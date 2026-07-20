import { useNotificationStore } from '../store/notificationStore';

describe('NotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      unreadCount: 0,
      lastSeenAt: null,
    });
  });

  it('should initialize with zero unread', () => {
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().lastSeenAt).toBeNull();
  });

  it('should set unread count', () => {
    useNotificationStore.getState().setUnreadCount(5);
    expect(useNotificationStore.getState().unreadCount).toBe(5);
  });

  it('should increment unread', () => {
    useNotificationStore.getState().setUnreadCount(3);
    useNotificationStore.getState().incrementUnread();
    expect(useNotificationStore.getState().unreadCount).toBe(4);
  });

  it('should mark all as seen', () => {
    useNotificationStore.getState().setUnreadCount(10);
    useNotificationStore.getState().markAllSeen();

    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().lastSeenAt).toBeDefined();
    expect(typeof useNotificationStore.getState().lastSeenAt).toBe('number');
  });
});
