import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  Animated,
} from "react-native";
import { PhotoViewerModalProps } from "./types";
import { PhotoViewerImage } from "./PhotoViewerImage";
import { GestureHandler } from "./GestureHandler";

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
  visible,
  currentIndex,
  photos,
  onClose,
  onIndexChange,
  onSwipeLeft,
  onSwipeRight,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [imageLoading, setImageLoading] = useState(false);
  const currentPhoto = photos[currentIndex];

  useEffect(() => {
    if (visible) {
      // Hide status bar when modal is visible
      StatusBar.setHidden(true);
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        // Show status bar when modal is closed
        StatusBar.setHidden(false);
      });
    }

    // Cleanup on unmount
    return () => {
      StatusBar.setHidden(false);
    };
  }, [visible, fadeAnim]);

  // Reset loading state when photo changes
  useEffect(() => {
    if (currentPhoto) {
      setImageLoading(true);
    }
  }, [currentPhoto]);

  const handleSwipeLeft = () => {
    onSwipeLeft?.();
  };

  const handleSwipeRight = () => {
    onSwipeRight?.();
  };

  const handleTap = () => {
    // Close modal on tap (for mobile)
    if (Platform.OS !== "android" && Platform.OS !== "ios") {
      // On TV/web, tapping might have different behavior
      return;
    }
    onClose();
  };

  if (!currentPhoto) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none" // We'll handle our own animation
      onRequestClose={onClose}
      supportedOrientations={["portrait", "landscape"]}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <SafeAreaView style={styles.safeArea}>
          <GestureHandler
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            onTap={handleTap}
          >
            <PhotoViewerImage
              photo={currentPhoto}
              isActive={true}
              onClose={onClose}
              onNext={onSwipeLeft}
              onPrevious={onSwipeRight}
              hasNext={currentIndex < photos.length - 1}
              hasPrevious={currentIndex > 0}
              onLoad={() => setImageLoading(false)}
              onError={(error) => {
                setImageLoading(false);
              }}
            />
          </GestureHandler>

          {/* Loading indicator */}
          {imageLoading && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingIndicator} />
            </View>
          )}

          {/* Optional: Add navigation indicators or controls here */}
          <View style={styles.overlay}>
            {/* Close button or other UI elements can be added here */}
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  safeArea: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Add overlay elements here if needed
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  loadingIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "white",
    borderTopColor: "transparent",
    // Add rotation animation here if needed
  },
});
