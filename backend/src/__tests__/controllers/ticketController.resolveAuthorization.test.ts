import { canUserResolveTicket } from '../../controllers/ticketController';

describe('canUserResolveTicket', () => {
  const ticket = {
    creatorId: 'creator-user-id',
    assigneeId: 'assignee-user-id',
  };

  it('allows ticket creator to resolve', () => {
    const allowed = canUserResolveTicket(ticket, {
      id: 'creator-user-id',
      username: 'creator',
      role: 'user',
      currentOrganizationId: 'org-1',
    });

    expect(allowed).toBe(true);
  });

  it('allows ticket assignee to resolve', () => {
    const allowed = canUserResolveTicket(ticket, {
      id: 'assignee-user-id',
      username: 'assignee',
      role: 'user',
      currentOrganizationId: 'org-1',
    });

    expect(allowed).toBe(true);
  });

  it('allows org admin role to resolve', () => {
    const allowed = canUserResolveTicket(ticket, {
      id: 'org-admin-id',
      username: 'orgadmin',
      role: 'org_admin',
      currentOrganizationId: 'org-1',
    });

    expect(allowed).toBe(true);
  });

  it('rejects unrelated non-admin users', () => {
    const allowed = canUserResolveTicket(ticket, {
      id: 'random-user-id',
      username: 'random',
      role: 'user',
      currentOrganizationId: 'org-1',
    });

    expect(allowed).toBe(false);
  });
});
