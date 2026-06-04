import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { spacing, useColors } from '@/src/theme';

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  scroll = false,
  padded = false,
  refreshControl,
  style,
  contentContainerStyle,
}: ScreenProps) {
  const c = useColors();

  if (scroll) {
    return (
      <View style={[styles.root, { backgroundColor: c.bg }, style]}>
        <ScrollView
          refreshControl={refreshControl}
          contentContainerStyle={[
            padded && styles.padded,
            contentContainerStyle,
          ]}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: c.bg },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  padded: {
    padding: spacing.lg,
  },
});

export default Screen;
