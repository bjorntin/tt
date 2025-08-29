# PII Scanner Integration Plan

This document outlines the step-by-step plan and system design for the on-device PII scanning feature.

## System Design and Integration

The PII Scanner is designed as a self-contained module that integrates with the existing application fabric primarily through a new React Context provider. This approach minimizes direct modifications to core components and promotes a clean separation of concerns.

### Core Architecture

The system is built on four main pillars:

1. **`ImageContextProvider`**: This is the central integration point. It is wrapped around the root layout (`_layout.tsx`), making its state and functions available to the entire component tree. On application startup, it orchestrates the initialization of the entire PII scanning process.

2. **`scanner.ts` Service**: This service encapsulates all the heavy lifting. It is responsible for:
    * **Database Setup**: Creating and managing the `pii-scanner.db` SQLite database.
    * **Queue Management**: Populating the image scan queue by fetching assets from the `MediaLibrary`.
    * **Background Task Logic**: Defining the code that runs periodically to process the image queue.

3. **Background Task (`background-pii-scan`)**: Registered via `expo-task-manager`, this task operates independently of the main application UI. It runs in the background, consuming the image queue in small batches, and updates the database with the results. It is designed to be resource-conscious, only running when the device is charging and on Wi-Fi.

4. **UI Integration Hooks & Components**:
    * `usePiiStatus.ts`: A custom hook that allows any component to query the database and get the scan status of a specific image URI.
    * **Image Components** (`ExpoImageComponent`, `RNImageComponent`, etc.): These have been modified to use the `usePiiStatus` and `useImageContext` hooks. They are now responsible for applying a `blurRadius` to themselves if an image is flagged with PII and the gallery is not in an "unlocked" state.
    * `ImagesGalleryHeader.tsx`: This component now includes the unlock button, which uses `useImageContext` to toggle the censorship state globally.

### Data Flow

1. **App Start**: `ImageContextProvider` mounts.
2. **Initialization**: The provider calls `setupDatabase`, `buildImageScanQueue`, and `registerBackgroundTask` from the `scanner.ts` service.
3. **Background Processing**: The OS periodically triggers the `background-pii-scan` task. The task processes images and updates their status in the SQLite database.
4. **Gallery Render**: As the user scrolls, `ImageComponent` instances mount.
5. **Status Check**: Each `ImageComponent` calls `usePiiStatus` to get its PII status from the database.
6. **Conditional Blurring**: The component checks the PII status and the `isUnlocked` state from `useImageContext` to decide whether to render with a blur effect.
7. **User Unlock**: The user taps the unlock button in the header, which calls `toggleUnlock` on the context, causing all visible image components to re-render without the blur effect.

This architecture ensures that the PII scanning logic is decoupled from the UI, robust to app closures, and efficient in its use of system resources.

## Required Libraries

The following libraries are required for this feature and have been installed:
* `expo-sqlite`
* `expo-task-manager`
* `expo-background-fetch`
* `expo-battery`
* `expo-network`
* `expo-notifications`

## Implementation Tasks

* [x] **1. Project Scaffolding & Dependencies**
* [x] **2. Database and Queue Management**
* [x] **3. Background Task & Automatic Startup**
* [x] **4. Gallery Integration & Censorship**
* [x] **5. Unlock Mechanism**
