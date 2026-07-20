import { useUIStore } from '../store/uiStore';

jest.mock('../utils/storage', () => ({
  asyncStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('UIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      theme: 'dark',
      toasts: [],
    });
  });

  it('should initialize with dark theme', () => {
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('should toggle theme', () => {
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe('light');

    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('should set theme directly', () => {
    useUIStore.getState().setTheme('light');
    expect(useUIStore.getState().theme).toBe('light');
  });

  it('should add a toast', () => {
    useUIStore.getState().addToast({ message: 'Success!', type: 'success' });

    const toasts = useUIStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Success!');
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].id).toBeDefined();
  });

  it('should remove a toast by id', () => {
    useUIStore.getState().addToast({ message: 'Toast 1', type: 'info' });

    const toasts = useUIStore.getState().toasts;
    expect(toasts).toHaveLength(1);

    useUIStore.getState().removeToast(toasts[0].id);
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });

  it('should clear all toasts', () => {
    useUIStore.getState().addToast({ message: 'A', type: 'info' });
    useUIStore.getState().addToast({ message: 'B', type: 'warning' });

    useUIStore.getState().clearToasts();
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });
});
