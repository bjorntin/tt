import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  Animated,
  Text,
  ScrollView,
} from "react-native";
import { PhotoViewerModalProps } from "./types";
import { PhotoViewerImage } from "./PhotoViewerImage";
import { GestureHandler } from "./GestureHandler";
import { recognizeText } from "@/services/ocr/mlkit";

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

  // OCR preview state for bottom panel
  const [ocrText, setOcrText] = useState("");
  const [ocrCounts, setOcrCounts] = useState({ lines: 0, words: 0 });
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

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

  // Reset loading/OCR state when photo changes
  useEffect(() => {
    if (currentPhoto) {
      setImageLoading(true);
      setOcrLoading(true);
      setOcrText("");
      setOcrCounts({ lines: 0, words: 0 });
      setOcrError(null);
    }
  }, [currentPhoto]);

  // Run OCR automatically when the modal is visible and photo changes
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (visible && currentPhoto?.uri) {
          setOcrLoading(true);
          const result = await recognizeText(currentPhoto.uri);
          if (cancelled) return;
          setOcrText(result.fullText ?? "");
          setOcrCounts({
            lines: result.lines?.length ?? 0,
            words: result.words?.length ?? 0,
          });
          setOcrError(null);
        }
      } catch (e: any) {
        if (!cancelled) setOcrError(String(e));
      } finally {
        if (!cancelled) setOcrLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [visible, currentPhoto?.uri]);

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

          {/* Bottom OCR panel */}
          <View style={styles.ocrPanel}>
            <Text style={styles.ocrTitle}>
              Recognized Text {ocrLoading ? "(processing…)" : ""}
              {!ocrLoading && ` (lines: ${ocrCounts.lines}, words: ${ocrCounts.words})`}
            </Text>
            <View style={styles.ocrBox}>
              {ocrError ? (
                <Text selectable style={styles.ocrError}>
                  {ocrError}
                </Text>
              ) : (
                <ScrollView>
                  <Text selectable style={styles.ocrText}>
                    {ocrText || "(no text recognized)"}
                  </Text>
                </ScrollView>
              )}
            </View>
          </View>

          {/* Optional overlay UI */}
          <View style={styles.overlay} />
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

  // OCR panel styles
  ocrPanel: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#111",
  },
  ocrTitle: {
    color: "#fff",
    fontWeight: "600",
    marginBottom: 6,
  },
  ocrBox: {
    maxHeight: 180,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
    backgroundColor: "#1b1b1b",
    padding: 10,
  },
  ocrError: {
    color: "#ff8080",
  },
  ocrText: {
    color: "#fff",
  },
});
