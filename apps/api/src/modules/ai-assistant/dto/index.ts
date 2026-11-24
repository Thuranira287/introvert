import { IsString, MinLength, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AskAIDto {
  @ApiProperty({
    description: 'Message to send to AI',
    example: 'How do I overcome social anxiety at parties?',
    minLength: 5,
  })
  @IsString()
  @MinLength(5)
  message: string;

  @ApiProperty({
    description: 'Optional conversation ID to continue a conversation',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
