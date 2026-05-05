import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * Environment types for API keys
 */
export enum Environment {
  PRODUCTION = "production",
  STAGING = "staging",
  DEVELOPMENT = "development",
  TESTING = "testing",
}

/**
 * Permissions subdocument
 */
interface IApiKeyPermissions {
  canIngest: boolean;
  canReadAnalytics: boolean;
  allowedServices: string[];
}

/**
 * Security subdocument
 */
interface IApiKeySecurity {
  allowedIPs: string[];
  allowedOrigins: string[];
  lastRotated: Date;
  rotationWarningDays: number;
}

/**
 * Metadata subdocument
 */
interface IApiKeyMetadata {
  createdBy?: Types.ObjectId;
  purpose?: string;
  tags?: string[];
}

/**
 * Main API Key document interface
 */
export interface IApiKey extends Document {
  keyId: string;
  keyValue: string;
  clientId: Types.ObjectId;
  name: string;
  description?: string;
  environment: Environment;
  isActive: boolean;
  permissions: IApiKeyPermissions;
  security: IApiKeySecurity;
  expiresAt: Date;
  metadata?: IApiKeyMetadata;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  isExpired(): boolean;
}

/**
 * API Key Schema
 */
const apiKeySchema: Schema<IApiKey> = new Schema({
    /** Public identifier for API key */
    keyId: { type: String, required: true, unique: true, index: true },

    /** Secret API key value */
    keyValue: { type: String, required: true, unique: true, index: true },
    clientId: { type: Types.ObjectId, required: true, ref: 'Client', index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 500, default: '' },

    /** Deployment environment */
    environment: { 
        type: String, 
        enum: Object.values(Environment), 
        default: Environment.PRODUCTION 
    },
    isActive: { type: Boolean, default: true },

    /** Permissions */
    permissions: {
        canIngest: { type: Boolean, default: true },
        canReadAnalytics: { type: Boolean, default: false },
        allowedServices: [{ type: String, trim: true }],
    },

    /** Security settings */
    security: {
        allowedIPs: [{
            type: String,
            validate: {
                validator: function (v: string) {
                    return /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(v) ||
                        v === '0.0.0.0/0';
                },
                message: 'Invalid IP address format'
            }
        }],
        allowedOrigins: [{
            type: String,
            validate: {
                validator: function (v: string) {
                    return /^https?:\/\/[^\s]+$/.test(v) || v === '*';
                },
                message: 'Invalid origin format'
            }
        }],
        /** Last time key was rotated */
        lastRotated: { type: Date, default: Date.now, },
        /** Days before rotation warning */
        rotationWarningDays: { type: Number, default: 30, },
    },

    /** Expiration date */
    expiresAt: {
        type: Date,
        default: () => {
            const days = parseInt(process.env.API_KEY_EXPIRY_DAYS || '365');
            return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        },
        index: true,
    },

    /** Additional metadata */
    metadata: {
        createdBy: { type: Types.ObjectId, ref: 'User', },
        purpose: { type: String, trim: true, maxlength: 200, },
        tags: [{ type: String, trim: true, maxlength: 50, }],
    },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true, },

}, { timestamps: true, collection: 'api_keys' });


/**
 * Indexes for performance optimization
 */
apiKeySchema.index({ clientId: 1, isActive: 1 });
apiKeySchema.index({ keyValue: 1, isActive: 1 });
apiKeySchema.index({ environment: 1, clientId: 1 });
/**
 * TTL index - auto delete expired keys
 */
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })


apiKeySchema.methods.isExpired = function (this: IApiKey): boolean {
    if (!this.expiresAt) return false;
    return this.expiresAt.getTime() < Date.now();
};


/**
 * Model
 */
const ApiKey: Model<IApiKey> = mongoose.model<IApiKey>("ApiKey", apiKeySchema);

export default ApiKey;
