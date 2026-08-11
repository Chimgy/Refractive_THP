import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @MinLength(2)
  companyName: string;

  @IsString()
  @MinLength(1)
  displayName: string;

  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;
}
