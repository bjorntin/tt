import * as SQLite from "expo-sqlite";

// Single database instance
let dbInstance: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;

/**
 * Get the database instance, creating it if it doesn't exist
 */
export const getDatabase = async (): Promise<SQLite.SQLiteDatabase | null> => {
  try {
    if (!dbInstance) {
      dbInstance = await SQLite.openDatabaseAsync("pii-scanner.db");
    }
    return dbInstance;
  } catch (error) {
    console.error("Failed to open database:", error);
    return null;
  }
};

/**
 * Initialize the database and create tables
 */
export const initializeDatabase = async (): Promise<boolean> => {
  try {
    if (isInitialized) {
      return true;
    }
    
    const db = await getDatabase();
    if (!db) {
      return false;
    }
    
    await db.execAsync(
      "CREATE TABLE IF NOT EXISTS images (id INTEGER PRIMARY KEY AUTOINCREMENT, uri TEXT UNIQUE, status TEXT, findings TEXT);"
    );
    
    isInitialized = true;
    return true;
  } catch (error) {
    console.error("Failed to initialize database:", error);
    return false;
  }
};

/**
 * Check if database is available and initialized
 */
export const isDatabaseAvailable = (): boolean => {
  return dbInstance !== null && isInitialized;
};