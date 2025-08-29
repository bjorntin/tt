import React, { useState, useEffect } from "react";
import { Alert, Platform } from "react-native";
import { ImageComponent } from "./ImageComponent";
import { useImageContext } from "@/providers/ImageContextProvider/ImageContextProvider";
import { FocusableImage } from "./FocusableImage";

type GalleryImageProps = {
  item: {
    cachedPhotoUri: string;
    originalPhotoUri: string;
  };
  index: number;
  numberOfColumns: number;
  settingsButtonHandle: number | null;
  itemSize: number;
  openViewer: (index: number) => void;
};

export const GalleryImage = ({
  item,
  index,
  numberOfColumns,
  settingsButtonHandle,
  itemSize,
  openViewer,
}: GalleryImageProps) => {
  const { unlockedUris, unlockImage, lockImage, getImageStatus, securityMode } =
    useImageContext();
  const [piiStatus, setPiiStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const status = await getImageStatus(item.originalPhotoUri);
      setPiiStatus(status);
    };
    fetchStatus();
  }, [getImageStatus, item.originalPhotoUri]);

  const isLocked =
    securityMode &&
    piiStatus === "pii_found" &&
    !unlockedUris.includes(item.originalPhotoUri);

  const focusProps = Platform.isTV
    ? {
        nextFocusLeft:
          index % numberOfColumns === 0
            ? (settingsButtonHandle ?? undefined)
            : undefined,
        nextFocusUp:
          index < numberOfColumns
            ? (settingsButtonHandle ?? undefined)
            : undefined,
      }
    : {};
  const handlePress = () => {
    if (isLocked) {
      Alert.alert(
        "Locked Image",
        "This image is flagged as potentially sensitive because {reason}. Do you want to unlock & view it?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unlock",
            onPress: () => {
              unlockImage(item.originalPhotoUri);
              openViewer(index);
            },
          },
        ],
      );
    } else {
      openViewer(index);
    }
  };

  const handleLongPress = () => {
    // Only show lock option for unlocked images
    if (!isLocked && securityMode && piiStatus === "pii_found") {
      Alert.alert(
        "Lock Image",
        "This will re-lock the image and apply blurring again. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Lock",
            style: "destructive",
            onPress: () => {
              lockImage(item.originalPhotoUri);
            },
          },
        ],
      );
    }
  };

  const Image = Platform.isTV ? FocusableImage : ImageComponent;

  return (
    <Image
      uri={item.cachedPhotoUri}
      itemSize={itemSize}
      onPress={handlePress}
      onLongPress={handleLongPress}
      originalUri={item.originalPhotoUri}
      {...focusProps}
    />
  );
};
