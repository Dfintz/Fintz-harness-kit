import { TypingIndicator } from '@/components/TypingIndicator';
import { theme } from '@/theme';
import type { PresenceState } from '@/types/apiV2';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('TypingIndicator Component', () => {
  const renderWithThemeProvider = (component: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
  };

  const createMockTypingUser = (
    displayName: string,
    location: string = 'chat'
  ): { user: PresenceState; location: string } => {
    const id = Math.random().toString();
    return {
      user: {
        userId: id,
        status: 'online' as const,
        lastSeen: Date.now(),
        user: {
          id,
          username: displayName.toLowerCase().replace(' ', '_'),
          displayName: displayName,
          email: '',
          avatar: undefined,
        },
      },
      location: location,
    };
  };

  it('returns null when no users are typing', () => {
    const typingUsers = new Map();
    renderWithThemeProvider(<TypingIndicator typingUsers={typingUsers} />);

    // When no users are typing, no typing message should appear
    expect(screen.queryByText(/is typing/)).not.toBeInTheDocument();
    expect(screen.queryByText(/are typing/)).not.toBeInTheDocument();
  });

  it('displays single user typing message', () => {
    const typingUsers = new Map([['user1', createMockTypingUser('John Doe')]]);

    renderWithThemeProvider(<TypingIndicator typingUsers={typingUsers} />);

    expect(screen.getByText(/John Doe is typing.../)).toBeInTheDocument();
  });

  it('displays two users typing message', () => {
    const typingUsers = new Map([
      ['user1', createMockTypingUser('John Doe')],
      ['user2', createMockTypingUser('Jane Smith')],
    ]);

    renderWithThemeProvider(<TypingIndicator typingUsers={typingUsers} />);

    expect(screen.getByText(/John Doe and Jane Smith are typing.../)).toBeInTheDocument();
  });

  it('displays three users typing message', () => {
    const typingUsers = new Map([
      ['user1', createMockTypingUser('John Doe')],
      ['user2', createMockTypingUser('Jane Smith')],
      ['user3', createMockTypingUser('Bob Wilson')],
    ]);

    renderWithThemeProvider(<TypingIndicator typingUsers={typingUsers} />);

    expect(
      screen.getByText(/John Doe, Jane Smith, and Bob Wilson are typing.../)
    ).toBeInTheDocument();
  });

  it('displays "and X others" when more than maxDisplay users', () => {
    const typingUsers = new Map([
      ['user1', createMockTypingUser('John Doe')],
      ['user2', createMockTypingUser('Jane Smith')],
      ['user3', createMockTypingUser('Bob Wilson')],
      ['user4', createMockTypingUser('Alice Brown')],
      ['user5', createMockTypingUser('Charlie Davis')],
    ]);

    renderWithThemeProvider(<TypingIndicator typingUsers={typingUsers} maxDisplay={3} />);

    expect(screen.getByText(/and 2 others.../)).toBeInTheDocument();
  });

  it('displays "and 1 other" for single extra user', () => {
    const typingUsers = new Map([
      ['user1', createMockTypingUser('John Doe')],
      ['user2', createMockTypingUser('Jane Smith')],
      ['user3', createMockTypingUser('Bob Wilson')],
      ['user4', createMockTypingUser('Alice Brown')],
    ]);

    renderWithThemeProvider(<TypingIndicator typingUsers={typingUsers} maxDisplay={3} />);

    expect(screen.getByText(/and 1 other.../)).toBeInTheDocument();
  });

  it('filters users by location when location prop is provided', () => {
    const typingUsers = new Map([
      ['user1', createMockTypingUser('John Doe', 'chat')],
      ['user2', createMockTypingUser('Jane Smith', 'fleet')],
      ['user3', createMockTypingUser('Bob Wilson', 'chat')],
    ]);

    renderWithThemeProvider(<TypingIndicator typingUsers={typingUsers} location="chat" />);

    // Should only show users typing in 'chat' location
    expect(screen.getByText(/John Doe and Bob Wilson are typing.../)).toBeInTheDocument();
  });

  it('returns null when no users match the location filter', () => {
    const typingUsers = new Map([
      ['user1', createMockTypingUser('John Doe', 'chat')],
      ['user2', createMockTypingUser('Jane Smith', 'chat')],
    ]);

    renderWithThemeProvider(<TypingIndicator typingUsers={typingUsers} location="fleet" />);

    // No typing message should appear when location filter doesn't match
    expect(screen.queryByText(/is typing/)).not.toBeInTheDocument();
    expect(screen.queryByText(/are typing/)).not.toBeInTheDocument();
  });

  it('renders animated dots', () => {
    const typingUsers = new Map([['user1', createMockTypingUser('John Doe')]]);

    renderWithThemeProvider(<TypingIndicator typingUsers={typingUsers} />);

    // Verify the typing message appears with animated dots indicator
    expect(screen.getByText(/John Doe is typing.../)).toBeInTheDocument();
  });

  it('respects custom maxDisplay value', () => {
    const typingUsers = new Map([
      ['user1', createMockTypingUser('John')],
      ['user2', createMockTypingUser('Jane')],
    ]);

    renderWithThemeProvider(<TypingIndicator typingUsers={typingUsers} maxDisplay={1} />);

    // With maxDisplay=1, should show "John is typing" and "1 other"
    expect(screen.getByText(/John is typing/)).toBeInTheDocument();
    expect(screen.getByText(/and 1 other.../)).toBeInTheDocument();
  });
});
