import { apiClient } from '@/services/apiClient';
import { logger } from '@/utils/logger';
import { isOwnerOrFounderRole } from '@/utils/roleUtils';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import React, { useEffect, useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { ConfirmDialog, useConfirmDialog } from './ui/ConfirmDialog';

interface Organization {
  id: string;
  name: string;
  userRole: string;
  joinedAt: Date;
}

interface OrganizationSwitcherProps {
  userId: string;
  onOrganizationChange?: (orgId: string) => void;
}

export const OrganizationSwitcher: React.FC<OrganizationSwitcherProps> = ({
  userId,
  onOrganizationChange,
}) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const {
    openDialog: openLeaveConfirm,
    closeDialog: closeLeaveConfirm,
    pendingData: pendingLeaveOrgId,
    dialogProps: leaveDialogProps,
  } = useConfirmDialog<string>();

  useEffect(() => {
    fetchUserOrganizations();
  }, [userId]);

  const fetchUserOrganizations = async () => {
    try {
      const response = await apiClient.get<
        { id: string; name: string; role: string; joinedAt: Date; isActive: boolean }[]
      >('/api/v2/users/me/organizations');
      const orgs = response.data ?? [];
      setOrganizations(
        orgs.map(o => ({ id: o.id, name: o.name, userRole: o.role, joinedAt: o.joinedAt }))
      );
      const active = orgs.find(o => o.isActive);
      if (active) {
        setActiveOrg({
          id: active.id,
          name: active.name,
          userRole: active.role,
          joinedAt: active.joinedAt,
        });
      }
    } catch (err) {
      logger.error(
        'Error fetching user organizations:',
        err,
        new Error('Error fetching user organizations:', { cause: err })
      );
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchOrganization = async (orgId: string) => {
    try {
      await apiClient.put('/api/v2/users/me', { activeOrgId: orgId });

      const switchedOrg = organizations.find(org => org.id === orgId);
      if (switchedOrg) {
        setActiveOrg(switchedOrg);
        setShowDropdown(false);

        if (onOrganizationChange) {
          onOrganizationChange(orgId);
        }
      }
    } catch (err) {
      logger.error(
        'Error switching organization:',
        err,
        new Error('Error switching organization:', { cause: err })
      );
      setError('Failed to switch organization');
    }
  };

  const handleJoinOrganization = async () => {
    const orgId = prompt('Enter organization ID to join:');
    if (!orgId) return;

    try {
      await apiClient.post(`/api/v2/organizations/${orgId}/members`, {
        userId,
        role: 'member',
      });

      alert('Successfully joined organization!');
      fetchUserOrganizations();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const errorMsg = axiosErr?.response?.data?.message ?? 'Failed to join organization';
      alert(errorMsg);
    }
  };

  const handleLeaveOrganizationClick = (orgId: string) => {
    openLeaveConfirm(orgId);
  };

  const handleLeaveOrganizationConfirm = async () => {
    const orgId = pendingLeaveOrgId;
    closeLeaveConfirm();
    if (!orgId) return;

    try {
      await apiClient.delete(`/api/v2/organizations/${orgId}/members/${userId}`);

      setOrganizations(organizations.filter(org => org.id !== orgId));

      if (activeOrg?.id === orgId) {
        setActiveOrg(null);
      }

      alert('Successfully left organization');
    } catch (err) {
      logger.error(
        'Error leaving organization:',
        err,
        new Error('Error leaving organization:', { cause: err })
      );
      alert('Failed to leave organization');
    }
  };

  if (loading) return <LoadingSpinner message="Loading organizations..." />;

  return (
    <div className="org-switcher">
      <div className="org-switcher-header">
        <button className="org-switcher-toggle" onClick={() => setShowDropdown(!showDropdown)}>
          <AccountBalanceIcon sx={{ fontSize: '1.25rem', verticalAlign: 'middle' }} />
          <span className="org-name">{activeOrg ? activeOrg.name : 'No Organization'}</span>
          <span className="dropdown-arrow">{showDropdown ? '▲' : '▼'}</span>
        </button>
      </div>

      {showDropdown && (
        <div className="org-switcher-dropdown">
          {error && <div className="error-message">{error}</div>}

          <div className="org-list">
            <div className="org-list-header">Your Organizations</div>
            {organizations.length === 0 ? (
              <div className="org-list-empty">No organizations yet</div>
            ) : (
              organizations.map(org => {
                const isCurrentOrg = activeOrg?.id === org.id;
                const isActiveOrgOwner = !!activeOrg && isOwnerOrFounderRole(activeOrg.userRole);
                const canSwitch = !isCurrentOrg && !isActiveOrgOwner;
                const isOrgOwner = isOwnerOrFounderRole(org.userRole);

                return (
                  <div key={org.id} className={`org-item ${isCurrentOrg ? 'active' : ''}`}>
                    <div className="org-item-info">
                      <button
                        className="org-item-button"
                        onClick={() => canSwitch && handleSwitchOrganization(org.id)}
                        disabled={!canSwitch}
                        title={
                          isActiveOrgOwner && !isCurrentOrg
                            ? 'Founders/owners cannot switch primary organization'
                            : undefined
                        }
                      >
                        <div className="org-item-name">{org.name}</div>
                        <div className="org-item-role">{org.userRole}</div>
                      </button>
                    </div>
                    {!isOrgOwner && (
                      <button
                        className="org-item-leave"
                        onClick={() => handleLeaveOrganizationClick(org.id)}
                        title="Leave organization"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="org-actions">
            <button className="org-action-button join" onClick={handleJoinOrganization}>
              + Join Organization
            </button>
          </div>
        </div>
      )}

      <style>{`
                .org-switcher {
                    position: relative;
                    display: inline-block;
                }

                .org-switcher-toggle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    background: var(--secondary-bg);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s ease;
                }

                .org-switcher-toggle:hover {
                    background: var(--primary-bg);
                    border-color: var(--accent-cyan);
                }

                .org-icon {
                    font-size: 18px;
                }

                .org-name {
                    font-weight: 500;
                    min-width: 150px;
                    text-align: left;
                }

                .dropdown-arrow {
                    font-size: 10px;
                    margin-left: 8px;
                }

                .org-switcher-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    margin-top: 8px;
                    min-width: 300px;
                    background: var(--secondary-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    z-index: 1000;
                }

                .org-switcher .error-message {
                    padding: 12px;
                    background: var(--error-dim);
                    color: var(--error);
                    border-bottom: 1px solid var(--error);
                }

                .org-list {
                    max-height: 400px;
                    overflow-y: auto;
                }

                .org-list-header {
                    padding: 12px 16px;
                    font-weight: 600;
                    color: var(--text-secondary);
                    border-bottom: 1px solid var(--border-color);
                    font-size: 12px;
                    text-transform: uppercase;
                }

                .org-list-empty {
                    padding: 24px;
                    text-align: center;
                    color: var(--text-secondary);
                }

                .org-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 4px 8px 4px 4px;
                    border-bottom: 1px solid var(--border-color);
                }

                .org-item:last-child {
                    border-bottom: none;
                }

                .org-item.active {
                    background: rgba(0, 217, 255, 0.1);
                }

                .org-item-info {
                    flex: 1;
                }

                .org-item-button {
                    width: 100%;
                    text-align: left;
                    padding: 8px 12px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .org-item-button:not(:disabled):hover {
                    background: rgba(0, 217, 255, 0.05);
                }

                .org-item-button:disabled {
                    cursor: default;
                }

                .org-item-name {
                    font-weight: 500;
                    color: var(--text-primary);
                    margin-bottom: 2px;
                }

                .org-item-role {
                    font-size: 12px;
                    color: var(--text-secondary);
                    text-transform: capitalize;
                }

                .org-item-leave {
                    padding: 4px 8px;
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-size: 16px;
                    transition: color 0.2s;
                }

                .org-item-leave:hover {
                    color: var(--error);
                }

                .org-actions {
                    padding: 12px;
                    border-top: 1px solid var(--border-color);
                }

                .org-action-button {
                    width: 100%;
                    padding: 10px;
                    background: linear-gradient(135deg, var(--accent-blue), #0088cc);
                    color: var(--text-primary);
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .org-action-button:hover {
                    background: linear-gradient(135deg, #0088cc, var(--accent-blue));
                    box-shadow: 0 4px 12px rgba(0, 217, 255, 0.4);
                }
            `}</style>

      <ConfirmDialog
        {...leaveDialogProps}
        title="Leave Organization"
        message="Are you sure you want to leave this organization?"
        confirmLabel="Leave"
        confirmColor="error"
        onConfirm={handleLeaveOrganizationConfirm}
      />
    </div>
  );
};
