import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { spacing, useColors } from '@/src/theme';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  style,
}: ListRowProps) {
  const c = useColors();

  const content = (
    <>
      {left}
      <View style={styles.middle}>
        <Text variant="body">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </>
  );

  const rowStyle: StyleProp<ViewStyle> = [
    styles.row,
    { borderBottomColor: c.border },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={rowStyle}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={rowStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    borderBottomWidth: 1,
  },
  middle: {
    flex: 1,
  },
});

export default ListRow;
