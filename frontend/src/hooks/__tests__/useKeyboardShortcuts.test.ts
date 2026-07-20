import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers keyboard shortcuts', () => {
    const mockAction = jest.fn();
    const shortcuts = [
      { key: 'k', ctrl: true, description: 'Search', action: mockAction },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Simulate Ctrl+K
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(mockAction).toHaveBeenCalled();
  });

  it('handles Meta key as Ctrl equivalent', () => {
    const mockAction = jest.fn();
    const shortcuts = [
      { key: 'k', ctrl: true, description: 'Search', action: mockAction },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Simulate Cmd+K (Meta+K)
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(mockAction).toHaveBeenCalled();
  });

  it('respects enabled option', () => {
    const mockAction = jest.fn();
    const shortcuts = [
      { key: 'k', ctrl: true, description: 'Search', action: mockAction },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts, { enabled: false }));

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(mockAction).not.toHaveBeenCalled();
  });

  it('ignores shortcuts when focus is in input field', () => {
    const mockAction = jest.fn();
    const shortcuts = [
      { key: 's', ctrl: true, description: 'Save', action: mockAction },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts, { ignoreInputs: true }));

    // Create and focus an input element
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true });
    Object.defineProperty(event, 'target', { value: input, enumerable: true });
    
    act(() => {
      window.dispatchEvent(event);
    });

    expect(mockAction).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('handles shortcuts in textarea when ignoreInputs is false', () => {
    const mockAction = jest.fn();
    const shortcuts = [
      { key: 's', ctrl: true, description: 'Save', action: mockAction },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts, { ignoreInputs: false }));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true });
    Object.defineProperty(event, 'target', { value: textarea, enumerable: true });
    
    act(() => {
      window.dispatchEvent(event);
    });

    expect(mockAction).toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('handles shortcuts with shift modifier', () => {
    const mockAction = jest.fn();
    const shortcuts = [
      { key: 'k', ctrl: true, shift: true, description: 'Advanced Search', action: mockAction },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(mockAction).toHaveBeenCalled();
  });

  it('handles shortcuts with alt modifier', () => {
    const mockAction = jest.fn();
    const shortcuts = [
      { key: 'n', alt: true, description: 'New', action: mockAction },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent('keydown', { key: 'n', altKey: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(mockAction).toHaveBeenCalled();
  });

  it('prevents default behavior when preventDefault is true', () => {
    const mockAction = jest.fn();
    const shortcuts = [
      { key: 's', ctrl: true, description: 'Save', action: mockAction },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts, { preventDefault: true }));

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    
    act(() => {
      window.dispatchEvent(event);
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does not prevent default when preventDefault is false', () => {
    const mockAction = jest.fn();
    const shortcuts = [
      { key: 's', ctrl: true, description: 'Save', action: mockAction },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts, { preventDefault: false }));

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    
    act(() => {
      window.dispatchEvent(event);
    });

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('handles multiple shortcuts', () => {
    const mockAction1 = jest.fn();
    const mockAction2 = jest.fn();
    const shortcuts = [
      { key: 'k', ctrl: true, description: 'Search', action: mockAction1 },
      { key: 'n', ctrl: true, description: 'New', action: mockAction2 },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event1 = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    act(() => {
      window.dispatchEvent(event1);
    });
    expect(mockAction1).toHaveBeenCalled();

    const event2 = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true });
    act(() => {
      window.dispatchEvent(event2);
    });
    expect(mockAction2).toHaveBeenCalled();
  });

  it('only triggers first matching shortcut', () => {
    const mockAction1 = jest.fn();
    const mockAction2 = jest.fn();
    const shortcuts = [
      { key: 'k', ctrl: true, description: 'Search 1', action: mockAction1 },
      { key: 'k', ctrl: true, description: 'Search 2', action: mockAction2 },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(mockAction1).toHaveBeenCalled();
    expect(mockAction2).not.toHaveBeenCalled();
  });

  it('cleans up event listeners on unmount', () => {
    const mockAction = jest.fn();
    const shortcuts = [
      { key: 'k', ctrl: true, description: 'Search', action: mockAction },
    ];

    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));
    
    unmount();

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    act(() => {
      window.dispatchEvent(event);
    });

    // Should not be called after unmount
    expect(mockAction).not.toHaveBeenCalled();
  });

  describe('Escape key handling', () => {
    it('handles Escape key without modifiers', () => {
      const mockAction = jest.fn();
      const shortcuts = [
        { key: 'Escape', description: 'Close', action: mockAction },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockAction).toHaveBeenCalled();
    });

    it('handles Escape key with Shift modifier held', () => {
      const mockAction = jest.fn();
      const shortcuts = [
        { key: 'Escape', description: 'Close', action: mockAction },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const event = new KeyboardEvent('keydown', { key: 'Escape', shiftKey: true });
      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockAction).toHaveBeenCalled();
    });

    it('handles Escape key with Ctrl modifier held', () => {
      const mockAction = jest.fn();
      const shortcuts = [
        { key: 'Escape', description: 'Close', action: mockAction },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const event = new KeyboardEvent('keydown', { key: 'Escape', ctrlKey: true });
      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockAction).toHaveBeenCalled();
    });

    it('handles Escape key with Alt modifier held', () => {
      const mockAction = jest.fn();
      const shortcuts = [
        { key: 'Escape', description: 'Close', action: mockAction },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      const event = new KeyboardEvent('keydown', { key: 'Escape', altKey: true });
      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockAction).toHaveBeenCalled();
    });
  });

  describe('modifier flexibility', () => {
    it('allows extra modifiers when not explicitly forbidden', () => {
      const mockAction = jest.fn();
      const shortcuts = [
        { key: 'k', ctrl: true, description: 'Search', action: mockAction },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      // Ctrl+Shift+K should trigger Ctrl+K when shift is not specified
      const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true });
      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockAction).toHaveBeenCalled();
    });

    it('respects explicit false for modifiers', () => {
      const mockAction = jest.fn();
      const shortcuts = [
        { key: 'k', ctrl: true, shift: false, description: 'Search without shift', action: mockAction },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      // Ctrl+Shift+K should NOT trigger when shift is explicitly false
      const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true });
      act(() => {
        window.dispatchEvent(event);
      });

      expect(mockAction).not.toHaveBeenCalled();
    });
  });
});
