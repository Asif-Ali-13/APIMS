/**
 * Maps Client, ApiKey, and User persistence documents to client-module response DTOs.
 * Reuses {@link toUserPublicDto} for client-scoped users.
 *
 * @module services/client/mapper/clientMapper
 */
import type { Types } from "mongoose";
import type { IClient } from "../../../shared/models/Client.ts";
import type { IApiKey } from "../../../shared/models/ApiKey.ts";
import type { IUser } from "../../../shared/models/User.ts";
import { toUserPublicDto } from "../../auth/mapper/userMapper.ts";
import type {
    ApiKeyCreatedByPublicDto,
    ApiKeyCreatedDto,
    ApiKeyPublicDto,
    ClientApiKeyListItemDto,
    ClientPublicDto,
    ClientUserPublicDto,
} from "../dto/clientResponseDto.ts";


/**
 * Normalizes `createdBy` after `populate`: user subdocument → {@link ApiKeyCreatedByPublicDto};
 * bare `ObjectId` → id string with empty username/email.
 *
 * @param createdBy - Populated user, ObjectId, or null when ref is missing.
 */
function toApiKeyCreatedByPublicDto(createdBy: unknown): ApiKeyCreatedByPublicDto {
    if (createdBy == null) {
        return { _id: "", username: "", email: "" };
    }

    if (typeof createdBy === "object" && "_id" in createdBy) {
        const doc = createdBy as {
            _id: Types.ObjectId;
            username?: string;
            email?: string;
        };

        return {
            _id: String(doc._id),
            username: typeof doc.username === "string" ? doc.username : "",
            email: typeof doc.email === "string" ? doc.email : "",
        };
    }
    
    return {
        _id: String(createdBy),
        username: "",
        email: "",
    };
}


/**
 * Maps a Client document to {@link ClientPublicDto} (string ids, ISO timestamps).
 *
 * @param client - Mongoose `Client` document.
 */
export function toClientPublicDto(client: IClient): ClientPublicDto {
    const plain = client.toObject({ versionKey: false });
    const { createdBy, ...rest } = plain as IClient & { createdBy: Types.ObjectId };

    return {
        _id: String(client._id),
        name: rest.name,
        slug: rest.slug,
        email: rest.email,
        description: rest.description,
        website: rest.website,
        isActive: rest.isActive,
        createdBy: String(createdBy),
        createdAt: rest.createdAt?.toISOString(),
        updatedAt: rest.updatedAt?.toISOString(),
    };
}


/**
 * Delegates to {@link toUserPublicDto} so client user responses match auth.
 *
 * @param user - Mongoose `User` document.
 */
export function toClientUserPublicDto(user: IUser): ClientUserPublicDto {
    return toUserPublicDto(user);
}


/**
 * Maps an ApiKey document to {@link ApiKeyPublicDto} (no `keyValue`; `createdBy` as id string).
 *
 * @param apiKey - Mongoose `ApiKey` document (typically not populated on `createdBy`).
 */
export function toApiKeyPublicDto(apiKey: IApiKey): ApiKeyPublicDto {
    const plain = apiKey.toObject({ versionKey: false });
    const {
        keyValue: _omit,
        clientId,
        createdBy,
        environment,
        ...rest
    } = plain as IApiKey & {
        keyValue?: string;
        clientId: Types.ObjectId;
        createdBy: Types.ObjectId;
    };

    return {
        _id: String(apiKey._id),
        keyId: rest.keyId,
        clientId: String(clientId),
        name: rest.name,
        description: rest.description,
        environment: environment.toString(),
        isActive: rest.isActive,
        createdBy: String(createdBy),
        createdAt: rest.createdAt?.toISOString(),
        updatedAt: rest.updatedAt?.toISOString(),
    };
}


/**
 * Same as {@link toApiKeyPublicDto} plus the secret `keyValue` for the create response only.
 *
 * @param apiKey - Persisted key document including `keyValue`.
 */
export function toApiKeyCreatedDto(apiKey: IApiKey): ApiKeyCreatedDto {
    const plain = apiKey.toObject({ versionKey: false }) as IApiKey & { keyValue: string };
    return {
        ...toApiKeyPublicDto(apiKey),
        keyValue: plain.keyValue,
    };
}


/**
 * List row for API keys: base public fields with `createdBy` expanded when populated (username, email).
 *
 * @param apiKey - Document from {@link IApiKeyRepository.findByClientId} (populates `createdBy`).
 */
export function toClientApiKeyListItemDto(apiKey: IApiKey): ClientApiKeyListItemDto {
    const base = toApiKeyPublicDto(apiKey);
    const plain = apiKey.toObject({ versionKey: false }) as IApiKey & { createdBy: unknown };
    return {
        ...base,
        createdBy: toApiKeyCreatedByPublicDto(plain.createdBy),
    };
}
