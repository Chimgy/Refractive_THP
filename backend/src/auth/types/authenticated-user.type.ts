import { UserRole } from '../../users/entities/user.entity';

export type AuthenticatedUser = {
  userId: string;
  email: string;
  role: UserRole;
  companyId: string;
  displayName: string | null;
};
