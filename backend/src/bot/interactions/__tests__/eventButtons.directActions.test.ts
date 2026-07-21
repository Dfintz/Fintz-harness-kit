const handlerMocks = {
  openActionsPanel: jest.fn(),
  bringShip: jest.fn(),
  removeShip: jest.fn(),
  joinCrew: jest.fn(),
  joinPassenger: jest.fn(),
  requestShip: jest.fn(),
  manageSlots: jest.fn(),
  bringFleet: jest.fn(),
  remindMe: jest.fn(),
  cancelPrompt: jest.fn(),
  confirmCancel: jest.fn(),
  cancelDismiss: jest.fn(),
  editEvent: jest.fn(),
  cloneEvent: jest.fn(),
  ephemeralLeaveConfirmation: jest.fn((action: string) => `leave:${action}`),
};

jest.mock('../eventButtons.bringFleet', () => ({
  handleBringFleet: (...args: unknown[]) => handlerMocks.bringFleet(...args),
}));

jest.mock('../eventButtons.bringShip', () => ({
  handleBringShip: (...args: unknown[]) => handlerMocks.bringShip(...args),
}));

jest.mock('../eventButtons.cancel', () => ({
  handleCancelEventPrompt: (...args: unknown[]) => handlerMocks.cancelPrompt(...args),
  handleCancelEvent: (...args: unknown[]) => handlerMocks.confirmCancel(...args),
  handleCancelEventDismiss: (...args: unknown[]) => handlerMocks.cancelDismiss(...args),
}));

jest.mock('../eventButtons.clone', () => ({
  handleCloneEvent: (...args: unknown[]) => handlerMocks.cloneEvent(...args),
}));

jest.mock('../eventButtons.edit', () => ({
  handleEditEvent: (...args: unknown[]) => handlerMocks.editEvent(...args),
}));

jest.mock('../eventButtons.manageSlots', () => ({
  handleManageSlots: (...args: unknown[]) => handlerMocks.manageSlots(...args),
}));

jest.mock('../eventButtons.panelReminder', () => ({
  handleOpenActionsPanel: (...args: unknown[]) => handlerMocks.openActionsPanel(...args),
  handleRemindMe: (...args: unknown[]) => handlerMocks.remindMe(...args),
  ephemeralLeaveConfirmation: (...args: unknown[]) =>
    handlerMocks.ephemeralLeaveConfirmation(...args),
}));

jest.mock('../eventButtons.passenger', () => ({
  handleJoinPassenger: (...args: unknown[]) => handlerMocks.joinPassenger(...args),
}));

jest.mock('../eventButtons.requestShip', () => ({
  handleRequestShip: (...args: unknown[]) => handlerMocks.requestShip(...args),
}));

jest.mock('../eventButtons.shipCrew', () => ({
  handleJoinCrew: (...args: unknown[]) => handlerMocks.joinCrew(...args),
  handleRemoveShip: (...args: unknown[]) => handlerMocks.removeShip(...args),
}));

import { dispatchDirectAction, getEphemeralLeaveConfirmation } from '../eventButtons.directActions';

describe('eventButtons.directActions seam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    handlerMocks.openActionsPanel.mockResolvedValue(undefined);
    handlerMocks.bringShip.mockResolvedValue(undefined);
    handlerMocks.removeShip.mockResolvedValue(undefined);
    handlerMocks.joinCrew.mockResolvedValue(undefined);
    handlerMocks.joinPassenger.mockResolvedValue(undefined);
    handlerMocks.requestShip.mockResolvedValue(undefined);
    handlerMocks.manageSlots.mockResolvedValue(undefined);
    handlerMocks.bringFleet.mockResolvedValue(undefined);
    handlerMocks.remindMe.mockResolvedValue(undefined);
    handlerMocks.cancelPrompt.mockResolvedValue(undefined);
    handlerMocks.confirmCancel.mockResolvedValue(undefined);
    handlerMocks.cancelDismiss.mockResolvedValue(undefined);
    handlerMocks.editEvent.mockResolvedValue(undefined);
    handlerMocks.cloneEvent.mockResolvedValue(undefined);
    handlerMocks.ephemeralLeaveConfirmation.mockImplementation(action => `leave:${action}`);
  });

  const actionMap: Array<[string, jest.Mock]> = [
    ['actions', handlerMocks.openActionsPanel],
    ['bringship', handlerMocks.bringShip],
    ['removeship', handlerMocks.removeShip],
    ['joincrew', handlerMocks.joinCrew],
    ['joinpassenger', handlerMocks.joinPassenger],
    ['requestship', handlerMocks.requestShip],
    ['manageslots', handlerMocks.manageSlots],
    ['bringfleet', handlerMocks.bringFleet],
    ['remindme', handlerMocks.remindMe],
    ['cancel', handlerMocks.cancelPrompt],
    ['confirmcancel', handlerMocks.confirmCancel],
    ['canceldismiss', handlerMocks.cancelDismiss],
    ['edit', handlerMocks.editEvent],
    ['clone', handlerMocks.cloneEvent],
  ];

  it.each(actionMap)('dispatches direct action %s', async (action, expectedHandler) => {
    const interaction = { id: 'interaction-1' } as never;

    const handled = await dispatchDirectAction(interaction, action, 'activity-1');

    expect(handled).toBe(true);
    expect(expectedHandler).toHaveBeenCalledWith(interaction, 'activity-1');
  });

  it('returns false for non-direct action', async () => {
    const interaction = { id: 'interaction-1' } as never;

    const handled = await dispatchDirectAction(interaction, 'join', 'activity-1');

    expect(handled).toBe(false);
    actionMap.forEach(([, handler]) => {
      expect(handler).not.toHaveBeenCalled();
    });
  });

  it('delegates ephemeral leave confirmation formatting', () => {
    const message = getEphemeralLeaveConfirmation('leave');

    expect(handlerMocks.ephemeralLeaveConfirmation).toHaveBeenCalledWith('leave');
    expect(message).toBe('leave:leave');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
