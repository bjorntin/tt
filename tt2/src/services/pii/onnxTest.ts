/* eslint-disable no-console */

export async function testOnnxSetup(): Promise<string[]> {
  const logs: string[] = [];
  
  try {
    logs.push("🔍 Testing ONNX Runtime setup...");
    
    // Test 1: Check if onnxruntime-react-native can be required
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ort = require("onnxruntime-react-native");
      logs.push("✅ onnxruntime-react-native module loaded");
      logs.push(`📦 ORT keys: ${Object.keys(ort || {}).join(", ")}`);
      
      if (ort?.InferenceSession) {
        logs.push("✅ InferenceSession class found");
      } else {
        logs.push("❌ InferenceSession class missing");
        return logs;
      }
    } catch (error) {
      logs.push(`❌ Failed to load onnxruntime-react-native: ${error}`);
      return logs;
    }

    // Test 2: Check if model asset can be loaded
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const modelAsset = require("@/assets/models/pii_model/model.onnx");
      logs.push("✅ Model asset loaded");
      logs.push(`📄 Asset type: ${typeof modelAsset}, value: ${modelAsset}`);
    } catch (error) {
      logs.push(`❌ Failed to load model asset: ${error}`);
      return logs;
    }

    // Test 3: Check if config can be loaded
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const config = require("@/assets/models/pii_model/config.json");
      logs.push("✅ Config loaded");
      logs.push(`🏷️ Labels count: ${Object.keys(config?.id2label || {}).length}`);
    } catch (error) {
      logs.push(`❌ Failed to load config: ${error}`);
    }

    // Test 4: Try to create an ONNX session
    try {
      logs.push("🚀 Attempting to create ONNX session...");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ort = require("onnxruntime-react-native");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Asset } = require("expo-asset");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const modelAsset = require("@/assets/models/pii_model/model.onnx");
      
      const asset = Asset.fromModule(modelAsset);
      await asset.downloadAsync();
      const modelPath = asset.localUri ?? asset.uri;
      logs.push(`📍 Model path: ${modelPath}`);
      
      const session = await ort.InferenceSession.create(modelPath);
      logs.push("✅ ONNX session created successfully!");
      logs.push(`🔧 Input names: ${session.inputNames?.join(", ")}`);
      logs.push(`📤 Output names: ${session.outputNames?.join(", ")}`);
      
      // Clean up
      session.release?.();
      logs.push("🧹 Session cleaned up");
      
    } catch (error) {
      logs.push(`❌ Failed to create ONNX session: ${error}`);
      logs.push(`📋 Error details: ${(error as any)?.message || "Unknown error"}`);
    }

    logs.push("🏁 ONNX test completed");
    
  } catch (error) {
    logs.push(`💥 Unexpected error: ${error}`);
  }
  
  return logs;
}