import { View, StyleSheet } from "react-native";
import { FlaggedPhotosView } from "@/components/FlaggedPhotosView";
import { HeaderText } from "@/components/HeaderText";
import { colors } from "@/config/colors";

export default function FlaggedScreen() {
  return (
    <View style={styles.container}>
      <HeaderText>Flagged for PII</HeaderText>
      <FlaggedPhotosView />
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
});
