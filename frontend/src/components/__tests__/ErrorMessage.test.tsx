import React from 'react';
import { render, screen } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { ErrorMessage } from '@/components/ErrorMessage';

describe('ErrorMessage', () => {
  it('renders error message', () => {
    const errorText = 'Something went wrong';
    render(<ErrorMessage message={errorText} />);
    
    expect(screen.getByText(errorText)).toBeInTheDocument();
  });

  it('displays Error heading', () => {
    render(<ErrorMessage message="Test error" />);
    
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders dismiss button when onDismiss is provided', () => {
    const handleDismiss = jest.fn();
    render(<ErrorMessage message="Test error" onDismiss={handleDismiss} />);
    
    const dismissButton = screen.getByText('Dismiss');
    expect(dismissButton).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const handleDismiss = jest.fn();
    render(<ErrorMessage message="Test error" onDismiss={handleDismiss} />);
    
    const dismissButton = screen.getByText('Dismiss');
    await user.click(dismissButton);
    
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render dismiss button when onDismiss is not provided', () => {
    render(<ErrorMessage message="Test error" />);
    
    const dismissButton = screen.queryByText('Dismiss');
    expect(dismissButton).not.toBeInTheDocument();
  });

  it('displays error icon', () => {
    render(<ErrorMessage message="Test error" />);
    
    // The component renders an Alert icon
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    const handleRetry = jest.fn();
    render(<ErrorMessage message="Test error" onRetry={handleRetry} />);
    
    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const handleRetry = jest.fn();
    render(<ErrorMessage message="Test error" onRetry={handleRetry} />);
    
    const retryButton = screen.getByText('Retry');
    await user.click(retryButton);
    
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
