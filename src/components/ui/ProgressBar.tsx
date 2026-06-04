import React from 'react';
import { DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { radii, useColors } from '@/src/theme';

export interface ProgressBarProps {
  value: number;
  color?: string;
  trackColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({
  value,
  color,
  trackColor,
  height = 8,
  style,
}: ProgressBarProps) {
  const c = useColors();
  const clamped = Math.max(0, Math.min(1, value));
  const fillWidth: DimensionValue = `${clamped * 100}%`;

  return (
    <View
      style={[
        styles.track,
        { height, backgroundColor: trackColor ?? c.surfaceAlt },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          { height, width: fillWidth, backgroundColor: color ?? c.accent },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radii.pill,
  },
});

export default ProgressBar;
