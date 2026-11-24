import { Module } from '@nestjs/common';
import { AnonymousMessagingService } from './anonymous-messaging.service';
import { AnonymousMessagingController } from './anonymous-messaging.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AnonymousMessagingController],
  providers: [AnonymousMessagingService],
  exports: [AnonymousMessagingService],
})
export class AnonymousMessagingModule {}
