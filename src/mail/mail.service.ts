import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('mail.user'),
        pass: this.configService.get<string>('mail.password'),
      },
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const appUrl = this.configService.get<string>('appUrl');
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('mail.from'),
        to: email,
        subject: 'Password Reset Request',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50;">Password Reset Request</h2>
                <p>You requested to reset your password. Click the button below to reset it:</p>
                <div style="margin: 30px 0;">
                  <a href="${resetUrl}" 
                     style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    Reset Password
                  </a>
                </div>
                <p style="color: #7f8c8d; font-size: 14px;">
                  This link will expire in 10 minutes.
                </p>
                <p style="color: #7f8c8d; font-size: 14px;">
                  If you didn't request this, please ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
                <p style="color: #95a5a6; font-size: 12px;">
                  For security reasons, this link can only be used once.
                </p>
              </div>
            </body>
          </html>
        `,
        text: `
          Password Reset Request
          
          You requested to reset your password. Use the link below to reset it:
          ${resetUrl}
          
          This link will expire in 10 minutes.
          If you didn't request this, please ignore this email.
        `,
      });

      this.logger.log(`Password reset email sent to ${this.maskEmail(email)}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email: ${error.message}`);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Masks email for logging (e.g., test@example.com -> t***@example.com)
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }
}