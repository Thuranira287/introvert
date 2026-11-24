import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  async check() {
    const dbHealthy = await this.checkDatabase();
    return {
      status: dbHealthy ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      database: dbHealthy ? 'connected' : 'unreachable',
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    const dbHealthy = await this.checkDatabase();
    return { ready: dbHealthy };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
