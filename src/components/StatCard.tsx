import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface StatCardProps {
  label: string;
  value: string;
  accent?: 'primary' | 'success' | 'danger';
  footer?: ReactNode;
}

const accentColors = {
  primary: '#2563EB',
  success: '#059669',
  danger: '#DC2626',
};

export const StatCard = ({ label, value, accent = 'primary', footer }: StatCardProps) => {
  return (
    <View style={[styles.card, { borderColor: accentColors[accent] }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: accentColors[accent] }]}>{value}</Text>
      {footer}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  label: {
    fontSize: 14,
    color: '#64748B',
  },
  value: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 6,
  },
});
