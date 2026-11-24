import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendAnonymousMessageDto {
  @IsUUID()
  @IsNotEmpty()
  receiverId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  /** If true, the sender's identity is stored but withheld from the receiver's view. */
  @IsOptional()
  @IsBoolean()
  revealIdentity?: boolean;
}
