import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_FROM = 'Introvert Corner <no-reply@introvertcorner.app>';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain ?? ''}`;
}

/**
 * Transactional email via Resend. Delivery failures are logged but never
 * thrown: callers such as forgot-password must respond identically whether
 * or not an address exists, so an email error must not change the response.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey?: string;
  private readonly from: string;
  private readonly isProduction: boolean;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('RESEND_API_KEY') || undefined;
    this.from = config.get<string>('EMAIL_FROM') || DEFAULT_FROM;
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    if (!this.apiKey && !this.isProduction) {
      // Local development convenience only; reset links are never logged in production.
      this.logger.log(`Password reset link for ${maskEmail(to)}: ${resetUrl}`);
    }

    const safeUrl = escapeHtml(resetUrl);
    await this.send(
      to,
      'Reset your Introvert Corner password',
      `<p>We received a request to reset your password.</p>
<p><a href="${safeUrl}">Choose a new password</a></p>
<p>This link expires in one hour. If you didn't request it, you can safely ignore this email.</p>`,
    );
  }

  async sendEmailVerification(to: string, verifyUrl: string): Promise<void> {
    if (!this.apiKey && !this.isProduction) {
      this.logger.log(`Email verification link for ${maskEmail(to)}: ${verifyUrl}`);
    }

    await this.send(
      to,
      'Verify your Introvert Corner email',
      `<p>Welcome to Introvert Corner.</p>
<p><a href="${escapeHtml(verifyUrl)}">Verify your email address</a></p>
<p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`,
    );
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(`Email "${subject}" to ${maskEmail(to)} was not sent: RESEND_API_KEY is not configured`);
      return;
    }

    try {
      await axios.post(
        RESEND_ENDPOINT,
        { from: this.from, to: [to], subject, html },
        { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: REQUEST_TIMEOUT_MS },
      );
    } catch (error) {
      this.logger.error(`Failed to send email "${subject}" to ${maskEmail(to)}`, (error as Error).message);
    }
  }
}
