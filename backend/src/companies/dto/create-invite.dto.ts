import { IsIn, IsOptional } from 'class-validator';
import type { UserRole } from '../../users/entities/user.entity';

export class CreateInviteDto {
  @IsOptional()
  @IsIn(['admin', 'member'])
  role?: UserRole;
}
