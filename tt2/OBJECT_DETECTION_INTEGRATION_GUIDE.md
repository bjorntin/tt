# Object Detection Screen Processing Integration Guide

This guide provides a comprehensive plan for integrating object detection screen processing into the tt2 project, following the architecture and patterns established in the existing PII scanner integration.

## Overview

The integration will add MLKit-powered object detection capabilities to the photo gallery app, allowing users to:

- Detect objects in existing images with bounding boxes and labels
- **Detect various privacy-sensitive content and automatically blur images for protection**
- Process images in the background similar to PII scanning
- Display detection results with visual overlays
- Use the stock Google MLKit model initially (no custom TFLite models needed)
- Support extensible privacy categories (people, documents, sensitive objects, etc.)

## System Architecture

### Core Components

Following the PII scanner pattern, the system consists of:

1. **ObjectDetectionContextProvider**: Central integration point wrapped around `_layout.tsx`
2. **objectDetectionService**: Handles database management, queue processing, and background tasks
3. **Background Task (`background-object-detection`)**: Processes images independently
4. **UI Components**: ObjectDetectionScreen, ObjectDetectionViewer, bounding box overlays

### Data Flow

```bash
App Start → ObjectDetectionContextProvider mounts
    ↓
Provider initializes → setupDatabase, buildImageQueue, registerBackgroundTask
    ↓
Background processing → OS triggers task → Process images → Update database
    ↓
Gallery render → ImageComponent checks detection status → Apply overlays
    ↓
User interaction → Toggle detection view → Show/hide bounding boxes
```

## Required Dependencies

Install the following packages (based on example app):

```bash
# Core MLKit packages for object detection and face detection
npm install @infinitered/react-native-mlkit-core
npm install @infinitered/react-native-mlkit-object-detection
npm install @infinitered/react-native-mlkit-face-detection

# Existing dependencies (already installed)
# expo-sqlite, expo-task-manager, expo-background-fetch, etc.
```

**Note**: We're using the stock Google MLKit models initially, so no custom TFLite models are required.

## Test Page for Easy Development

Before integrating into the main gallery, create a dedicated test page for easier development and testing:

#### ObjectDetectionTestScreen.tsx

```typescript
import React, { useState } from 'react';
import { View, Text, ScrollView, Switch } from 'react-native';
import { useObjectDetection } from '@infinitered/react-native-mlkit-object-detection';
import { ImageSelector } from '../components/ImageSelector';
import { Button } from '../components/Button';

export const ObjectDetectionTestScreen: React.FC = () => {
  const detector = useObjectDetection('default');
  const [image, setImage] = useState(null);
  const [results, setResults] = useState([]);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionMode, setDetectionMode] = useState<'object' | 'person'>('object');

  const processImage = async () => {
    if (!image?.uri || !detector?.isLoaded()) return;

    setIsProcessing(true);
    try {
      const detectionResults = await detector.detectObjects(image.uri);

      if (detectionMode === 'privacy') {
        // Define privacy categories for testing
        const privacyCategories = {
          person: ['person', 'man', 'woman'],
          document: ['document', 'paper', 'card'],
          financial: ['money', 'wallet', 'credit card'],
          medical: ['medicine', 'pill'],
          personal: ['phone', 'key']
        };

        // Collect all privacy-related detections
        const privacyResults = [];
        for (const [category, keywords] of Object.entries(privacyCategories)) {
          const categoryResults = detectionResults.filter(result =>
            result.labels.some(label =>
              keywords.some(keyword =>
                label.text.toLowerCase().includes(keyword)
              )
            )
          );

          categoryResults.forEach(result => {
            privacyResults.push({
              ...result,
              category,
              label: `${category}: ${result.labels[0]?.text} (${Math.round(result.labels[0]?.confidence * 100 || 0)}%)`
            });
          });
        }

        setResults(privacyResults);

        // Create bounding boxes for privacy concerns
        const boxes = privacyResults.map(r => ({
          ...r.frame,
          label: r.label,
          width: 2,
        }));
        setBoundingBoxes(boxes);
      } else {
        // Regular object detection
        setResults(detectionResults);

        // Create bounding boxes for all objects
        const boxes = detectionResults.map(r => ({
          ...r.frame,
          label: r.labels[0] ? `${r.labels[0].text} (${Math.round(r.labels[0].confidence * 100)}%)` : undefined,
          width: 2,
        }));
        setBoundingBoxes(boxes);
      }
    } catch (error) {
      console.error('Detection failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setBoundingBoxes([]);
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
        Object Detection Test
      </Text>

      <Text style={{ marginBottom: 16 }}>
        Select an image from your gallery to test object detection with the stock Google MLKit model.
        Use "Object" mode for general detection or "Privacy" mode to test comprehensive privacy protection
        for people, documents, financial items, medical content, and personal information.
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Text>Detection Mode: </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            text="Object"
            onPress={() => setDetectionMode('object')}
            preset={detectionMode === 'object' ? 'filled' : 'default'}
          />
          <Button
            text="Privacy"
            onPress={() => setDetectionMode('privacy')}
            preset={detectionMode === 'privacy' ? 'filled' : 'default'}
          />
        </View>
      </View>

      <ImageSelector
        boundingBoxes={boundingBoxes}
        onImageChange={setImage}
        onImageClear={clearResults}
        statusMessage={
          isProcessing ? 'Processing...' :
          results.length ? `Found ${results.length} ${detectionMode === 'privacy' ? 'privacy concerns' : 'objects'}` :
          'Select an image to begin'
        }
        isLoading={!detector?.isLoaded() || isProcessing}
        images={{ filter: 'knownObject' }}
      />

      <View style={{ gap: 8, marginTop: 16 }}>
        <Button
          text="Detect Objects"
          onPress={processImage}
          disabled={!image || isProcessing || !detector?.isLoaded()}
        />

        <Button
          text="Clear Results"
          onPress={clearResults}
          preset="secondary"
        />
      </View>

      {results.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
            Detection Results:
          </Text>
          {results.map((result, index) => (
            <View key={index} style={{
              padding: 8,
              marginBottom: 8,
              backgroundColor: '#f5f5f5',
              borderRadius: 4
            }}>
              <Text style={{ fontWeight: 'bold' }}>
                {detectionMode === 'privacy' ? `${result.category}: ` : ''}{result.labels[0]?.text || 'Unknown'}
              </Text>
              <Text>Confidence: {Math.round((result.labels[0]?.confidence || 0) * 100)}%</Text>
              {detectionMode === 'privacy' && (
                <Text>Privacy Category: {result.category}</Text>
              )}
              <Text>Position: ({result.frame.origin.x}, {result.frame.origin.y})</Text>
              <Text>Size: {result.frame.size.width} x {result.frame.size.height}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};
```

Add this screen to your navigation for easy access during development.

## Implementation Steps

### Phase 1: Project Setup & Dependencies

1. **Install MLKit Packages**

   ```bash
   npm install @infinitered/react-native-mlkit-core
   npm install @infinitered/react-native-mlkit-object-detection
   npm install @infinitered/react-native-mlkit-document-scanner
   ```

2. **Update app.config.ts**
   Add necessary plugins (no camera permissions needed for image processing only):

   ```typescript
   // app.config.ts
   export default {
     // ... existing config
     plugins: [
       // ... existing plugins
       "@infinitered/react-native-mlkit-core",
       "@infinitered/react-native-mlkit-object-detection",
       "@infinitered/react-native-mlkit-face-detection",
     ],
   };
   ```

### Phase 2: Database Schema

Create tables for object detection results:

```sql
-- Object detection results table
CREATE TABLE IF NOT EXISTS object_detection_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_uri TEXT NOT NULL,
  objects TEXT, -- JSON array of detected objects
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  model_version TEXT
);

-- Privacy concerns detection results table (extensible for various sensitive content)
CREATE TABLE IF NOT EXISTS privacy_concerns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_uri TEXT NOT NULL,
  concern_type TEXT NOT NULL, -- 'person', 'document', 'financial', 'medical', etc.
  detected_objects TEXT, -- JSON array of detected objects for this concern type
  confidence_score REAL DEFAULT 0, -- Overall confidence for this concern type
  should_blur BOOLEAN DEFAULT FALSE, -- Whether this concern type should trigger blurring
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  model_version TEXT,
  UNIQUE(image_uri, concern_type)
);

-- Image privacy summary table (for quick lookups)
CREATE TABLE IF NOT EXISTS image_privacy_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_uri TEXT NOT NULL UNIQUE,
  has_privacy_concerns BOOLEAN DEFAULT FALSE,
  concern_types TEXT, -- JSON array of concern types found
  highest_confidence REAL DEFAULT 0,
  should_blur BOOLEAN DEFAULT FALSE,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Processing queue table
CREATE TABLE IF NOT EXISTS detection_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_uri TEXT NOT NULL UNIQUE,
  detection_type TEXT DEFAULT 'object', -- 'object' or 'person'
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Phase 3: Service Layer Implementation

Create `src/services/objectDetection/` directory:

#### objectDetectionService.ts

```typescript
import * as SQLite from 'expo-sqlite';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { RNMLKitObjectDetectionObject } from '@infinitered/react-native-mlkit-object-detection';

const DB_NAME = 'object-detection.db';
const BACKGROUND_TASK_NAME = 'background-object-detection';

export class ObjectDetectionService {
  private db: SQLite.SQLiteDatabase;

  constructor() {
    this.db = SQLite.openDatabase(DB_NAME);
  }

  async setupDatabase() {
    // Create tables
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS object_detection_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_uri TEXT NOT NULL,
        objects TEXT,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        model_version TEXT
      );

      CREATE TABLE IF NOT EXISTS privacy_concerns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_uri TEXT NOT NULL,
        concern_type TEXT NOT NULL,
        detected_objects TEXT,
        confidence_score REAL DEFAULT 0,
        should_blur BOOLEAN DEFAULT FALSE,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        model_version TEXT,
        UNIQUE(image_uri, concern_type)
      );

      CREATE TABLE IF NOT EXISTS image_privacy_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_uri TEXT NOT NULL UNIQUE,
        has_privacy_concerns BOOLEAN DEFAULT FALSE,
        concern_types TEXT,
        highest_confidence REAL DEFAULT 0,
        should_blur BOOLEAN DEFAULT FALSE,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS detection_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_uri TEXT NOT NULL UNIQUE,
        detection_type TEXT DEFAULT 'object',
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async buildImageQueue() {
    // Similar to PII scanner - get all images from MediaLibrary
    // Add to processing queue
  }

  async registerBackgroundTask() {
    TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
      try {
        await this.processImageQueue();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        console.error('Background object detection failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
      minimumInterval: 15 * 60, // 15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }

  private async processImageQueue() {
    // Process batch of images from queue
    const pendingImages = await this.db.getAllAsync(
      'SELECT * FROM detection_queue WHERE status = ? LIMIT 10',
      ['pending']
    );

    for (const queueItem of pendingImages) {
      try {
        // Update status to processing
        await this.db.runAsync(
          'UPDATE detection_queue SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['processing', queueItem.id]
        );

        if (queueItem.detection_type === 'privacy') {
          // Comprehensive privacy detection
          const detectionResults = await this.detectObjectsInImage(queueItem.image_uri);

          // Define privacy concern categories
          const privacyCategories = {
            person: ['person', 'man', 'woman', 'human'],
            document: ['document', 'paper', 'card', 'id', 'license', 'passport'],
            financial: ['money', 'wallet', 'credit card', 'banknote', 'cash'],
            medical: ['medicine', 'pill', 'medical', 'hospital'],
            personal: ['phone', 'key', 'address', 'signature']
          };

          // Process each privacy category
          const foundConcerns = [];
          let shouldBlurImage = false;

          for (const [category, keywords] of Object.entries(privacyCategories)) {
            const categoryObjects = detectionResults.filter(result =>
              result.labels.some(label =>
                keywords.some(keyword =>
                  label.text.toLowerCase().includes(keyword)
                )
              )
            );

            if (categoryObjects.length > 0) {
              const avgConfidence = categoryObjects.reduce((sum, obj) =>
                sum + (obj.labels[0]?.confidence || 0), 0
              ) / categoryObjects.length;

              // Store concern details
              await this.db.runAsync(
                `INSERT OR REPLACE INTO privacy_concerns
                 (image_uri, concern_type, detected_objects, confidence_score, should_blur, processed_at)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                  queueItem.image_uri,
                  category,
                  JSON.stringify(categoryObjects),
                  avgConfidence,
                  this.shouldBlurCategory(category, avgConfidence)
                ]
              );

              foundConcerns.push(category);
              if (this.shouldBlurCategory(category, avgConfidence)) {
                shouldBlurImage = true;
              }
            }
          }

          // Update image privacy summary
          await this.db.runAsync(
            `INSERT OR REPLACE INTO image_privacy_status
             (image_uri, has_privacy_concerns, concern_types, should_blur, last_updated)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              queueItem.image_uri,
              foundConcerns.length > 0,
              JSON.stringify(foundConcerns),
              shouldBlurImage
            ]
          );
        } else {
          // Regular object detection
          const detectionResults = await this.detectObjectsInImage(queueItem.image_uri);
          await this.db.runAsync(
            'INSERT OR REPLACE INTO object_detection_results (image_uri, objects, processed_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [queueItem.image_uri, JSON.stringify(detectionResults)]
          );
        }

        // Mark as completed
        await this.db.runAsync(
          'UPDATE detection_queue SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['completed', queueItem.id]
        );

      } catch (error) {
        console.error(`Failed to process ${queueItem.image_uri}:`, error);
        await this.db.runAsync(
          'UPDATE detection_queue SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['failed', queueItem.id]
        );
      }
    }
  }

  private async detectObjectsInImage(imageUri: string) {
    // Use MLKit object detection
    // This would integrate with the MLKit object detection API
    // Return detection results
  }

  private shouldBlurCategory(category: string, confidence: number): boolean {
    // Define blurring rules based on category and confidence
    const blurRules = {
      person: confidence > 0.7, // Blur if high confidence person detection
      document: confidence > 0.8, // Very high confidence for documents
      financial: confidence > 0.9, // Very high confidence for financial items
      medical: confidence > 0.8, // High confidence for medical items
      personal: confidence > 0.6 // Medium confidence for personal items
    };

    return blurRules[category] || false;
  }
}
```

### Phase 4: Context Provider

Create `src/providers/ObjectDetectionContextProvider/`:

#### ObjectDetectionContextProvider.tsx

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ObjectDetectionService } from '../../services/objectDetection/objectDetectionService';
import { useObjectDetectionModels, useObjectDetectionProvider } from '@infinitered/react-native-mlkit-object-detection';

interface ObjectDetectionContextType {
  isInitialized: boolean;
  detectionResults: Map<string, RNMLKitObjectDetectionObject[]>;
  toggleDetectionView: () => void;
  showDetectionView: boolean;
}

const ObjectDetectionContext = createContext<ObjectDetectionContextType | null>(null);

export const useObjectDetectionContext = () => {
  const context = useContext(ObjectDetectionContext);
  if (!context) {
    throw new Error('useObjectDetectionContext must be used within ObjectDetectionProvider');
  }
  return context;
};

export const ObjectDetectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [showDetectionView, setShowDetectionView] = useState(false);
  const [detectionResults, setDetectionResults] = useState(new Map());

  const service = new ObjectDetectionService();

  // Setup MLKit models - using stock Google model
  const models = useObjectDetectionModels({
    loadDefaultModel: true, // Use the built-in Google MLKit model
    defaultModelOptions: {
      shouldEnableMultipleObjects: true,
      shouldEnableClassification: true,
      detectorMode: 'singleImage',
    },
  });

  const { ObjectDetectionProvider: MLKitProvider } = useObjectDetectionProvider(models);

  useEffect(() => {
    const initialize = async () => {
      try {
        await service.setupDatabase();
        await service.buildImageQueue();
        await service.registerBackgroundTask();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize object detection:', error);
      }
    };

    initialize();
  }, []);

  const toggleDetectionView = () => {
    setShowDetectionView(!showDetectionView);
  };

  return (
    <ObjectDetectionContext.Provider
      value={{
        isInitialized,
        detectionResults,
        toggleDetectionView,
        showDetectionView,
      }}
    >
      <MLKitProvider>
        {children}
      </MLKitProvider>
    </ObjectDetectionContext.Provider>
  );
};
```

#### usePrivacyDetection Hook

Create a custom hook to check for various privacy concerns and manage blur settings:

```typescript
// src/hooks/usePrivacyDetection.ts
import { useState, useEffect } from 'react';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('object-detection.db');

export interface PrivacyConcern {
  type: string;
  confidence: number;
  shouldBlur: boolean;
}

export const usePrivacyDetection = (imageUri: string) => {
  const [privacyConcerns, setPrivacyConcerns] = useState<PrivacyConcern[]>([]);
  const [shouldBlur, setShouldBlur] = useState(false);
  const [isBlurEnabled, setIsBlurEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPrivacyConcerns = async () => {
      try {
        // Check image privacy status
        const statusResult = await db.getFirstAsync(
          'SELECT * FROM image_privacy_status WHERE image_uri = ?',
          [imageUri]
        );

        if (statusResult) {
          setShouldBlur(statusResult.should_blur && isBlurEnabled);

          // Get detailed concerns
          const concernsResult = await db.getAllAsync(
            'SELECT * FROM privacy_concerns WHERE image_uri = ?',
            [imageUri]
          );

          const concerns: PrivacyConcern[] = concernsResult.map(row => ({
            type: row.concern_type,
            confidence: row.confidence_score,
            shouldBlur: row.should_blur
          }));

          setPrivacyConcerns(concerns);
        }
      } catch (error) {
        console.error('Error checking privacy concerns:', error);
      } finally {
        setLoading(false);
      }
    };

    if (imageUri) {
      checkPrivacyConcerns();
    }
  }, [imageUri, isBlurEnabled]);

  return {
    privacyConcerns,
    shouldBlur,
    isBlurEnabled,
    loading,
    setIsBlurEnabled,
  };
};
```

### Phase 5: UI Components

#### ObjectDetectionScreen.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useObjectDetection } from '@infinitered/react-native-mlkit-object-detection';
import { ImageSelector } from '../components/ImageSelector';
import { BoundingBox } from '@infinitered/react-native-mlkit-core';

export const ObjectDetectionScreen: React.FC = () => {
  const detector = useObjectDetection('default');
  const [image, setImage] = useState(null);
  const [objects, setObjects] = useState([]);
  const [boundingBoxes, setBoundingBoxes] = useState([]);

  useEffect(() => {
    const detectObjects = async () => {
      if (!image?.uri || !detector?.isLoaded()) return;

      try {
        const results = await detector.detectObjects(image.uri);
        setObjects(results);
        setBoundingBoxes(
          results.map(r => ({
            ...r.frame,
            label: r.labels[0]?.text,
          }))
        );
      } catch (error) {
        console.error('Detection failed:', error);
      }
    };

    detectObjects();
  }, [image, detector]);

  return (
    <View>
      <Text>Object Detection</Text>
      <ImageSelector
        boundingBoxes={boundingBoxes}
        onImageChange={setImage}
        statusMessage={objects.length ? `Found ${objects.length} objects` : 'Select an image'}
      />
      {/* Display results */}
    </View>
  );
};
```

#### Enhanced ImageComponent

Update existing ImageComponent to show detection overlays and blur images with people:

```typescript
// In ImageComponent.tsx
import { useObjectDetectionContext } from '../providers/ObjectDetectionContextProvider';
import { usePrivacyDetection } from '../hooks/usePrivacyDetection';

export const ImageComponent: React.FC<ImageComponentProps> = ({ uri, ...props }) => {
  const { showDetectionView, detectionResults } = useObjectDetectionContext();
  const { shouldBlur, privacyConcerns } = usePrivacyDetection(uri);

  const objects = detectionResults.get(uri) || [];

  return (
    <View>
      {/* Existing image rendering with conditional blur */}
      <ExpoImageComponent
        {...props}
        uri={uri}
        blurRadius={shouldBlur ? 10 : 0}
        style={[
          props.style,
          shouldBlur && { opacity: 0.7 }
        ]}
      />

      {/* Show detection overlays when enabled */}
      {showDetectionView && objects.map((obj, index) => (
        <BoundingBoxOverlay key={index} object={obj} />
      ))}

      {/* Privacy indicator */}
      {privacyConcerns.length > 0 && (
        <View style={{
          position: 'absolute',
          top: 8,
          right: 8,
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: 4,
          borderRadius: 4
        }}>
          <Text style={{ color: 'white', fontSize: 12 }}>
            Privacy: {privacyConcerns.map(c => c.type).join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
};
```

### Phase 7: Navigation Integration

Update navigation to include new screens:

```typescript
// In _layout.tsx or navigation config
const Stack = createNativeStackNavigator();

<Stack.Screen
  name="ObjectDetection"
  component={ObjectDetectionScreen}
  options={{ title: 'Object Detection' }}
/>
<Stack.Screen
  name="ObjectDetectionTest"
  component={ObjectDetectionTestScreen}
  options={{ title: 'Object Detection Test' }}
/>
```

### Phase 8: Error Handling & Best Practices

1. **Model Loading States**
   - Show loading indicators while models initialize
   - Handle model loading failures gracefully

2. **Background Processing**
   - Respect device battery and network conditions
   - Implement retry logic for failed detections

3. **Memory Management**
   - Clear detection results for images not in view
   - Limit concurrent processing

4. **Platform Considerations**
   - Object detection works on both iOS and Android
   - MLKit runs on-device for privacy and performance

## Performance Considerations

- Process images in background to avoid blocking UI
- Use image caching to avoid re-processing
- Implement lazy loading for detection results
- Monitor memory usage with large image sets

## Security & Privacy

- Process images locally (MLKit runs on-device)
- Don't store sensitive detection results unnecessarily
- Respect user permissions for camera and photo library access

## Future Enhancements

- Custom TFLite models for specific object types
- Real-time detection in camera view
- Batch processing optimizations
- Export detection results functionality

This guide provides a solid foundation for integrating MLKit object detection and document scanning capabilities into the tt2 project, following established patterns and best practices.
