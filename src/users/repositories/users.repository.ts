import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { IUsersRepository, UserWithRoles } from '../interfaces/user-repository.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, User} from '@prisma/client';

@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<UserWithRoles> {
    const role = await this.prismaService.role.findFirst({
      where: {
        name: 'user',
      },
    });

    if (!role) {
      throw new InternalServerErrorException('something wrong');
    }

    return await this.prismaService.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: data.password,
        signupMethod: data.signupMethod,
        avatar: data.avatar,
        roles: {
          create: [
            { role: { connect: { id: role.id } }}
          ]
        }
      },
      include: {
        roles: {
          include: {
            role: true
          },
        },
      },
    });
  }

  async findByEmail(email: string): Promise<UserWithRoles | null> {
    return this.prismaService.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async findByUsername(username: string): Promise<UserWithRoles | null> {
    return this.prismaService.user.findUnique({
      where: { username },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async update(id: number, data: Partial<User>): Promise<UserWithRoles> {
    return this.prismaService.user.update({
      where: { id },
      data,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }
}
