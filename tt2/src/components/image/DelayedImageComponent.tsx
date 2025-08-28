import { Image as ExpoImage, ImageProps } from "expo-image";
import { memo } from "react";
import { StyleSheet } from "react-native";
import { ImageViewProps } from "./types";

/**
 * Similar to ExpoImageComponent, but with a delay before rendering the image.
 * This is useful to showcase the placeholders.
 */
export const DelayedImageComponent = memo(function DelayedImageComponent({
  uri,
  itemSize,
  placeholder,
  style,
}: ImageViewProps & Pick<ImageProps, "placeholder" | "style">) {
  return (
    <ExpoImage
      source={{ uri, width: 1000, height: 1000 }}
      decodeFormat="rgb"
      // Disable caching to have reproducible results
      cachePolicy="none"
      recyclingKey={uri}
      transition={500}
      style={[styles.image, { width: itemSize, height: itemSize }, style]}
      placeholder={placeholder}
    />
  );
});

const styles = StyleSheet.create({
  image: {
    borderWidth: 1,
    borderColor: "grey",
    overflow: "hidden",
  },
});
