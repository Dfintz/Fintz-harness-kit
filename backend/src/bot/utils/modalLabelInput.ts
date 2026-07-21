import { LabelBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export interface ModalLabelInputOptions {
  customId: string;
  label: string;
  style: TextInputStyle;
  required?: boolean;
  placeholder?: string;
  value?: string;
  minLength?: number;
  maxLength?: number;
}

/**
 * Build a Label component that owns the visible label and wraps a TextInput payload.
 * Discord rejects nested text inputs that also carry their own label field.
 */
export function createModalLabelInput(options: Readonly<ModalLabelInputOptions>): LabelBuilder {
  const input = new TextInputBuilder({
    custom_id: options.customId,
    style: options.style,
    required: options.required ?? true,
  });

  if (options.placeholder !== undefined) {
    input.setPlaceholder(options.placeholder);
  }
  if (options.value !== undefined) {
    input.setValue(options.value);
  }
  if (options.minLength !== undefined) {
    input.setMinLength(options.minLength);
  }
  if (options.maxLength !== undefined) {
    input.setMaxLength(options.maxLength);
  }

  return new LabelBuilder().setLabel(options.label).setTextInputComponent(input);
}
