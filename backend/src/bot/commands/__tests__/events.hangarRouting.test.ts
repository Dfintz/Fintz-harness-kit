jest.mock('../../../services/activity', () => ({
  ActivityService: jest.fn(),
  EventMirrorService: jest.fn(),
}));

jest.mock('../../../services/user/UserService', () => ({
  UserService: jest.fn(),
}));

jest.mock('../../embeds/eventsEmbeds', () => ({
  buildEventMirrorSubPanelEmbed: jest.fn(),
}));

jest.mock('../../embeds/mirroredEventMessage', () => ({
  buildMirroredEventComponents: jest.fn(),
  buildMirroredEventEmbed: jest.fn(),
}));

jest.mock('../../interactions/eventButtons', () => ({
  handleBringFleetSelect: jest.fn(),
  handleBringShipModal: jest.fn(),
  handleCrewSelectMenu: jest.fn(),
  handleEditEventModal: jest.fn(),
  handleEventButton: jest.fn(),
  handleFleetInviteResponse: jest.fn(),
  handleHangarPageSelect: jest.fn(),
  handleHangarShipSelect: jest.fn(),
  handleManageSlotsModal: jest.fn(),
  handleManageSlotsShipSelect: jest.fn(),
  handleNestShipSelect: jest.fn(),
  handlePassengerSelectMenu: jest.fn(),
  handleRemoveShipSelectMenu: jest.fn(),
  handleReqShipModal: jest.fn(),
  handleReqShipRoleSelect: jest.fn(),
  handleReqShipTypeSelect: jest.fn(),
}));

jest.mock('../../interactions/eventCreationWizard', () => ({
  handleWizardButton: jest.fn(),
  handleWizardModal: jest.fn(),
  handleWizardSelectMenu: jest.fn(),
  isWizardButtonId: jest.fn(() => false),
  isWizardModalId: jest.fn(() => false),
  isWizardSelectId: jest.fn(() => false),
}));

jest.mock('../../interactions/eventEditWizard', () => ({
  handleEditWizardButton: jest.fn(),
  handleEditWizardModal: jest.fn(),
  isEditWizardButtonId: jest.fn(() => false),
  isEditWizardModalId: jest.fn(() => false),
}));

jest.mock('../../mirrorSyncPublisher', () => ({
  publishMirrorRefresh: jest.fn(),
}));

jest.mock('../../utils/commandPanelBuilder', () => ({
  buildCommandPanel: jest.fn(),
  parsePanelCustomId: jest.fn(() => null),
  replyWithCommandPanel: jest.fn(),
}));

jest.mock('../../utils/guildContext', () => ({
  resolveOrgIdForGuild: jest.fn(),
}));

jest.mock('../eventHandlers', () => ({
  handleEventCreate: jest.fn(),
  handleEventList: jest.fn(),
}));

import {
  handleBringShipModal,
  handleCrewSelectMenu,
  handleEditEventModal,
  handleHangarPageSelect,
  handleHangarShipSelect,
  handleManageSlotsModal,
  handleManageSlotsShipSelect,
  handleNestShipSelect,
  handlePassengerSelectMenu,
  handleRemoveShipSelectMenu,
  handleReqShipModal,
  handleReqShipRoleSelect,
  handleReqShipTypeSelect,
} from '../../interactions/eventButtons';
import { replyWithCommandPanel } from '../../utils/commandPanelBuilder';
import { events } from '../events';

describe('events command hangar routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes bring-ship modal customId to handleBringShipModal', async () => {
    const interaction = {
      customId: 'event_bringship_modal_activity-1',
      reply: jest.fn(),
    };

    await events.handleModal(interaction as never);

    expect(handleBringShipModal).toHaveBeenCalledWith(interaction, 'activity-1');
  });

  it('opens a lightweight default events panel', async () => {
    const interaction = {};

    await events.execute(interaction as never);

    expect(replyWithCommandPanel).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({
        buttons: [
          expect.objectContaining({ subcommand: 'list', label: 'List Events' }),
          expect.objectContaining({ subcommand: 'create', label: 'Create Event' }),
          expect.objectContaining({ subcommand: 'my', label: 'My Events' }),
        ],
      })
    );
  });

  it('routes edit-event modal customId to handleEditEventModal', async () => {
    const interaction = {
      customId: 'event_edit_modal_activity-1',
      reply: jest.fn(),
    };

    await events.handleModal(interaction as never);

    expect(handleEditEventModal).toHaveBeenCalledWith(interaction, 'activity-1');
  });

  it('routes hangar page select customId to handleHangarPageSelect', async () => {
    const interaction = {
      customId: 'event_hangarpage_activity-1',
      reply: jest.fn(),
    };

    await events.handleSelectMenu(interaction as never);

    expect(handleHangarPageSelect).toHaveBeenCalledWith(interaction, 'activity-1');
  });

  it('routes crew select customId to handleCrewSelectMenu', async () => {
    const interaction = {
      customId: 'event_crewselect_activity-1',
      reply: jest.fn(),
    };

    await events.handleSelectMenu(interaction as never);

    expect(handleCrewSelectMenu).toHaveBeenCalledWith(interaction, 'activity-1');
  });

  it('routes remove-ship select customId to handleRemoveShipSelectMenu', async () => {
    const interaction = {
      customId: 'event_removeshipselect_activity-1',
      reply: jest.fn(),
    };

    await events.handleSelectMenu(interaction as never);

    expect(handleRemoveShipSelectMenu).toHaveBeenCalledWith(interaction, 'activity-1');
  });

  it('routes hangar ship select customId to handleHangarShipSelect', async () => {
    const interaction = {
      customId: 'event_hangarship_activity-1',
      reply: jest.fn(),
    };

    await events.handleSelectMenu(interaction as never);

    expect(handleHangarShipSelect).toHaveBeenCalledWith(interaction, 'activity-1');
  });

  it('routes nest-ship select customId to handleNestShipSelect', async () => {
    const interaction = {
      customId: 'event_nestship_activity-1_child%3A%3Akey',
      reply: jest.fn(),
    };

    await events.handleSelectMenu(interaction as never);

    expect(handleNestShipSelect).toHaveBeenCalledWith(interaction, 'activity-1', 'child%3A%3Akey');
  });

  it('routes request-ship modal customId to handleReqShipModal', async () => {
    const interaction = {
      customId: 'event_reqship_modal_activity-1',
      reply: jest.fn(),
    };

    await events.handleModal(interaction as never);

    expect(handleReqShipModal).toHaveBeenCalledWith(interaction, 'activity-1');
  });

  it('routes request-ship role select customId to handleReqShipRoleSelect', async () => {
    const interaction = {
      customId: 'event_reqshiprole_activity-1',
      reply: jest.fn(),
    };

    await events.handleSelectMenu(interaction as never);

    expect(handleReqShipRoleSelect).toHaveBeenCalledWith(interaction, 'activity-1');
  });

  it('routes request-ship type select customId to handleReqShipTypeSelect', async () => {
    const interaction = {
      customId: 'event_reqshiptype_activity-1_combat',
      reply: jest.fn(),
    };

    await events.handleSelectMenu(interaction as never);

    expect(handleReqShipTypeSelect).toHaveBeenCalledWith(interaction, 'activity-1', 'combat');
  });

  it('routes manage-slots select customId to handleManageSlotsShipSelect', async () => {
    const interaction = {
      customId: 'event_manageslotsselect_activity-1',
      reply: jest.fn(),
    };

    await events.handleSelectMenu(interaction as never);

    expect(handleManageSlotsShipSelect).toHaveBeenCalledWith(interaction, 'activity-1');
  });

  it('routes manage-slots modal customId and decodes ship identifier', async () => {
    const interaction = {
      customId: 'event_manageslots_modal_activity-1__ship%2Falpha',
      reply: jest.fn(),
    };

    await events.handleModal(interaction as never);

    expect(handleManageSlotsModal).toHaveBeenCalledWith(interaction, 'activity-1', 'ship/alpha');
  });

  it('routes passenger select customId to handlePassengerSelectMenu', async () => {
    const interaction = {
      customId: 'event_passengerselect_activity-1',
      reply: jest.fn(),
    };

    await events.handleSelectMenu(interaction as never);

    expect(handlePassengerSelectMenu).toHaveBeenCalledWith(interaction, 'activity-1');
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
