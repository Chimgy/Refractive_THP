import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  // Browser clients send the refresh token via the httpOnly cookie instead;
  // kept optional here as an explicit fallback for non-browser callers.
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
