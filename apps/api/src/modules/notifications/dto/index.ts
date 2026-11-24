import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsEnum(['IOS', 'ANDROID', 'WEB'])
  platform: 'IOS' | 'ANDROID' | 'WEB';
}
