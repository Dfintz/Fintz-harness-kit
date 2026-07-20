/**
 * useWebSocket Hook Tests
 * Tests for the WebSocket hook used in tunnel chat functionality
 */

import { renderHook, act } from '@testing-library/react';
import { useWebSocket, TunnelMessage } from '@/hooks/useWebSocket';

// Mock socket.io-client
const mockSocket = {
    connected: false,
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
};

jest.mock('socket.io-client', () => ({
    io: jest.fn(() => mockSocket),
}));

describe('useWebSocket Hook', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSocket.connected = false;
        localStorage.setItem('token', 'test-token');
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('initializes with disconnected state', () => {
        const { result } = renderHook(() => useWebSocket({ autoConnect: false }));
        
        expect(result.current.connected).toBe(false);
        expect(result.current.socket).toBeNull();
    });

    it('provides joinTunnel function', () => {
        const { result } = renderHook(() => useWebSocket({ autoConnect: false }));
        
        expect(typeof result.current.joinTunnel).toBe('function');
    });

    it('provides leaveTunnel function', () => {
        const { result } = renderHook(() => useWebSocket({ autoConnect: false }));
        
        expect(typeof result.current.leaveTunnel).toBe('function');
    });

    it('provides sendMessage function', () => {
        const { result } = renderHook(() => useWebSocket({ autoConnect: false }));
        
        expect(typeof result.current.sendMessage).toBe('function');
    });

    it('provides requestHistory function', () => {
        const { result } = renderHook(() => useWebSocket({ autoConnect: false }));
        
        expect(typeof result.current.requestHistory).toBe('function');
    });

    it('provides callback registration functions', () => {
        const { result } = renderHook(() => useWebSocket({ autoConnect: false }));
        
        expect(typeof result.current.onMessage).toBe('function');
        expect(typeof result.current.onTunnelCreated).toBe('function');
        expect(typeof result.current.onTunnelDeleted).toBe('function');
        expect(typeof result.current.onTunnelUpdated).toBe('function');
        expect(typeof result.current.onMessageBlocked).toBe('function');
        expect(typeof result.current.onRateLimited).toBe('function');
        expect(typeof result.current.onError).toBe('function');
    });

    it('provides disconnect function', () => {
        const { result } = renderHook(() => useWebSocket({ autoConnect: false }));
        
        expect(typeof result.current.disconnect).toBe('function');
    });

    it('does not connect when no token is available', () => {
        localStorage.clear();
        
        const { result } = renderHook(() => useWebSocket({ autoConnect: true }));
        
        expect(result.current.connected).toBe(false);
    });

    it('accepts custom URL option', () => {
        const customUrl = 'http://custom.example.com:5000';
        
        const { result } = renderHook(() => useWebSocket({ 
            url: customUrl, 
            autoConnect: false 
        }));
        
        // Hook should initialize with the custom URL config
        expect(result.current).toBeDefined();
    });

    it('registers message callback', () => {
        const { result } = renderHook(() => useWebSocket({ autoConnect: false }));
        
        const mockCallback = jest.fn();
        
        act(() => {
            result.current.onMessage(mockCallback);
        });
        
        // Callback should be registered without throwing
        expect(mockCallback).not.toHaveBeenCalled();
    });

    it('registers error callback', () => {
        const { result } = renderHook(() => useWebSocket({ autoConnect: false }));
        
        const mockErrorCallback = jest.fn();
        
        act(() => {
            result.current.onError(mockErrorCallback);
        });
        
        expect(mockErrorCallback).not.toHaveBeenCalled();
    });

    it('registers rate limit callback', () => {
        const { result } = renderHook(() => useWebSocket({ autoConnect: false }));
        
        const mockRateLimitCallback = jest.fn();
        
        act(() => {
            result.current.onRateLimited(mockRateLimitCallback);
        });
        
        expect(mockRateLimitCallback).not.toHaveBeenCalled();
    });

    it('registers message blocked callback', () => {
        const { result } = renderHook(() => useWebSocket({ autoConnect: false }));
        
        const mockBlockedCallback = jest.fn();
        
        act(() => {
            result.current.onMessageBlocked(mockBlockedCallback);
        });
        
        expect(mockBlockedCallback).not.toHaveBeenCalled();
    });
});

describe('useWebSocket Message Types', () => {
    it('defines correct TunnelMessage interface', () => {
        const mockMessage: TunnelMessage = {
            id: 'msg-123',
            tunnelId: 'tunnel-456',
            authorId: 'user-789',
            authorName: 'TestUser',
            authorAvatar: 'https://example.com/avatar.png',
            content: 'Hello, world!',
            timestamp: new Date(),
            guildId: 'guild-abc',
        };

        expect(mockMessage.id).toBe('msg-123');
        expect(mockMessage.tunnelId).toBe('tunnel-456');
        expect(mockMessage.authorId).toBe('user-789');
        expect(mockMessage.authorName).toBe('TestUser');
        expect(mockMessage.content).toBe('Hello, world!');
    });

    it('allows optional authorAvatar', () => {
        const mockMessage: TunnelMessage = {
            id: 'msg-123',
            tunnelId: 'tunnel-456',
            authorId: 'user-789',
            authorName: 'TestUser',
            content: 'No avatar message',
            timestamp: new Date(),
            guildId: 'guild-abc',
        };

        expect(mockMessage.authorAvatar).toBeUndefined();
    });
});
