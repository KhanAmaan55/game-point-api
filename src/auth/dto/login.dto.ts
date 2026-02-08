// src/auth/dto/login.dto.ts
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(3, { message: 'Email or username must be at least 3 characters' })
  emailOrUsername: string;

  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string;
}

