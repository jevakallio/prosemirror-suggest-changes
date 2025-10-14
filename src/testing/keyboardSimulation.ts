import { type EditorView } from "prosemirror-view";

/**
 * Simulates a keyboard event in a ProseMirror editor.
 *
 * This uses the `someProp` method to directly invoke ProseMirror's keyboard
 * handlers, which is the recommended approach for testing (as suggested by
 * ProseMirror's creator, Marijn Haverbeke).
 *
 * This approach is more reliable in JSDOM than dispatching actual DOM events,
 * as it bypasses browser-specific event handling and directly tests ProseMirror's
 * keymap behavior.
 *
 * @param view - The EditorView to dispatch the event to
 * @param key - The key name (e.g., "Enter", "Backspace", "Delete")
 * @param keyCode - The legacy keyCode (e.g., 13 for Enter, 8 for Backspace, 46 for Delete)
 * @returns true if the event was handled by ProseMirror, false otherwise
 *
 * @example
 * ```typescript
 * // Simulate pressing Enter
 * simulateKeyPress(view, "Enter", 13);
 *
 * // Simulate pressing Backspace
 * simulateKeyPress(view, "Backspace", 8);
 *
 * // Simulate pressing Delete
 * simulateKeyPress(view, "Delete", 46);
 * ```
 */
export function simulateKeyPress(
  view: EditorView,
  key: string,
  keyCode: number,
): boolean {
  // Get the window object from the view's DOM
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
  const windowObj = (view.dom.ownerDocument.defaultView ?? window) as any;

  // Create a KeyboardEvent using the modern constructor
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const event = new windowObj.KeyboardEvent("keydown", {
    key,
    keyCode,
    code: key,
    bubbles: true,
    cancelable: true,
  }) as KeyboardEvent;

  // Invoke ProseMirror's keyboard handlers directly using someProp
  // This is more reliable than dispatching to the DOM in JSDOM
  const handled = view.someProp("handleKeyDown", (f) => f(view, event));

  return handled ?? false;
}

/**
 * Common keyboard event constants for convenience
 */
export const Keys = {
  ENTER: { key: "Enter", keyCode: 13 },
  BACKSPACE: { key: "Backspace", keyCode: 8 },
  DELETE: { key: "Delete", keyCode: 46 },
  ARROW_LEFT: { key: "ArrowLeft", keyCode: 37 },
  ARROW_RIGHT: { key: "ArrowRight", keyCode: 39 },
  ARROW_UP: { key: "ArrowUp", keyCode: 38 },
  ARROW_DOWN: { key: "ArrowDown", keyCode: 40 },
} as const;

/**
 * Convenience function to press Enter
 */
export function pressEnter(view: EditorView): boolean {
  return simulateKeyPress(view, Keys.ENTER.key, Keys.ENTER.keyCode);
}

/**
 * Convenience function to press Backspace
 */
export function pressBackspace(view: EditorView): boolean {
  return simulateKeyPress(view, Keys.BACKSPACE.key, Keys.BACKSPACE.keyCode);
}

/**
 * Convenience function to press Delete
 */
export function pressDelete(view: EditorView): boolean {
  return simulateKeyPress(view, Keys.DELETE.key, Keys.DELETE.keyCode);
}
