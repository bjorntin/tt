import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import * as SQLite from "expo-sqlite";
import { colors } from "@/config/colors";

const db = SQLite.openDatabaseSync("pii-scanner.db");

type ImageRow = {
  id: number;
  uri: string;
  status: string;
  findings: string | null;
};

export const DatabaseDebugView = () => {
  const [data, setData] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await db.getAllAsync<ImageRow>(
          "SELECT * FROM images ORDER BY id DESC;",
        );
        setData(result);
      } catch (error) {
        // console.error("Failed to fetch from database", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }

  if (data.length === 0) {
    return (
      <View style={styles.centered}>
        <Text>No data in the PII scanner database.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text
            style={styles.uriText}
          >{`ID: ${item.id} - URI: ...${item.uri.slice(-40)}`}</Text>
          <Text style={styles.statusText}>{`Status: ${item.status}`}</Text>
        </View>
      )}
      contentContainerStyle={styles.container}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  row: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGrey,
    marginBottom: 5,
  },
  uriText: {
    fontSize: 12,
    color: colors.grey,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 4,
  },
});
