import { IsEmail, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;
}
