import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router-dom';
import { render, screen } from '@/test-utils/test-utils';
import { AllianceCard } from '@/components/AllianceCard';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

describe('AllianceCard', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    mockNavigate.mockClear();
  });

  it('renders alliance count', () => {
    render(<AllianceCard allianceCount={5} organizationId="org-123" />);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Active Alliances')).toBeInTheDocument();
  });

  it('displays singular alliance text for count of 1', () => {
    render(<AllianceCard allianceCount={1} organizationId="org-123" />);

    expect(screen.getByText('1 Alliance')).toBeInTheDocument();
  });

  it('displays plural alliance text for count > 1', () => {
    render(<AllianceCard allianceCount={3} organizationId="org-123" />);

    expect(screen.getByText('3 Alliances')).toBeInTheDocument();
  });

  it('does not show badge when count is 0', () => {
    render(<AllianceCard allianceCount={0} organizationId="org-123" />);

    expect(screen.queryByText('0 Alliances')).not.toBeInTheDocument();
  });

  it('disables view button when count is 0', () => {
    render(<AllianceCard allianceCount={0} organizationId="org-123" />);

    const button = screen.getByRole('button', { name: /view details/i });
    expect(button).toBeDisabled();
  });

  it('enables view button when count > 0', () => {
    render(<AllianceCard allianceCount={2} organizationId="org-123" />);

    const button = screen.getByRole('button', { name: /view details/i });
    expect(button).not.toBeDisabled();
  });

  it('navigates to alliances page when button clicked', async () => {
    const user = userEvent.setup();
    render(<AllianceCard allianceCount={3} organizationId="org-456" />);

    const button = screen.getByRole('button', { name: /view details/i });
    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/organization/org-456/alliances');
  });
});
