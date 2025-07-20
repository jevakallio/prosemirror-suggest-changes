/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { EditorState, TextSelection } from "prosemirror-state";
import { eq } from "prosemirror-test-builder";
import { AddMarkStep } from "prosemirror-transform";
import { assert, describe, it } from "vitest";

import { trackAddMarkStep } from "../addMarkStep.js";

import { type TaggedNode, testBuilders } from "../testing/testBuilders.js";

describe("AddMarkStep", () => {
  it("should treat an add mark as a standard replace", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("<a>first<b> paragraph"),
      testBuilders.paragraph("second paragraph"),
    ) as TaggedNode;

    const editorState = EditorState.create({
      doc,
      selection: TextSelection.near(doc.resolve(doc.tag["a"]!)),
    });

    const originalTransaction = editorState.tr;

    originalTransaction.addMark(
      doc.tag["a"]!,
      doc.tag["b"]!,
      testBuilders.schema.marks.strong.create(),
    );
    const step = originalTransaction.steps[0];
    assert(step instanceof AddMarkStep, "Could not create test AddMarkStep");

    const trackedTransaction = editorState.tr;
    trackAddMarkStep(trackedTransaction, editorState, doc, step, [], "1");

    const trackedState = editorState.apply(trackedTransaction);

    const expected = testBuilders.doc(
      testBuilders.paragraph(
        testBuilders.deletion({ id: "1" }, "first"),
        testBuilders.insertion({ id: "1" }, testBuilders.strong("first")),
        " paragraph",
      ),
      testBuilders.paragraph("second paragraph"),
    );

    assert(
      eq(trackedState.doc, expected),
      `Expected ${trackedState.doc} to match ${expected}`,
    );
  });

  it("should handle overlapping deletions", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        testBuilders.deletion({ id: "1" }, "<a>fi"),
        "rst<b> paragraph",
      ),
      testBuilders.paragraph("second paragraph"),
    ) as TaggedNode;

    const editorState = EditorState.create({
      doc,
      selection: TextSelection.near(doc.resolve(doc.tag["a"]!)),
    });

    const originalTransaction = editorState.tr;

    originalTransaction.addMark(
      doc.tag["a"]!,
      doc.tag["b"]!,
      testBuilders.schema.marks.strong.create(),
    );
    const step = originalTransaction.steps[0];
    assert(step instanceof AddMarkStep, "Could not create test AddMarkStep");

    const trackedTransaction = editorState.tr;
    trackAddMarkStep(trackedTransaction, editorState, doc, step, [], "1");

    const trackedState = editorState.apply(trackedTransaction);

    const expected = testBuilders.doc(
      testBuilders.paragraph(
        testBuilders.deletion({ id: "1" }, "first"),
        testBuilders.insertion({ id: "1" }, testBuilders.strong("rst")),
        " paragraph",
      ),
      testBuilders.paragraph("second paragraph"),
    );

    assert(
      eq(trackedState.doc, expected),
      `Expected ${trackedState.doc} to match ${expected}`,
    );
  });

  it("should handle nested addMarkSteps with inner mark completely inside outer mark", () => {
    // Starting document already has a suggestion change with strong mark applied
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "This ",
        testBuilders.deletion({ id: "1" }, "is a test paragraph with"),
        testBuilders.insertion(
          { id: "1" },
          testBuilders.strong("is a <b>test paragraph<c> with"),
        ),
        " content",
      ),
    ) as TaggedNode;

    const editorState = EditorState.create({
      doc,
    });

    // Add emphasis mark to a smaller range completely inside the existing strong mark (from 'b' to 'c')
    const originalTransaction = editorState.tr;
    originalTransaction.addMark(
      doc.tag["b"]!,
      doc.tag["c"]!,
      testBuilders.schema.marks.em.create(),
    );
    const step = originalTransaction.steps[0];
    assert(step instanceof AddMarkStep, "Could not create AddMarkStep");

    // Apply the step with tracking
    const trackedTransaction = editorState.tr;
    trackAddMarkStep(trackedTransaction, editorState, doc, step, [], "1");

    const finalState = editorState.apply(trackedTransaction);

    // Expected result should handle the nested mark properly within the existing suggestion changes
    const expected = testBuilders.doc(
      testBuilders.paragraph(
        "This ",
        testBuilders.deletion({ id: "1" }, "is a test paragraph with"),
        testBuilders.insertion({ id: "1" }, testBuilders.strong("is a ")),
        testBuilders.insertion(
          { id: "1" },
          testBuilders.strong(testBuilders.em("test paragraph")),
        ),
        testBuilders.insertion({ id: "1" }, testBuilders.strong(" with")),
        " content",
      ),
    );

    assert(
      eq(finalState.doc, expected),
      `Expected ${finalState.doc} to match ${expected}`,
    );
  });
});
