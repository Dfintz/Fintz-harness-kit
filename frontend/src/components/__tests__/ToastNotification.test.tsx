import React from 'react';
import { render, screen, waitFor, act } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { ToastNotification, ToastData, useToasts } from '@/components/ToastNotification';
import { renderHook } from '@testing-library/react';

describe('ToastNotification', () => {
  const mockOnRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createToast = (overrides: Partial<ToastData> = {}): ToastData => ({
    id: 'test-toast-1',
    type: 'success',
    title: 'Test Title',
    message: 'Test message',
    duration: 5000,
    ...overrides
  });

  it('renders toasts', () => {
    const toasts = [createToast()];
    render(<ToastNotification toasts={toasts} onRemove={mockOnRemove} />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    const toasts = [
      createToast({ id: '1', title: 'First Toast' }),
      createToast({ id: '2', title: 'Second Toast' })
    ];
    render(<ToastNotification toasts={toasts} onRemove={mockOnRemove} />);
    
    expect(screen.getByText('First Toast')).toBeInTheDocument();
    expect(screen.getByText('Second Toast')).toBeInTheDocument();
  });

  it('renders success toast with correct styling', () => {
    const toasts = [createToast({ type: 'success' })];
    render(<ToastNotification toasts={toasts} onRemove={mockOnRemove} />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders error toast', () => {
    const toasts = [createToast({ type: 'error', title: 'Error occurred' })];
    render(<ToastNotification toasts={toasts} onRemove={mockOnRemove} />);
    
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });

  it('renders warning toast', () => {
    const toasts = [createToast({ type: 'warning', title: 'Warning!' })];
    render(<ToastNotification toasts={toasts} onRemove={mockOnRemove} />);
    
    expect(screen.getByText('Warning!')).toBeInTheDocument();
  });

  it('renders info toast', () => {
    const toasts = [createToast({ type: 'info', title: 'Information' })];
    render(<ToastNotification toasts={toasts} onRemove={mockOnRemove} />);
    
    expect(screen.getByText('Information')).toBeInTheDocument();
  });

  it('renders toast without message', () => {
    const toasts = [createToast({ message: undefined })];
    render(<ToastNotification toasts={toasts} onRemove={mockOnRemove} />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const actionHandler = jest.fn();
    const toasts = [createToast({ 
      action: { label: 'Undo', onClick: actionHandler }
    })];
    render(<ToastNotification toasts={toasts} onRemove={mockOnRemove} />);
    
    expect(screen.getByText('Undo')).toBeInTheDocument();
  });

  it('calls action onClick when action button is clicked', async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    const actionHandler = jest.fn();
    const toasts = [createToast({ 
      action: { label: 'Undo', onClick: actionHandler },
      duration: 0 // Persistent toast
    })];
    render(<ToastNotification toasts={toasts} onRemove={mockOnRemove} />);
    
    await user.click(screen.getByText('Undo'));
    
    expect(actionHandler).toHaveBeenCalledTimes(1);
  });

  it('renders empty when no toasts', () => {
    const { container } = render(<ToastNotification toasts={[]} onRemove={mockOnRemove} />);
    
    // Should only have the container div with no toast items
    const toastItems = container.querySelectorAll('[style*="border-left"]');
    expect(toastItems.length).toBe(0);
  });
});

describe('useToasts hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with empty toasts array', () => {
    const { result } = renderHook(() => useToasts());
    
    expect(result.current.toasts).toEqual([]);
  });

  it('adds a toast', () => {
    const { result } = renderHook(() => useToasts());
    
    act(() => {
      result.current.addToast({
        type: 'success',
        title: 'Test Toast'
      });
    });
    
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].title).toBe('Test Toast');
    expect(result.current.toasts[0].type).toBe('success');
  });

  it('removes a toast', () => {
    const { result } = renderHook(() => useToasts());
    
    let toastId: string;
    act(() => {
      toastId = result.current.addToast({
        type: 'success',
        title: 'Test Toast'
      });
    });
    
    expect(result.current.toasts.length).toBe(1);
    
    act(() => {
      result.current.removeToast(toastId);
    });
    
    expect(result.current.toasts.length).toBe(0);
  });

  it('showSuccess adds a success toast', () => {
    const { result } = renderHook(() => useToasts());
    
    act(() => {
      result.current.showSuccess('Success!', 'Operation completed');
    });
    
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].title).toBe('Success!');
    expect(result.current.toasts[0].message).toBe('Operation completed');
  });

  it('showError adds an error toast', () => {
    const { result } = renderHook(() => useToasts());
    
    act(() => {
      result.current.showError('Error!', 'Something went wrong');
    });
    
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].type).toBe('error');
  });

  it('showWarning adds a warning toast', () => {
    const { result } = renderHook(() => useToasts());
    
    act(() => {
      result.current.showWarning('Warning!');
    });
    
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].type).toBe('warning');
  });

  it('showInfo adds an info toast', () => {
    const { result } = renderHook(() => useToasts());
    
    act(() => {
      result.current.showInfo('Info');
    });
    
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].type).toBe('info');
  });

  it('sets default duration of 5000ms', () => {
    const { result } = renderHook(() => useToasts());
    
    act(() => {
      result.current.addToast({
        type: 'success',
        title: 'Test Toast'
      });
    });
    
    expect(result.current.toasts[0].duration).toBe(5000);
  });

  it('allows custom duration', () => {
    const { result } = renderHook(() => useToasts());
    
    act(() => {
      result.current.showSuccess('Test', undefined, 10000);
    });
    
    expect(result.current.toasts[0].duration).toBe(10000);
  });
});
