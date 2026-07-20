/**
 * Keyboard target utilities
 *
 * Helpers for determining whether a keyboard event target is a typing context
 * (input, textarea, select, contenteditable) so that global keyboard shortcuts
 * can be suppressed while the user is typing.
 */

const TYPING_TAG_NAMES = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Returns true when the given event target is an element that accepts text
 * input, such as an <input>, <textarea>, <select>, or a contenteditable node.
 * Use this to prevent global keyboard shortcuts from firing while the user
 * is typing.
 */
export function isTypingContextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  if (TYPING_TAG_NAMES.has(target.tagName)) {
    return true;
  }
  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }
  return false;
}
