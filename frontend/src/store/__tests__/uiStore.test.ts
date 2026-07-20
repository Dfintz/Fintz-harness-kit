/**
 * UI Store Tests
 * Tests for theme, notifications, modals, sidebar, and loading state
 */

import { selectLoading, selectModals, selectNotifications, selectSidebarOpen, selectTheme, useModal, useNotification, useTheme, useUIStore } from '@/store/uiStore';
import { act, renderHook } from '@testing-library/react';

describe('uiStore', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // Reset store before each test
        act(() => {
            useUIStore.setState({
                theme: 'dark',
                sidebarOpen: true,
                notifications: [],
                modals: [],
                loading: {}
            });
        });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    describe('initial state', () => {
        it('should have correct initial state', () => {
            const { result } = renderHook(() => useUIStore());
            
            expect(result.current.theme).toBe('dark');
            expect(result.current.sidebarOpen).toBe(true);
            expect(result.current.notifications).toEqual([]);
            expect(result.current.modals).toEqual([]);
            expect(result.current.loading).toEqual({});
        });
    });

    describe('theme actions', () => {
        it('should toggle theme from dark to light', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.toggleTheme();
            });
            
            expect(result.current.theme).toBe('light');
        });

        it('should toggle theme from light to dark', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.setTheme('light');
            });
            
            expect(result.current.theme).toBe('light');
            
            act(() => {
                result.current.toggleTheme();
            });
            
            expect(result.current.theme).toBe('dark');
        });

        it('should set theme directly', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.setTheme('light');
            });
            
            expect(result.current.theme).toBe('light');
            
            act(() => {
                result.current.setTheme('dark');
            });
            
            expect(result.current.theme).toBe('dark');
        });
    });

    describe('sidebar actions', () => {
        it('should toggle sidebar', () => {
            const { result } = renderHook(() => useUIStore());
            
            expect(result.current.sidebarOpen).toBe(true);
            
            act(() => {
                result.current.toggleSidebar();
            });
            
            expect(result.current.sidebarOpen).toBe(false);
            
            act(() => {
                result.current.toggleSidebar();
            });
            
            expect(result.current.sidebarOpen).toBe(true);
        });

        it('should set sidebar open state directly', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.setSidebarOpen(false);
            });
            
            expect(result.current.sidebarOpen).toBe(false);
            
            act(() => {
                result.current.setSidebarOpen(true);
            });
            
            expect(result.current.sidebarOpen).toBe(true);
        });
    });

    describe('notification actions', () => {
        it('should add a notification', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.addNotification({
                    type: 'success',
                    message: 'Test notification',
                    title: 'Success'
                });
            });
            
            expect(result.current.notifications).toHaveLength(1);
            expect(result.current.notifications[0].message).toBe('Test notification');
            expect(result.current.notifications[0].title).toBe('Success');
            expect(result.current.notifications[0].type).toBe('success');
            expect(result.current.notifications[0].id).toBeDefined();
            expect(result.current.notifications[0].createdAt).toBeDefined();
        });

        it('should add multiple notifications', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.addNotification({
                    type: 'success',
                    message: 'First notification'
                });
                result.current.addNotification({
                    type: 'error',
                    message: 'Second notification'
                });
            });
            
            expect(result.current.notifications).toHaveLength(2);
            expect(result.current.notifications[0].message).toBe('First notification');
            expect(result.current.notifications[1].message).toBe('Second notification');
        });

        it('should keep notification in store until renderer removes it', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.addNotification({
                    type: 'info',
                    message: 'Auto-remove notification',
                    duration: 3000
                });
            });
            
            expect(result.current.notifications).toHaveLength(1);
            
            // Auto-removal is now handled by GlobalToastRenderer, not the store
            act(() => {
                jest.advanceTimersByTime(3000);
            });
            
            // Notification stays in store — renderer calls removeNotification after animation
            expect(result.current.notifications).toHaveLength(1);
            
            // Manual removal still works
            act(() => {
                result.current.removeNotification(result.current.notifications[0].id);
            });
            
            expect(result.current.notifications).toHaveLength(0);
        });

        it.skip('should not auto-remove notification with duration 0', () => {
            // Clear any existing notifications and timers
            act(() => {
                useUIStore.setState({ notifications: [] });
                jest.clearAllTimers();
            });
            
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.addNotification({
                    type: 'error',
                    message: 'Permanent notification',
                    duration: 0
                });
            });
            
            // First check it was added
            expect(result.current.notifications.length).toBeGreaterThanOrEqual(1);
            if (result.current.notifications.length > 0) {
                expect(result.current.notifications[0].message).toBe('Permanent notification');
            }
            
            // Advance time - should still be there since duration is 0
            act(() => {
                jest.advanceTimersByTime(10000);
            });
            
            // Should still have at least the permanent notification
            const permanentNotification = result.current.notifications.find(
                n => n.message === 'Permanent notification'
            );
            expect(permanentNotification).toBeDefined();
        });

        it('should remove specific notification', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.addNotification({
                    type: 'info',
                    message: 'First'
                });
                result.current.addNotification({
                    type: 'info',
                    message: 'Second'
                });
            });
            
            const firstId = result.current.notifications[0].id;
            
            act(() => {
                result.current.removeNotification(firstId);
            });
            
            expect(result.current.notifications).toHaveLength(1);
            expect(result.current.notifications[0].message).toBe('Second');
        });

        it('should clear all notifications', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.addNotification({ type: 'info', message: 'First' });
                result.current.addNotification({ type: 'info', message: 'Second' });
                result.current.addNotification({ type: 'info', message: 'Third' });
            });
            
            expect(result.current.notifications).toHaveLength(3);
            
            act(() => {
                result.current.clearNotifications();
            });
            
            expect(result.current.notifications).toHaveLength(0);
        });

        it('should store notification with default duration of 5000ms', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.addNotification({
                    type: 'info',
                    message: 'Default duration'
                });
            });
            
            expect(result.current.notifications).toHaveLength(1);
            // Duration is set to 5000ms by default — renderer handles auto-dismiss
            expect(result.current.notifications[0].duration).toBe(5000);
        });
    });

    describe('modal actions', () => {
        it('should open a modal', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.openModal({
                    title: 'Test Modal',
                    content: 'Modal content'
                });
            });
            
            expect(result.current.modals).toHaveLength(1);
            expect(result.current.modals[0].title).toBe('Test Modal');
            expect(result.current.modals[0].content).toBe('Modal content');
            expect(result.current.modals[0].id).toBeDefined();
        });

        it('should open multiple modals', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.openModal({ title: 'Modal 1', content: 'Content 1' });
                result.current.openModal({ title: 'Modal 2', content: 'Content 2' });
            });
            
            expect(result.current.modals).toHaveLength(2);
        });

        it('should close specific modal', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.openModal({ title: 'Modal 1', content: 'Content 1' });
                result.current.openModal({ title: 'Modal 2', content: 'Content 2' });
            });
            
            const firstModalId = result.current.modals[0].id;
            
            act(() => {
                result.current.closeModal(firstModalId);
            });
            
            expect(result.current.modals).toHaveLength(1);
            expect(result.current.modals[0].title).toBe('Modal 2');
        });

        it('should call onClose when closing modal', () => {
            const { result } = renderHook(() => useUIStore());
            const onClose = jest.fn();
            
            act(() => {
                result.current.openModal({
                    title: 'Test Modal',
                    content: 'Content',
                    onClose
                });
            });
            
            const modalId = result.current.modals[0].id;
            
            act(() => {
                result.current.closeModal(modalId);
            });
            
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(result.current.modals).toHaveLength(0);
        });

        it('should close all modals', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.openModal({ title: 'Modal 1', content: 'Content 1' });
                result.current.openModal({ title: 'Modal 2', content: 'Content 2' });
                result.current.openModal({ title: 'Modal 3', content: 'Content 3' });
            });
            
            expect(result.current.modals).toHaveLength(3);
            
            act(() => {
                result.current.closeAllModals();
            });
            
            expect(result.current.modals).toHaveLength(0);
        });

        it('should call onClose for all modals when closing all', () => {
            const { result } = renderHook(() => useUIStore());
            const onClose1 = jest.fn();
            const onClose2 = jest.fn();
            const onClose3 = jest.fn();
            
            act(() => {
                result.current.openModal({ title: 'Modal 1', content: 'Content 1', onClose: onClose1 });
                result.current.openModal({ title: 'Modal 2', content: 'Content 2', onClose: onClose2 });
                result.current.openModal({ title: 'Modal 3', content: 'Content 3', onClose: onClose3 });
            });
            
            act(() => {
                result.current.closeAllModals();
            });
            
            expect(onClose1).toHaveBeenCalledTimes(1);
            expect(onClose2).toHaveBeenCalledTimes(1);
            expect(onClose3).toHaveBeenCalledTimes(1);
        });
    });

    describe('loading actions', () => {
        it('should set loading state for a key', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.setLoading('fetch-data', true);
            });
            
            expect(result.current.loading['fetch-data']).toBe(true);
        });

        it('should set multiple loading states', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.setLoading('fetch-data', true);
                result.current.setLoading('save-data', true);
                result.current.setLoading('delete-data', false);
            });
            
            expect(result.current.loading['fetch-data']).toBe(true);
            expect(result.current.loading['save-data']).toBe(true);
            expect(result.current.loading['delete-data']).toBe(false);
        });

        it('should clear all loading states', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.setLoading('fetch-data', true);
                result.current.setLoading('save-data', true);
            });
            
            expect(Object.keys(result.current.loading)).toHaveLength(2);
            
            act(() => {
                result.current.clearLoading();
            });
            
            expect(result.current.loading).toEqual({});
        });
    });

    describe('selectors', () => {
        it('should select theme', () => {
            const { result } = renderHook(() => useUIStore());
            const theme = selectTheme(result.current);
            expect(theme).toBe('dark');
        });

        it('should select sidebar open', () => {
            const { result } = renderHook(() => useUIStore());
            const sidebarOpen = selectSidebarOpen(result.current);
            expect(sidebarOpen).toBe(true);
        });

        it('should select notifications', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.addNotification({ type: 'info', message: 'Test' });
            });
            
            const notifications = selectNotifications(result.current);
            expect(notifications).toHaveLength(1);
        });

        it('should select modals', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.openModal({ title: 'Test', content: 'Content' });
            });
            
            const modals = selectModals(result.current);
            expect(modals).toHaveLength(1);
        });

        it('should select loading state for specific key', () => {
            const { result } = renderHook(() => useUIStore());
            
            act(() => {
                result.current.setLoading('fetch-data', true);
            });
            
            const selector = selectLoading('fetch-data');
            expect(selector(result.current)).toBe(true);
        });

        it('should return false for non-existent loading key', () => {
            const { result } = renderHook(() => useUIStore());
            const selector = selectLoading('non-existent');
            expect(selector(result.current)).toBe(false);
        });
    });

    describe('helper hooks', () => {
        describe('useTheme', () => {
            it('should provide theme and actions', () => {
                const { result } = renderHook(() => useTheme());
                
                expect(result.current.theme).toBe('dark');
                expect(typeof result.current.toggleTheme).toBe('function');
                expect(typeof result.current.setTheme).toBe('function');
            });

            it('should toggle theme through helper', () => {
                const { result } = renderHook(() => useTheme());
                
                act(() => {
                    result.current.toggleTheme();
                });
                
                expect(result.current.theme).toBe('light');
            });
        });

        describe('useNotification', () => {
            it('should provide notification helper methods', () => {
                const { result } = renderHook(() => useNotification());
                
                expect(typeof result.current.success).toBe('function');
                expect(typeof result.current.error).toBe('function');
                expect(typeof result.current.warning).toBe('function');
                expect(typeof result.current.info).toBe('function');
            });

            it('should add success notification', () => {
                const { result: notificationResult } = renderHook(() => useNotification());
                const { result: storeResult } = renderHook(() => useUIStore());
                
                act(() => {
                    notificationResult.current.success('Success message', 'Success Title');
                });
                
                expect(storeResult.current.notifications).toHaveLength(1);
                expect(storeResult.current.notifications[0].type).toBe('success');
                expect(storeResult.current.notifications[0].message).toBe('Success message');
                expect(storeResult.current.notifications[0].title).toBe('Success Title');
            });

            it.skip('should add error notification with duration 0', () => {
                const { result: notificationResult } = renderHook(() => useNotification());
                const { result: storeResult } = renderHook(() => useUIStore());
                
                act(() => {
                    notificationResult.current.error('Error message');
                });
                
                expect(storeResult.current.notifications).toHaveLength(1);
                expect(storeResult.current.notifications[0].type).toBe('error');
                
                // Should not auto-remove - advance timers and ensure it's still there
                act(() => {
                    jest.advanceTimersByTime(10000);
                    jest.runAllTimers();
                });
                
                expect(storeResult.current.notifications).toHaveLength(1);
            });

            it('should add warning notification', () => {
                const { result: notificationResult } = renderHook(() => useNotification());
                const { result: storeResult } = renderHook(() => useUIStore());
                
                act(() => {
                    notificationResult.current.warning('Warning message');
                });
                
                expect(storeResult.current.notifications).toHaveLength(1);
                expect(storeResult.current.notifications[0].type).toBe('warning');
            });

            it('should add info notification', () => {
                const { result: notificationResult } = renderHook(() => useNotification());
                const { result: storeResult } = renderHook(() => useUIStore());
                
                act(() => {
                    notificationResult.current.info('Info message');
                });
                
                expect(storeResult.current.notifications).toHaveLength(1);
                expect(storeResult.current.notifications[0].type).toBe('info');
            });
        });

        describe('useModal', () => {
            it('should provide modal helper methods', () => {
                const { result } = renderHook(() => useModal());
                
                expect(typeof result.current.openModal).toBe('function');
                expect(typeof result.current.closeModal).toBe('function');
                expect(typeof result.current.closeAllModals).toBe('function');
            });

            it('should open modal through helper', () => {
                const { result: modalResult } = renderHook(() => useModal());
                const { result: storeResult } = renderHook(() => useUIStore());
                
                act(() => {
                    modalResult.current.openModal({ title: 'Test', content: 'Content' });
                });
                
                expect(storeResult.current.modals).toHaveLength(1);
            });

            it('should close modal through helper', () => {
                const { result: modalResult } = renderHook(() => useModal());
                const { result: storeResult } = renderHook(() => useUIStore());
                
                act(() => {
                    modalResult.current.openModal({ title: 'Test', content: 'Content' });
                });
                
                const modalId = storeResult.current.modals[0].id;
                
                act(() => {
                    modalResult.current.closeModal(modalId);
                });
                
                expect(storeResult.current.modals).toHaveLength(0);
            });

            it('should close all modals through helper', () => {
                const { result: modalResult } = renderHook(() => useModal());
                const { result: storeResult } = renderHook(() => useUIStore());
                
                act(() => {
                    modalResult.current.openModal({ title: 'Test 1', content: 'Content 1' });
                    modalResult.current.openModal({ title: 'Test 2', content: 'Content 2' });
                });
                
                act(() => {
                    modalResult.current.closeAllModals();
                });
                
                expect(storeResult.current.modals).toHaveLength(0);
            });
        });
    });
});
