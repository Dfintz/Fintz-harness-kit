/**
 * CookieBanner Component Tests
 */

import { CookieBanner } from '@/components/CookieBanner';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

describe('CookieBanner', () => {
  // Mock window.location
  const originalLocation = window.location;

  beforeAll(() => {
    // Delete and reassign window.location for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).location;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).location = { href: 'http://localhost/', assign: jest.fn(), reload: jest.fn() };
  });

  afterAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).location = originalLocation;
  });

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset location href
    window.location.href = 'http://localhost/';
  });

  const renderComponent = (props = {}) => {
    return render(<CookieBanner {...props} />);
  };

  describe('Visibility', () => {
    it('should be visible when no consent is recorded', () => {
      renderComponent();
      expect(screen.getByText(/This website uses cookies/i)).toBeInTheDocument();
    });

    it('should not be visible when consent is already recorded', () => {
      const consentData = {
        accepted: true,
        version: '1.0',
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('cookie_consent_accepted', JSON.stringify(consentData));

      renderComponent();
      expect(screen.queryByText(/This website uses cookies/i)).not.toBeInTheDocument();
    });

    it('should be visible again if version mismatches', () => {
      const consentData = {
        accepted: true,
        version: '0.9', // Old version
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('cookie_consent_accepted', JSON.stringify(consentData));

      renderComponent();
      expect(screen.getByText(/This website uses cookies/i)).toBeInTheDocument();
    });

    it('should be visible if localStorage data is invalid', () => {
      localStorage.setItem('cookie_consent_accepted', 'invalid json');

      renderComponent();
      expect(screen.getByText(/This website uses cookies/i)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should hide banner and record consent when "Accept" is clicked', async () => {
      renderComponent();

      const acceptButton = screen.getByText('Accept');
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(screen.queryByText(/This website uses cookies/i)).not.toBeInTheDocument();
      });

      // Verify consent is saved
      const saved = localStorage.getItem('cookie_consent_accepted');
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved!);
      expect(parsed.accepted).toBe(true);
      expect(parsed.version).toBe('1.0');
      expect(parsed.timestamp).toBeTruthy();
    });

    it('should call onAccept callback when provided', () => {
      const onAccept = jest.fn();
      renderComponent({ onAccept });

      const acceptButton = screen.getByText('Accept');
      fireEvent.click(acceptButton);

      expect(onAccept).toHaveBeenCalledTimes(1);
    });

    it('should hide banner when "Settings" is clicked', async () => {
      renderComponent();

      const settingsButton = screen.getByText('Settings');

      // The click will hide the banner (and would navigate in real browser)
      fireEvent.click(settingsButton);

      await waitFor(() => {
        // Banner should be hidden
        expect(screen.queryByText(/This website uses cookies/i)).not.toBeInTheDocument();
      });
    });

    it('should hide banner when dismiss button is clicked', async () => {
      renderComponent();

      const dismissButton = screen.getByLabelText(/dismiss banner/i);
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByText(/This website uses cookies/i)).not.toBeInTheDocument();
      });

      // Verify consent is recorded (implicit acceptance)
      const saved = localStorage.getItem('cookie_consent_accepted');
      expect(saved).toBeTruthy();
    });

    it('should navigate to privacy settings when link is clicked', () => {
      renderComponent();

      const privacyLink = screen.getByRole('link', { name: /privacy settings/i });
      expect(privacyLink).toHaveAttribute('href', '/privacy-settings');
    });
  });

  describe('Content', () => {
    it('should display cookie information text', () => {
      renderComponent();

      expect(screen.getByText(/This website uses cookies/i)).toBeInTheDocument();
      expect(screen.getByText(/cookies for authentication and security/i)).toBeInTheDocument();
    });

    it('should have all action buttons', () => {
      renderComponent();

      expect(screen.getByText('Accept')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByLabelText(/dismiss banner/i)).toBeInTheDocument();
    });

    it('should have link to Privacy Settings', () => {
      renderComponent();

      const privacyLink = screen.getByRole('link', { name: /privacy settings/i });
      expect(privacyLink).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();

      const dismissButton = screen.getByLabelText(/dismiss banner/i);
      expect(dismissButton).toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      renderComponent();

      const acceptButton = screen.getByText('Accept');
      // The actual button element is the parent of the text node
      const buttonElement = acceptButton.closest('button');
      buttonElement?.focus();
      expect(document.activeElement).toBe(buttonElement);
    });
  });

  describe('LocalStorage Handling', () => {
    it('should handle localStorage errors gracefully', async () => {
      // Mock localStorage to throw error
      const originalSetItem = Storage.prototype.setItem;
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('LocalStorage error');
      });

      renderComponent();

      const acceptButton = screen.getByText('Accept');

      // Click should not throw - component should handle gracefully
      fireEvent.click(acceptButton);

      // Wait for any state updates
      await waitFor(() => {
        // Banner should try to hide despite localStorage error
        expect(Storage.prototype.setItem).toHaveBeenCalled();
      });

      // Restore
      Storage.prototype.setItem = originalSetItem;
      consoleError.mockRestore();
    });
  });
});
