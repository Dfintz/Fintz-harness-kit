import { ThemeToggle } from '@/components/ThemeToggle';
import { fireEvent, render, screen } from '@/test-utils/test-utils';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    document.body.classList.remove('light-theme');
  });

  it('renders theme toggle button', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('has accessible aria-label', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', expect.stringMatching(/switch to (light|dark) theme/i));
  });

  it('displays sun icon for dark theme', () => {
    render(<ThemeToggle />);
    
    // Default is dark theme, so aria-label should indicate switch to light
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Switch to light theme');
  });

  it('toggles theme on click', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('button');
    
    // Click to switch to light theme
    fireEvent.click(button);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
    expect(document.body.classList.contains('light-theme')).toBe(true);
    
    // Click again to switch back to dark theme  
    fireEvent.click(button);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
    expect(document.body.classList.contains('light-theme')).toBe(false);
  });

  it('displays moon icon for light theme', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('button');
    
    // Click to switch to light theme
    fireEvent.click(button);
    
    // Should now show dark mode label
    expect(button).toHaveAttribute('aria-label', 'Switch to dark theme');
  });

  it('initializes from localStorage saved theme', () => {
    localStorageMock.getItem.mockReturnValueOnce('light');
    
    render(<ThemeToggle />);
    
    // Should apply light theme on mount
    expect(document.body.classList.contains('light-theme')).toBe(true);
  });

  it('has correct class name', () => {
    render(<ThemeToggle />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('theme-toggle');
  });
});
