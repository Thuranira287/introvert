import { Module } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { AnalyticsService } from './analytics.service';
import { MonetizationService } from './monetization.service';
import { PaymentsService } from './payments.service';
import { CreatorController } from './creator.controller';
import { CreatorCronService } from './creator-cron.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [CreatorController],
  providers: [AchievementsService, AnalyticsService, MonetizationService, PaymentsService, CreatorCronService],
  exports: [AchievementsService, AnalyticsService, MonetizationService],
})
export class CreatorModule {}
