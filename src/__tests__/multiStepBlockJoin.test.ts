/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { EditorState } from "prosemirror-state";
import { assert, describe, it } from "vitest";

import { type TaggedNode, testBuilders } from "../testing/testBuilders.js";
import { transformToSuggestionTransaction } from "../withSuggestChanges.js";
import { eq } from "prosemirror-test-builder";

const getTags = (doc: TaggedNode) => {
  const tagA = doc.tag["a"];
  const tagA2 = doc.tag["a2"];
  const tagB = doc.tag["b"];
  const tagC = doc.tag["c"];
  const tagD = doc.tag["d"];
  const tagD2 = doc.tag["d2"];
  assert(tagA !== undefined, "Tag 'a' not found");
  assert(tagB !== undefined, "Tag 'b' not found");
  assert(tagC !== undefined, "Tag 'c' not found");
  assert(tagD !== undefined, "Tag 'd' not found");
  return { tagA, tagB, tagC, tagD, tagA2, tagD2 };
};

describe("Multi-Step Block Join", () => {
  it("should handle steps before and after the block join when deleting ", () => {
    // Starting document with 4 paragraphs:
    // - Para 1-2 connected by ZWSP insertion marks with ID 1
    // - Para 3-4 connected by ZWSP insertion marks with ID 2
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "first <a>remove-a<a2> paragraph<b>",
        testBuilders.insertion({ id: 1 }, "\u200B"),
      ),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, "\u200B"),
        "<c>second <d>remove-d<d2> paragraph",
      ),
    ) as TaggedNode;
    const { tagA, tagB, tagC, tagD, tagA2, tagD2 } = getTags(doc);

    const editorState = EditorState.create({ doc });

    // TODO: Add test operations here

    // Verify initial document structure
    assert(
      doc.textContent.includes("\u200B"),
      "Document should contain ZWSP characters",
    );

    const tr = editorState.tr
      // .replace(tagA, tagA2)
      .replace(tagB, tagB + 1)
      .replace(tagD, tagD2);
    const suggestionTr = transformToSuggestionTransaction(tr, editorState);
    const newState = editorState.apply(suggestionTr);

    const expected = testBuilders.doc(
      testBuilders.paragraph(
        "first ",
        testBuilders.deletion({ id: 5 }, "<a>remove-a<a2>"),
        " paragraph<b>",
      ),
      testBuilders.paragraph(
        "<c>second ",
        testBuilders.deletion({ id: 6 }, "<d>remove-d<ad>"),
        " paragraph",
      ),
    );

    assert(
      eq(newState.doc, expected),
      `Expected ${newState.doc} to match ${expected}`,
    );
    console.log(
      "Initial doc text:",
      doc.textContent.replace(/\u200B/g, "[ZWSP]"),
    );
    console.log(
      "New doc text:",
      newState.doc.textContent.replace(/\u200B/g, "[ZWSP]"),
    );
    console.log("Initial doc structure:", doc.toString());
    console.log("New doc structure:", newState.doc.toString());
  });
});
