import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { ImageViewProps } from "./types";

export const EmptyImageComponent = memo(
  function EmptyImageComponent({ itemSize }: ImageViewProps) {
    return (
      <View style={[styles.image, { width: itemSize, height: itemSize }]} />
    );
  },
  () => true,
);

const styles = StyleSheet.create({
  image: {
    borderWidth: 1,
    borderColor: "grey",
  },
});
