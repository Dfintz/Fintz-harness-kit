import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  useMyOrganizations,
  useOrganizationMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from '../../hooks/queries/useOrganizationQueries';
import type { MembersStackParamList } from '../../navigation/types';
import type { OrganizationMemberV2 } from '../../services/organizationServiceV2';
import { useAuthStore } from '../../store/authStore';
import { ScreenStyles } from '../../utils/sharedStyles';
import { Colors } from '../../utils/theme';

const ROLE_OPTIONS = ['member', 'officer', 'fleet_commander', 'admin'] as const;

export const MembersScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MembersStackParamList>>();
  const { data: orgs } = useMyOrganizations();
  const orgId = orgs?.[0]?.id;
  const currentUserId = useAuthStore(state => state.user?.id);

  const { data: membersData, isLoading, refetch } = useOrganizationMembers(orgId);
  const updateMemberRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [refreshing, setRefreshing] = React.useState(false);
  const [roleModalVisible, setRoleModalVisible] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState<string>('member');
  const [targetMember, setTargetMember] = React.useState<OrganizationMemberV2 | null>(null);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const openMember = React.useCallback(
    (member: OrganizationMemberV2) => {
      navigation.navigate('MemberDetail', { userId: member.userId });
    },
    [navigation]
  );

  const openRoleModal = React.useCallback((member: OrganizationMemberV2) => {
    setTargetMember(member);
    setSelectedRole(member.role || 'member');
    setRoleModalVisible(true);
  }, []);

  const handleApplyRole = React.useCallback(async () => {
    if (!orgId || !targetMember) {
      return;
    }
    try {
      await updateMemberRole.mutateAsync({
        organizationId: orgId,
        memberId: targetMember.userId,
        role: selectedRole,
      });
      setRoleModalVisible(false);
      setTargetMember(null);
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update role';
      Alert.alert('Role update failed', message);
    }
  }, [orgId, targetMember, selectedRole, updateMemberRole, refetch]);

  const confirmRemoveMember = React.useCallback(
    (member: OrganizationMemberV2) => {
      if (!orgId) {
        return;
      }

      Alert.alert(
        'Remove member',
        `Remove ${member.displayName || member.username || member.userId} from this organization?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeMember.mutateAsync({
                  organizationId: orgId,
                  memberId: member.userId,
                });
                await refetch();
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to remove member';
                Alert.alert('Remove failed', message);
              }
            },
          },
        ]
      );
    },
    [orgId, removeMember, refetch]
  );

  const members = membersData?.items ?? [];

  const renderMember = ({ item }: { item: OrganizationMemberV2 }) => {
    const isSelf = item.userId === currentUserId;

    return (
      <View style={styles.memberCard}>
        <TouchableOpacity style={styles.memberInfo} onPress={() => openMember(item)}>
          <Text style={styles.memberName}>{item.displayName || item.username || item.userId}</Text>
          <Text style={styles.memberRole}>{item.role}</Text>
        </TouchableOpacity>

        <View style={styles.memberActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openRoleModal(item)}
            disabled={updateMemberRole.isPending || isSelf}
          >
            <Text style={styles.actionButtonText}>Role</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.removeAction]}
            onPress={() => confirmRemoveMember(item)}
            disabled={removeMember.isPending || isSelf}
          >
            <Text style={[styles.actionButtonText, styles.removeActionText]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading && !refreshing) {
    return (
      <View style={[ScreenStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={ScreenStyles.container}>
      <FlatList
        data={members}
        renderItem={renderMember}
        keyExtractor={item => item.userId}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {membersData?.pagination.total ?? members.length} Members
            </Text>
            <Text style={styles.headerSubtitle}>
              Tap a member to view details. Use Role/Remove for commands.
            </Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No members found</Text>}
      />

      <Modal
        visible={roleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Member Role</Text>
            <Text style={styles.modalSubtitle}>
              {targetMember?.displayName || targetMember?.username || targetMember?.userId}
            </Text>

            <View style={styles.roleOptionsWrap}>
              {ROLE_OPTIONS.map(role => {
                const selected = selectedRole === role;
                return (
                  <Pressable
                    key={role}
                    style={[styles.roleOption, selected && styles.roleOptionSelected]}
                    onPress={() => setSelectedRole(role)}
                  >
                    <Text
                      style={[styles.roleOptionText, selected && styles.roleOptionTextSelected]}
                    >
                      {role.replaceAll('_', ' ')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setRoleModalVisible(false);
                  setTargetMember(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleApplyRole}
                disabled={updateMemberRole.isPending}
              >
                <Text style={styles.confirmButtonText}>
                  {updateMemberRole.isPending ? 'Saving...' : 'Apply'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textTertiary,
  },
  listContent: {
    padding: 12,
  },
  memberCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.surfaceElevated,
  },
  actionButtonText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  removeAction: {
    borderColor: Colors.error,
    backgroundColor: Colors.surface,
  },
  removeActionText: {
    color: Colors.error,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  roleOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  roleOption: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  roleOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceElevated,
  },
  roleOptionText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  roleOptionTextSelected: {
    color: Colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  confirmButtonText: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
});
