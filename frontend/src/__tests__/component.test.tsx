/**
 * Component Testing Examples
 * 
 * Demonstrates testing patterns for React components using React Testing Library.
 * These examples show best practices without requiring complex dependencies.
 */

import React, { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// === Example Components for Testing ===

/**
 * Simple button component with click handler
 */
function SimpleButton({ onClick, disabled, children }: { 
  onClick: () => void; 
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/**
 * Component with conditional rendering based on user state
 */
function UserGreeting({ user }: { 
  user: { name: string; isAdmin: boolean } | null 
}) {
  if (!user) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      {user.isAdmin && (
        <button aria-label="Admin Panel">Admin Panel</button>
      )}
    </div>
  );
}

/**
 * List component demonstrating list rendering
 */
function TodoList({ items }: { items: string[] }) {
  return (
    <ul aria-label="Todo list">
      {items.length === 0 ? (
        <li>No items</li>
      ) : (
        items.map((item, index) => (
          <li key={index}>{item}</li>
        ))
      )}
    </ul>
  );
}

/**
 * Counter component with state management
 */
function Counter({ initialValue = 0 }: { initialValue?: number }) {
  const [count, setCount] = useState(initialValue);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}

/**
 * Form component demonstrating form testing
 */
function LoginForm({ onSubmit }: { 
  onSubmit: (data: { username: string; password: string }) => void 
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }

    setError('');
    onSubmit({ username, password });
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Login form">
      <div>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <div role="alert">{error}</div>}
      <button type="submit">Login</button>
    </form>
  );
}

// === Tests ===

describe('SimpleButton Component', () => {
  it('renders button with children', () => {
    const mockClick = jest.fn();
    render(<SimpleButton onClick={mockClick}>Click Me</SimpleButton>);
    
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', async () => {
    const mockClick = jest.fn();
    const user = userEvent.setup();
    
    render(<SimpleButton onClick={mockClick}>Click Me</SimpleButton>);
    
    await user.click(screen.getByRole('button'));
    
    expect(mockClick).toHaveBeenCalledTimes(1);
  });

  it('respects disabled state', async () => {
    const mockClick = jest.fn();
    const user = userEvent.setup();
    
    render(<SimpleButton onClick={mockClick} disabled>Click Me</SimpleButton>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    await user.click(button);
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('handles multiple clicks', async () => {
    const mockClick = jest.fn();
    const user = userEvent.setup();
    
    render(<SimpleButton onClick={mockClick}>Click Me</SimpleButton>);
    
    const button = screen.getByRole('button');
    await user.click(button);
    await user.click(button);
    await user.click(button);
    
    expect(mockClick).toHaveBeenCalledTimes(3);
  });
});

describe('UserGreeting Component', () => {
  it('shows login prompt when user is null', () => {
    render(<UserGreeting user={null} />);
    expect(screen.getByText(/please log in/i)).toBeInTheDocument();
  });

  it('displays user name when logged in', () => {
    const user = { name: 'John Doe', isAdmin: false };
    render(<UserGreeting user={user} />);
    
    expect(screen.getByRole('heading', { name: /welcome, john doe!/i }))
      .toBeInTheDocument();
  });

  it('shows admin panel for admin users', () => {
    const adminUser = { name: 'Admin User', isAdmin: true };
    render(<UserGreeting user={adminUser} />);
    
    expect(screen.getByRole('button', { name: /admin panel/i }))
      .toBeInTheDocument();
  });

  it('hides admin panel for regular users', () => {
    const regularUser = { name: 'Regular User', isAdmin: false };
    render(<UserGreeting user={regularUser} />);
    
    expect(screen.queryByRole('button', { name: /admin panel/i }))
      .not.toBeInTheDocument();
  });
});

describe('TodoList Component', () => {
  it('renders empty state', () => {
    render(<TodoList items={[]} />);
    expect(screen.getByText(/no items/i)).toBeInTheDocument();
  });

  it('renders single item', () => {
    render(<TodoList items={['Buy groceries']} />);
    expect(screen.getByText('Buy groceries')).toBeInTheDocument();
  });

  it('renders multiple items', () => {
    const items = ['Task 1', 'Task 2', 'Task 3'];
    render(<TodoList items={items} />);
    
    items.forEach(item => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });

  it('has accessible list structure', () => {
    render(<TodoList items={['Item 1', 'Item 2']} />);
    
    const list = screen.getByRole('list', { name: /todo list/i });
    const items = within(list).getAllByRole('listitem');
    
    expect(items).toHaveLength(2);
  });
});

describe('Counter Component', () => {
  it('initializes with default value', () => {
    render(<Counter />);
    expect(screen.getByText(/count: 0/i)).toBeInTheDocument();
  });

  it('initializes with custom value', () => {
    render(<Counter initialValue={10} />);
    expect(screen.getByText(/count: 10/i)).toBeInTheDocument();
  });

  it('increments count', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    
    await user.click(screen.getByRole('button', { name: /increment/i }));
    
    expect(screen.getByText(/count: 1/i)).toBeInTheDocument();
  });

  it('decrements count', async () => {
    const user = userEvent.setup();
    render(<Counter initialValue={5} />);
    
    await user.click(screen.getByRole('button', { name: /decrement/i }));
    
    expect(screen.getByText(/count: 4/i)).toBeInTheDocument();
  });

  it('resets to zero', async () => {
    const user = userEvent.setup();
    render(<Counter initialValue={10} />);
    
    await user.click(screen.getByRole('button', { name: /reset/i }));
    
    expect(screen.getByText(/count: 0/i)).toBeInTheDocument();
  });

  it('handles multiple operations', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    
    await user.click(screen.getByRole('button', { name: /increment/i }));
    await user.click(screen.getByRole('button', { name: /increment/i }));
    await user.click(screen.getByRole('button', { name: /decrement/i }));
    
    expect(screen.getByText(/count: 1/i)).toBeInTheDocument();
  });
});

describe('LoginForm Component', () => {
  it('renders form fields', () => {
    const mockSubmit = jest.fn();
    render(<LoginForm onSubmit={mockSubmit} />);
    
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const mockSubmit = jest.fn();
    const user = userEvent.setup();
    
    render(<LoginForm onSubmit={mockSubmit} />);
    
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));
    
    expect(mockSubmit).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'password123',
    });
  });

  it('shows error for empty fields', async () => {
    const mockSubmit = jest.fn();
    const user = userEvent.setup();
    
    render(<LoginForm onSubmit={mockSubmit} />);
    
    await user.click(screen.getByRole('button', { name: /login/i }));
    
    expect(screen.getByRole('alert')).toHaveTextContent(
      /username and password are required/i
    );
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('updates input values on typing', async () => {
    const mockSubmit = jest.fn();
    const user = userEvent.setup();
    
    render(<LoginForm onSubmit={mockSubmit} />);
    
    const usernameInput = screen.getByLabelText(/username/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    
    await user.type(usernameInput, 'john');
    await user.type(passwordInput, 'secret');
    
    expect(usernameInput.value).toBe('john');
    expect(passwordInput.value).toBe('secret');
  });

  it('clears error on valid submission', async () => {
    const mockSubmit = jest.fn();
    const user = userEvent.setup();
    
    render(<LoginForm onSubmit={mockSubmit} />);
    
    // First submit with empty fields to trigger error
    await user.click(screen.getByRole('button', { name: /login/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    
    // Then submit with valid data
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));
    
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Accessibility Testing Examples', () => {
  it('button has accessible name', () => {
    const mockClick = jest.fn();
    render(<SimpleButton onClick={mockClick}>Save</SimpleButton>);
    
    const button = screen.getByRole('button', { name: /save/i });
    expect(button).toHaveAccessibleName('Save');
  });

  it('form has proper labels', () => {
    const mockSubmit = jest.fn();
    render(<LoginForm onSubmit={mockSubmit} />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    expect(usernameInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
  });

  it('alerts are properly announced', async () => {
    const mockSubmit = jest.fn();
    const user = userEvent.setup();
    
    render(<LoginForm onSubmit={mockSubmit} />);
    
    await user.click(screen.getByRole('button', { name: /login/i }));
    
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/username and password are required/i);
  });

  it('list has accessible name', () => {
    render(<TodoList items={['Task 1']} />);
    
    const list = screen.getByRole('list', { name: /todo list/i });
    expect(list).toBeInTheDocument();
  });
});
