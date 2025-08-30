import React, { useState, useEffect } from "react";
import { Image as ExpoImage } from "expo-image";
import {
  StyleSheet,
  Dimensions,
  View,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import { PhotoViewerImageProps } from "./types";
import { useImageContext } from "@/providers/ImageContextProvider/ImageContextProvider";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export const PhotoViewerImage: React.FC<PhotoViewerImageProps> = ({
  photo,
  isActive,
  onZoom,
  onPan,
  onLoad,
  onError,
  onClose,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
}) => {
  const { unlockedUris, unlockImage, getImageStatus, securityMode } =
    useImageContext();
  const [piiStatus, setPiiStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const status = await getImageStatus(photo.originalUri);
      setPiiStatus(status);
    };
    fetchStatus();
  }, [getImageStatus, photo.originalUri]);

  const shouldBlur =
    securityMode &&
    piiStatus === "pii_found" &&
    !unlockedUris.includes(photo.originalUri);

  const ImageComponent = (
    <ExpoImage
      source={{ uri: photo.uri }}
      style={styles.image}
      contentFit="contain"
      allowDownscaling={true}
      cachePolicy="memory-disk"
      placeholder={shouldBlur ? undefined : require("@/assets/images/icon.png")}
      placeholderContentFit="contain"
      blurRadius={shouldBlur ? 15 : 0}
      onLoad={() => {
        onLoad?.();
      }}
      onError={(error) => {
        onError?.(error);
      }}
    />
  );

  const handleLongPress = () => {
    if (shouldBlur) {
      Alert.alert(
        "Locked Image",
        "This image is flagged as potentially sensitive. Do you want to unlock & view it?",
        [
          {
            text: "Exit Viewer",
            style: "destructive",
            onPress: () => {
              onClose?.();
            },
          },
          {
            text: "Unlock",
            onPress: () => {
              unlockImage(photo.originalUri);
            },
          },
        ],
      );
    }
  };

  return (
    <View style={styles.container}>
      {shouldBlur ? (
        <TouchableOpacity
          style={styles.touchable}
          onLongPress={handleLongPress}
          delayLongPress={500}
          activeOpacity={1}
        >
          {ImageComponent}
          <View style={styles.hintOverlay}>
            <Text style={styles.hintText}>Long press to unlock</Text>
          </View>

          {/* Navigation buttons for locked images */}
          {hasPrevious && (
            <TouchableOpacity
              style={[styles.navButton, styles.previousButton]}
              onPress={onPrevious}
              activeOpacity={0.7}
            >
              <View style={styles.navButtonContent}>
                <Text style={styles.navButtonText}>‹</Text>
              </View>
            </TouchableOpacity>
          )}

          {hasNext && (
            <TouchableOpacity
              style={[styles.navButton, styles.nextButton]}
              onPress={onNext}
              activeOpacity={0.7}
            >
              <View style={styles.navButtonContent}>
                <Text style={styles.navButtonText}>›</Text>
              </View>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      ) : (
        ImageComponent
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
  },
  image: {
    width: screenWidth,
    height: screenHeight * 0.8, // Leave some space for UI elements
    maxWidth: screenWidth,
    maxHeight: screenHeight * 0.8,
  },
  hintOverlay: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  touchable: {
    position: "relative",
    width: screenWidth,
    height: screenHeight * 0.8,
    justifyContent: "center",
    alignItems: "center",
  },
  hintText: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    color: "white",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 14,
    textAlign: "center",
  },
  navButton: {
    position: "absolute",
    top: "50%",
    transform: [{ translateY: -25 }],
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  previousButton: {
    left: 20,
  },
  nextButton: {
    right: 20,
  },
  navButtonContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  navButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    transform: [{ translateY: -2 }],
  },
});
