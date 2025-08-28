import { CachedPhotoType } from "@/providers/CachedPhotosProvider/cache-service";

export type ViewerPhoto = {
  uri: string; // Cached photo URI for display
  originalUri: string; // Original photo URI
  index: number; // Photo index in gallery
};

export type PhotoViewerModalProps = {
  visible: boolean;
  currentIndex: number;
  photos: ViewerPhoto[];
  onClose: () => void;
  onIndexChange?: (index: number) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

export type PhotoViewerImageProps = {
  photo: ViewerPhoto;
  isActive: boolean;
  onZoom?: (scale: number) => void;
  onPan?: (x: number, y: number) => void;
  onLoad?: () => void;
  onError?: (error: any) => void;
};

export type GestureHandlerProps = {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onTap: () => void;
  children: React.ReactNode;
};

export type usePhotoViewerReturn = {
  isVisible: boolean;
  currentIndex: number;
  photos: ViewerPhoto[];
  openViewer: (index: number, cachedPhotos: CachedPhotoType[]) => void;
  closeViewer: () => void;
  goToNext: () => void;
  goToPrevious: () => void;
  goToIndex: (index: number) => void;
};