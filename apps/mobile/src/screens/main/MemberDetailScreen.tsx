import { useUserProfile, useUserShips } from '@/hooks/queries/useUserQueries';
import { Colors, Spacing } from '@/utils/theme';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MembersStackParamList } from '../../navigation/types';

export const MemberDetailScreen: React.FC = () => {
  const route = useRoute<RouteProp<MembersStackParamList, 'MemberDetail'>>();
  const userId = route.params?.userId;

  const { data: profile, isLoading } = useUserProfile(userId);
  const { data: ships } = useUserShips(userId);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{profile.displayName || profile.username}</Text>
        {profile.role && <Text style={styles.role}>{profile.role}</Text>}
        {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      </View>

      {profile.rsiHandle && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>RSI</Text>
          <Text style={styles.cardValue}>
            {profile.rsiHandle} {profile.rsiVerified ? '✓ Verified' : ''}
          </Text>
        </View>
      )}

      {ships && ships.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ships ({ships.length})</Text>
          {ships.slice(0, 10).map(ship => (
            <View key={ship.id} style={styles.shipRow}>
              <Text style={styles.shipName}>{ship.customName || ship.shipName}</Text>
              {ship.manufacturer && <Text style={styles.shipMeta}>{ship.manufacturer}</Text>}
            </View>
          ))}
        </View>
      )}
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
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.primary },
  role: { fontSize: 14, color: Colors.textSecondary, marginTop: Spacing.xs },
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
  cardTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 10 },
  cardValue: { fontSize: 14, color: Colors.textSecondary },
  shipRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  shipName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  shipMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
