/**
 * Extends the built-in ErrorConstructor type to include
 * the optional V8-specific `captureStackTrace` method.
 */
type ErrorWithStackTrace = ErrorConstructor & {
    captureStackTrace?: (target: object, constructorOpt?: Function) => void;
};


/**
 * Custom application error class for handling operational errors.
 *
 * This class standardizes error structure across the application,
 * including HTTP status codes and optional detailed error messages.
 */
class AppError extends Error {
    /**
     * HTTP status code associated with the error.
     */
    public readonly statusCode: number;
    /**
     * Optional list of detailed error messages (e.g., validation errors).
     */
    public readonly errors: string[] | null;
    /**
     * Indicates whether the error is operational (expected) or a programming error.
     */
    public readonly isOperational: boolean;

    /**
     * Creates a new AppError instance.
     *
     * @param message - Human-readable error message
     * @param statusCode - HTTP status code (default: 500)
     * @param errors - Optional array of detailed error messages
     */
    constructor(
        message: string, 
        statusCode: number = 500, 
        errors: string[] | null = null
    ) {
        super(message);

        // Set the error name to the class name (useful for debugging/logging)
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = true;
        
        /**
         * Use V8-specific stack trace optimization if available.
         *
         * This removes the constructor call from the stack trace,
         * making error logs cleaner and easier to read.
         */
        const errorConstructor = Error as ErrorWithStackTrace;
        errorConstructor.captureStackTrace?.(this, this.constructor);
    }
}

export default AppError;
