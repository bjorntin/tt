#!/bin/bash

set -a
if [ -f ../.env ]; then
    source ../.env
else
    echo "Warning: ../.env file not found. Using default package."
    EXPO_ANDROID_PACKAGE="com.swmansion.photos"
fi
set +a

declare -A SCENARIO_PATHS=(
    ["1"]="list-scenarios/rn-image-in-scroll-view-demo"
    ["2"]="list-scenarios/expo-image-in-scroll-view-demo"
    ["3"]="list-scenarios/flatlist-demo"
    ["4"]="list-scenarios/flashlist-demo"
    ["5"]="list-scenarios/legendlist-demo"
    ["6"]="photos-gallery"
    ["7"]="placeholders/static-image-placeholder-demo"
    ["8"]="placeholders/skeleton-placeholder-demo"
    ["9"]="placeholders/blurhash-placeholder-demo"
)

# Device selection
adb_devices_output=$(adb devices | awk 'NR>1 && $1!="" {print $1}')
DEVICE_LIST=($adb_devices_output)

if [ ${#DEVICE_LIST[@]} -eq 0 ]; then
    echo "No Android devices found. Please connect a device or start an emulator."
    exit 1
fi

if [ ${#DEVICE_LIST[@]} -eq 1 ]; then
    DEVICE_ID=${DEVICE_LIST[0]}
    echo "Using the only connected device: $DEVICE_ID"
else
    echo "Available Android devices:"
    for i in "${!DEVICE_LIST[@]}"; do
        echo "$((i + 1)). ${DEVICE_LIST[$i]}"
    done
    read -p "Enter the number of the device to use: " DEVICE_NUM
    DEVICE_ID=${DEVICE_LIST[$((DEVICE_NUM - 1))]}
    if [ -z "$DEVICE_ID" ]; then
        echo "Invalid device selection. Exiting."
        exit 1
    fi
fi

echo "Select a scenario to test:"
for i in "${!SCENARIO_PATHS[@]}"; do
    echo "$i. ${SCENARIO_PATHS[$i]}"
done
read -p "Enter the number of the scenario: " SCENARIO_NUM

SCENARIO_PATH=${SCENARIO_PATHS[$SCENARIO_NUM]}

if [ -z "$SCENARIO_PATH" ]; then
    echo "Invalid selection. Exiting."
    exit 1
fi

SCENARIO_NAME=$(basename "$SCENARIO_PATH")

adb -s "$DEVICE_ID" shell mkdir -p /sdcard/auto-recordings

echo "Recording scenario: $SCENARIO_NAME on device: $DEVICE_ID."

# Start recording
adb -s "$DEVICE_ID" shell screenrecord --verbose /sdcard/auto-recordings/$SCENARIO_NAME.mp4 &
SCREENRECORD_PID=$!

sleep 1

# Run the app
adb -s "$DEVICE_ID" shell am start -a android.intent.action.VIEW -d "swmphotos://$SCENARIO_PATH" $EXPO_ANDROID_PACKAGE

sleep 4

function scroll_down() {
    local duration=${1:-50}
    adb -s "$DEVICE_ID" shell input swipe 500 1500 500 600 "$duration"
    echo "Scrolled down for $duration ms on device: $DEVICE_ID"
}

function scroll_up() {
    local duration=${1:-20}
    adb -s "$DEVICE_ID" shell input swipe 500 600 500 1500 "$duration"
    echo "Scrolled up for $duration ms on device: $DEVICE_ID"
}

# Run the appropriate scenario function based on the selected scenario
case "$SCENARIO_NUM" in
1 | 2)
    # run_image_comparison_scenario
    sleep 2
    scroll_down 50
    sleep 10
    ;;
3 | 4 | 5)
    # run_list_comparison_scenario
    # Scroll down slowly
    for i in {1..3}; do
        scroll_down 100
        sleep 1
    done

    sleep 1

    # Scroll down quickly
    for i in {1..6}; do
        scroll_down 30
        sleep 1
    done

    sleep 3

    # Scroll up
    for i in {1..3}; do
        scroll_up 20
        sleep 1
    done
    ;;
7 | 8 | 9)
    # run_placeholder_scenario
    echo "Running placeholder scenario"
    sleep 4

    scroll_down 80

    sleep 5
    echo "Placeholder scenario completed"
    ;;
    # No extra actions for other scenarios
esac

sleep 3

# Stop recording
kill $SCREENRECORD_PID

# Wait for the recording to finish
sleep 1

# Kill the app
adb -s "$DEVICE_ID" shell am force-stop $EXPO_ANDROID_PACKAGE

adb -s "$DEVICE_ID" pull /sdcard/auto-recordings/$SCENARIO_NAME.mp4 .

echo "Scrolling test completed for scenario: $SCENARIO_PATH on device: $DEVICE_ID."
