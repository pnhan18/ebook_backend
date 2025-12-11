export class AuthResponseDto {
  accessToken: string;
  user: {
    id: number;
    email: string;
    username: string;
    avatar: string | null;
    roles: string[];
    subscriptionPlan: string;
    status: string;
  };
}