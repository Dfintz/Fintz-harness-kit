import { LabelBuilder, TextInputStyle } from 'discord.js';
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
export declare function createModalLabelInput(options: Readonly<ModalLabelInputOptions>): LabelBuilder;
//# sourceMappingURL=modalLabelInput.d.ts.map