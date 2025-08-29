import { memo, useState, useEffect } from "react";
import { Image as RNImage, StyleSheet, TouchableOpacity } from "react-native";
import { ImageViewProps } from "./types";
import { useImageContext } from "@/providers/ImageContextProvider/ImageContextProvider";

export const RNImageComponent = memo(function RNImageComponent({
  uri,
  itemSize,
  onPress,
  onLongPress,
  originalUri,
}: ImageViewProps) {
  const { unlockedUris, getImageStatus, securityMode } = useImageContext();
  const [piiStatus, setPiiStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const status = await getImageStatus(originalUri || uri);
      setPiiStatus(status);
    };
    fetchStatus();
  }, [getImageStatus, originalUri, uri]);

  const shouldBlur =
    securityMode &&
    piiStatus === "pii_found" &&
    !unlockedUris.includes(originalUri || uri);

  const ImageComponent = (
    <RNImage
      source={{ uri, cache: "reload" }}
      fadeDuration={0}
      style={[styles.image, { width: itemSize, height: itemSize }]}
      blurRadius={shouldBlur ? 15 : 0}
    />
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.8}
      >
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
