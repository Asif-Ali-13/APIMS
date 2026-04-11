/**
 * Auth domain service: validation rules, user orchestration, JWT issuance.
 * Uses DTOs at boundaries; 
 * {@link IUser} stays behind the repository and {@link toUserPublicDto}.
 *
 * @module services/auth/service/authService
 */
import config from "../../../shared/config/index.ts";
import logger from "../../../shared/config/logger.ts";
import AppError from "../../../shared/utils/appError.ts";
import { APPLICATION_ROLES } from "../../../shared/constants/roles.ts";
import type { IUser, UserRole } from "../../../shared/models/User.ts";

import type {
    OnboardSuperAdminBodyDto,
    RegisterBodyDto,
    LoginBodyDto,
} from "../dto/authRequestDto.ts";
import type { JwtAccessPayload } from "../dto/jwtPayload.ts";
import type { AuthSuccessDto, UserPublicDto } from "../dto/authResponseDto.ts";

import jwt, { type SignOptions } from "jsonwebtoken";
import { toUserPublicDto } from "../mapper/userMapper.ts";
import type { IUserRepository } from "../repository/IUserRepository.ts";


/** Constructor dependencies for {@link AuthService}. */
export interface AuthServiceDeps {
    /** Persistence for users. */
    userRepository: IUserRepository;
}

export class AuthService {
    private readonly userRepository: IUserRepository;

    /**
     * @param deps - Must include `userRepository`.
     * @throws Error if `userRepository` is missing.
     */
    constructor(deps: AuthServiceDeps) {
        if (!deps?.userRepository) {
            throw new Error("userRepository is required");
        }
        this.userRepository = deps.userRepository;
    }


    /** Shape stored in the access token; includes `clientId` when present on the user. */
    private buildJwtPayload(user: IUser): JwtAccessPayload {
        const base = {
            userId: String(user._id),
            username: user.username,
            email: user.email,
            role: user.role,
        };
        
        return user.clientId
            ? { ...base, clientId: String(user.clientId) }
            : base;
    }


    /** Signs a JWT using app `config.jwt` (secret + expiry). */
    private signAccessToken(user: IUser): string {
        const payload = this.buildJwtPayload(user);
        const signOptions: SignOptions = {
            expiresIn: config.jwt.expiresIn as NonNullable<SignOptions["expiresIn"]>,
        };
        return jwt.sign(payload, config.jwt.secret, signOptions);
    }


    /** Public user DTO plus signed access token. */
    private toAuthSuccess(user: IUser): AuthSuccessDto {
        return {
            user: toUserPublicDto(user),
            token: this.signAccessToken(user),
        };
    }


    /**
     * Creates the first super admin when the user collection is empty.
     * @throws AppError 403 when any user already exists.
     */
    async onboardSuperAdmin(input: OnboardSuperAdminBodyDto): Promise<AuthSuccessDto> {
        try {
            if (await this.userRepository.hasAnyUser()) {
                // 403: The client does not have access rights to the content. 
                throw new AppError("Super admin onboarding is disabled", 403);
            }

            const user = await this.userRepository.create({
                username: input.username,
                email: input.email,
                password: input.password,
                role: APPLICATION_ROLES.SUPER_ADMIN,
            });

            logger.info("Admin onboarded successfully", { username: user.username });
            return this.toAuthSuccess(user);
        } 
        catch (error) {
            logger.error("Error in onboarding Super admin", error);
            throw error;
        }
    }


    /**
     * Registers a new user with optional role (defaults to client viewer).
     * @throws AppError 409 when username or email is taken.
     */
    async register(input: RegisterBodyDto): Promise<AuthSuccessDto> {
        try {
            const role: UserRole = input.role ?? APPLICATION_ROLES.CLIENT_VIEWER;

            const existingUser = await this.userRepository.findByUsername(input.username);
            if (existingUser) {
                // 409: The request could not be completed 
                // due to a conflict with the current state of the resource.
                throw new AppError("Username already exists", 409);
            }

            const existingEmail = await this.userRepository.findByEmail(input.email);
            if (existingEmail) {
                throw new AppError("Email already exists", 409);
            }

            const user = await this.userRepository.create({
                username: input.username,
                email: input.email,
                password: input.password,
                role,
            });

            logger.info("User registered successfully", { username: user.username });
            return this.toAuthSuccess(user);
        } 
        catch (error) {
            logger.error("Error in Register service", error);
            throw error;
        }
    }


    /**
     * Authenticates by username and password; inactive accounts are rejected.
     * @throws AppError 401 for bad credentials, 403 if deactivated.
     */
    async login(input: LoginBodyDto): Promise<AuthSuccessDto> {
        try {
            const user = await this.userRepository.findByUsername(input.username);

            if (!user) {
                // 401: The request requires user authentication information.
                throw new AppError("Invalid credentials", 401);
            }

            if (!user.isActive) {
                throw new AppError("Account is deactivated", 403);
            }

            const isPasswordValid = await user.comparePassword(input.password);
            if (!isPasswordValid) {
                throw new AppError("Invalid credentials", 401);
            }

            logger.info("User loggedIn successfully", { username: user.username });
            return this.toAuthSuccess(user);
        } 
        catch (error) {
            logger.error("Error in Login service", error);
            throw error;
        }
    }


    /**
     * Returns a safe user projection for the given id.
     * @throws AppError 404 when the user does not exist.
     */
    async getProfile(userId: string): Promise<UserPublicDto> {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new AppError("User not found", 404);
            }
            return toUserPublicDto(user);
        }
        catch (error) {
            logger.error("Error getting user profile:", error);
            throw error;
        }
    }

    /**
     * Returns true if the given user exists and has SUPER_ADMIN role.
     * @throws AppError 404 when the user does not exist.
     */
    async checkSuperAdminPermissions(userId: string): Promise<boolean> {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new AppError("User not found", 404);
            }
            return user.role === APPLICATION_ROLES.SUPER_ADMIN;
        } 
        catch (error) {
            logger.error("Error checking super admin permissions:", error);
            throw error;
        }
    }
}
