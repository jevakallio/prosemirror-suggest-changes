import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema } from "prosemirror-model";
import { nodes, marks } from "prosemirror-schema-basic";
import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { addSuggestionMarks } from "../schema.js";
import { withSuggestChanges } from "../withSuggestChanges.js";
import { suggestChanges, suggestChangesKey } from "../plugin.js";

const schema = new Schema({
  nodes,
  marks: addSuggestionMarks(marks),
});

export interface CreateTestEditorOptions {
  /**
   * Initial text content for the paragraph
   */
  content?: string;
  /**
   * Container element to mount the editor in (for JSDOM tests)
   */
  container: HTMLElement;
  /**
   * Whether to enable transaction logging for debugging
   * @default true
   */
  enableLogging?: boolean;
  /**
   * Whether to enable suggest changes mode by default
   * @default true
   */
  enableSuggestChanges?: boolean;
  /**
   * Custom suggestion ID generator
   * @default () => 1
   */
  generateId?: () => string | number;
}

/**
 * Creates a test ProseMirror editor with all necessary plugins for E2E testing.
 *
 * This helper sets up an editor with:
 * - baseKeymap for handling Enter, Backspace, Delete, etc.
 * - suggestChanges plugin for tracking suggestions
 * - withSuggestChanges dispatch wrapper for transforming transactions
 * - Optional transaction logging for debugging
 *
 * @param options - Configuration options for the editor
 * @returns An EditorView instance ready for testing
 *
 * @example
 * ```typescript
 * const editor = createTestEditor({
 *   content: "test paragraph",
 *   container: document.getElementById('editor')!,
 *   enableLogging: true
 * });
 *
 * // Use keyboard simulation
 * pressEnter(editor);
 * pressBackspace(editor);
 * ```
 */
export function createTestEditor(options: CreateTestEditorOptions): EditorView {
  const {
    content = "",
    container,
    enableLogging = true,
    enableSuggestChanges = true,
    generateId = () => 1,
  } = options;

  // Create initial document
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: content ? [{ type: "text", text: content }] : [],
      },
    ],
  });

  // Create editor state with plugins
  let state = EditorState.create({
    doc,
    schema,
    plugins: [
      keymap(baseKeymap), // Add baseKeymap to handle keyboard events
      suggestChanges(),
    ],
  });

  // Enable suggest changes mode if requested
  if (enableSuggestChanges) {
    state = state.apply(state.tr.setMeta(suggestChangesKey, { enabled: true }));
  }

  // Create dispatch function with optional logging
  const dispatch = withSuggestChanges(function (this: EditorView, tr) {
    // Log the transaction if enabled
    if (enableLogging) {
      console.log("\n=== TRANSACTION ===");
      console.log(
        "Steps:",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        tr.steps.map((s) => s.toJSON()),
      );
      console.log("Selection:", {
        from: tr.selection.from,
        to: tr.selection.to,
        empty: tr.selection.empty,
      });
      console.log("Doc before:", this.state.doc.toJSON());

      const newState = this.state.apply(tr);
      this.updateState(newState);

      console.log("Doc after:", newState.doc.toJSON());
      console.log("===================\n");
    } else {
      const newState = this.state.apply(tr);
      this.updateState(newState);
    }
  }, generateId);

  // Create the editor view
  const view = new EditorView(container, {
    state,
    dispatchTransaction: dispatch,
  });

  return view;
}

/**
 * Export the schema for use in tests
 */
export { schema };
