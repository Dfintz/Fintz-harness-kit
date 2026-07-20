export declare const INTERACTION_ERROR_CLASSES: readonly ["user_input", "permission", "not_found", "conflict", "rate_limit", "timeout", "dependency", "internal"];
export type InteractionErrorClass = (typeof INTERACTION_ERROR_CLASSES)[number];
export declare function classifyInteractionError(error: Error): InteractionErrorClass;
export declare function isUserCorrectable(errorClass: InteractionErrorClass): boolean;
//# sourceMappingURL=interactionErrorTaxonomy.d.ts.map