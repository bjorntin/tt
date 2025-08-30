import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import {
  setupDatabase,
  buildImageScanQueue,
  registerBackgroundTask,
} from "../../services/pii/scanner";
import { getDatabase } from "../../services/pii/database";
import { useFocusEffect } from "expo-router";

// Define the shape of the context data
type ImageContextData = {
  unlockedUris: string[];
  unlockImage: (uri: string) => void;
  lockImage: (uri: string) => void;
  lockAllImages: () => void;
  securityMode: boolean;
  toggleSecurityMode: () => void;
  scannerProgress: {
    processed: number;
    total: number;
  };
  getImageStatus: (uri: string) => Promise<string | null>;
  updateScannerProgress: () => Promise<void>;
};

// Create the context with a default value
const ImageContext = createContext<ImageContextData | undefined>(undefined);

// Define the props for the provider component
type ImageContextProviderProps = {
  children: ReactNode;
};

/**
 * Provider component that wraps the app and provides image-related state.
 * This will manage the unlocked state for viewing censored images and
 * will trigger the initial PII scan.
 */
export const ImageContextProvider = ({
  children,
}: ImageContextProviderProps) => {
  const [unlockedUris, setUnlockedUris] = useState<string[]>([]);
  const [securityMode, setSecurityMode] = useState(true);
  const [imageStatuses, setImageStatuses] = useState<Map<string, string>>(
    new Map(),
  );
  const [scannerProgress, setScannerProgress] = useState({
    processed: 0,
    total: 0,
  });

  const updateScannerProgress = useCallback(async () => {
    // Disable scanner progress updates to prevent SQLite errors
    setScannerProgress({ total: 0, processed: 0 });
  }, []);

  // This effect runs once on startup to initialize the database and task.
  useEffect(() => {
    const initialize = async () => {
      // Temporarily disable PII scanner to prevent SQLite errors
      console.warn("PII Scanner disabled due to SQLite compatibility issues");
      // await setupDatabase();
      // await buildImageScanQueue();
      // await registerBackgroundTask();
      // await updateScannerProgress();
    };

    initialize();
  }, [updateScannerProgress]);

  // This effect runs whenever the screen is focused, and sets up polling.
  useFocusEffect(
    useCallback(() => {
      // Update progress immediately when the screen is focused
      updateScannerProgress();

      // Set up an interval to poll for progress every 5 seconds
      const intervalId = setInterval(() => {
        updateScannerProgress();
      }, 5000); // 5 seconds

      // Clean up the interval when the screen is unfocused
      return () => clearInterval(intervalId);
    }, [updateScannerProgress]),
  );

  const getImageStatus = async (uri: string): Promise<string | null> => {
    // Disable PII status checking to prevent SQLite errors
    return null;
  };

  const unlockImage = (uri: string) => {
    setUnlockedUris((prev) => [...prev, uri]);
  };

  const lockImage = (uri: string) => {
    setUnlockedUris((prev) =>
      prev.filter((unlockedUri) => unlockedUri !== uri),
    );
  };

  const lockAllImages = () => {
    setUnlockedUris([]);
  };

  const toggleSecurityMode = () => {
    setSecurityMode((prev) => !prev);
    lockAllImages();
  };

  const value = {
    unlockedUris,
    unlockImage,
    lockImage,
    lockAllImages,
    securityMode,
    toggleSecurityMode,
    scannerProgress,
    getImageStatus,
    updateScannerProgress,
  };

  return (
    <ImageContext.Provider value={value}>{children}</ImageContext.Provider>
  );
};

/**
 * Custom hook to easily access the ImageContext data.
 */
export const useImageContext = () => {
  const context = useContext(ImageContext);
  if (context === undefined) {
    throw new Error(
      "useImageContext must be used within an ImageContextProvider",
    );
  }
  return context;
};
