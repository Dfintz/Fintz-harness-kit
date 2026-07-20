import { useShip } from '@/hooks/queries/useShipQueries';
import { Colors, Spacing } from '@/utils/theme';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { FleetStackParamList } from '../../navigation/types';

export const ShipDetailScreen: React.FC = () => {
  const route = useRoute<RouteProp<FleetStackParamList, 'ShipDetail'>>();
  const shipId = route.params?.shipId;

  const { data: ship, isLoading } = useShip(shipId);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!ship) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Ship not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{ship.customName || ship.name}</Text>
        <Text style={styles.subtitle}>
          {ship.manufacturer} · {ship.model}
        </Text>
      </View>

      <View style={styles.detailsCard}>
        <DetailRow label="Role" value={ship.role} />
        <DetailRow label="Size" value={ship.size} />
        {ship.status && <DetailRow label="Status" value={ship.status} />}
        {ship.condition && <DetailRow label="Condition" value={ship.condition} />}
      </View>
    </ScrollView>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: { fontSize: 16, color: Colors.error },
  header: { padding: Spacing.lg, backgroundColor: Colors.surface },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.primary },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginTop: Spacing.xs },
  detailsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    margin: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  detailLabel: { fontSize: 14, color: Colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: Colors.text },
});
