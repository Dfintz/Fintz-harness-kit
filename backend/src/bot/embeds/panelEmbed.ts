import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { EmbedColors, SCFleetEmbed } from '../utils/embedBuilder';

// ΓöÇΓöÇΓöÇ Panel Button Definition ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface PanelButtonDef {
  /** Unique action key used in customId: `{prefix}_panel_{action}` */
  action: string;
  /** Display label on the button */
  label: string;
  /** Discord button style */
  style: ButtonStyle;
  /** Optional emoji shown before label */
  emoji?: string;
  /** Short description shown in the embed field */
  description: string;
}

// ΓöÇΓöÇΓöÇ Modal Field Definition ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface PanelModalFieldDef {
  /** Unique ID for this input (used in modal submission) */
  customId: string;
  /** Label shown above the input */
  label: string;
  /** Placeholder hint text */
  placeholder?: string;
  /** Short (single line) or Paragraph (multi-line) */
  style: 'short' | 'paragraph' | TextInputStyle;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  /** Optional pre-filled value. */
  value?: string;
}

// ΓöÇΓöÇΓöÇ Panel Configuration ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface PanelConfig {
  /** Title shown in the embed header */
  title: string;
  /** Description text below the title */
  description: string;
  /** Embed accent colour (defaults to SC_BLUE) */
  color?: number;
  /** Footer text (e.g. "Click a button below to get started") */
  footer?: string;
  /** CustomId prefix for buttons (e.g. 'ticket', 'recruitment') */
  prefix: string;
  /** Button definitions ΓÇö one button per category/action */
  buttons: PanelButtonDef[];
}

// ΓöÇΓöÇΓöÇ Builders ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

/**
 * Builds a branded panel embed from a PanelConfig.
 * Each button definition becomes an inline field explaining what it does.
 */
export function buildPanelEmbed(config: PanelConfig): EmbedBuilder {
  const embed = SCFleetEmbed.create()
    .setColor(config.color ?? EmbedColors.SC_BLUE)
    .setTitle(decodeHtmlEntities(config.title))
    .setDescription(decodeHtmlEntities(config.description));

  for (const btn of config.buttons) {
    embed.addFields({
      name: `${btn.emoji ?? ''} ${decodeHtmlEntities(btn.label)}`.trim(),
      value: decodeHtmlEntities(btn.description),
      inline: true,
    });
  }

  if (config.footer) {
    embed.setFooter({ text: decodeHtmlEntities(config.footer) });
  }

  return embed.setTimestamp().build();
}

/**
 * Builds an ActionRow of buttons from a PanelConfig.
 * CustomId format: `{prefix}_panel_{action}`
 */
export function buildPanelButtons(config: PanelConfig): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  for (const btn of config.buttons) {
    const builder = new ButtonBuilder()
      .setCustomId(`${config.prefix}_panel_${btn.action}`)
      .setLabel(decodeHtmlEntities(btn.label))
      .setStyle(btn.style);

    if (btn.emoji) {
      builder.setEmoji(btn.emoji);
    }

    row.addComponents(builder);
  }

  return row;
}

/**
 * Parses a panel button customId.
 * e.g. 'ticket_panel_hr' ΓåÆ { prefix: 'ticket', action: 'hr' }
 */
export function parsePanelButtonId(customId: string): {
  prefix: string;
  action: string;
} | null {
  const match = /^([a-z]+)_panel_([a-z_]+)$/.exec(customId);
  if (!match) {
    return null;
  }
  return { prefix: match[1], action: match[2] };
}

/**
 * Builds a modal form from field definitions.
 * Useful for panels that open a form when a button is clicked.
 */
export function buildPanelModal(
  customId: string,
  title: string,
  fields: PanelModalFieldDef[]
): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(decodeHtmlEntities(title));

  for (const field of fields.slice(0, 5)) {
    let resolvedStyle: TextInputStyle;
    if (field.style === 'paragraph') {
      resolvedStyle = TextInputStyle.Paragraph;
    } else if (field.style === 'short') {
      resolvedStyle = TextInputStyle.Short;
    } else {
      resolvedStyle = field.style;
    }

    const input = new TextInputBuilder()
      .setCustomId(field.customId)
      .setStyle(resolvedStyle)
      .setRequired(field.required ?? true);

    if (field.placeholder) {
      input.setPlaceholder(decodeHtmlEntities(field.placeholder));
    }
    if (field.minLength !== undefined) {
      input.setMinLength(field.minLength);
    }
    if (field.maxLength !== undefined) {
      input.setMaxLength(field.maxLength);
    }
    if (field.value !== undefined) {
      input.setValue(decodeHtmlEntities(field.value));
    }

    modal.addLabelComponents(
      new LabelBuilder().setLabel(decodeHtmlEntities(field.label)).setTextInputComponent(input)
    );
  }

  return modal;
}
