import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import * as SQLite from "expo-sqlite";
import { useFocusEffect } from "expo-router";
import { Asset } from "expo-media-library";
import { FlashList } from "@shopify/flash-list";
import { ImageComponent } from "./image/ImageComponent";
import { useGalleryUISettings } from "@/providers/GalleryUISettingsProvider";

const db = SQLite.openDatabaseSync("pii-scanner.db");

type ImageRow = {
  id: number;
  uri: string;
};

export const FlaggedPhotosView = () => {
  const [data, setData] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const { numberOfColumns, galleryGap } = useGalleryUISettings();

  const itemSize = 100; // Fixed size for this view

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await db.getAllAsync<ImageRow>(
        "SELECT * FROM images WHERE status = 'pii_found' ORDER BY id DESC;",
      );
      const mappedData: Asset[] = result.map((row) => ({
        id: row.id.toString(),
        uri: row.uri,
        width: itemSize,
        height: itemSize,
        creationTime: 0,
        duration: 0,
        filename: row.uri.split("/").pop() ?? "",
        mediaType: "photo",
        modificationTime: 0,
        albumId: "-1",
      }));
      setData(mappedData);
    } catch (error) {
      // console.error("Failed to fetch from database", error);
    } finally {
      setLoading(false);
    }
  }, [itemSize]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  if (loading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }

  if (data.length === 0) {
    return (
      <View style={styles.centered}>
        <Text>No photos have been flagged with PII.</Text>
      </View>
    );
  }

  return (
    <FlashList
      data={data}
      numColumns={numberOfColumns}
      keyExtractor={(item) => item.id}
      estimatedItemSize={itemSize}
      renderItem={({ item }) => (
        <ImageComponent uri={item.uri} itemSize={itemSize} />
      )}
      contentContainerStyle={{ padding: galleryGap }}
      ItemSeparatorComponent={() => <View style={{ height: galleryGap }} />}
    />
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
