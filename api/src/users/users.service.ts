import { Inject, Injectable } from '@nestjs/common';
import { SignupMethod, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ConflictException, StorageUrlHelper } from 'src/common';
import type { IUsersRepository } from './interfaces/user-repository.interface';
import { SafeUser } from './types/safe-user.type';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class UsersService {
  private readonly urlHelper: StorageUrlHelper;

  constructor(
    @Inject('IUsersRepository')
    private usersRepository: IUsersRepository,
    private readonly storageService: StorageService,
  ) {
    this.urlHelper = new StorageUrlHelper(storageService);
  }

  private transformUserUrls(user: SafeUser): SafeUser {
    return this.urlHelper.transformToPublicUrls(user, ['avatar']);
  }

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

    const transformedUser = {
      ...safeUser,
      roles: roles.map(r => r.role)
    };

    return this.transformUserUrls(transformedUser);
  }

  async findByEmailWithPassword(email: string) {
    return await this.usersRepository.findByEmail(email);
  }

  async updateLastLogin(userId: number): Promise<void> {
    await this.usersRepository.update(userId, {
      lastLoginAt: new Date(),
    });
  }

  async findById(id: number): Promise<SafeUser | null> {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      return null;
    }

    const { password: _, roles, ...safeUser } = user;

    const transformedUser = {
      ...safeUser,
      roles: roles.map((r) => r.role),
    };

    return this.transformUserUrls(transformedUser);
  }

  async findByIdWithPassword(id: number) {
    return await this.usersRepository.findById(id);
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.usersRepository.update(userId, {
      password: hashedPassword,
    });
  }

  async saveResetToken(userId: number, hashedToken: string, expiresAt: Date): Promise<void> {
    await this.usersRepository.update(userId, {
      resetPasswordToken: hashedToken,
      resetPasswordExpiresAt: expiresAt,
    });
  }

  async findByResetToken(hashedToken: string) {
    return await this.usersRepository.findByResetToken(hashedToken);
  }

  async resetPassword(userId: number, hashedPassword: string): Promise<void> {
    await this.usersRepository.update(userId, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiresAt: null,
    });
  }

  // ==================== PAYMENT RELATED ====================

  /**
   * Get full user data including stripeCustomerId (for internal use only)
   */
  async findByIdRaw(id: number) {
    return await this.usersRepository.findById(id);
  }

  /**
   * Find user by Stripe customer ID
   */
  async findByStripeCustomerId(stripeCustomerId: string) {
    return await this.usersRepository.findByStripeCustomerId(stripeCustomerId);
  }

  /**
   * Update user's Stripe customer ID
   */
  async updateStripeCustomerId(
    userId: number,
    stripeCustomerId: string,
  ): Promise<void> {
    await this.usersRepository.update(userId, { stripeCustomerId });
  }

  /**
   * Update user's subscription plan
   */
  async updateSubscriptionPlan(
    userId: number,
    plan: 'FREE' | 'PREMIUM',
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      subscriptionPlan: plan,
    });
  }
}
