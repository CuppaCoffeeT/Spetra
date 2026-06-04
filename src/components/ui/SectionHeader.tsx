import React from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { spacing } from '@/src/theme';
import { Text } from './Text';

interface SectionHeaderAction {
  label: string;
  onPress: () => void;
}

export interface SectionHeaderProps {
  title: string;
  action?: SectionHeaderAction | React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

function isLabelAction(
  action: SectionHeaderAction | React.ReactNode
): action is SectionHeaderAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'label' in action &&
    'onPress' in action
  );
}

export function SectionHeader({ title, action, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <Text variant="heading">{title}</Text>
      {action != null
        ? isLabelAction(action)
          ? (
            <Text variant="label" color="accent" onPress={action.onPress}>
              {action.label}
            </Text>
          )
          : action
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
});

export default SectionHeader;
