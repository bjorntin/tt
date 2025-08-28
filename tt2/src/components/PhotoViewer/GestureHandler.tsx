import React, { useRef } from "react";
import { View, PanResponder } from "react-native";
import { GestureHandlerProps } from "./types";

const SWIPE_THRESHOLD = 50; // Minimum distance for swipe recognition
const SWIPE_VELOCITY_THRESHOLD = 0.3; // Minimum velocity for swipe

export const GestureHandler: React.FC<GestureHandlerProps> = ({
  onSwipeLeft,
  onSwipeRight,
  onTap,
  children,
}) => {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Gesture started - could add haptic feedback here
      },
      onPanResponderMove: () => {
        // Handle move if needed for visual feedback
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, dy, vx } = gestureState;

        // Check if it's more horizontal than vertical (to distinguish swipe from tap)
        const isHorizontalSwipe = Math.abs(dx) > Math.abs(dy);
        const meetsDistanceThreshold = Math.abs(dx) > SWIPE_THRESHOLD;
        const meetsVelocityThreshold = Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD;

        if (
          isHorizontalSwipe &&
          (meetsDistanceThreshold || meetsVelocityThreshold)
        ) {
          if (dx > 0) {
            // Swipe right - go to previous
            onSwipeRight();
          } else {
            // Swipe left - go to next
            onSwipeLeft();
          }
        } else if (
          Math.abs(dx) < 20 &&
          Math.abs(dy) < 20 &&
          Math.abs(vx) < 0.1
        ) {
          // Treat as tap if movement is minimal
          onTap();
        }
        // If neither swipe nor tap, just ignore
      },
      onPanResponderTerminate: () => {
        // Gesture terminated - could reset any visual feedback
      },
    }),
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
};
