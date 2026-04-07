import type { Types } from "mongoose";
import type { IUser } from "../../../shared/models/User.ts";
import type { UserPublicDto } from "../dto/authResponseDto.ts";


/**
 * Maps a User persistence entity (Mongoose document)
 * to a safe API response DTO.
 *
 * This transformation:
 * - Removes sensitive fields (e.g., password)
 * - Converts MongoDB ObjectIds to strings
 * - Ensures a stable and consistent response shape
 *
 * @param user - Mongoose User document
 * @returns UserPublicDto safe for API exposure
 */
export function toUserPublicDto(user: IUser): UserPublicDto {
    /**
     * Convert Mongoose document to plain object
     * and remove internal fields like __v
     */
    const plain = user.toObject({ versionKey: false });

    const {
        password: _omit,
        clientId,
        ...rest
    } = plain as IUser & { password?: string; clientId?: Types.ObjectId };

    /**
     * Construct API-safe DTO
     */
    const dto: UserPublicDto = {
        _id: String(user._id),
        username: rest.username,
        email: rest.email,
        role: rest.role,
        isActive: rest.isActive,
        permissions: rest.permissions,
        createdAt: rest.createdAt?.toISOString(),
        updatedAt: rest.updatedAt?.toISOString(),
    };

    if (clientId !== undefined && clientId !== null) {
        dto.clientId = String(clientId);
    }

    return dto;
}
