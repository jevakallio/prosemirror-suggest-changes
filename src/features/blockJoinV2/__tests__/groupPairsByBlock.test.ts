import { describe, it, assert } from "vitest";
import { testBuilders, type TaggedNode } from "../../../testing/testBuilders.js";
import { groupPairsByBlock } from "../utils/groupPairsByBlock.js";
import { findZwspsInRange } from "../utils/findZwspsInRange.js";
import { findZwspPairs } from "../utils/findZwspPairs.js";

const ZWSP = "\u200B";

describe("groupPairsByBlock", () => {
  const insertionMarkType = testBuilders.schema.marks.insertion;

  it("should return empty array for no pairs", () => {
    const groups = groupPairsByBlock([]);
    assert(groups.length === 0, "Expected no groups for empty input");
  });

  it("should create groups for valid pairs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<a>First",
        testBuilders.insertion({ id: 1 }, ZWSP),
      ),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, ZWSP),
        "Second<b>",
      ),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );
    const pairs = findZwspPairs(zwsps);
    const groups = groupPairsByBlock(pairs);

    assert(groups.length === 1, "Expected one group");
    const group0 = groups[0];
    assert(group0 !== undefined, "Group at index 0 not found");
    assert(group0.zwspPositions.length === 2, "Expected two ZWSP positions");
    assert(group0.reason === "in-range", "Expected in-range reason");
  });

  it("should handle multiple pairs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<a>A",
        testBuilders.insertion({ id: 1 }, ZWSP),
      ),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, ZWSP),
        "B",
        testBuilders.insertion({ id: 2 }, ZWSP),
      ),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 2 }, ZWSP),
        "C<b>",
      ),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );
    const pairs = findZwspPairs(zwsps);
    const groups = groupPairsByBlock(pairs);

    assert(groups.length === 2, "Expected two groups");
  });
});
