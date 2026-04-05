import mongoose, { Schema, Document, Model, Types } from "mongoose";
import bcrypt from "bcryptjs";
import SecurityUtils from "../utils/securityUtils.ts";

/**
 * User roles
 */
export enum UserRole {
  SUPER_ADMIN = "super_admin",
  CLIENT_ADMIN = "client_admin",
  CLIENT_VIEWER = "client_viewer",
}

/**
 * Permissions subdocument
 */
interface IUserPermissions {
  canCreateApiKeys: boolean;
  canManageUsers: boolean;
  canViewAnalytics: boolean;
  canExportData: boolean;
}

/**
 * User document interface
 */
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  clientId?: Types.ObjectId;
  isActive: boolean;
  permissions: IUserPermissions;
  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidate: string): Promise<boolean>;
}

/**
 * User Schema
 */
const userSchema: Schema<IUser> = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        validate: {
            validator: function (userName: string) {
                return /^[a-zA-Z0-9_.-]+$/.test(userName);
            },
            message: "Please enter a valid username"
        }
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function (email: string) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            },
            message: "Please enter a valid email"
        }
    },

    /** Hashed password */
    password: {
        type: String,
        required: true,
        minlength: 6,
        validate: {
            validator: function (this: any, password: string) {
                if (this.isModified('password') && password && !password.startsWith('$2a$')) {
                    const validation = SecurityUtils.validatePassword(password)
                    return validation.success
                };
                return true
            },
            message: function (props: any) {
                if (props.value && !props.value.startsWith('$2a$')) {
                    const validation = SecurityUtils.validatePassword(props.value)
                    // ["Password is required", "Password must contain at least one uppercase letter"]
                    // "Password is required. Password must contain at least one uppercase letter."
                    return validation.errors.join(". ");
                };
                return "Password validation failed"
            }
        },
    },

    /** Role-based access */
    role: {
        type: String,
        enum: Object.values(UserRole),
        default: UserRole.CLIENT_VIEWER,
    },
    clientId: {
        type: Schema.Types.ObjectId,
        ref: "Client",
        required: function (this: IUser) {
            return this.role !== UserRole.SUPER_ADMIN;
        }
    },
    isActive: { type: Boolean, default: true, },

    /** Permissions */
    permissions: {
        canCreateApiKeys: { type: Boolean, default: false, },
        canManageUsers: { type: Boolean, default: false, },
        canViewAnalytics: { type: Boolean, default: true, },
        canExportData: { type: Boolean, default: false, },
    },

}, { timestamps: true, collection: "users" });

/**
 * Pre-save hook to hash password
 */
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.pre("findOneAndUpdate", async function () {
    const update: any = this.getUpdate();

    if (update?.password && !update.password.startsWith("$2")) {
        const salt = await bcrypt.genSalt(10);
        update.password = await bcrypt.hash(update.password, salt);
    }
});


/**
 * Compare password method
 */
userSchema.methods.comparePassword = async function (
    candidate: string
): Promise<boolean> {
    return bcrypt.compare(candidate, this.password);
};


/**
 * Indexes
 */
userSchema.index({ clientId: 1, isActive: 1 });
userSchema.index({ role: 1 })


/**
 * Model
 */
const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);

export default User;
