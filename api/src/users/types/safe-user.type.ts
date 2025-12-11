import { Role, User } from '@prisma/client';

/**
 * SafeUser type - User without sensitive fields
 * Use this type for API responses to prevent password leakage
 */
export type SafeUser = Omit<User, 'password'> & {
    roles: Role[]
}