# Software Mansion React Native Labs - dev scripts

- [populate-device-with-images.ts](./populate-device-with-images.ts) - populates the selected device with images takes from [../assets/photos](../assets/photos)
  - run `bun populate-device-with-images`
    > [!WARNING]
    > You need to have `GraphicsMagick` and `ghostscript` installed:
    >
    > ```bash
    > brew install graphicsmagick ghostscript
    > ```
- [android-scroll-demo.sh](./android-scroll-demo.sh) - automates the Android device by sending several adb command in a scripted way
  - run `./android-scroll-demo.sh`
