import { User, Prisma } from '@prisma/client';

export type UserWithRoles = User & {
  roles: {
    role: {
      id: number;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }[];
};

export interface IUsersRepository {
  create(data: Prisma.UserCreateInput): Promise<UserWithRoles>;
  findByEmail(email: string): Promise<UserWithRoles | null>;
  findByUsername(username: string): Promise<UserWithRoles | null>;
  update(id: number, data: Partial<User>): Promise<UserWithRoles>;
}
