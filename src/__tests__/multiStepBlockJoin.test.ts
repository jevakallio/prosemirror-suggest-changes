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
  assert(tagA2 !== undefined, "Tag 'a2' not found");
  assert(tagD2 !== undefined, "Tag 'd2' not found");
  return { tagA, tagB, tagC, tagD, tagA2, tagD2 };
};

describe("Multi-Step Block Join", () => {
  it("should handle steps before and after the block join when deleting ", () => {
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
    const { tagA, tagB, tagD, tagA2, tagD2 } = getTags(doc);

    const editorState = EditorState.create({ doc });

    assert(
      doc.textContent.includes("\u200B"),
      "Document should contain ZWSP characters",
    );

    const tr = editorState.tr;
    tr.replace(tagA, tagA2);

    const mappedTagB = tr.mapping.map(tagB);
    tr.replace(mappedTagB, mappedTagB + 1);

    const mappedTagD = tr.mapping.map(tagD);
    const mappedTagD2 = tr.mapping.map(tagD2);
    tr.replace(mappedTagD, mappedTagD2);

    const suggestionTr = transformToSuggestionTransaction(tr, editorState);
    const newState = editorState.apply(suggestionTr);

    const expected = testBuilders.doc(
      testBuilders.paragraph(
        "first ",
        testBuilders.deletion({ id: 2 }, "remove-a"),
        " paragraphsecond ",
        testBuilders.deletion({ id: 4 }, "remove-d"),
        " paragraph",
      ),
    );

    assert(
      eq(newState.doc, expected),
      `Expected:\n${JSON.stringify(expected.toJSON(), null, 2)}\n\nActual:\n${JSON.stringify(newState.doc.toJSON(), null, 2)}`,
    );
  });
});
