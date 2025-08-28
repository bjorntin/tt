import React from "react";
import { Image as ExpoImage } from "expo-image";
import { StyleSheet, Dimensions, View } from "react-native";
import { PhotoViewerImageProps } from "./types";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export const PhotoViewerImage: React.FC<PhotoViewerImageProps> = ({
  photo,
  isActive,
  onZoom,
  onPan,
  onLoad,
  onError,
}) => {
  return (
    <View style={styles.container}>
      <ExpoImage
        source={{ uri: photo.uri }}
        style={styles.image}
        contentFit="contain"
        allowDownscaling={true}
        cachePolicy="memory-disk"
        placeholder={require("@/assets/images/icon.png")}
        placeholderContentFit="contain"
        onLoad={() => {
          onLoad?.();
        }}
        onError={(error) => {
          onError?.(error);
        }}
      />
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
});
