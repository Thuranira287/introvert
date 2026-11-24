import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AIAssistantService } from './ai-assistant.service';
import { AIAssistantController } from './ai-assistant.controller';

@Module({
  imports: [PrismaModule],
  providers: [AIAssistantService],
  controllers: [AIAssistantController],
  exports: [AIAssistantService],
})
export class AIAssistantModule {}
