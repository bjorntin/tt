import { Image as ExpoImage } from "expo-image";
import { memo } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { ImageViewProps } from "./types";

export const ExpoImageComponent = memo(function ExpoImageComponent({
  uri,
  itemSize,
  onPress,
}: ImageViewProps) {
  const ImageComponent = (
    <ExpoImage
      source={{ uri }}
      decodeFormat="rgb"
      // Disable caching to have reproducible results
      cachePolicy="none"
      recyclingKey={uri}
      transition={0}
      style={[styles.image, { width: itemSize, height: itemSize }]}
    />
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {ImageComponent}
      </TouchableOpacity>
    );
  }

  return ImageComponent;
});

const styles = StyleSheet.create({
  image: {
    borderWidth: 1,
    borderColor: "grey",
  },
});
