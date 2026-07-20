import {
  useDeleteFleet,
  useFleet,
  useFleetShips,
  useUpdateFleet,
} from '@/hooks/queries/useFleetQueries';
import { Colors, Spacing } from '@/utils/theme';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FleetFormModal } from '../../components/common/FleetFormModal';
import type { FleetStackParamList } from '../../navigation/types';

export const FleetDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<FleetStackParamList>>();
  const route = useRoute<RouteProp<FleetStackParamList, 'FleetDetail'>>();
  const fleetId = route.params?.fleetId;
  const updateFleet = useUpdateFleet();
  const deleteFleet = useDeleteFleet();

  const { data: fleet, isLoading, refetch: refetchFleet } = useFleet(fleetId);
  const { data: shipsData, refetch: refetchShips } = useFleetShips(fleetId);

  const [editModalVisible, setEditModalVisible] = React.useState(false);
  const [editedName, setEditedName] = React.useState('');
  const [editedDescription, setEditedDescription] = React.useState('');

  const handleOpenEdit = React.useCallback(() => {
    if (!fleet) {
      return;
    }
    setEditedName(fleet.name ?? '');
    setEditedDescription(fleet.description ?? '');
    setEditModalVisible(true);
  }, [fleet]);

  const handleSaveEdit = React.useCallback(async () => {
    if (!fleetId) {
      return;
    }

    const trimmedName = editedName.trim();
    if (!trimmedName) {
      Alert.alert('Fleet name required', 'Enter a fleet name before saving changes.');
      return;
    }

    try {
      await updateFleet.mutateAsync({
        fleetId,
        data: {
          name: trimmedName,
          description: editedDescription.trim() || undefined,
        },
      });
      setEditModalVisible(false);
      await Promise.all([refetchFleet(), refetchShips()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update fleet';
      Alert.alert('Update failed', message);
    }
  }, [fleetId, editedName, editedDescription, updateFleet, refetchFleet, refetchShips]);

  const handleDeleteFleet = React.useCallback(() => {
    if (!fleetId || !fleet) {
      return;
    }

    Alert.alert('Delete fleet', `Delete ${fleet.name}? This action cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFleet.mutateAsync(fleetId);
            navigation.goBack();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete fleet';
            Alert.alert('Delete failed', message);
          }
        },
      },
    ]);
  }, [fleetId, fleet, deleteFleet, navigation]);

  const handleOpenShip = React.useCallback(
    (shipId: string) => {
      navigation.navigate('ShipDetail', { shipId });
    },
    [navigation]
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!fleet) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Fleet not found</Text>
      </View>
    );
  }

  const ships = shipsData?.items ?? [];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{fleet.name}</Text>
          <View style={styles.commandRow}>
            <TouchableOpacity style={styles.commandButton} onPress={handleOpenEdit}>
              <Text style={styles.commandButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.commandButton, styles.deleteCommand]}
              onPress={handleDeleteFleet}
              disabled={deleteFleet.isPending}
            >
              <Text style={[styles.commandButtonText, styles.deleteCommandText]}>
                {deleteFleet.isPending ? 'Deleting...' : 'Delete'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {fleet.description && <Text style={styles.description}>{fleet.description}</Text>}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{fleet.shipCount ?? ships.length}</Text>
          <Text style={styles.statLabel}>Ships</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{fleet.memberCount ?? 0}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ships</Text>
        {ships.length === 0 ? (
          <Text style={styles.placeholder}>No ships assigned</Text>
        ) : (
          ships.map(ship => (
            <TouchableOpacity
              key={ship.id}
              style={styles.shipRow}
              onPress={() => handleOpenShip(ship.id)}
            >
              <View>
                <Text style={styles.shipName}>{ship.name}</Text>
                <Text style={styles.shipMeta}>
                  {ship.manufacturer} · {ship.role}
                </Text>
              </View>
              <Text style={styles.shipChevron}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <FleetFormModal
        visible={editModalVisible}
        title="Edit Fleet"
        confirmLabel="Save"
        pendingLabel="Saving..."
        isPending={updateFleet.isPending}
        name={editedName}
        description={editedDescription}
        onNameChange={setEditedName}
        onDescriptionChange={setEditedDescription}
        onCancel={() => setEditModalVisible(false)}
        onConfirm={handleSaveEdit}
      />
    </ScrollView>
  );
};

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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.primary },
  commandRow: {
    flexDirection: 'row',
    gap: 6,
  },
  commandButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceElevated,
  },
  commandButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  deleteCommand: {
    borderColor: Colors.error,
    backgroundColor: Colors.surface,
  },
  deleteCommandText: {
    color: Colors.error,
  },
  description: { fontSize: 14, color: Colors.textSecondary, marginTop: Spacing.xs },
  statsRow: { flexDirection: 'row', gap: 8, padding: Spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: 'bold', color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  section: {
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
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 10 },
  placeholder: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  shipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  shipName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  shipMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  shipChevron: {
    fontSize: 24,
    color: Colors.textTertiary,
    marginLeft: 12,
  },
});
