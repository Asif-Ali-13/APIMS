/**
 * Password validation result structure.
 */
interface IPasswordValidationResult {
    success: boolean;
    errors: string[];
}

/**
 * Password requirement configuration.
 */
interface IPasswordRequirements {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
}

/**
 * Utility class for security-related helpers.
 */
class SecurityUtils {
    
    /**
     * Safely parses boolean environment variables.
     *
     * @param value - Environment variable value
     * @param defaultValue - Default fallback
     * @returns { boolean }
     */
    private static parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
        if (value === undefined) return defaultValue;
        return value.toLowerCase() === "true";
    }

    /**
     * Password policy configuration loaded from environment variables.
     */
    static readonly PASSWORD_REQUIREMENTS: IPasswordRequirements = {
        minLength: Number(process.env.PASSWORD_MIN_LENGTH ?? 8),
        requireUppercase: this.parseBoolean(process.env.PASSWORD_REQUIRE_UPPERCASE, true),
        requireLowercase: this.parseBoolean(process.env.PASSWORD_REQUIRE_LOWERCASE, true),
        requireNumbers: this.parseBoolean(process.env.PASSWORD_REQUIRE_NUMBERS, true),
        requireSymbols: this.parseBoolean(process.env.PASSWORD_REQUIRE_SYMBOLS, true),
    };

    /**
     * Validates a password against defined security requirements.
     *
     * @param password - Password string to validate
     * @returns { PasswordValidationResult } Validation result
     */
    static validatePassword(password: string): IPasswordValidationResult {
        const errors: string[] = [];
        const requirements = this.PASSWORD_REQUIREMENTS;

        if (!password) {
            return {
                success: false,
                errors: ["Password is required"]
            }
        }

        if (password.length < requirements.minLength) {
            errors.push(`Password must be at least ${requirements.minLength} chars long!`)
        }

        if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (requirements.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (requirements.requireNumbers && !/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (requirements.requireSymbols && !/[^A-Za-z0-9]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        // Common weak passwords blacklist
        const weakPasswords: ReadonlySet<string> = new Set([
            'password', '123456', 'qwerty', 'admin', 'letmein',
            'password123', 'admin123', '12345678', 'welcome'
        ]);

        if (weakPasswords.has(password.toLowerCase())) {
            errors.push('Password is too common and easily guessable');
        }

        return {
            success: errors.length === 0,
            errors,
        };
    }
}

export default SecurityUtils;
