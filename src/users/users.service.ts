import { Inject, Injectable } from '@nestjs/common';
import { SignupMethod } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ConflictException } from 'src/common';
import type { IUsersRepository } from './interfaces/user-repository.interface';
import { SafeUser } from './types/safe-user.type';

@Injectable()
export class UsersService {
    constructor(
    @Inject('IUsersRepository')
    private usersRepository: IUsersRepository,
  ) {}

    async create({
      email,
      username,
      password,
      signupMethod = SignupMethod.EMAIL,
    }: {
    email: string;
    username: string;
    password: string;
    signupMethod?: SignupMethod;
  }): Promise<SafeUser> {
    const existingEmail = await this.usersRepository.findByEmail(email);
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const existingUsername = await this.usersRepository.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.usersRepository.create({
      email,
      username,
      password: hashedPassword,
      signupMethod,
    });

    // Remove password and format roles
    const { password: _, roles, ...safeUser } = user;

    return {
      ...safeUser,
      roles: roles.map(r => r.role)
    }
  }
}
