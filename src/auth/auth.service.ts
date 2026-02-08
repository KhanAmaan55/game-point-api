import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload, AuthTokens, SafeUser } from './types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptRounds: number;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.bcryptRounds = this.configService.get<number>('security.bcryptRounds') ?? 12;
  }

  /**
   * Register a new user with secure password hashing
   */
  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const { email, username, name, password } = registerDto;

    // Check for existing user (email or username)
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(username ? [{ username }] : []),
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email already registered');
      }
      if (existingUser.username === username) {
        throw new ConflictException('Username already taken');
      }
    }

    // Hash password securely (bcrypt with 12+ rounds)
    const passwordHash = await bcrypt.hash(password, this.bcryptRounds);

    // Create user
    await this.prisma.user.create({
      data: {
        email,
        username,
        name,
        passwordHash,
      },
    });

    this.logger.log(`User registered: ${this.maskEmail(email)}`);
    return { message: 'Registration successful' };
  }

  /**
   * Validate user credentials (used by LocalStrategy)
   * Supports login via email OR username
   */
  async validateUser(emailOrUsername: string, password: string): Promise<SafeUser | null> {
    // Check rate limiting
    const attempts = await this.getLoginAttempts(emailOrUsername);
    const maxAttempts = this.configService.get<number>('rateLimit.login.max') ?? 5;

    if (attempts >= maxAttempts) {
      this.logger.warn(`Login rate limit exceeded: ${emailOrUsername}`);
      throw new UnauthorizedException('Too many login attempts. Please try again later.');
    }

    // Find user by email or username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { username: emailOrUsername },
        ],
      },
    });

    // Use constant-time comparison to prevent timing attacks
    if (!user) {
      await this.incrementLoginAttempts(emailOrUsername);
      // Perform dummy hash to maintain constant time
      await bcrypt.hash('dummy', this.bcryptRounds);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      await this.incrementLoginAttempts(emailOrUsername);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Clear login attempts on successful login
    await this.clearLoginAttempts(emailOrUsername);

    // Remove sensitive fields
    const { passwordHash, refreshTokenHash, resetPasswordTokenHash, resetPasswordExpiresAt, ...result } = user;
    return result;
  }

  /**
   * Login and generate JWT tokens with refresh token rotation
   */
  async login(user: SafeUser): Promise<AuthTokens> {
    const tokens = await this.generateTokens(user);
    
    // Hash and store refresh token
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, this.bcryptRounds);
    
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    this.logger.log(`User logged in: ${user.id}`);
    return tokens;
  }

  /**
   * Refresh access token using refresh token (with rotation)
   */
  async refreshTokens(userId: number, refreshToken: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Access denied');
    }

    // Verify refresh token
    const isTokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (!isTokenValid) {
      // Potential token reuse - invalidate all refresh tokens
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshTokenHash: null },
      });
      this.logger.warn(`Refresh token reuse detected for user: ${userId}`);
      throw new UnauthorizedException('Access denied');
    }

    // Generate new tokens (rotation)
    const { passwordHash, refreshTokenHash, resetPasswordTokenHash, resetPasswordExpiresAt, ...userWithoutSensitive } = user;
    const tokens = await this.generateTokens(userWithoutSensitive);

    // Hash and store new refresh token
    const newRefreshTokenHash = await bcrypt.hash(tokens.refreshToken, this.bcryptRounds);
    
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    this.logger.log(`Tokens refreshed for user: ${userId}`);
    return tokens;
  }

  /**
   * Logout user by invalidating refresh token
   */
  async logout(userId: number): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    this.logger.log(`User logged out: ${userId}`);
    return { message: 'Logout successful' };
  }

  /**
   * Forgot password - generate secure token and send email
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    // Check rate limiting
    const attempts = await this.getResetAttempts(email);
    const maxAttempts = this.configService.get<number>('rateLimit.reset.max') ?? 3;

    if (attempts >= maxAttempts) {
      this.logger.warn(`Password reset rate limit exceeded: ${this.maskEmail(email)}`);
      // Return generic message to prevent enumeration
      return { message: 'If an account exists with this email, a password reset link has been sent.' };
    }

    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return generic message to prevent account enumeration
    if (!user) {
      await this.incrementResetAttempts(email);
      return { message: 'If an account exists with this email, a password reset link has been sent.' };
    }

    // Generate cryptographically secure reset token (32 bytes = 64 hex chars)
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token before storing
    const resetPasswordTokenHash = await bcrypt.hash(resetToken, this.bcryptRounds);
    
    // Set expiration (10 minutes from now)
    const expirationMs = this.configService.get<number>('security.resetPasswordExpiration') ?? 600000;
    const resetPasswordExpiresAt = new Date(Date.now() + expirationMs);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordTokenHash,
        resetPasswordExpiresAt,
      },
    });

    // Send email with plain token (user receives this, not the hash)
    await this.mailService.sendPasswordResetEmail(email, resetToken);
    await this.incrementResetAttempts(email);

    this.logger.log(`Password reset email sent to ${this.maskEmail(email)}`);
    return { message: 'If an account exists with this email, a password reset link has been sent.' };
  }

  /**
   * Reset password using token (single-use)
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    // Find user with non-expired token
    const users = await this.prisma.user.findMany({
      where: {
        resetPasswordExpiresAt: {
          gte: new Date(), // Token not expired
        },
        NOT: {
          resetPasswordTokenHash: null,
        },
      },
    });

    // Verify token against all potential users (constant-time)
    let matchedUser: SafeUser | null = null;
    for (const user of users) {
      if (user.resetPasswordTokenHash) {
        const isValid = await bcrypt.compare(token, user.resetPasswordTokenHash);
        if (isValid) {
          matchedUser = user;
          break;
        }
      }
    }

    if (!matchedUser) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, this.bcryptRounds);

    // Update password and clear reset token (single-use)
    await this.prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        passwordHash,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
        refreshTokenHash: null, // Invalidate all sessions
      },
    });

    this.logger.log(`Password reset successful for user: ${matchedUser.id}`);
    return { message: 'Password reset successful' };
  }

  /**
   * Generate JWT access and refresh tokens
   */
  private async generateTokens(user: SafeUser): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.accessSecret') || '',
        expiresIn: this.configService.get<string>('jwt.accessExpiration') || '15m',
      } as any),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret') || '',
        expiresIn: this.configService.get<string>('jwt.refreshExpiration') || '7d',
      } as any),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Rate limiting helpers using Redis
   */
  private async getLoginAttempts(identifier: string): Promise<number> {
    const key = `login_attempts:${identifier}`;
    const attempts = await this.cacheManager.get<number>(key);
    return attempts || 0;
  }

  private async incrementLoginAttempts(identifier: string): Promise<void> {
    const key = `login_attempts:${identifier}`;
    const windowMs = this.configService.get<number>('rateLimit.login.windowMs') ?? 900000;
    const attempts = (await this.cacheManager.get<number>(key)) || 0;
    await this.cacheManager.set(key, attempts + 1, windowMs);
  }

  private async clearLoginAttempts(identifier: string): Promise<void> {
    const key = `login_attempts:${identifier}`;
    await this.cacheManager.del(key);
  }

  private async getResetAttempts(email: string): Promise<number> {
    const key = `reset_attempts:${email}`;
    const attempts = await this.cacheManager.get<number>(key);
    return attempts || 0;
  }

  private async incrementResetAttempts(email: string): Promise<void> {
    const key = `reset_attempts:${email}`;
    const windowMs = this.configService.get<number>('rateLimit.reset.windowMs') ?? 3600000;
    const attempts = (await this.cacheManager.get<number>(key)) || 0;
    await this.cacheManager.set(key, attempts + 1, windowMs);
  }

  /**
   * Mask email for logging (security)
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }
}