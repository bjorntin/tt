import { IS_WIDE_SCREEN } from "@/config/constants";
import { useCachedPhotos } from "@/providers/CachedPhotosProvider";
import { useGalleryUISettings } from "@/providers/GalleryUISettingsProvider";
import { useMediaLibraryPhotos } from "@/providers/MediaLibraryPhotosProvider";
import { Dimensions } from "@/providers/ScreenDimensionsProvider";
import { useCallback, useMemo } from "react";
import { Platform, StyleSheet, View, ViewStyle } from "react-native";
import { EmptyGalleryList } from "./EmptyGalleryList";
import { SplashScreen } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { scaledPixels } from "@/hooks/useScale";
import { getHandle, useFocusRefs } from "@/providers/FocusRefProvider";
import { usePhotoViewer } from "@/hooks/usePhotoViewer";
import { PhotoViewerModal } from "./PhotoViewer";
import { NoPhotosMessage } from "./NoPhotosMessage";
import { GalleryImage } from "./image/GalleryImage";

/**
 * Helper definitions - images gallery list props
 */
export type ImagesGalleryListProps = {
  dimensions: Dimensions;
  numberOfColumns: number;
  galleryGap: number;
  style?: ViewStyle;
};

/**
 * Images list component
 *
 * @param dimensions - The target screen dimensions within which to display the list.
 * @param style - Styles for the list View wrapper component
 */
export const ImagesGalleryList = ({
  dimensions,
  numberOfColumns,
  galleryGap,
  style,
}: ImagesGalleryListProps) => {
  const focusRefs = useFocusRefs();
  const settingsButtonHandle = getHandle(focusRefs["settings"]);
  const { cachedPhotos, cachedPhotosLoadingState } = useCachedPhotos();
  const { mediaLibraryPhotos, mediaLibraryLoadingState } =
    useMediaLibraryPhotos();
  const { offscreenDrawDistanceWindowSize } = useGalleryUISettings();
  const {
    isVisible: photoViewerVisible,
    currentIndex: photoViewerIndex,
    photos: photoViewerPhotos,
    openViewer,
    closeViewer,
    goToIndex,
    goToNext,
    goToPrevious,
  } = usePhotoViewer();

  const calculateSingleImageSize = useCallback(() => {
    const effectiveWidth =
      dimensions.width - (numberOfColumns + 1) * galleryGap;
    return IS_WIDE_SCREEN
      ? (effectiveWidth - dimensions.width * 0.1) / numberOfColumns
      : effectiveWidth / numberOfColumns;
  }, [dimensions, numberOfColumns, galleryGap]);

  const calculateOffscreenDrawDistanceFromWindowSize = useCallback(
    () => Math.round(dimensions.height * offscreenDrawDistanceWindowSize),
    [dimensions, offscreenDrawDistanceWindowSize],
  );

  const properties = useMemo(
    () => ({
      singleImageSize: calculateSingleImageSize(),
      listOffscreenDrawDistance: calculateOffscreenDrawDistanceFromWindowSize(),
    }),
    [calculateSingleImageSize, calculateOffscreenDrawDistanceFromWindowSize],
  );

  const shouldShowNoPhotosMessage =
    mediaLibraryLoadingState === "COMPLETED" && mediaLibraryPhotos.length === 0;

  const shouldShowLoadingSkeletons =
    mediaLibraryLoadingState !== "COMPLETED" ||
    (mediaLibraryPhotos.length > 0 && cachedPhotosLoadingState !== "COMPLETED");

  const ListEmptyComponent = useCallback(() => {
    if (shouldShowNoPhotosMessage) {
      return <NoPhotosMessage />;
    }

    if (shouldShowLoadingSkeletons) {
      return (
        <EmptyGalleryList
          itemSize={properties.singleImageSize}
          numberOfColumns={numberOfColumns}
          numberOfItems={100}
        />
      );
    }

    return null;
  }, [
    shouldShowNoPhotosMessage,
    shouldShowLoadingSkeletons,
    properties,
    numberOfColumns,
  ]);

  const renderItem = useCallback(
    ({
      item,
      index,
    }: {
      item: (typeof cachedPhotos)[number];
      index: number;
    }) => {
      const handleOpenViewer = (idx: number) => {
        openViewer(idx, cachedPhotos);
      };

      return (
        <GalleryImage
          item={item}
          index={index}
          numberOfColumns={numberOfColumns}
          settingsButtonHandle={settingsButtonHandle ?? null}
          itemSize={properties.singleImageSize}
          openViewer={handleOpenViewer}
        />
      );
    },
    [
      properties.singleImageSize,
      settingsButtonHandle,
      numberOfColumns,
      openViewer,
      cachedPhotos,
    ],
  );

  const ItemSeparator = useCallback(() => {
    return <View style={{ height: galleryGap }} />;
  }, [galleryGap]);

  const keyExtractor = useCallback(
    (item: (typeof cachedPhotos)[number]) => item.originalPhotoUri,
    [],
  );

  const handleLoad = useCallback(() => {
    setTimeout(() => {
      SplashScreen.hideAsync();
    }, 100);
  }, []);

  return (
    <View style={[styles.listContainer, style]}>
      <FlashList
        key={mediaLibraryLoadingState}
        data={cachedPhotos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numberOfColumns}
        estimatedItemSize={properties.singleImageSize}
        contentContainerStyle={{
          paddingLeft: galleryGap,
          ...(IS_WIDE_SCREEN && {
            paddingLeft: galleryGap + dimensions.width * 0.05,
            paddingRight: dimensions.width * 0.05,
            paddingTop: Platform.isTV ? scaledPixels(20) : 0,
          }),
        }}
        drawDistance={properties.listOffscreenDrawDistance}
        ItemSeparatorComponent={ItemSeparator}
        ListEmptyComponent={ListEmptyComponent}
        onLoad={handleLoad}
        showsVerticalScrollIndicator={false}
        CellRendererComponent={(props) => {
          const { style: cellStyle, children, ...rest } = props;
          return (
            <View style={cellStyle} {...rest}>
              {children}
            </View>
          );
        }}
        disableAutoLayout={true}
      />

      <PhotoViewerModal
        visible={photoViewerVisible}
        currentIndex={photoViewerIndex}
        photos={photoViewerPhotos}
        onClose={closeViewer}
        onIndexChange={goToIndex}
        onSwipeLeft={goToNext}
        onSwipeRight={goToPrevious}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
  },
});
