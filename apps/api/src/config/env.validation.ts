import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 4000;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET?: string;

  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;

  @IsString()
  @IsOptional()
  OLLAMA_BASE_URL?: string;

  @IsString()
  @IsOptional()
  FIREBASE_PROJECT_ID?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  DISABLE_CRON?: string;

  @IsString()
  @IsOptional()
  RESEND_API_KEY?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL?: string;
}

const MIN_PRODUCTION_SECRET_LENGTH = 32;

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    // In development, warn instead of crashing so partial .env setups still run.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(errors.toString());
    }
    // eslint-disable-next-line no-console
    console.warn('[env] Missing/invalid environment variables:', errors.map((e) => e.property).join(', '));
  }

  if (process.env.NODE_ENV === 'production') {
    if (!validatedConfig.CORS_ORIGIN) {
      throw new Error('CORS_ORIGIN must be set in production');
    }

    const weak = (['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const).filter((key) => {
      const value = validatedConfig[key];
      return value !== undefined && value.length < MIN_PRODUCTION_SECRET_LENGTH;
    });
    if (weak.length > 0) {
      throw new Error(`${weak.join(', ')} must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`);
    }
  }

  return validatedConfig;
}
