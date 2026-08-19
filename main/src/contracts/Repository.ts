export interface Repository<T> {
  /**
   * Finds an entity by its unique string identifier.
   */
  findById(id: string): Promise<T | null>;

  /**
   * Retrieves all entities from the table store.
   */
  findAll(): Promise<T[]>;

  /**
   * Creates a new entity row in the database.
   */
  create(entity: T): Promise<void>;

  /**
   * Deletes an entity row matching the target identifier.
   */
  delete(id: string): Promise<void>;
}
