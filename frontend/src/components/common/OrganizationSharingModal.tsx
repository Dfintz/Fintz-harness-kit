import { alpha, useTheme } from '@mui/material';
import React from 'react';

interface Organization {
  id: string;
  name: string;
}

interface OrganizationSharingModalProps {
  isOpen: boolean;
  itemTitle: string;
  itemType: string; // e.g., "Event", "Loadout", "Resource"
  userOrganizations: Organization[];
  selectedOrgIds: string[];
  onToggleOrg: (orgId: string) => void;
  onSave: () => void;
  onClose: () => void;
}

/**
 * Reusable modal for selecting organizations to share items with
 * Reduces duplication across EventManagement, SharedResourcesManager, etc.
 */
export const OrganizationSharingModal: React.FC<OrganizationSharingModalProps> = ({
  isOpen,
  itemTitle,
  itemType,
  userOrganizations,
  selectedOrgIds,
  onToggleOrg,
  onSave,
  onClose,
}) => {
  const theme = useTheme();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: alpha(theme.palette.common.black, 0.8),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '2rem',
          borderRadius: '8px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          Share {itemType}: {itemTitle}
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Select organizations to share this {itemType.toLowerCase()} with:
        </p>

        {userOrganizations.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>
            You need to join organizations first to share {itemType.toLowerCase()}s.
          </p>
        ) : (
          <div>
            {userOrganizations.map(org => (
              <div
                key={org.id}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  background: 'var(--bg-primary)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  border: selectedOrgIds.includes(org.id)
                    ? '2px solid var(--accent-cyan)'
                    : '2px solid transparent',
                }}
                onClick={() => onToggleOrg(org.id)}
              >
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedOrgIds.includes(org.id)}
                    onChange={() => onToggleOrg(org.id)}
                    style={{ marginRight: '0.75rem' }}
                  />
                  <span>{org.name}</span>
                </label>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button onClick={onSave} style={{ flex: 1, background: 'var(--accent-cyan)' }}>
            Save Sharing
          </button>
          <button onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
