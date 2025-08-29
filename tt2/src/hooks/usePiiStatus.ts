import { useState, useEffect } from "react";
import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("pii-scanner.db");

/**
 * A hook to get the PII scan status for a specific image URI.
 * It queries the database and returns the status (e.g., 'pii_found').
 *
 * @param uri The URI of the image to check.
 * @returns The scan status of the image.
 */
export const usePiiStatus = (uri: string) => {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const getStatus = async () => {
      const result = await db.getFirstAsync<{ status: string }>(
        "SELECT status FROM images WHERE uri = ?;",
        uri,
      );
      setStatus(result ? result.status : null);
    };

    getStatus();
  }, [uri]);

  return status;
};
