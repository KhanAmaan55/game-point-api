import type { UserModel as PrismaUser } from '../../generated/prisma/models';

/**
 * JWT Payload structure
 */
export interface JwtPayload {
  sub: number;
  email: string;
  username?: string | null;
  iat?: number;
  exp?: number;
}

/**
 * Authentication token pair
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * User type without sensitive fields
 * This represents the complete User model from Prisma with sensitive fields removed
 */
export type SafeUser = Omit<
  PrismaUser,
  'passwordHash' | 'refreshTokenHash' | 'resetPasswordTokenHash' | 'resetPasswordExpiresAt'
>;

/**
 * Refresh token validation result
 */
export interface RefreshTokenPayload {
  userId: number;
  refreshToken: string;
}