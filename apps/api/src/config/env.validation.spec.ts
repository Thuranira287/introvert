import { validate } from './env.validation';

const setNodeEnv = (value: string | undefined) => {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
};

describe('validate', () => {
  const originalEnv = process.env.NODE_ENV;
  const valid = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'a'.repeat(32),
    CORS_ORIGIN: 'https://app.example.com',
  };

  afterEach(() => {
    setNodeEnv(originalEnv);
    jest.restoreAllMocks();
  });

  describe('in production', () => {
    beforeEach(() => setNodeEnv('production'));

    it('accepts a complete, strong configuration', () => {
      expect(() => validate(valid)).not.toThrow();
    });

    it('requires CORS_ORIGIN so credentials are never reflected to arbitrary origins', () => {
      const { CORS_ORIGIN, ...withoutCors } = valid;

      expect(() => validate(withoutCors)).toThrow('CORS_ORIGIN');
    });

    it('rejects a short JWT_SECRET', () => {
      expect(() => validate({ ...valid, JWT_SECRET: 'short' })).toThrow('at least 32 characters');
    });

    it('rejects a short JWT_REFRESH_SECRET', () => {
      expect(() => validate({ ...valid, JWT_REFRESH_SECRET: 'short' })).toThrow('JWT_REFRESH_SECRET');
    });

    it('fails fast when a required variable is missing', () => {
      const { DATABASE_URL, ...withoutDatabase } = valid;

      expect(() => validate(withoutDatabase)).toThrow();
    });
  });

  describe('in development', () => {
    it('warns instead of crashing when variables are missing', () => {
      setNodeEnv('development');
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      expect(() => validate({})).not.toThrow();
      expect(warn).toHaveBeenCalled();
    });
  });
});
