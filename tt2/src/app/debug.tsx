import React, { useState } from "react";
import { View, StyleSheet, Alert, Text, ScrollView } from "react-native";
import { DatabaseDebugView } from "@/components/DatabaseDebugView";
import { HeaderText } from "@/components/HeaderText";
import { colors } from "@/config/colors";
import { Button } from "@/components/Button";
import { runScannerBatch, rescanAllPhotos } from "@/services/pii/scanner";
import { Link } from "expo-router";
import { useImageContext } from "@/providers/ImageContextProvider/ImageContextProvider";
import * as MediaLibrary from "expo-media-library";
import { recognizeText } from "@/services/ocr/mlkit";
import { Image as ExpoImage } from "expo-image";

export default function DebugScreen() {
  const { updateScannerProgress } = useImageContext();

  const [ocrPreview, setOcrPreview] = useState<{
    uri: string | null;
    text: string;
    lines: number;
    words: number;
  }>({ uri: null, text: "", lines: 0, words: 0 });

  const handleRunScan = async () => {
    await runScannerBatch();
    await updateScannerProgress();
  };

  const handleRescan = async () => {
    await rescanAllPhotos();
    await updateScannerProgress();
  };

  // Quick OCR smoke test: picks the latest photo and runs on-device OCR.
  const handleTestOcr = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("OCR Test", "Media library permission not granted.");
        return;
      }
      const assets = await MediaLibrary.getAssetsAsync({
        mediaType: "photo",
        first: 1,
      });
      if (!assets.assets.length) {
        Alert.alert("OCR Test", "No photos found in media library.");
        return;
      }
      const uri = assets.assets[0].uri;
      const result = await recognizeText(uri);

      // Update preview panel to show the image and recognized text
      setOcrPreview({
        uri,
        text: result.fullText ?? "",
        lines: result.lines?.length ?? 0,
        words: result.words?.length ?? 0,
      });

      // eslint-disable-next-line no-console
      console.log("[OCR TEST] Result:", {
        uri,
        textLen: result.fullText.length,
        lines: result.lines.length,
        words: result.words.length,
      });

      Alert.alert(
        "OCR Test Result",
        `URI: ${uri}\nText length: ${result.fullText.length}\nLines: ${result.lines.length}\nWords: ${result.words.length}`,
      );
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[OCR TEST] Failed:", e);
      Alert.alert("OCR Test", `Failed: ${String(e)}`);
    }
  };

  return (
    <View style={styles.container}>
      <HeaderText>PII Scanner Database</HeaderText>
      <Button onPress={handleRunScan} style={styles.button}>
        Force Run Scan Batch
      </Button>
      <Button onPress={handleRescan} style={styles.button}>
        Rescan All Photos
      </Button>
      <Button onPress={handleTestOcr} style={styles.button}>
        Test OCR on latest photo
      </Button>
      <Link href="/flagged" asChild>
        <Button style={styles.button}>View Flagged Photos</Button>
      </Link>

      {ocrPreview.uri && (
        <View style={styles.preview}>
          <ExpoImage
            source={{ uri: ocrPreview.uri }}
            style={styles.previewImage}
            contentFit="contain"
          />
          <Text style={styles.previewTitle}>
            Recognized Text (lines: {ocrPreview.lines}, words: {ocrPreview.words})
          </Text>
          <ScrollView style={styles.previewTextBox}>
            <Text selectable>{ocrPreview.text || "(no text recognized)"}</Text>
          </ScrollView>
        </View>
      )}

      <DatabaseDebugView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    padding: 10,
    paddingTop: 50,
  },
  button: {
    marginBottom: 15,
    backgroundColor: colors.pink,
  },
});
