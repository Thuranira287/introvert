import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EmailService } from './email.service';

jest.mock('axios');
const mockedPost = axios.post as jest.Mock;

const RESET_URL = 'https://app.example.com/reset-password?token=secret-token-value';

function buildService(settings: Record<string, string | undefined>): EmailService {
  const config = { get: (key: string) => settings[key] };
  return new EmailService(config as unknown as ConfigService);
}

describe('EmailService', () => {
  const originalEnv = process.env.NODE_ENV;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(Logger.prototype, 'log');
    warnSpy = jest.spyOn(Logger.prototype, 'warn');
    errorSpy = jest.spyOn(Logger.prototype, 'error');
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  describe('when configured', () => {
    const settings = { RESEND_API_KEY: 're_test_key', EMAIL_FROM: 'App <no-reply@example.com>' };

    it('sends the reset link through Resend with the API key', async () => {
      mockedPost.mockResolvedValue({ status: 200 });

      await buildService(settings).sendPasswordReset('user@example.com', RESET_URL);

      const [url, body, options] = mockedPost.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      expect(body).toMatchObject({ from: 'App <no-reply@example.com>', to: ['user@example.com'] });
      expect(body.html).toContain(RESET_URL);
      expect(options.headers.Authorization).toBe('Bearer re_test_key');
    });

    it('escapes the link when embedding it in HTML', async () => {
      mockedPost.mockResolvedValue({ status: 200 });

      await buildService(settings).sendPasswordReset('user@example.com', 'https://x.test/?a=1&b="2"');

      expect(mockedPost.mock.calls[0][1].html).toContain('a=1&amp;b=&quot;2&quot;');
    });

    it('does not throw when delivery fails, and never logs the reset link or the full address', async () => {
      mockedPost.mockRejectedValue(new Error('provider down'));

      await expect(buildService(settings).sendPasswordReset('user@example.com', RESET_URL)).resolves.toBeUndefined();

      const logged = JSON.stringify(errorSpy.mock.calls);
      expect(logged).not.toContain('secret-token-value');
      expect(logged).not.toContain('user@example.com');
    });
  });

  describe('sendEmailVerification', () => {
    it('sends the verification link through Resend', async () => {
      mockedPost.mockResolvedValue({ status: 200 });

      await buildService({ RESEND_API_KEY: 're_test_key' }).sendEmailVerification(
        'user@example.com',
        'https://app.example.com/verify-email?token=abc',
      );

      const body = mockedPost.mock.calls[0][1];
      expect(body.to).toEqual(['user@example.com']);
      expect(body.html).toContain('https://app.example.com/verify-email?token=abc');
    });

    it('never logs the link in production when unconfigured', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      await buildService({}).sendEmailVerification('user@example.com', 'https://x.test/verify-email?token=top-secret');

      expect(JSON.stringify([...logSpy.mock.calls, ...warnSpy.mock.calls])).not.toContain('top-secret');
    });
  });

  describe('when not configured', () => {
    it('skips sending in production and never logs the reset link', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      await buildService({}).sendPasswordReset('user@example.com', RESET_URL);

      expect(mockedPost).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(JSON.stringify([...logSpy.mock.calls, ...warnSpy.mock.calls])).not.toContain('secret-token-value');
    });

    it('prints the link for developers outside production', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

      await buildService({}).sendPasswordReset('user@example.com', RESET_URL);

      expect(mockedPost).not.toHaveBeenCalled();
      expect(JSON.stringify(logSpy.mock.calls)).toContain('secret-token-value');
    });
  });
});
