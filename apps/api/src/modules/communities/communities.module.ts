import { Module } from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { CommunitiesController } from './communities.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { CreatorModule } from '../creator/creator.module';

@Module({
  imports: [NotificationsModule, CreatorModule],
  controllers: [CommunitiesController],
  providers: [CommunitiesService],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
