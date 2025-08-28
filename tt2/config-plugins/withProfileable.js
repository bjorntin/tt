const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const { getMainApplicationOrThrow } = AndroidConfig.Manifest;

const withProfileable = (config) => {
  return withAndroidManifest(config, async (config) => {
    config.modResults = await setCustomConfigAsync(config, config.modResults);
    return config;
  });
};

async function setCustomConfigAsync(_, androidManifest) {
  const mainApplication = getMainApplicationOrThrow(androidManifest);

  mainApplication.profileable = {
    $: {
      "android:shell": "true",
    },
  };

  return androidManifest;
}

module.exports = withProfileable;
