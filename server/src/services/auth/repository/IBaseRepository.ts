/**
 * Generic repository interface for data access layer.
 *
 * Provides common CRUD operations that are applicable
 * across all entities.
 *
 * @template T - Entity type (e.g., User, Product)
 * @template ID - Type of the entity's unique identifier (default: string)
 */
export interface IBaseRepository<T, ID = string> {

    /**
     * Creates a new record in the database.
     *
     * @param data - Partial data used to create the entity
     * @returns Promise resolving to the created entity
     */
    create(data: Partial<T>): Promise<T>;

    /**
     * Finds a record by its unique identifier.
     *
     * @param id - Unique identifier of the entity
     * @returns Promise resolving to the entity or null if not found
     */
    findById(id: ID): Promise<T | null>;

    /**
     * Retrieves all records.
     *
     * @returns Promise resolving to an array of entities
     */
    findAll(): Promise<T[]>;
}
