import {
  Injectable,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export const INTROVERT_PSYCHOLOGY_SYSTEM_PROMPT = `You are a compassionate and empathetic AI assistant specializing in supporting introverts. Your role is to:

1. Help users overcome social anxiety and build confidence
2. Provide evidence-based strategies for social interaction
3. Offer supportive guidance without judgment
4. Suggest practical techniques for gradually exposing oneself to social situations
5. Validate the user's feelings and experiences
6. Encourage self-care and mental wellness
7. Recommend professional help when appropriate

Guidelines:
- Be warm, understanding, and genuinely supportive
- Avoid being patronizing or dismissive
- Ask clarifying questions to better understand the user's situation
- Provide actionable advice when appropriate
- Acknowledge that introversion is a natural personality trait, not a flaw
- Help users leverage their introverted strengths
- Encourage balance between solitude and social connection
- Be honest about limitations - suggest professional mental health support when needed

Remember: You are not a replacement for professional mental health care. If a user expresses suicidal thoughts or severe mental health crisis, always recommend they contact a mental health professional or crisis hotline.`;

@Injectable()
export class AIAssistantService {
  private readonly logger = new Logger(AIAssistantService.name);
  private openaiClient: AxiosInstance;
  private ollamaClient: AxiosInstance;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.openaiClient = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        Authorization: `Bearer ${this.configService.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
    });

    this.ollamaClient = axios.create({
      baseURL: this.configService.get('OLLAMA_BASE_URL'),
      timeout: 60000,
    });
  }

  /**
   * Stream response from LLM
   * Uses OpenAI if API key available, otherwise falls back to Ollama
   */
  async streamResponse(
    userId: string,
    userMessage: string,
    conversationId?: string,
  ): Promise<{ stream: AsyncGenerator<string>; conversationId: string }> {
    try {
      // Resolve or create the conversation thread. conversationId is a
      // client-facing key distinct from the row's `id` so a client can
      // reference a conversation before it exists in the database (first turn).
      const resolvedConversationId = conversationId || crypto.randomUUID();

      let conversationHistory: any[] = [];
      if (conversationId) {
        const conversation = await this.prisma.aiConversation.findUnique({
          where: { conversationId },
        });
        if (conversation) {
          // Prisma returns Json fields already deserialized — no JSON.parse needed.
          conversationHistory = (conversation.messages as any[]) ?? [];
        }
      }

      const messages = [
        { role: 'system', content: INTROVERT_PSYCHOLOGY_SYSTEM_PROMPT },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];

      const useOpenAI = Boolean(this.configService.get('OPENAI_API_KEY'));
      const stream = useOpenAI
        ? this.streamOpenAI(messages, userId, resolvedConversationId)
        : this.streamOllama(messages, userId, resolvedConversationId);

      return { stream, conversationId: resolvedConversationId };
    } catch (error) {
      this.logger.error('Error streaming response:', error);
      throw new InternalServerErrorException('Failed to get AI response');
    }
  }

  /**
   * Stream from OpenAI
   */
  private async *streamOpenAI(
    messages: any[],
    userId: string,
    conversationId: string,
  ): AsyncGenerator<string> {
    try {
      const response = await this.openaiClient.post(
        '/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 2000,
        },
        {
          responseType: 'stream',
        },
      );

      let fullResponse = '';

      for await (const line of response.data) {
        const text = line.toString();
        if (text.startsWith('data: ')) {
          const jsonStr = text.slice(6);
          if (jsonStr === '[DONE]') break;

          try {
            const json = JSON.parse(jsonStr);
            const chunk = json.choices?.[0]?.delta?.content;
            if (chunk) {
              fullResponse += chunk;
              yield chunk;
            }
          } catch {
            // A partial stream chunk is not valid JSON yet; wait for the next one.
          }
        }
      }

      await this.saveConversation(userId, conversationId, messages, fullResponse, 'gpt-4o-mini');
    } catch (error) {
      this.logger.error('OpenAI streaming error:', error);
      throw error;
    }
  }

  /**
   * Stream from Ollama (local LLM)
   */
  private async *streamOllama(
    messages: any[],
    userId: string,
    conversationId: string,
  ): AsyncGenerator<string> {
    try {
      const response = await this.ollamaClient.post(
        '/api/chat',
        {
          model: this.configService.get('LLM_MODEL') || 'llama2:7b-chat',
          messages,
          stream: true,
        },
        {
          responseType: 'stream',
        },
      );

      let fullResponse = '';

      for await (const line of response.data) {
        const text = line.toString();
        try {
          const json = JSON.parse(text);
          const chunk = json.message?.content;
          if (chunk) {
            fullResponse += chunk;
            yield chunk;
          }
        } catch {
          // A partial stream chunk is not valid JSON yet; wait for the next one.
        }
      }

      await this.saveConversation(userId, conversationId, messages, fullResponse, 'ollama');
    } catch (error) {
      this.logger.error('Ollama streaming error:', error);
      throw error;
    }
  }

  /**
   * Persist (or extend) a conversation thread, keyed by conversationId.
   */
  private async saveConversation(
    userId: string,
    conversationId: string,
    messages: any[],
    response: string,
    model: string,
  ) {
    try {
      // `messages` here already includes the system prompt (index 0) plus
      // history plus the latest user turn — strip the system prompt before
      // persisting so it isn't duplicated/re-sent as history next time.
      const [, ...conversationTurns] = messages;
      const updatedMessages = [...conversationTurns, { role: 'assistant', content: response }];
      const tokensUsed = this.estimateTokens(response);

      await this.prisma.aiConversation.upsert({
        where: { conversationId },
        create: {
          userId,
          conversationId,
          messages: updatedMessages,
          model,
          tokensUsed,
        },
        update: {
          messages: updatedMessages,
          model,
          tokensUsed: { increment: tokensUsed },
        },
      });
    } catch (error) {
      this.logger.error('Error saving conversation:', error);
      // Don't throw - conversation still happened
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(userId: string, limit = 10) {
    return this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        messages: true,
        createdAt: true,
      },
    });
  }

  /**
   * Clear conversation history
   */
  async clearConversationHistory(userId: string) {
    await this.prisma.aiConversation.deleteMany({
      where: { userId },
    });

    this.logger.log(`Conversation history cleared for user: ${userId}`);
  }

  /**
   * Get AI-powered recommendations for user
   */
  async getRecommendations(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const interests = user.profile?.interests || [];

    const [recommendedBlogs, recommendedCommunities, recommendedEvents] =
      await Promise.all([
        this.prisma.blog.findMany({
          where: {
            status: 'PUBLISHED',
            ...(interests.length > 0 && { tags: { hasSome: interests.slice(0, 3) } }),
          },
          take: 5,
          include: {
            author: {
              select: { username: true, profile: { select: { avatarUrl: true } } },
            },
          },
        }),

        this.prisma.community.findMany({
          where: { visibility: 'PUBLIC' },
          take: 5,
        }),

        // Recommend upcoming events — introverts often prefer online events, so
        // surface those first without excluding in-person ones entirely.
        this.prisma.event.findMany({
          where: { startsAt: { gte: new Date() }, status: 'UPCOMING' },
          take: 5,
          orderBy: [{ isOnline: 'desc' }, { startsAt: 'asc' }],
        }),
      ]);

    return {
      blogs: recommendedBlogs,
      communities: recommendedCommunities,
      events: recommendedEvents,
    };
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}
