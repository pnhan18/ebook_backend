export interface AuthenticatedUser {
  id: number;
  email: string;
  username: string;
  roles: string[];
  status: string;
  subscriptionPlan: string;
  avatar: string | null;
}
