import { ConfigPlugin, withAppBuildGradle, withDangerousMod } from "@expo/config-plugins";

/**
 * Expo config plugin to bundle Google ML Kit Text Recognition v2 into the APK
 * so OCR works fully offline on first run.
 *
 * - Adds Gradle dependency: com.google.mlkit:text-recognition:16.0.0
 * - Appends ProGuard keep rules to prevent stripping ML Kit classes
 *
 * Usage (app.config.ts):
 *   plugins: [
 *     ...,
 *     ["./config-plugins/withMlkitTextRecognition"],
 *   ]
 */

const DEP_LINE = 'implementation("com.google.mlkit:text-recognition:16.0.0")';

const withMlkitTextRecognition: ConfigPlugin = (config) => {
  // Inject ML Kit dependency into android/app/build.gradle
  config = withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;

    if (!src.includes(DEP_LINE)) {
      // Try to insert inside the dependencies block
      const re = /dependencies\s*{([\s\S]*?)^\s*}/m;
      if (re.test(src)) {
        src = src.replace(re, (full, inner) => {
          if (inner.includes(DEP_LINE)) return full;
          const injected = `${inner.trimEnd()}\n    ${DEP_LINE}\n`;
          return full.replace(inner, injected);
        });
      } else {
        // Fallback: append a new dependencies block
        src += `

dependencies {
    ${DEP_LINE}
}
`;
      }
    }

    cfg.modResults.contents = src;
    return cfg;
  });

  // Append ProGuard keep rules to android/app/proguard-rules.pro
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const fs = require("fs");
      const path = require("path");
      const proguardPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "proguard-rules.pro",
      );

      const keepRules = `
# ML Kit Text Recognition keep rules (added by withMlkitTextRecognition)
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_** { *; }
# Keep annotations
-keepattributes *Annotation*
`;

      try {
        let contents = "";
        try {
          contents = fs.readFileSync(proguardPath, "utf8");
        } catch {
          // File may not exist; create it
          fs.writeFileSync(proguardPath, "", "utf8");
        }
        if (!contents.includes("withMlkitTextRecognition")) {
          fs.writeFileSync(
            proguardPath,
            contents.trimEnd() + "\n" + keepRules,
            "utf8",
          );
        }
      } catch {
        // no-op; do not fail build if proguard cannot be modified
      }

      return cfg;
    },
  ]);

  return config;
};

export default withMlkitTextRecognition;