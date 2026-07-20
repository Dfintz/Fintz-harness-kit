import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FleetFormModal } from '../../components/common/FleetFormModal';
import { useCreateFleet, useFleets, useFleetStatistics } from '../../hooks/queries/useFleetQueries';
import { useMyOrganizations } from '../../hooks/queries/useOrganizationQueries';
import type { FleetStackParamList } from '../../navigation/types';
import { ScreenStyles } from '../../utils/sharedStyles';
import { Colors } from '../../utils/theme';

export const FleetOverviewScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<FleetStackParamList>>();
  const { data: orgs } = useMyOrganizations();
  const orgId = orgs?.[0]?.id;
  const createFleet = useCreateFleet();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useFleetStatistics(orgId);

  const {
    data: fleetsData,
    isLoading: fleetsLoading,
    refetch: refetchFleets,
  } = useFleets(orgId, { page: 1, limit: 10 });

  const isLoading = statsLoading || fleetsLoading;
  const [refreshing, setRefreshing] = React.useState(false);
  const [createModalVisible, setCreateModalVisible] = React.useState(false);
  const [fleetName, setFleetName] = React.useState('');
  const [fleetDescription, setFleetDescription] = React.useState('');

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchStats(), refetchFleets()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchStats, refetchFleets]);

  const openCreateModal = React.useCallback(() => {
    if (!orgId) {
      Alert.alert('No organization selected', 'Join or switch to an organization first.');
      return;
    }
    setCreateModalVisible(true);
  }, [orgId]);

  const handleCreateFleet = React.useCallback(async () => {
    if (!orgId) {
      Alert.alert('No organization selected', 'Join or switch to an organization first.');
      return;
    }

    const trimmedName = fleetName.trim();
    if (!trimmedName) {
      Alert.alert('Fleet name required', 'Enter a name before creating the fleet.');
      return;
    }

    try {
      await createFleet.mutateAsync({
        organizationId: orgId,
        data: {
          name: trimmedName,
          description: fleetDescription.trim() || undefined,
        },
      });

      setCreateModalVisible(false);
      setFleetName('');
      setFleetDescription('');
      await Promise.all([refetchFleets(), refetchStats()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create fleet';
      Alert.alert('Create failed', message);
    }
  }, [orgId, fleetName, fleetDescription, createFleet, refetchFleets, refetchStats]);

  const handleOpenFleet = React.useCallback(
    (fleetId: string) => {
      navigation.navigate('FleetDetail', { fleetId });
    },
    [navigation]
  );

  if (isLoading && !refreshing) {
    return (
      <View style={[ScreenStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const fleets = fleetsData?.items ?? [];

  return (
    <ScrollView
      style={ScreenStyles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={openCreateModal}
            disabled={createFleet.isPending}
          >
            <Text style={styles.primaryActionText}>
              {createFleet.isPending ? 'Creating...' : 'Create Fleet'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={onRefresh}>
            <Text style={styles.secondaryActionText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalShips ?? 0}</Text>
            <Text style={styles.statLabel}>Ships</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalMembers ?? 0}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalFleets ?? 0}</Text>
            <Text style={styles.statLabel}>Fleets</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fleets</Text>
          {fleets.length === 0 ? (
            <Text style={styles.placeholder}>No fleets yet</Text>
          ) : (
            fleets.map(fleet => (
              <TouchableOpacity
                key={fleet.id}
                style={styles.fleetRow}
                onPress={() => handleOpenFleet(fleet.id)}
              >
                <View>
                  <Text style={styles.fleetName}>{fleet.name}</Text>
                  <Text style={styles.fleetMeta}>
                    {fleet.shipCount ?? 0} ships · {fleet.memberCount ?? 0} members
                  </Text>
                </View>
                <Text style={styles.fleetChevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      <FleetFormModal
        visible={createModalVisible}
        title="Create Fleet"
        confirmLabel="Create"
        pendingLabel="Creating..."
        isPending={createFleet.isPending}
        name={fleetName}
        description={fleetDescription}
        onNameChange={setFleetName}
        onDescriptionChange={setFleetDescription}
        onCancel={() => setCreateModalVisible(false)}
        onConfirm={handleCreateFleet}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryActionText: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryAction: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 10,
  },
  fleetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  fleetName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  fleetMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  fleetChevron: {
    fontSize: 24,
    color: Colors.textTertiary,
    marginLeft: 12,
  },
  placeholder: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
