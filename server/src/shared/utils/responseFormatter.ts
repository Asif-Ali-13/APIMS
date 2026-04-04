/**
 * Pagination metadata structure.
 */
export interface IPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

/**
 * Generic API response structure.
 */
export interface IResponseData<T = unknown, E = unknown> {
    success: boolean;
    message?: string;
    data?: T;
    error?: E;
    pagination?: IPagination;
    statusCode: number;
    timestamp: string;
}

/**
 * Utility class to standardize API responses.
 */
class ResponseFormatter {

    /**
     * Formats a successful response.
     *
     * @template T - Type of response data
     * @param data - Response payload
     * @param message - Optional success message
     * @param statusCode - HTTP status code
     * 
     * @returns { IResponseData<T> }
     */
    static success<T>(
        data: T,
        message: string = "Success", 
        statusCode: number = 200
    ): IResponseData<T> {
        return {
            success: true,
            message,
            data,
            statusCode,
            timestamp: new Date().toISOString()
        }
    }

    /**
     * Formats an error response.
     *
     * @template E - Type of error details
     * 
     * @param message - Error message
     * @param statusCode - HTTP status code
     * @param error - Optional error details
     * 
     * @returns { IResponseData<null, E> }
     */
    static error<E = unknown>(
        message: string = "Error", 
        statusCode: number = 500, 
        error?: E
    ): IResponseData<null, E> {
        const base = {
            success: false as const,
            message,
            statusCode,
            timestamp: new Date().toISOString(),
        };

        if (error !== undefined) {
            return { ...base, error };
        }
        
        return base;
    }

    /**
     * Formats a validation error response.
     *
     * @param errors - Validation errors
     * @returns { IResponseData<null, string[]> }
     */
    static validationError(
        errors: string[] = []
    ): IResponseData<null, string[]> {
        return {
            success: false,
            message: "Validation failed",
            error: errors,
            statusCode: 400,
            timestamp: new Date().toISOString()
        }
    }

    /**
     * Formats a paginated response.
     *
     * @template T - Type of data array
     * 
     * @param data  - Paginated data
     * @param page  - Current page number
     * @param limit - Items per page
     * @param total - Total number of records
     * 
     * @returns { IResponseData<T[]> }
     */
    static paginated<T>(
        data: T[], 
        page: number, 
        limit: number, 
        total: number
    ): IResponseData<T[]> {
        return {
            success: true,
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            statusCode: 200,
            timestamp: new Date().toISOString()
        }
    }
}

export default ResponseFormatter;
