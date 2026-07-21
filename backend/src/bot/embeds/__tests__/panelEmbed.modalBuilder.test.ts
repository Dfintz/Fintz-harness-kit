import { TextInputStyle } from 'discord.js';

import { buildPanelModal } from '../panelEmbed';

describe('buildPanelModal', () => {
  it('builds modal rows preserving field contracts', () => {
    const modal = buildPanelModal('modal_1', 'Panel Modal', [
      {
        customId: 'name',
        label: 'Name',
        style: 'short',
        placeholder: 'Enter name',
        required: true,
        maxLength: 50,
      },
      {
        customId: 'details',
        label: 'Details',
        style: 'paragraph',
        required: false,
        minLength: 0,
        maxLength: 200,
        value: 'prefilled details',
      },
      {
        customId: 'color',
        label: 'Color',
        style: TextInputStyle.Short,
        required: false,
      },
    ]);

    const json = modal.toJSON();

    expect(json.custom_id).toBe('modal_1');
    expect(json.title).toBe('Panel Modal');
    expect(json.components).toHaveLength(3);

    const [name, details, color] = json.components.map(component =>
      'components' in component ? component.components[0] : component.component
    );

    expect(name.custom_id).toBe('name');
    expect(name.style).toBe(TextInputStyle.Short);
    expect(name.required).toBe(true);
    expect(name.max_length).toBe(50);

    expect(details.custom_id).toBe('details');
    expect(details.style).toBe(TextInputStyle.Paragraph);
    expect(details.required).toBe(false);
    expect(details.value).toBe('prefilled details');

    expect(color.custom_id).toBe('color');
    expect(color.style).toBe(TextInputStyle.Short);
    expect(color.required).toBe(false);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
