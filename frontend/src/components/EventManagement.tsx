import {
  useCreateEvent,
  useDeleteEvent,
  useEvents,
  useShareEventWithOrg,
  useUnshareEventWithOrg,
} from '@/hooks/queries/useEventQueries';
import LinkIcon from '@mui/icons-material/Link';
import React, { useState } from 'react';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { OrganizationSharingModal } from './common/OrganizationSharingModal';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  attendees: string[];
  organizationId?: string;
  sharedWithOrgs?: string[];
}

interface Organization {
  id: string;
  name: string;
}

interface EventManagementProps {
  userId?: string;
  userOrganizations?: Organization[];
}

export const EventManagement: React.FC<EventManagementProps> = ({
  userId: _userId,
  userOrganizations = [],
}) => {
  const { data: events = [], isLoading, error: queryError } = useEvents();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();
  const shareWithOrg = useShareEventWithOrg();
  const unshareWithOrg = useUnshareEventWithOrg();

  const [newEvent, setNewEvent] = useState<Event>({
    id: '',
    title: '',
    description: '',
    date: '',
    location: '',
    attendees: [],
    organizationId: '',
    sharedWithOrgs: [],
  });
  const [mutationError, setMutationError] = useState('');
  const [sharingModalEvent, setSharingModalEvent] = useState<Event | null>(null);
  const [selectedOrgsToShare, setSelectedOrgsToShare] = useState<string[]>([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewEvent({ ...newEvent, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEvent.mutateAsync({
        ...newEvent,
        id: `event-${Date.now()}`,
      } as Parameters<typeof createEvent.mutateAsync>[0]);
      setNewEvent({
        id: '',
        title: '',
        description: '',
        date: '',
        location: '',
        attendees: [],
        organizationId: '',
        sharedWithOrgs: [],
      });
    } catch (err) {
      setMutationError('Failed to create event');
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      await deleteEvent.mutateAsync(eventId);
    } catch (err) {
      setMutationError('Failed to delete event');
    }
  };

  const handleOpenSharingModal = (event: Event) => {
    setSharingModalEvent(event);
    setSelectedOrgsToShare(event.sharedWithOrgs || []);
  };

  const handleCloseSharingModal = () => {
    setSharingModalEvent(null);
    setSelectedOrgsToShare([]);
  };

  const handleToggleOrgShare = (orgId: string) => {
    setSelectedOrgsToShare(prev =>
      prev.includes(orgId) ? prev.filter(id => id !== orgId) : [...prev, orgId]
    );
  };

  const handleSaveSharing = async () => {
    if (!sharingModalEvent) return;

    try {
      const currentShared = sharingModalEvent.sharedWithOrgs || [];
      const toAdd = selectedOrgsToShare.filter(id => !currentShared.includes(id));
      const toRemove = currentShared.filter(id => !selectedOrgsToShare.includes(id));

      for (const orgId of toAdd) {
        await shareWithOrg.mutateAsync({ eventId: sharingModalEvent.id, orgId });
      }

      for (const orgId of toRemove) {
        await unshareWithOrg.mutateAsync({ eventId: sharingModalEvent.id, orgId });
      }

      handleCloseSharingModal();
    } catch (err) {
      setMutationError('Failed to update event sharing');
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading events..." />;
  }

  const error = queryError ? 'Failed to fetch events' : mutationError;

  return (
    <div>
      <h2>Tactical Group Management</h2>
      {error && <ErrorMessage message={error} onDismiss={() => setMutationError('')} />}
      <form onSubmit={handleSubmit} aria-label="Create new tactical group event">
        <div>
          <label htmlFor="event-title">Operation Title</label>
          <input
            id="event-title"
            type="text"
            name="title"
            value={newEvent.title}
            onChange={handleInputChange}
            placeholder="Enter operation title"
            required
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="event-description">Operation Description</label>
          <textarea
            id="event-description"
            name="description"
            value={newEvent.description}
            onChange={handleInputChange}
            placeholder="Enter operation description"
            required
            aria-required="true"
            rows={4}
          />
        </div>
        <div>
          <label htmlFor="event-date">Date & Time</label>
          <input
            id="event-date"
            type="datetime-local"
            name="date"
            value={newEvent.date}
            onChange={handleInputChange}
            required
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="event-location">Location</label>
          <input
            id="event-location"
            type="text"
            name="location"
            value={newEvent.location}
            onChange={handleInputChange}
            placeholder="Enter operation location"
            required
            aria-required="true"
          />
        </div>
        <button type="submit">Create Tactical Operation</button>
      </form>

      <h3 className="mt-3">Upcoming Tactical Operations</h3>
      {events.length === 0 ? (
        <p className="text-center" style={{ color: 'var(--text-secondary)', padding: '2rem' }}>
          No tactical operations scheduled yet. Create your first operation above!
        </p>
      ) : (
        <ul>
          {events.map(event => (
            <li key={event.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.5rem',
                }}
              >
                <h4 style={{ margin: 0, color: 'var(--accent-cyan)' }}>{event.title}</h4>
                <span className="badge badge-success">{event.attendees.length} attending</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                {event.description}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                <p style={{ margin: 0 }}>
                  <strong style={{ color: 'var(--accent-blue)' }}>📅 Date:</strong>{' '}
                  {new Date(event.date).toLocaleString()}
                </p>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: 'var(--accent-blue)' }}>📍 Location:</strong>{' '}
                  {event.location}
                </p>
              </div>
              {event.organizationId && (
                <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
                  <strong>Organization:</strong> {event.organizationId}
                </p>
              )}
              {event.sharedWithOrgs && event.sharedWithOrgs.length > 0 && (
                <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
                  <strong>Shared with:</strong>{' '}
                  {event.sharedWithOrgs
                    .map(orgId => {
                      const org = userOrganizations.find(o => o.id === orgId);
                      return org ? org.name : orgId;
                    })
                    .join(', ')}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                {userOrganizations.length > 0 && (
                  <button
                    onClick={() => handleOpenSharingModal(event)}
                    style={{ background: 'var(--accent-blue)' }}
                    aria-label={`Share ${event.title} with organizations`}
                  >
                    <LinkIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />Share with Orgs
                  </button>
                )}
                <button
                  onClick={() => handleDelete(event.id)}
                  aria-label={`Delete ${event.title} event`}
                >
                  Delete Event
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Sharing Modal */}
      <OrganizationSharingModal
        isOpen={!!sharingModalEvent}
        itemTitle={sharingModalEvent?.title || ''}
        itemType="Event"
        userOrganizations={userOrganizations}
        selectedOrgIds={selectedOrgsToShare}
        onToggleOrg={handleToggleOrgShare}
        onSave={handleSaveSharing}
        onClose={handleCloseSharingModal}
      />
    </div>
  );
};
