import { Fragment, Slice } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { eq } from "prosemirror-test-builder";
import { type ReplaceStep, replaceStep } from "prosemirror-transform";
import { assert, describe, it } from "vitest";

import { suggestReplaceStep } from "../replaceStep.js";
import { type TaggedNode, testBuilders } from "../testing/testBuilders.js";
import { getSuggestionMarks } from "../utils.js";

describe("Paragraph Backspace Behavior", () => {
  it("should remove suggested paragraph when backspacing immediately after creation", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("first <a>paragraph"),
      testBuilders.paragraph("second paragraph"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found in document");

    // Step 1: Create paragraph split (simulates Enter key)
    const splitStep = replaceStep(
      doc,
      tagA,
      tagA,
      new Slice(
        Fragment.from([testBuilders.paragraph(), testBuilders.paragraph()]),
        1,
        1,
      ),
    ) as ReplaceStep | null;

    assert(splitStep, "Could not create paragraph split step");

    const editorState = EditorState.create({
      doc,
      selection: new TextSelection(doc.resolve(tagA), doc.resolve(tagA)),
    });

    // Apply the split as a suggestion
    const splitTransaction = editorState.tr;
    suggestReplaceStep(splitTransaction, editorState, doc, splitStep, [], 1);
    const splitState = editorState.apply(splitTransaction);

    // Verify paragraph was created with insertion marks
    const expectedAfterSplit = testBuilders.doc(
      testBuilders.paragraph(
        "first ",
        testBuilders.insertion({ id: 1 }, "\u200B"),
      ),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, "\u200B"),
        "paragraph",
      ),
      testBuilders.paragraph("second paragraph"),
    );

    assert(
      eq(splitState.doc, expectedAfterSplit),
      "After split, document structure should match expected",
    );

    // Step 2: Backspace to remove the suggestion
    // Position is now at start of new paragraph (after the zero-width space)
    const cursorPos = tagA + 2; // After "first " + zwsp
    const backspaceStep = replaceStep(
      splitState.doc,
      cursorPos - 1,
      cursorPos,
      Slice.empty,
    ) as ReplaceStep | null;

    assert(backspaceStep, "Could not create backspace step");

    // Apply backspace as a suggestion
    const backspaceTransaction = splitState.tr;
    suggestReplaceStep(
      backspaceTransaction,
      splitState,
      splitState.doc,
      backspaceStep,
      [],
      2,
    );

    const finalState = splitState.apply(backspaceTransaction);

    // Expected: Back to original state (paragraph structure removed)
    const expectedFinal = testBuilders.doc(
      testBuilders.paragraph("first paragraph"),
      testBuilders.paragraph("second paragraph"),
    );

    assert(
      eq(finalState.doc, expectedFinal),
      "After backspace, document should return to original state",
    );
  });

  it("should remove suggested paragraph with content when backspacing the boundary", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("first <a>paragraph"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found in document");

    // Create paragraph split
    const splitStep = replaceStep(
      doc,
      tagA,
      tagA,
      new Slice(
        Fragment.from([testBuilders.paragraph(), testBuilders.paragraph()]),
        1,
        1,
      ),
    ) as ReplaceStep | null;

    assert(splitStep, "Could not create paragraph split step");

    const editorState = EditorState.create({ doc });

    const splitTransaction = editorState.tr;
    suggestReplaceStep(splitTransaction, editorState, doc, splitStep, [], 1);
    const splitState = editorState.apply(splitTransaction);

    // Type some text in the new paragraph (after the zwsp at position 10)
    const insertTextStep = replaceStep(
      splitState.doc,
      tagA + 4, // Position 11, after both zwsps
      tagA + 4,
      new Slice(Fragment.from(testBuilders.schema.text("new ")), 0, 0),
    ) as ReplaceStep | null;

    assert(insertTextStep, "Could not create text insertion step");

    const insertTextTransaction = splitState.tr;
    suggestReplaceStep(
      insertTextTransaction,
      splitState,
      splitState.doc,
      insertTextStep,
      [],
      1, // Same suggestion ID
    );

    const stateWithText = splitState.apply(insertTextTransaction);

    // Now backspace at the boundary (delete the zero-width space)
    const cursorPos = tagA + 2;
    const backspaceStep = replaceStep(
      stateWithText.doc,
      cursorPos - 1,
      cursorPos,
      Slice.empty,
    ) as ReplaceStep | null;

    assert(backspaceStep, "Could not create backspace step");

    const backspaceTransaction = stateWithText.tr;
    suggestReplaceStep(
      backspaceTransaction,
      stateWithText,
      stateWithText.doc,
      backspaceStep,
      [],
      2,
    );

    const finalState = stateWithText.apply(backspaceTransaction);

    // Expected: Paragraph joined, "new " text also removed (part of same suggestion)
    const expectedFinal = testBuilders.doc(
      testBuilders.paragraph("first paragraph"),
    );

    assert(
      eq(finalState.doc, expectedFinal),
      "After backspace, paragraph should be joined and content removed",
    );
  });

  it("should only join blocks with same suggestion ID", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("first <a>paragraph"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found in document");

    // Create paragraph split with ID 1
    const splitStep = replaceStep(
      doc,
      tagA,
      tagA,
      new Slice(
        Fragment.from([testBuilders.paragraph(), testBuilders.paragraph()]),
        1,
        1,
      ),
    ) as ReplaceStep | null;

    assert(splitStep, "Could not create paragraph split step");

    const editorState = EditorState.create({ doc });

    const splitTransaction = editorState.tr;
    suggestReplaceStep(splitTransaction, editorState, doc, splitStep, [], 1);
    const splitState = editorState.apply(splitTransaction);

    // Manually mark the second zero-width space with a different ID
    // (simulating a different suggestion)
    const { insertion } = getSuggestionMarks(splitState.schema);
    const modifyMarkTransaction = splitState.tr;
    const secondZwspPos = tagA + 3; // Position 10, the second zwsp
    modifyMarkTransaction.removeMark(
      secondZwspPos,
      secondZwspPos + 1,
      insertion,
    );
    modifyMarkTransaction.addMark(
      secondZwspPos,
      secondZwspPos + 1,
      insertion.create({ id: 2 }),
    );

    const modifiedState = splitState.apply(modifyMarkTransaction);

    // Now backspace the first zero-width space (at position 7-8)
    const cursorPos = tagA + 1; // Position 8, after the first zwsp
    const backspaceStep = replaceStep(
      modifiedState.doc,
      cursorPos - 1, // Backspace from position 7
      cursorPos, // To position 8
      Slice.empty,
    ) as ReplaceStep | null;

    assert(backspaceStep, "Could not create backspace step");

    const backspaceTransaction = modifiedState.tr;
    suggestReplaceStep(
      backspaceTransaction,
      modifiedState,
      modifiedState.doc,
      backspaceStep,
      [],
      3,
    );

    const finalState = modifiedState.apply(backspaceTransaction);

    // Expected: Only first zero-width space removed, paragraph NOT joined
    const expectedFinal = testBuilders.doc(
      testBuilders.paragraph("first "),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 2 }, "\u200B"),
        "paragraph",
      ),
    );

    assert(
      eq(finalState.doc, expectedFinal),
      "Blocks with different suggestion IDs should not be joined",
    );
  });
});
