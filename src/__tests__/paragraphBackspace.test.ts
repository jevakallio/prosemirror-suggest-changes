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

    if (!eq(finalState.doc, expectedFinal)) {
      console.log("MISMATCH!");
      console.log("Expected:", JSON.stringify(expectedFinal.toJSON(), null, 2));
      console.log("Actual:", JSON.stringify(finalState.doc.toJSON(), null, 2));
    }
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

  it("should remove suggested paragraph split at end of document when backspacing", () => {
    // This test matches the E2E pattern: "Paragraph: Enter then Backspace"
    // Transaction pattern: Split at position 15 (end), ZWSPs at 15-16 and 18-19
    const doc = testBuilders.doc(
      testBuilders.paragraph("test paragraph<a>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found in document");

    const editorState = EditorState.create({
      doc,
      selection: new TextSelection(doc.resolve(tagA), doc.resolve(tagA)),
    });

    // Create paragraph split at end (position 15)
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

    // Apply the split as a suggestion (matches E2E transaction)
    const splitTransaction = editorState.tr;
    suggestReplaceStep(splitTransaction, editorState, doc, splitStep, [], 1);
    const splitState = editorState.apply(splitTransaction);

    // Verify ZWSPs added at correct positions (15-16 and 18-19)
    const expectedAfterSplit = testBuilders.doc(
      testBuilders.paragraph(
        "test paragraph",
        testBuilders.insertion({ id: 1 }, "\u200B"),
      ),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, "\u200B")),
    );

    assert(
      eq(splitState.doc, expectedAfterSplit),
      "After split, ZWSPs should be at positions 15-16 and 18-19",
    );

    // Backspace from position 19 (start of second paragraph, after ZWSP)
    // This matches the E2E behavior: cursor at 19, backspace deletes ZWSP at 18-19
    const cursorPos = tagA + 4; // Position 19 (tagA=15, +1 for first ZWSP, +2 for para boundary, +1 for second ZWSP)
    const backspaceStep = replaceStep(
      splitState.doc,
      cursorPos - 1,
      cursorPos,
      Slice.empty,
    ) as ReplaceStep | null;

    assert(backspaceStep, "Could not create backspace step");

    // Apply backspace (triggers block join)
    const backspaceTransaction = splitState.tr;
    suggestReplaceStep(
      backspaceTransaction,
      splitState,
      splitState.doc,
      backspaceStep,
      [],
      1,
    );

    const finalState = splitState.apply(backspaceTransaction);

    // Expected: Document reverted to original, no ZWSPs
    const expectedFinal = testBuilders.doc(
      testBuilders.paragraph("test paragraph"),
    );

    assert(
      eq(finalState.doc, expectedFinal),
      "After backspace, document should revert to original with no ZWSPs",
    );

    // Verify no ZWSP characters remain
    assert(
      !finalState.doc.textContent.includes("\u200B"),
      "No ZWSP characters should remain in document",
    );
  });

  it("should handle block split in middle of text content", () => {
    // This test matches the E2E pattern: "Enter at middle of text then Backspace"
    // Transaction pattern: Split at position 6 (after "test "), ZWSPs at 6-7 and 9-10
    const doc = testBuilders.doc(
      testBuilders.paragraph("test <a>paragraph"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found in document");

    const editorState = EditorState.create({
      doc,
      selection: new TextSelection(doc.resolve(tagA), doc.resolve(tagA)),
    });

    // Create paragraph split at position 5 (after "test ")
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

    // Apply the split as a suggestion
    const splitTransaction = editorState.tr;
    suggestReplaceStep(splitTransaction, editorState, doc, splitStep, [], 1);
    const splitState = editorState.apply(splitTransaction);

    // Verify split: "test " | "paragraph" with ZWSPs at boundaries
    const expectedAfterSplit = testBuilders.doc(
      testBuilders.paragraph(
        "test ",
        testBuilders.insertion({ id: 1 }, "\u200B"),
      ),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, "\u200B"),
        "paragraph",
      ),
    );

    assert(
      eq(splitState.doc, expectedAfterSplit),
      "After split at middle, should have 'test ' and 'paragraph' in separate blocks",
    );

    // Backspace from start of second paragraph
    // Position calculation: tagA (5) + 1 (first ZWSP) + 1 (para boundary) + 1 (second ZWSP) = 8
    const cursorPos = tagA + 3;
    const backspaceStep = replaceStep(
      splitState.doc,
      cursorPos - 1,
      cursorPos,
      Slice.empty,
    ) as ReplaceStep | null;

    assert(backspaceStep, "Could not create backspace step");

    // Apply backspace (triggers block join)
    const backspaceTransaction = splitState.tr;
    suggestReplaceStep(
      backspaceTransaction,
      splitState,
      splitState.doc,
      backspaceStep,
      [],
      1,
    );

    const finalState = splitState.apply(backspaceTransaction);

    // Expected: Blocks rejoined at original split position
    const expectedFinal = testBuilders.doc(
      testBuilders.paragraph("test paragraph"),
    );

    assert(
      eq(finalState.doc, expectedFinal),
      "After backspace, text should be rejoined: 'test paragraph'",
    );

    // Verify cursor position returned to split point
    // Note: In E2E tests, cursor returns to position 6 (original split point)
    assert(
      !finalState.doc.textContent.includes("\u200B"),
      "No ZWSP characters should remain",
    );
  });

  it("should handle multiple sequential split/join cycles", () => {
    // This test matches the E2E pattern: "Multiple rapid Enter/Backspace sequences"
    // Transaction pattern: 3 cycles of split→join, verifying stability
    const doc = testBuilders.doc(
      testBuilders.paragraph("test paragraph<a>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found in document");

    let currentState = EditorState.create({
      doc,
      selection: new TextSelection(doc.resolve(tagA), doc.resolve(tagA)),
    });

    // Run 3 cycles of split→join
    for (let cycle = 1; cycle <= 3; cycle++) {
      // Cycle start: should always be back to original doc
      const expectedStart = testBuilders.doc(
        testBuilders.paragraph("test paragraph"),
      );

      assert(
        eq(currentState.doc, expectedStart),
        `Cycle ${String(cycle)}: Should start with original document`,
      );

      // SPLIT: Create paragraph split at end
      const splitStep = replaceStep(
        currentState.doc,
        tagA,
        tagA,
        new Slice(
          Fragment.from([testBuilders.paragraph(), testBuilders.paragraph()]),
          1,
          1,
        ),
      ) as ReplaceStep | null;

      assert(splitStep, `Cycle ${String(cycle)}: Could not create split step`);

      const splitTransaction = currentState.tr;
      suggestReplaceStep(
        splitTransaction,
        currentState,
        currentState.doc,
        splitStep,
        [],
        1,
      );
      const splitState = currentState.apply(splitTransaction);

      // Verify split created 2 paragraphs
      const expectedAfterSplit = testBuilders.doc(
        testBuilders.paragraph(
          "test paragraph",
          testBuilders.insertion({ id: 1 }, "\u200B"),
        ),
        testBuilders.paragraph(testBuilders.insertion({ id: 1 }, "\u200B")),
      );

      assert(
        eq(splitState.doc, expectedAfterSplit),
        `Cycle ${String(cycle)}: After split, should have 2 paragraphs with ZWSPs`,
      );

      // JOIN: Backspace to revert
      const cursorPos = tagA + 4; // Position after both ZWSPs
      const backspaceStep = replaceStep(
        splitState.doc,
        cursorPos - 1,
        cursorPos,
        Slice.empty,
      ) as ReplaceStep | null;

      assert(
        backspaceStep,
        `Cycle ${String(cycle)}: Could not create backspace step`,
      );

      const backspaceTransaction = splitState.tr;
      suggestReplaceStep(
        backspaceTransaction,
        splitState,
        splitState.doc,
        backspaceStep,
        [],
        1,
      );
      const joinedState = splitState.apply(backspaceTransaction);

      // Verify joined back to original
      assert(
        eq(joinedState.doc, expectedStart),
        `Cycle ${String(cycle)}: After join, should revert to original`,
      );

      assert(
        !joinedState.doc.textContent.includes("\u200B"),
        `Cycle ${String(cycle)}: No ZWSPs should remain after join`,
      );

      // Update state for next cycle
      currentState = joinedState;
    }

    // Final verification: After 3 complete cycles, doc should be unchanged
    const expectedFinal = testBuilders.doc(
      testBuilders.paragraph("test paragraph"),
    );

    assert(
      eq(currentState.doc, expectedFinal),
      "After 3 cycles, document should be stable and unchanged",
    );
  });

  it("should revert through nested suggestions when backspacing twice", () => {
    // This test matches the E2E pattern: "Enter twice then Backspace twice"
    // Transaction pattern: 1→2→3 paragraphs, then 3→2→1 on backspace
    const doc = testBuilders.doc(
      testBuilders.paragraph("test paragraph<a>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found in document");

    const editorState = EditorState.create({
      doc,
      selection: new TextSelection(doc.resolve(tagA), doc.resolve(tagA)),
    });

    // FIRST SPLIT: 1 → 2 paragraphs
    const firstSplitStep = replaceStep(
      doc,
      tagA,
      tagA,
      new Slice(
        Fragment.from([testBuilders.paragraph(), testBuilders.paragraph()]),
        1,
        1,
      ),
    ) as ReplaceStep | null;

    assert(firstSplitStep, "Could not create first split step");

    const firstSplitTransaction = editorState.tr;
    suggestReplaceStep(
      firstSplitTransaction,
      editorState,
      doc,
      firstSplitStep,
      [],
      1,
    );
    const stateAfterFirstSplit = editorState.apply(firstSplitTransaction);

    // Verify 2 paragraphs with ZWSPs
    const expectedAfterFirstSplit = testBuilders.doc(
      testBuilders.paragraph(
        "test paragraph",
        testBuilders.insertion({ id: 1 }, "\u200B"),
      ),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, "\u200B")),
    );

    assert(
      eq(stateAfterFirstSplit.doc, expectedAfterFirstSplit),
      "After first Enter, should have 2 paragraphs",
    );

    // SECOND SPLIT: 2 → 3 paragraphs (split the second paragraph)
    const secondSplitPos = tagA + 4; // End of second paragraph
    const secondSplitStep = replaceStep(
      stateAfterFirstSplit.doc,
      secondSplitPos,
      secondSplitPos,
      new Slice(
        Fragment.from([testBuilders.paragraph(), testBuilders.paragraph()]),
        1,
        1,
      ),
    ) as ReplaceStep | null;

    assert(secondSplitStep, "Could not create second split step");

    const secondSplitTransaction = stateAfterFirstSplit.tr;
    suggestReplaceStep(
      secondSplitTransaction,
      stateAfterFirstSplit,
      stateAfterFirstSplit.doc,
      secondSplitStep,
      [],
      1, // Same suggestion ID
    );
    const stateAfterSecondSplit = stateAfterFirstSplit.apply(
      secondSplitTransaction,
    );

    // Verify 3 paragraphs now exist
    const expectedAfterSecondSplit = testBuilders.doc(
      testBuilders.paragraph(
        "test paragraph",
        testBuilders.insertion({ id: 1 }, "\u200B"),
      ),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, "\u200B"),
        testBuilders.insertion({ id: 1 }, "\u200B"),
      ),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, "\u200B")),
    );

    assert(
      eq(stateAfterSecondSplit.doc, expectedAfterSecondSplit),
      "After second Enter, should have 3 paragraphs",
    );

    // FIRST BACKSPACE: 3 → 2 paragraphs (remove second split)
    const firstBackspacePos = secondSplitPos + 4; // Position in third paragraph
    const firstBackspaceStep = replaceStep(
      stateAfterSecondSplit.doc,
      firstBackspacePos - 1,
      firstBackspacePos,
      Slice.empty,
    ) as ReplaceStep | null;

    assert(firstBackspaceStep, "Could not create first backspace step");

    const firstBackspaceTransaction = stateAfterSecondSplit.tr;
    suggestReplaceStep(
      firstBackspaceTransaction,
      stateAfterSecondSplit,
      stateAfterSecondSplit.doc,
      firstBackspaceStep,
      [],
      1,
    );
    const stateAfterFirstBackspace = stateAfterSecondSplit.apply(
      firstBackspaceTransaction,
    );

    // Verify back to 2 paragraphs
    assert(
      eq(stateAfterFirstBackspace.doc, expectedAfterFirstSplit),
      "After first Backspace, should revert to 2 paragraphs",
    );

    // SECOND BACKSPACE: 2 → 1 paragraph (remove first split)
    const secondBackspacePos = tagA + 4;
    const secondBackspaceStep = replaceStep(
      stateAfterFirstBackspace.doc,
      secondBackspacePos - 1,
      secondBackspacePos,
      Slice.empty,
    ) as ReplaceStep | null;

    assert(secondBackspaceStep, "Could not create second backspace step");

    const secondBackspaceTransaction = stateAfterFirstBackspace.tr;
    suggestReplaceStep(
      secondBackspaceTransaction,
      stateAfterFirstBackspace,
      stateAfterFirstBackspace.doc,
      secondBackspaceStep,
      [],
      1,
    );
    const finalState = stateAfterFirstBackspace.apply(
      secondBackspaceTransaction,
    );

    // Verify back to original 1 paragraph
    const expectedFinal = testBuilders.doc(
      testBuilders.paragraph("test paragraph"),
    );

    assert(
      eq(finalState.doc, expectedFinal),
      "After second Backspace, should revert to original single paragraph",
    );

    assert(
      !finalState.doc.textContent.includes("\u200B"),
      "No ZWSPs should remain after complete reversion",
    );
  });

  it("should handle forward delete from end of first block", () => {
    // This test matches the E2E pattern: "Enter then Delete from first block"
    // Note: Delete key may leave ZWSP markers (known limitation)
    const doc = testBuilders.doc(
      testBuilders.paragraph("test paragraph<a>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found in document");

    const editorState = EditorState.create({
      doc,
      selection: new TextSelection(doc.resolve(tagA), doc.resolve(tagA)),
    });

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

    assert(splitStep, "Could not create split step");

    const splitTransaction = editorState.tr;
    suggestReplaceStep(splitTransaction, editorState, doc, splitStep, [], 1);
    const splitState = editorState.apply(splitTransaction);

    // Verify we start with 2 paragraphs
    const expectedAfterSplit = testBuilders.doc(
      testBuilders.paragraph(
        "test paragraph",
        testBuilders.insertion({ id: 1 }, "\u200B"),
      ),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, "\u200B")),
    );

    assert(
      eq(splitState.doc, expectedAfterSplit),
      "Should have 2 paragraphs after split",
    );

    // Delete from end of first block (forward delete)
    // Position at end of first block text, before the ZWSP
    const deleteFromPos = tagA; // Position 15, end of "test paragraph"
    const deleteStep = replaceStep(
      splitState.doc,
      deleteFromPos,
      deleteFromPos + 1, // Delete forward (the ZWSP at 15-16)
      Slice.empty,
    ) as ReplaceStep | null;

    assert(deleteStep, "Could not create delete step");

    const deleteTransaction = splitState.tr;
    suggestReplaceStep(
      deleteTransaction,
      splitState,
      splitState.doc,
      deleteStep,
      [],
      1,
    );
    const finalState = splitState.apply(deleteTransaction);

    // Expected: Blocks should be joined
    // Note: Forward delete works for block join, may have different ZWSP behavior than Backspace
    const expectedFinal = testBuilders.doc(
      testBuilders.paragraph("test paragraph"),
    );

    assert(
      eq(finalState.doc, expectedFinal),
      "After forward delete, blocks should be joined",
    );

    // Note: E2E tests show Delete may leave ZWSP markers in some cases
    // This is a known difference between Delete and Backspace behavior
  });

  it("should preserve content when joining blocks with existing text", () => {
    // This test verifies that content in the second block is preserved during join
    const doc = testBuilders.doc(
      testBuilders.paragraph("test <a>paragraph"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found in document");

    const editorState = EditorState.create({
      doc,
      selection: new TextSelection(doc.resolve(tagA), doc.resolve(tagA)),
    });

    // Create split at position 5 (after "test ")
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

    assert(splitStep, "Could not create split step");

    const splitTransaction = editorState.tr;
    suggestReplaceStep(splitTransaction, editorState, doc, splitStep, [], 1);
    const splitState = editorState.apply(splitTransaction);

    // Verify split: "test " | "paragraph"
    const expectedAfterSplit = testBuilders.doc(
      testBuilders.paragraph(
        "test ",
        testBuilders.insertion({ id: 1 }, "\u200B"),
      ),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, "\u200B"),
        "paragraph",
      ),
    );

    assert(
      eq(splitState.doc, expectedAfterSplit),
      "After split, 'paragraph' should be in second block",
    );

    // Join blocks
    const backspacePos = tagA + 3;
    const backspaceStep = replaceStep(
      splitState.doc,
      backspacePos - 1,
      backspacePos,
      Slice.empty,
    ) as ReplaceStep | null;

    assert(backspaceStep, "Could not create backspace step");

    const backspaceTransaction = splitState.tr;
    suggestReplaceStep(
      backspaceTransaction,
      splitState,
      splitState.doc,
      backspaceStep,
      [],
      1,
    );
    const finalState = splitState.apply(backspaceTransaction);

    // Expected: Content merged back together
    const expectedFinal = testBuilders.doc(
      testBuilders.paragraph("test paragraph"),
    );

    assert(
      eq(finalState.doc, expectedFinal),
      "After join, content should be merged: 'test paragraph'",
    );
  });

  it("should handle block split at start of document", () => {
    // Edge case: Split the first paragraph at the beginning
    const doc = testBuilders.doc(
      testBuilders.paragraph("<a>test paragraph"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found in document");

    const editorState = EditorState.create({
      doc,
      selection: new TextSelection(doc.resolve(tagA), doc.resolve(tagA)),
    });

    // Split at start (position 1)
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

    assert(splitStep, "Could not create split step at start");

    const splitTransaction = editorState.tr;
    suggestReplaceStep(splitTransaction, editorState, doc, splitStep, [], 1);
    const splitState = editorState.apply(splitTransaction);

    // Verify split: "" | "test paragraph"
    const expectedAfterSplit = testBuilders.doc(
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, "\u200B")),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, "\u200B"),
        "test paragraph",
      ),
    );

    assert(
      eq(splitState.doc, expectedAfterSplit),
      "After split at start, first block should be empty with ZWSP",
    );

    // Backspace to rejoin
    const backspacePos = tagA + 3; // In second paragraph
    const backspaceStep = replaceStep(
      splitState.doc,
      backspacePos - 1,
      backspacePos,
      Slice.empty,
    ) as ReplaceStep | null;

    assert(backspaceStep, "Could not create backspace step");

    const backspaceTransaction = splitState.tr;
    suggestReplaceStep(
      backspaceTransaction,
      splitState,
      splitState.doc,
      backspaceStep,
      [],
      1,
    );
    const finalState = splitState.apply(backspaceTransaction);

    // Expected: Back to original
    const expectedFinal = testBuilders.doc(
      testBuilders.paragraph("test paragraph"),
    );

    assert(
      eq(finalState.doc, expectedFinal),
      "After backspace, should revert to original single paragraph",
    );

    assert(
      !finalState.doc.textContent.includes("\u200B"),
      "No ZWSPs should remain",
    );
  });

  it("should handle block split at end with multiple paragraphs in document", () => {
    // Edge case: Split the last paragraph when multiple paragraphs exist
    const doc = testBuilders.doc(
      testBuilders.paragraph("first paragraph"),
      testBuilders.paragraph("second paragraph<a>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found in document");

    const editorState = EditorState.create({
      doc,
      selection: new TextSelection(doc.resolve(tagA), doc.resolve(tagA)),
    });

    // Split at end of second paragraph
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

    assert(splitStep, "Could not create split step at end");

    const splitTransaction = editorState.tr;
    suggestReplaceStep(splitTransaction, editorState, doc, splitStep, [], 1);
    const splitState = editorState.apply(splitTransaction);

    // Verify 3 paragraphs now
    const expectedAfterSplit = testBuilders.doc(
      testBuilders.paragraph("first paragraph"),
      testBuilders.paragraph(
        "second paragraph",
        testBuilders.insertion({ id: 1 }, "\u200B"),
      ),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, "\u200B")),
    );

    assert(
      eq(splitState.doc, expectedAfterSplit),
      "After split, should have 3 paragraphs",
    );

    // Backspace to rejoin last two paragraphs
    const backspacePos = tagA + 4;
    const backspaceStep = replaceStep(
      splitState.doc,
      backspacePos - 1,
      backspacePos,
      Slice.empty,
    ) as ReplaceStep | null;

    assert(backspaceStep, "Could not create backspace step");

    const backspaceTransaction = splitState.tr;
    suggestReplaceStep(
      backspaceTransaction,
      splitState,
      splitState.doc,
      backspaceStep,
      [],
      1,
    );
    const finalState = splitState.apply(backspaceTransaction);

    // Expected: Back to 2 paragraphs
    const expectedFinal = testBuilders.doc(
      testBuilders.paragraph("first paragraph"),
      testBuilders.paragraph("second paragraph"),
    );

    assert(
      eq(finalState.doc, expectedFinal),
      "After backspace, should revert to 2 paragraphs",
    );

    assert(
      !finalState.doc.textContent.includes("\u200B"),
      "No ZWSPs should remain",
    );
  });

  it("should ensure all ZWSP markers are removed after successful block join", () => {
    // Explicit verification that ZWSP cleanup happens correctly
    const doc = testBuilders.doc(
      testBuilders.paragraph("test paragraph<a>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found in document");

    const editorState = EditorState.create({
      doc,
      selection: new TextSelection(doc.resolve(tagA), doc.resolve(tagA)),
    });

    // Create split
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

    assert(splitStep, "Could not create split step");

    const splitTransaction = editorState.tr;
    suggestReplaceStep(splitTransaction, editorState, doc, splitStep, [], 1);
    const splitState = editorState.apply(splitTransaction);

    // Verify ZWSPs present after split
    assert(
      splitState.doc.textContent.includes("\u200B"),
      "ZWSPs should be present after split",
    );

    // Count ZWSPs
    const zwspCountAfterSplit = (
      splitState.doc.textContent.match(/\u200B/g) ?? []
    ).length;
    assert(
      zwspCountAfterSplit === 2,
      `Should have exactly 2 ZWSPs after split, found ${String(zwspCountAfterSplit)}`,
    );

    // Backspace to join
    const backspacePos = tagA + 4;
    const backspaceStep = replaceStep(
      splitState.doc,
      backspacePos - 1,
      backspacePos,
      Slice.empty,
    ) as ReplaceStep | null;

    assert(backspaceStep, "Could not create backspace step");

    const backspaceTransaction = splitState.tr;
    suggestReplaceStep(
      backspaceTransaction,
      splitState,
      splitState.doc,
      backspaceStep,
      [],
      1,
    );
    const finalState = splitState.apply(backspaceTransaction);

    // Verify ALL ZWSPs removed
    assert(
      !finalState.doc.textContent.includes("\u200B"),
      "All ZWSP markers should be removed after block join",
    );

    const zwspCountAfterJoin = (
      finalState.doc.textContent.match(/\u200B/g) ?? []
    ).length;
    assert(
      zwspCountAfterJoin === 0,
      `Should have 0 ZWSPs after join, found ${String(zwspCountAfterJoin)}`,
    );

    // Also verify document structure is clean
    const expectedFinal = testBuilders.doc(
      testBuilders.paragraph("test paragraph"),
    );

    assert(
      eq(finalState.doc, expectedFinal),
      "Document structure should be clean after join",
    );
  });

  it("should handle delete after cursor navigation", () => {
    // This test simulates: Enter → cursor moves → Delete
    // Verifies that cursor position changes don't affect block join detection
    const doc = testBuilders.doc(
      testBuilders.paragraph("test paragraph<a>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found in document");

    const editorState = EditorState.create({
      doc,
      selection: new TextSelection(doc.resolve(tagA), doc.resolve(tagA)),
    });

    // Create split
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

    assert(splitStep, "Could not create split step");

    const splitTransaction = editorState.tr;
    suggestReplaceStep(splitTransaction, editorState, doc, splitStep, [], 1);
    const splitState = editorState.apply(splitTransaction);

    // Simulate cursor moving back to end of first block
    // In E2E tests, this would be done with ArrowLeft key
    // Here we just create a delete step from that position
    const deleteFromPos = tagA; // End of first paragraph text
    const deleteStep = replaceStep(
      splitState.doc,
      deleteFromPos,
      deleteFromPos + 1, // Delete the ZWSP at end of first block
      Slice.empty,
    ) as ReplaceStep | null;

    assert(deleteStep, "Could not create delete step");

    const deleteTransaction = splitState.tr;
    suggestReplaceStep(
      deleteTransaction,
      splitState,
      splitState.doc,
      deleteStep,
      [],
      1,
    );
    const finalState = splitState.apply(deleteTransaction);

    // Expected: Blocks joined
    const expectedFinal = testBuilders.doc(
      testBuilders.paragraph("test paragraph"),
    );

    assert(
      eq(finalState.doc, expectedFinal),
      "After delete following cursor navigation, blocks should be joined",
    );

    assert(
      !finalState.doc.textContent.includes("\u200B"),
      "No ZWSPs should remain after join",
    );
  });
});
