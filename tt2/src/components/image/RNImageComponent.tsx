import { memo } from "react";
import { Image as RNImage, StyleSheet, TouchableOpacity } from "react-native";
import { ImageViewProps } from "./types";

export const RNImageComponent = memo(function RNImageComponent({
  uri,
  itemSize,
  onPress,
}: ImageViewProps) {
  const ImageComponent = (
    <RNImage
      source={{ uri, cache: "reload" }}
      fadeDuration={0}
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
