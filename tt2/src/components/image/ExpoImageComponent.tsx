import { Image as ExpoImage } from "expo-image";
import { memo, useState, useEffect } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { ImageViewProps } from "./types";
import { useImageContext } from "@/providers/ImageContextProvider/ImageContextProvider";

export const ExpoImageComponent = memo(function ExpoImageComponent({
  uri,
  itemSize,
  onPress,
  originalUri,
}: ImageViewProps) {
  const { unlockedUris, getImageStatus } = useImageContext();
  const [piiStatus, setPiiStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const status = await getImageStatus(originalUri || uri);
      setPiiStatus(status);
    };
    fetchStatus();
  }, [getImageStatus, originalUri, uri]);

  const shouldBlur =
    piiStatus === "pii_found" && !unlockedUris.includes(originalUri || uri);

  const ImageComponent = (
    <ExpoImage
      source={{ uri }}
      decodeFormat="rgb"
      // Disable caching to have reproducible results
      cachePolicy="none"
      recyclingKey={uri}
      transition={0}
      style={[styles.image, { width: itemSize, height: itemSize }]}
      blurRadius={shouldBlur ? 15 : 0}
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
