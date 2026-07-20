import { useMyProfile } from '@/hooks/queries/useUserQueries';
import { useAuthStore } from '@/store/authStore';
import { Colors, Spacing } from '@/utils/theme';
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export const ProfileScreen: React.FC = () => {
  const { data: profile, isLoading } = useMyProfile();
  const logout = useAuthStore(state => state.logout);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{profile?.displayName || profile?.username || 'User'}</Text>
        {profile?.role && <Text style={styles.email}>{profile.role}</Text>}
        {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      </View>

      {profile?.rsiHandle && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>RSI Handle</Text>
          <Text style={styles.cardValue}>
            {profile.rsiHandle} {profile.rsiVerified ? '✓' : ''}
          </Text>
        </View>
      )}

      {profile?.organizations && profile.organizations.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Organizations</Text>
          {profile.organizations.map(org => (
            <View key={org.orgId} style={styles.orgRow}>
              <Text style={styles.orgName}>{org.orgName}</Text>
              <Text style={styles.orgRole}>{org.roleName}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
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
  header: { padding: Spacing.lg, backgroundColor: Colors.surface },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.primary },
  email: { fontSize: 14, color: Colors.textSecondary, marginTop: Spacing.xs },
  bio: { fontSize: 14, color: Colors.text, marginTop: Spacing.sm },
  card: {
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
  cardLabel: { fontSize: 12, color: Colors.textTertiary, marginBottom: 4 },
  cardValue: { fontSize: 16, fontWeight: '600', color: Colors.text },
  cardTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 10 },
  orgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  orgName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  orgRole: { fontSize: 14, color: Colors.textSecondary },
  logoutButton: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: 10,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  logoutText: { color: Colors.textInverse, fontSize: 16, fontWeight: '600' },
});
