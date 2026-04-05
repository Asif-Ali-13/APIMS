import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * Settings subdocument for a client
 */
interface IClientSettings {
  dataRetentionDays: number;
  alertsEnabled: boolean;
  timezone: string;
}

/**
 * Main Client document interface
 */
export interface IClient extends Document {
  name: string;
  slug: string;
  email: string;
  description?: string;
  website?: string;
  createdBy: Types.ObjectId;
  isActive: boolean;
  settings: IClientSettings;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Client Schema
 */
const clientSchema: Schema<IClient> = new Schema({
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    
    /** URL-friendly unique identifier */
    slug: { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true, 
        match: /^[a-z0-9-]+$/ 
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, maxlength: 500, default: "" },
    
    /** Website URL */
    website:   { type: String, default: "" },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    isActive:  { type: Boolean, required: true },

    /** Client-specific settings */
    settings: {
        dataRetentionDays: { type: Number, default: 30, min: 7, max: 365, },
        alertsEnabled: { type: Boolean, default: true, },
        timezone: { type: String, default: 'UTC', },
    },

}, { timestamps: true, collection: "clients" });

/**
 * Index for filtering active clients
 */
clientSchema.index({ isActive: 1 });
/**
 * Model
 */
const Client: Model<IClient> = mongoose.model<IClient>("Client", clientSchema);

export default Client;

