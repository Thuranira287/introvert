import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AIAssistantService } from './ai-assistant.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AskAIDto } from './dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIAssistantController {
  private readonly logger = new Logger(AIAssistantController.name);

  constructor(private readonly aiService: AIAssistantService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  async askAI(@CurrentUser('id') userId: string, @Body() dto: AskAIDto) {
    // This endpoint is primarily for non-WebSocket clients.
    // For real-time streaming, use the /ai namespace WebSocket gateway.
    this.logger.log(`AI query from user: ${userId}`);

    const { stream, conversationId } = await this.aiService.streamResponse(
      userId,
      dto.message,
      dto.conversationId,
    );

    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk;
    }

    return {
      message: dto.message,
      response: fullResponse,
      conversationId,
    };
  }

  @Get('history')
  getConversationHistory(@CurrentUser('id') userId: string) {
    return this.aiService.getConversationHistory(userId);
  }

  @Delete('history')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearConversationHistory(@CurrentUser('id') userId: string) {
    await this.aiService.clearConversationHistory(userId);
    this.logger.log(`Conversation history cleared for user: ${userId}`);
  }

  @Get('recommendations')
  getRecommendations(@CurrentUser('id') userId: string) {
    return this.aiService.getRecommendations(userId);
  }
}
