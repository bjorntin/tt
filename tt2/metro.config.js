const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Ensure Metro bundles ONNX and text assets from ./assets/models/pii_model
const extraAssetExts = ["onnx", "txt"];
config.resolver.assetExts = Array.from(
  new Set([...(config.resolver.assetExts || []), ...extraAssetExts]),
);

module.exports = config;
