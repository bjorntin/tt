import { useState, useCallback } from "react";
import { CachedPhotoType } from "@/providers/CachedPhotosProvider/cache-service";
import {
  ViewerPhoto,
  usePhotoViewerReturn,
} from "@/components/PhotoViewer/types";

export const usePhotoViewer = (): usePhotoViewerReturn => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photos, setPhotos] = useState<ViewerPhoto[]>([]);

  const openViewer = useCallback(
    (index: number, cachedPhotos: CachedPhotoType[]) => {
      const viewerPhotos: ViewerPhoto[] = cachedPhotos.map((photo, idx) => ({
        uri: photo.originalPhotoUri, // Use full-resolution original image
        originalUri: photo.originalPhotoUri,
        index: idx,
      }));

      setPhotos(viewerPhotos);
      setCurrentIndex(index);
      setIsVisible(true);
    },
    [],
  );

  const closeViewer = useCallback(() => {
    setIsVisible(false);
    setCurrentIndex(0);
    setPhotos([]);
  }, []);

  const goToNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex((prevIndex) => prevIndex + 1);
    }
  }, [currentIndex, photos.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  }, []);

  const goToIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < photos.length) {
        setCurrentIndex(index);
      }
    },
    [photos.length],
  );

  return {
    isVisible,
    currentIndex,
    photos,
    openViewer,
    closeViewer,
    goToNext,
    goToPrevious,
    goToIndex,
  };
};
