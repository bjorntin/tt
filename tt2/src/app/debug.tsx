import { View, StyleSheet } from "react-native";
import { DatabaseDebugView } from "@/components/DatabaseDebugView";
import { HeaderText } from "@/components/HeaderText";
import { colors } from "@/config/colors";
import { Button } from "@/components/Button";
import { runScannerBatch } from "@/services/pii/scanner";
import { Link } from "expo-router";
import { useImageContext } from "@/providers/ImageContextProvider/ImageContextProvider";

export default function DebugScreen() {
  const { updateScannerProgress } = useImageContext();

  const handlePress = async () => {
    await runScannerBatch();
    await updateScannerProgress();
  };

  return (
    <View style={styles.container}>
      <HeaderText>PII Scanner Database</HeaderText>
      <Button onPress={handlePress} style={styles.button}>
        Force Run Full Scan & Refresh
      </Button>
      <Link href="/flagged" asChild>
        <Button style={styles.button}>View Flagged Photos</Button>
      </Link>
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
