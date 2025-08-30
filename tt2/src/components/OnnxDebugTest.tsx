import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";

export const OnnxDebugTest: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const addLog = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testOnnxRuntime = async () => {
    setTesting(true);
    setTestResults([]);
    
    try {
      addLog("🔍 Testing ONNX Runtime availability...");
      
      // Test 1: Check if onnxruntime-react-native can be required
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ort = require("onnxruntime-react-native");
        addLog("✅ onnxruntime-react-native module loaded");
        addLog(`📦 ORT keys: ${Object.keys(ort || {}).join(", ")}`);
        
        if (ort?.InferenceSession) {
          addLog("✅ InferenceSession class found");
        } else {
          addLog("❌ InferenceSession class missing");
          setTesting(false);
          return;
        }
      } catch (error) {
        addLog(`❌ Failed to load onnxruntime-react-native: ${error}`);
        setTesting(false);
        return;
      }

      // Test 2: Check if model asset can be loaded
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const modelAsset = require("@/assets/models/pii_model/model.onnx");
        addLog("✅ Model asset loaded");
        addLog(`📄 Asset type: ${typeof modelAsset}, value: ${modelAsset}`);
      } catch (error) {
        addLog(`❌ Failed to load model asset: ${error}`);
        setTesting(false);
        return;
      }

      // Test 3: Check if config can be loaded
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const config = require("@/assets/models/pii_model/config.json");
        addLog("✅ Config loaded");
        addLog(`🏷️ Labels count: ${Object.keys(config?.id2label || {}).length}`);
      } catch (error) {
        addLog(`❌ Failed to load config: ${error}`);
      }

      // Test 4: Check if tokenizer config can be loaded
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const tokConfig = require("@/assets/models/pii_model/tokenizer.json");
        addLog("✅ Tokenizer config loaded");
        addLog(`📝 Vocab size: ${Object.keys(tokConfig?.model?.vocab || {}).length}`);
      } catch (error) {
        addLog(`❌ Failed to load tokenizer config: ${error}`);
      }

      // Test 5: Try to create an ONNX session
      try {
        addLog("🚀 Attempting to create ONNX session...");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ort = require("onnxruntime-react-native");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Asset } = require("expo-asset");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const modelAsset = require("@/assets/models/pii_model/model.onnx");
        
        const asset = Asset.fromModule(modelAsset);
        await asset.downloadAsync();
        const modelPath = asset.localUri ?? asset.uri;
        addLog(`📍 Model path: ${modelPath}`);
        
        const session = await ort.InferenceSession.create(modelPath);
        addLog("✅ ONNX session created successfully!");
        addLog(`🔧 Input names: ${session.inputNames?.join(", ")}`);
        addLog(`📤 Output names: ${session.outputNames?.join(", ")}`);
        
        // Clean up
        session.release?.();
        addLog("🧹 Session cleaned up");
        
      } catch (error) {
        addLog(`❌ Failed to create ONNX session: ${error}`);
        addLog(`📋 Error details: ${(error as any)?.message || "Unknown error"}`);
      }

      addLog("🏁 ONNX test completed");
      
    } catch (error) {
      addLog(`💥 Unexpected error: ${error}`);
    }
    
    setTesting(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ONNX Debug Test</Text>
      
      <TouchableOpacity 
        style={[styles.button, testing && styles.buttonDisabled]} 
        onPress={testOnnxRuntime}
        disabled={testing}
      >
        <Text style={styles.buttonText}>
          {testing ? "Testing..." : "Test ONNX Runtime"}
        </Text>
      </TouchableOpacity>

      <ScrollView style={styles.logContainer}>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.logText}>
            {result}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
  logContainer: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 8,
    padding: 12,
  },
  logText: {
    color: "#00ff00",
    fontFamily: "monospace",
    fontSize: 12,
    marginBottom: 4,
  },
});