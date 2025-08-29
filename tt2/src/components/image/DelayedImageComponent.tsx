import { Image as ExpoImage, ImageProps } from "expo-image";
import { memo, useState, useEffect } from "react";
import { StyleSheet } from "react-native";
import { ImageViewProps } from "./types";
import { useImageContext } from "@/providers/ImageContextProvider/ImageContextProvider";

/**
 * Similar to ExpoImageComponent, but with a delay before rendering the image.
 * This is useful to showcase the placeholders.
 */
export const DelayedImageComponent = memo(function DelayedImageComponent({
  uri,
  itemSize,
  placeholder,
  style,
  originalUri,
}: ImageViewProps & Pick<ImageProps, "placeholder" | "style">) {
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
      blurRadius={shouldBlur ? 15 : 0}
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
