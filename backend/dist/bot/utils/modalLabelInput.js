"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModalLabelInput = createModalLabelInput;
const discord_js_1 = require("discord.js");
function createModalLabelInput(options) {
    const input = new discord_js_1.TextInputBuilder({
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
    return new discord_js_1.LabelBuilder().setLabel(options.label).setTextInputComponent(input);
}
//# sourceMappingURL=modalLabelInput.js.map