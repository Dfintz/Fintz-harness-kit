import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  useDeleteNotification,
  useMarkAllNotificationsAsRead,
  useMarkNotificationsAsRead,
  useNotifications,
} from '../../hooks/queries/useNotificationQueries';
import type { Notification } from '../../types/apiV2';
import { ScreenStyles } from '../../utils/sharedStyles';
import { Colors } from '../../utils/theme';

export const NotificationsScreen: React.FC = () => {
  const { data: notifications, isLoading, refetch } = useNotifications();

  const markAsRead = useMarkNotificationsAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const deleteNotification = useDeleteNotification();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handlePress = (item: Notification) => {
    if (!item.read) {
      markAsRead.mutate([item.id]);
    }
  };

  const handleDelete = React.useCallback(
    (item: Notification) => {
      Alert.alert('Delete notification', 'Remove this notification from your inbox?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteNotification.mutate(item.id);
          },
        },
      ]);
    },
    [deleteNotification]
  );

  const handleMarkAll = React.useCallback(() => {
    markAllAsRead.mutate();
  }, [markAllAsRead]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.unreadNotification]}
      onPress={() => handlePress(item)}
    >
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.notificationTime}>{formatTime(item.createdAt)}</Text>
      </View>
      <TouchableOpacity style={styles.deleteAction} onPress={() => handleDelete(item)}>
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (isLoading && !refreshing) {
    return (
      <View style={[ScreenStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const items = notifications ?? [];
  const unreadCount = items.filter(n => !n.read).length;

  return (
    <View style={ScreenStyles.container}>
      <FlatList
        data={items}
        renderItem={renderNotification}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>{unreadCount} unread</Text>
              {unreadCount > 0 && (
                <TouchableOpacity
                  style={styles.markAllButton}
                  onPress={handleMarkAll}
                  disabled={markAllAsRead.isPending}
                >
                  <Text style={styles.markAllButtonText}>
                    {markAllAsRead.isPending ? 'Marking...' : 'Mark all read'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No notifications</Text>}
      />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  markAllButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceElevated,
  },
  markAllButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  listContent: {
    padding: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  notificationContent: {
    flex: 1,
  },
  deleteAction: {
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 10,
    backgroundColor: Colors.surface,
  },
  deleteActionText: {
    color: Colors.error,
    fontSize: 11,
    fontWeight: '700',
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
