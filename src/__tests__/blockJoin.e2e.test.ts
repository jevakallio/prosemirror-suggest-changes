import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema } from "prosemirror-model";
import { nodes, marks } from "prosemirror-schema-basic";
import { addSuggestionMarks } from "../schema.js";
import { describe, it, beforeEach, afterEach } from "vitest";
// @ts-expect-error - jsdom types not needed for tests
import { JSDOM } from "jsdom";
import { withSuggestChanges } from "../withSuggestChanges.js";
import { suggestChanges, suggestChangesKey } from "../plugin.js";

/**
 * E2E Tests to Understand Real ProseMirror Behavior
 *
 * These tests simulate actual user interactions and LOG the transactions
 * that ProseMirror generates. This helps us understand:
 * - What slice structures are created
 * - What positions are affected
 * - How cursor moves
 * - What the actual behavior is (vs what we assume)
 */

const schema = new Schema({
  nodes,
  marks: addSuggestionMarks(marks),
});

describe("Block Join E2E - Real ProseMirror Behavior", () => {
  let dom: JSDOM;
  let container: HTMLElement;
  let view: EditorView | null = null;

  beforeEach(() => {
    // Create a fresh DOM for each test
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    dom = new JSDOM("<!DOCTYPE html><div id='editor'></div>");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-non-null-assertion
    container = dom.window.document.getElementById("editor")!;
  });

  afterEach(() => {
    // Clean up
    if (view) {
      view.destroy();
      view = null;
    }
  });

  /**
   * Helper to create a ProseMirror editor with transaction logging
   */
  function createEditor(content: string) {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: content ? [{ type: "text", text: content }] : [],
        },
      ],
    });

    let state = EditorState.create({
      doc,
      schema,
      plugins: [suggestChanges()],
    });

    // Enable suggest changes mode
    state = state.apply(state.tr.setMeta(suggestChangesKey, { enabled: true }));

    const dispatch = withSuggestChanges(
      function (this: EditorView, tr) {
        // LOG THE TRANSACTION - This is the key!
        console.log("\n=== TRANSACTION ===");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        console.log(
          "Steps:",
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
      },
      () => 1 as string | number, // Always use suggestion ID 1
    );

    view = new EditorView(container, {
      state,
      dispatchTransaction: dispatch,
    });

    return view;
  }

  describe("Paragraph: Enter then Backspace", () => {
    it("should revert document to original state", () => {
      const editor = createEditor("test paragraph");
      const initialDoc = editor.state.doc;

      console.log("\n📝 TEST: Paragraph Enter → Backspace");
      console.log("Initial doc:", initialDoc.toJSON());

      // Move cursor to end of paragraph
      const endPos = initialDoc.content.size - 1;
      editor.dispatch(
        editor.state.tr.setSelection(
          TextSelection.near(initialDoc.resolve(endPos)),
        ),
      );

      console.log("\n⚡ Simulating ENTER key...");
      // Simulate Enter key
      // TODO: We need to figure out the actual transaction for Enter
      // For now, we'll manually create a paragraph split
      const splitTr = editor.state.tr.split(editor.state.selection.from);
      editor.dispatch(splitTr);

      const afterEnterDoc = editor.state.doc;
      console.log("After Enter:", afterEnterDoc.toJSON());
      console.log("Cursor after Enter:", {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      });

      console.log("\n⬅️ Simulating BACKSPACE key...");
      // Simulate Backspace key
      // TODO: Figure out actual transaction for Backspace
      const backspaceTr = editor.state.tr.delete(
        editor.state.selection.from - 1,
        editor.state.selection.from,
      );
      editor.dispatch(backspaceTr);

      const finalDoc = editor.state.doc;
      console.log("After Backspace:", finalDoc.toJSON());

      // OBSERVATION: Did it revert? What transactions happened?
      console.log("\n🔍 OBSERVATION:");
      console.log("Did document revert?", initialDoc.eq(finalDoc));
      console.log("Initial text:", initialDoc.textContent);
      console.log("Final text:", finalDoc.textContent);
    });
  });

  describe("Paragraph: Enter twice then Backspace twice", () => {
    it("should revert through both suggestions", () => {
      const editor = createEditor("test paragraph");
      const initialDoc = editor.state.doc;

      console.log("\n📝 TEST: Paragraph Enter → Enter → Backspace → Backspace");

      // Move to end
      const endPos = initialDoc.content.size - 1;
      editor.dispatch(
        editor.state.tr.setSelection(
          TextSelection.near(initialDoc.resolve(endPos)),
        ),
      );

      console.log("\n⚡ First ENTER...");
      editor.dispatch(editor.state.tr.split(editor.state.selection.from));

      console.log("\n⚡ Second ENTER...");
      editor.dispatch(editor.state.tr.split(editor.state.selection.from));

      const afterTwoEnters = editor.state.doc;
      console.log("After two Enters:", afterTwoEnters.toJSON());
      console.log("Number of paragraphs:", afterTwoEnters.childCount);

      console.log("\n⬅️ First BACKSPACE...");
      editor.dispatch(
        editor.state.tr.delete(
          editor.state.selection.from - 1,
          editor.state.selection.from,
        ),
      );

      console.log("\n⬅️ Second BACKSPACE...");
      editor.dispatch(
        editor.state.tr.delete(
          editor.state.selection.from - 1,
          editor.state.selection.from,
        ),
      );

      const finalDoc = editor.state.doc;
      console.log("After two Backspaces:", finalDoc.toJSON());

      console.log("\n🔍 OBSERVATION:");
      console.log("Did document revert?", initialDoc.eq(finalDoc));
      console.log("Initial paragraphs:", initialDoc.childCount);
      console.log("Final paragraphs:", finalDoc.childCount);
    });
  });

  describe("Paragraph: Enter then Delete (from first block - Case 1)", () => {
    it("should revert when Delete pressed from end of first block", () => {
      const editor = createEditor("test paragraph");
      const initialDoc = editor.state.doc;

      console.log(
        "\n📝 TEST: Paragraph Enter → Delete from first block (Case 1)",
      );

      // Move to end
      const endPos = initialDoc.content.size - 1;
      editor.dispatch(
        editor.state.tr.setSelection(
          TextSelection.near(initialDoc.resolve(endPos)),
        ),
      );

      console.log("\n⚡ ENTER...");
      editor.dispatch(editor.state.tr.split(editor.state.selection.from));

      // Move cursor to end of FIRST block (before the split)
      const firstBlockEnd = editor.state.doc.resolve(endPos);
      editor.dispatch(
        editor.state.tr.setSelection(TextSelection.near(firstBlockEnd)),
      );

      console.log("\n➡️ DELETE from end of first block...");
      console.log("Cursor before Delete:", {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      });

      // Delete forward
      editor.dispatch(
        editor.state.tr.delete(
          editor.state.selection.from,
          editor.state.selection.from + 1,
        ),
      );

      const finalDoc = editor.state.doc;
      console.log("After Delete:", finalDoc.toJSON());

      console.log("\n🔍 OBSERVATION:");
      console.log("Did document revert?", initialDoc.eq(finalDoc));
      console.log("Cursor after Delete:", {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      });
    });
  });

  describe("Paragraph: Enter then Delete (from second block at boundary - Case 3)", () => {
    it("should revert when Delete pressed at exact block boundary", () => {
      const editor = createEditor("test paragraph");
      const initialDoc = editor.state.doc;

      console.log("\n📝 TEST: Paragraph Enter → Delete at boundary (Case 3)");

      // Move to end
      const endPos = initialDoc.content.size - 1;
      editor.dispatch(
        editor.state.tr.setSelection(
          TextSelection.near(initialDoc.resolve(endPos)),
        ),
      );

      console.log("\n⚡ ENTER...");
      editor.dispatch(editor.state.tr.split(editor.state.selection.from));

      const afterEnter = editor.state.doc;

      // Position cursor at the START of second block (at the boundary)
      // This is the position RIGHT AFTER the ending ZWSP of first block
      // We need to figure out the exact position from logs
      console.log("\n🎯 Positioning cursor at block boundary...");
      console.log("Doc structure after Enter:", afterEnter.toJSON());

      // Try to position at boundary
      // In a split, the boundary is typically where first block ends
      const boundaryPos = endPos + 1; // This might need adjustment based on logs

      editor.dispatch(
        editor.state.tr.setSelection(
          TextSelection.near(afterEnter.resolve(boundaryPos)),
        ),
      );

      console.log("Cursor at boundary:", {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      });

      console.log("\n➡️ DELETE at boundary (or BACKSPACE)...");
      // This tests structural deletion - what happens when we delete
      // right at the boundary? Does it naturally join blocks?
      // Or do we need special handling?

      // Try delete forward first
      editor.dispatch(
        editor.state.tr.delete(
          editor.state.selection.from,
          editor.state.selection.from + 1,
        ),
      );

      const finalDoc = editor.state.doc;
      console.log("After Delete at boundary:", finalDoc.toJSON());

      console.log("\n🔍 OBSERVATION:");
      console.log("Did document revert?", initialDoc.eq(finalDoc));
      console.log("How many paragraphs remain?", finalDoc.childCount);
      console.log("Final text:", finalDoc.textContent);
    });
  });

  describe("Edge Cases", () => {
    it("should NOT revert when deleting ZWSP without matching pair", () => {
      console.log("\n📝 TEST: Delete ZWSP without matching pair");
      // TODO: Test what happens when only one ZWSP exists
    });

    it("should NOT revert when ZWSP IDs don't match", () => {
      console.log("\n📝 TEST: Delete ZWSP with mismatched IDs");
      // TODO: Test what happens with different suggestion IDs
    });
  });
});
