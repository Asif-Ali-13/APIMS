import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * Enum representing allowed HTTP methods
 */
export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
  OPTIONS = "OPTIONS",
  HEAD = "HEAD",
}

/**
 * Interface representing a single API hit document
 */
export interface IApiHit extends Document {
  eventId: string;
  timestamp: Date;
  serviceName: string;
  endpoint: string;
  method: HttpMethod;
  statusCode: number;
  latencyMs: number;
  clientId: Types.ObjectId;
  apiKeyId: Types.ObjectId;
  ip: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose schema for API hit tracking
 */
const apiHitSchema: Schema<IApiHit> = new Schema({
    eventId:     { type: String, required: true, unique: true, index: true },

    /** Timestamp when API was hit */
    timestamp:   { type: Date, required: true },
    serviceName: { type: String, required: true, index: true },
    endpoint:    { type: String, required: true, index: true },
    method: {
        type: String,
        required: true,
        enum: Object.values(HttpMethod),
    },

    /** HTTP response status code */
    statusCode: { type: Number, required: true, index: true },
    latencyMs:  { type: Number, required: true },
    clientId:   { type: Schema.Types.ObjectId, required: true, ref: 'Client', index: true },
    apiKeyId:   { type: Schema.Types.ObjectId, required: true, ref: 'ApiKey', index: true },
    
    /** IP address of the requester */
    ip:         { type: String, required: true },
    userAgent:  { type: String, default: '' },

}, { timestamps: true, collection: 'api_hits' });

/**
 * Compound indexes for optimized queries
 */
apiHitSchema.index({ clientId: 1, serviceName: 1, endpoint: 1, timestamp: -1 });
apiHitSchema.index({ clientId: 1, timestamp: -1, statusCode: 1 });
apiHitSchema.index({ apiKeyId: 1, timestamp: -1 });
/**
 * TTL index to automatically delete documents after 30 days
 */
apiHitSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

const ApiHit: Model<IApiHit> = mongoose.model<IApiHit>("ApiHit", apiHitSchema);
export default ApiHit;
