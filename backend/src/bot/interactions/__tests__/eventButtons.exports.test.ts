import * as eventButtons from '../eventButtons';

describe('eventButtons export surface', () => {
  it('exports reqship routed handlers and keeps direct request button handler internal', () => {
    expect(typeof eventButtons.handleReqShipModal).toBe('function');
    expect(typeof eventButtons.handleReqShipRoleSelect).toBe('function');
    expect(typeof eventButtons.handleReqShipTypeSelect).toBe('function');

    const exportsMap = eventButtons as Record<string, unknown>;
    expect('handleRequestShip' in exportsMap).toBe(false);
  });

  it('exports manage-slots routed handlers and keeps direct manage button handler internal', () => {
    expect(typeof eventButtons.handleManageSlotsModal).toBe('function');
    expect(typeof eventButtons.handleManageSlotsShipSelect).toBe('function');

    const exportsMap = eventButtons as Record<string, unknown>;
    expect('handleManageSlots' in exportsMap).toBe(false);
  });

  it('exports passenger routed handler and keeps direct passenger button handler internal', () => {
    expect(typeof eventButtons.handlePassengerSelectMenu).toBe('function');

    const exportsMap = eventButtons as Record<string, unknown>;
    expect('handleJoinPassenger' in exportsMap).toBe(false);
  });

  it('keeps cancel handlers internal to the monolith direct-action map', () => {
    const exportsMap = eventButtons as Record<string, unknown>;

    expect('handleCancelEventPrompt' in exportsMap).toBe(false);
    expect('handleCancelEventDismiss' in exportsMap).toBe(false);
    expect('handleCancelEvent' in exportsMap).toBe(false);
  });

  it('exports edit modal handler and keeps direct edit button handler internal', () => {
    expect(typeof eventButtons.handleEditEventModal).toBe('function');

    const exportsMap = eventButtons as Record<string, unknown>;
    expect('handleEditEvent' in exportsMap).toBe(false);
  });

  it('keeps clone handler internal to the monolith direct-action map', () => {
    const exportsMap = eventButtons as Record<string, unknown>;
    expect('handleCloneEvent' in exportsMap).toBe(false);
  });

  it('keeps panel/reminder handlers internal to the monolith direct-action map', () => {
    const exportsMap = eventButtons as Record<string, unknown>;
    expect('handleOpenActionsPanel' in exportsMap).toBe(false);
    expect('handleRemindMe' in exportsMap).toBe(false);
    expect('ephemeralLeaveConfirmation' in exportsMap).toBe(false);
  });

  it('keeps mirror-sync helper internal to the monolith module', () => {
    const exportsMap = eventButtons as Record<string, unknown>;
    expect('triggerMirrorSync' in exportsMap).toBe(false);
  });

  it('keeps direct-action seam helpers internal to the monolith module', () => {
    const exportsMap = eventButtons as Record<string, unknown>;
    expect('dispatchDirectAction' in exportsMap).toBe(false);
    expect('getEphemeralLeaveConfirmation' in exportsMap).toBe(false);
  });

  it('keeps non-direct action seam helper internal to the monolith module', () => {
    const exportsMap = eventButtons as Record<string, unknown>;
    expect('executeNonDirectAction' in exportsMap).toBe(false);
  });

  it('keeps post-action effects seam helper internal to the monolith module', () => {
    const exportsMap = eventButtons as Record<string, unknown>;
    expect('runPostActionEffects' in exportsMap).toBe(false);
  });

  it('keeps actor context seam helper internal to the monolith module', () => {
    const exportsMap = eventButtons as Record<string, unknown>;
    expect('resolveActionActorContext' in exportsMap).toBe(false);
  });

  it('keeps non-direct pipeline seam helper internal to the monolith module', () => {
    const exportsMap = eventButtons as Record<string, unknown>;
    expect('runDeferredNonDirectPipeline' in exportsMap).toBe(false);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
