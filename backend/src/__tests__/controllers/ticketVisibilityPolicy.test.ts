import { resolveVisibleRecipientTypesForOrgRole } from '../../controllers/ticketController';
import { TicketRecipientType } from '../../models/Ticket';

describe('ticket visibility policy', () => {
  it('includes platform admin tickets for officer roles', () => {
    const officerVisible = resolveVisibleRecipientTypesForOrgRole('officer');
    const seniorOfficerVisible = resolveVisibleRecipientTypesForOrgRole('senior_officer');

    expect(officerVisible).toContain(TicketRecipientType.PLATFORM_ADMIN);
    expect(seniorOfficerVisible).toContain(TicketRecipientType.PLATFORM_ADMIN);
  });

  it('normalizes fleet commander alias to senior officer visibility', () => {
    const aliasVisible = resolveVisibleRecipientTypesForOrgRole('fleet-commander');

    expect(aliasVisible).toContain(TicketRecipientType.ORG_LEADERSHIP);
    expect(aliasVisible).toContain(TicketRecipientType.PLATFORM_ADMIN);
  });

  it('returns undefined for unknown roles', () => {
    expect(resolveVisibleRecipientTypesForOrgRole('guest')).toBeUndefined();
  });
});
