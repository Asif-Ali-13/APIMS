/**
 * Mongoose-backed persistence for users; implements {@link IUserRepository}.
 *
 * @module services/auth/repository/UserRepository
 */
import { Model } from "mongoose";
import type { IUserRepository } from "./IUserRepository.ts";

import logger from "../../../shared/config/logger.ts";
import User, { IUser, UserRole } from "../../../shared/models/User.ts";

export class MongoUserRepository implements IUserRepository {
    private readonly model: Model<IUser>;

    /**
     * @param model - Mongoose model; defaults to the app `User` model for production use.
     */
    constructor(model: Model<IUser> = User) {
        this.model = model;
    }


    /**
     * Persists a user. 
     * If `role` is super admin and `permissions` are omitted, fills default flags.
     */
    async create(userData: Partial<IUser>): Promise<IUser> {
        try {
            const data: Partial<IUser> = { ...userData };

            if (data.role === UserRole.SUPER_ADMIN && !data.permissions) {
                data.permissions = {
                    canCreateApiKeys: true,
                    canManageUsers: true,
                    canViewAnalytics: true,
                    canExportData: true,
                };
            }

            const user = new this.model(data);
            await user.save();

            logger.info("User created", { username: user.username });
            return user;
        } 
        catch (error) {
            logger.error("Error creating user", error);
            throw error;
        }
    }


    /** Load one user by Mongo `_id`. */
    async findById(userId: string): Promise<IUser | null> {
        try {
            return await this.model.findById(userId).exec();
        } 
        catch (error) {
            logger.error("Error finding user by id", error);
            throw error;
        }
    }


    /** Case-sensitive match on `username`. */
    async findByUsername(username: string): Promise<IUser | null> {
        try {
            return await this.model.findOne({ username }).exec();
        } 
        catch (error) {
            logger.error("Error finding user by username", error);
            throw error;
        }
    }


    /** Exact match on `email`. */
    async findByEmail(email: string): Promise<IUser | null> {
        try {
            return await this.model.findOne({ email }).exec();
        } 
        catch (error) {
            logger.error("Error finding user by email", error);
            throw error;
        }
    }


    /** Active users only; omits `password` from the projection. */
    async findAll(): Promise<IUser[]> {
        try {
            return (
                await this.model.find({ isActive: true }).select("-password")
                    .lean().exec()
            ) as unknown as IUser[];
        } 
        catch (error) {
            logger.error("Error finding users", error);
            throw error;
        }
    }

    
    /** 
     * `true` if the collection has at least one document 
     * (used to gate super-admin bootstrap). 
     */
    async hasAnyUser(): Promise<boolean> {
        const count = await this.model.countDocuments().exec();
        return count > 0;
    }
}
