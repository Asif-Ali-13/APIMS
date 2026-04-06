import type { IUser } from "../../../shared/models/User";
import type { IBaseRepository } from "./IBaseRepository";


/**
 * Repository interface for User entity.
 *
 * Extends the generic {@link IBaseRepository} to include
 * user-specific query operations required by the Auth module.
 *
 * This abstraction ensures that the AuthService remains
 * independent of the underlying database implementation
 * (e.g., MongoDB, Mongoose).
 */
export interface IUserRepository extends IBaseRepository<IUser, string> {

    /**
     * Finds a user by username.
     *
     * @param username - Unique username of the user
     * @returns Promise resolving to the user or null if not found
     */
    findByUsername(username: string): Promise<IUser | null>;

    /**
     * Finds a user by email.
     * Commonly used for registration validation and login flows.
     *
     * @param email - Unique email address of the user
     * @returns Promise resolving to the user or null if not found
     */
    findByEmail(email: string): Promise<IUser | null>;

    /**
     * Checks whether any user exists in the system.
     *
     * Useful for bootstrapping logic such as:
     * - Allowing creation of the first Super Admin
     * - Preventing duplicate initial setups
     *
     * @returns Promise resolving to true if at least one user exists
     */
    hasAnyUser(): Promise<boolean>;
}
