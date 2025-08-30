import * as MediaLibrary from "expo-media-library";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { getBatteryStateAsync, BatteryState } from "expo-battery";
import { getNetworkStateAsync, NetworkStateType } from "expo-network";
import { getDatabase, initializeDatabase } from "./database";

/**
 * Initializes the database and creates the 'images' table if it doesn't exist.
 * This function now runs asynchronously.
 */
export const setupDatabase = async () => {
  const success = await initializeDatabase();
  if (!success) {
    console.warn("Failed to initialize PII scanner database");
  }
};

/**
 * Fetches all images from the Media Library and adds them to the SQLite database
 * for background scanning. It fetches images in pages to handle large galleries
 * efficiently.
 */
export const buildImageScanQueue = async () => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    // Permission not granted.
    return;
  }

  let hasNextPage = true;
  let after: MediaLibrary.AssetRef | undefined = undefined;

  while (hasNextPage) {
    const assets = await MediaLibrary.getAssetsAsync({
      mediaType: "photo",
      first: 100, // Fetch in pages of 100
      after,
    });

    if (assets.assets.length > 0) {
      // Use a transaction to batch the inserts for better performance.
      const database = await getDatabase();
      if (database) {
        try {
          await database.withTransactionAsync(async () => {
            for (const asset of assets.assets) {
              await database.runAsync(
                "INSERT OR IGNORE INTO images (uri, status) VALUES (?, ?);",
                asset.uri,
                "pending",
              );
            }
          });
        } catch (error) {
          console.warn("Failed to insert images into database:", error);
        }
      }
      after = assets.endCursor;
      hasNextPage = assets.hasNextPage;
    } else {
      hasNextPage = false;
    }
  }
};

export const BACKGROUND_SCAN_TASK = "background-pii-scan";

// Define the background task
export async function runScannerBatch() {
  // eslint-disable-next-line no-console
  console.log("--- Manual PII Scan Started ---");
  try {
    // 1. Fetch all 'pending' images from the database
    const database = await getDatabase();
    if (!database) {
      console.warn("Database not available for PII scanning");
      return;
    }
    
    const pendingImages = await database.getAllAsync<{ id: number; uri: string }>(
      "SELECT * FROM images WHERE status = ?;",
      "pending",
    );

    // eslint-disable-next-line no-console
    console.log(
      `[SCANNER] Found ${pendingImages.length} pending images to process.`,
    );

    if (pendingImages.length === 0) {
      // eslint-disable-next-line no-console
      console.log("[SCANNER] No more images to process.");
      return;
    }

    // 2. Process all images
    for (const image of pendingImages) {
      // eslint-disable-next-line no-console
      console.log(`[SCANNER] Processing image ID: ${image.id}`);
      await database.runAsync(
        "UPDATE images SET status = ? WHERE id = ?;",
        "processing",
        image.id,
      );

      // THIS IS WHERE THE ACTUAL PII PIPELINE WOULD RUN
      // For now, we'll simulate a result.
      // To test, rename a file to include "_pii_test" in its name.
      const isTestImage = image.uri.includes("_pii_test");
      const hasPii = isTestImage || Math.random() > 0.95; // 5% chance for non-test images
      const newStatus = hasPii ? "pii_found" : "scanned_clean";

      await database.runAsync(
        "UPDATE images SET status = ? WHERE id = ?;",
        newStatus,
        image.id,
      );
      // eslint-disable-next-line no-console
      console.log(`[SCANNER] Image ID: ${image.id} marked as ${newStatus}`);
    }

    // eslint-disable-next-line no-console
    console.log("--- Manual PII Scan Finished ---");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[SCANNER] Manual scan failed with error:", error);
  }
}

TaskManager.defineTask(BACKGROUND_SCAN_TASK, async () => {
  // eslint-disable-next-line no-console
  console.log("--- Background PII Scan Task Started ---");
  try {
    const batteryState = await getBatteryStateAsync();
    const networkState = await getNetworkStateAsync();

    const isCharging = batteryState === BatteryState.CHARGING;
    const isWifi = networkState.type === NetworkStateType.WIFI;

    // eslint-disable-next-line no-console
    console.log(
      `[SCANNER] Conditions: Is Charging? ${isCharging}, Is WiFi? ${isWifi}`,
    );

    if (!isCharging && !isWifi) {
      // eslint-disable-next-line no-console
      console.log("[SCANNER] Conditions not met. Postponing task.");
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    await runScannerBatch();

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[SCANNER] Task failed with error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Registers the background task to run periodically.
 */
export async function registerBackgroundTask() {
  try {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(BACKGROUND_SCAN_TASK);
    if (isRegistered) {
      return;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_SCAN_TASK, {
      minimumInterval: 15 * 60, // 15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (error) {
    // Failed to register task
  }
}

/**
 * Resets the status of all images to 'pending' to allow a full rescan.
 */
export async function rescanAllPhotos() {
  try {
    const database = await getDatabase();
    if (!database) {
      console.warn("Database not available for rescan");
      return;
    }
    
    await database.execAsync("UPDATE images SET status = 'pending';");
    // eslint-disable-next-line no-console
    console.log(
      "[SCANNER] All images have been reset to 'pending' for rescan.",
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[SCANNER] Failed to reset images for rescan:", error);
  }
}
