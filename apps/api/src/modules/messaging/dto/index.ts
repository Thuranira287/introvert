import { IsString, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  @IsNotEmpty()
  receiverId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}

export class MarkReadDto {
  @IsUUID()
  @IsNotEmpty()
  conversationUserId: string;
}

export class TypingDto {
  @IsUUID()
  @IsNotEmpty()
  receiverId: string;
}
