import { describe, it, assert } from "vitest";
import {
  testBuilders,
  type TaggedNode,
} from "../../../testing/testBuilders.js";
import { findZwspsInRange } from "../utils/findZwspsInRange.js";
import { findZwspPairs } from "../utils/findZwspPairs.js";

const ZWSP = "\u200B";

describe("findZwspPairs", () => {
  const insertionMarkType = testBuilders.schema.marks.insertion;

  it("should return empty array for no ZWSPs", () => {
    const pairs = findZwspPairs([]);
    assert(pairs.length === 0, "Expected no pairs for empty input");
  });

  it("should return empty array for single ZWSP", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<a>",
        testBuilders.insertion({ id: 1 }, ZWSP),
        "Hello<b>",
      ),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    assert(pairs.length === 0, "Expected no pairs for single ZWSP");
  });

  it("should find pair across two blocks", () => {
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

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    assert(pairs.length === 1, "Expected one pair");
    const pair0 = pairs[0];
    assert(pair0 !== undefined, "Pair at index 0 not found");
    assert(pair0.shouldJoin, "Pair should be marked for join");
    assert(pair0.zwsp1.id === 1, "First ZWSP should have ID 1");
    assert(pair0.zwsp2.id === 1, "Second ZWSP should have ID 1");
  });

  it("should not pair ZWSPs with different IDs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<a>First",
        testBuilders.insertion({ id: 1 }, ZWSP),
      ),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 2 }, ZWSP),
        "Second<b>",
      ),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    assert(pairs.length === 0, "Expected no pairs for mismatched IDs");
  });

  it("should handle multiple pairs with different IDs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("<a>A", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, ZWSP),
        "B",
        testBuilders.insertion({ id: 2 }, ZWSP),
      ),
      testBuilders.paragraph(testBuilders.insertion({ id: 2 }, ZWSP), "C<b>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    assert(pairs.length === 2, "Expected two pairs");
    const pair0 = pairs[0];
    const pair1 = pairs[1];
    assert(pair0 !== undefined, "Pair at index 0 not found");
    assert(pair1 !== undefined, "Pair at index 1 not found");
    assert(pair0.zwsp1.id === 1, "First pair ZWSP1 should have ID 1");
    assert(pair0.zwsp2.id === 1, "First pair ZWSP2 should have ID 1");
    assert(pair1.zwsp1.id === 2, "Second pair ZWSP1 should have ID 2");
    assert(pair1.zwsp2.id === 2, "Second pair ZWSP2 should have ID 2");
  });

  it("should skip ZWSPs without IDs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("<a>", ZWSP, "A", ZWSP, "B<b>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    assert(pairs.length === 0, "Expected no pairs for ZWSPs without IDs");
  });

  it("should handle mix of ZWSPs with and without IDs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<a>",
        ZWSP,
        "A",
        testBuilders.insertion({ id: 1 }, ZWSP),
      ),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "B<b>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    assert(pairs.length === 1, "Expected one pair");
    const pair0 = pairs[0];
    assert(pair0 !== undefined, "Pair at index 0 not found");
    assert(pair0.zwsp1.id === 1, "ZWSP1 should have ID 1");
    assert(pair0.zwsp2.id === 1, "ZWSP2 should have ID 1");
  });

  it("should not create duplicate pairs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("<a>A", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "B<b>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    assert(pairs.length === 1, "Expected exactly one pair");
  });

  it("should handle three ZWSPs with same ID by pairing first two", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("<a>A", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "B"),
      testBuilders.paragraph(
        "C",
        testBuilders.insertion({ id: 1 }, ZWSP),
        "<b>",
      ),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    assert(pairs.length === 1, "Expected one pair from three ZWSPs");
    const pair0 = pairs[0];
    assert(pair0 !== undefined, "Pair at index 0 not found");
    assert(pair0.zwsp1.isBlockEnd, "First ZWSP should be at block end");
    assert(pair0.zwsp2.isBlockStart, "Second ZWSP should be at block start");
  });

  it("should calculate joinPos correctly for blockEnd-blockStart pair", () => {
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

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    assert(pairs.length === 1, "Expected one pair");
    const pair0 = pairs[0];
    assert(pair0 !== undefined, "Pair at index 0 not found");
    assert(pair0.joinPos > 0, "joinPos should be calculated");
  });

  it("should set shouldJoin to false for invalid pair positions", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<a>",
        testBuilders.insertion({ id: 1 }, ZWSP),
        "First",
        testBuilders.insertion({ id: 1 }, ZWSP),
        "<b>",
      ),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);

    // Manually reverse the ZWSPs to create invalid ordering
    const zwsp0 = zwsps[0];
    const zwsp1 = zwsps[1];
    assert(zwsp0 !== undefined, "ZWSP at index 0 not found");
    assert(zwsp1 !== undefined, "ZWSP at index 1 not found");
    const reversedZwsps = [zwsp1, zwsp0];
    const pairs = findZwspPairs(reversedZwsps);

    if (pairs.length > 0) {
      const pair0 = pairs[0];
      assert(pair0 !== undefined, "Pair at index 0 not found");
      assert(!pair0.shouldJoin, "Invalid pair should have shouldJoin=false");
    }
  });

  it("should reject pairs when both ZWSPs are in the same block", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<a>",
        testBuilders.insertion({ id: 1 }, ZWSP),
        "Middle text",
        testBuilders.insertion({ id: 1 }, ZWSP),
        "<b>",
      ),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    // Should find no pairs because both ZWSPs are in the same parent block
    assert(pairs.length === 0, "Expected no pairs for same-block ZWSPs");
  });

  it("should support chain pairing with 3 blocks and same ID", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("<a>A", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, ZWSP),
        "B",
        testBuilders.insertion({ id: 1 }, ZWSP),
      ),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "C<b>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    // Should find TWO pairs: (A-end → B-start) AND (B-end → C-start)
    assert(pairs.length === 2, "Expected two pairs for chained blocks");

    const pair0 = pairs[0];
    const pair1 = pairs[1];
    assert(pair0 !== undefined, "Pair at index 0 not found");
    assert(pair1 !== undefined, "Pair at index 1 not found");

    // First pair: A-end → B-start
    assert(pair0.zwsp1.isBlockEnd, "First pair zwsp1 should be blockEnd");
    assert(pair0.zwsp2.isBlockStart, "First pair zwsp2 should be blockStart");
    assert(pair0.shouldJoin, "First pair should be joinable");

    // Second pair: B-end → C-start
    assert(pair1.zwsp1.isBlockEnd, "Second pair zwsp1 should be blockEnd");
    assert(pair1.zwsp2.isBlockStart, "Second pair zwsp2 should be blockStart");
    assert(pair1.shouldJoin, "Second pair should be joinable");

    // Verify the middle block's ZWSPs are used in both pairs
    assert(
      pair0.zwsp2.pos < pair1.zwsp1.pos,
      "Pairs should be in position order",
    );
  });

  it("should pair across different block types (paragraph to list)", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<a>Text in paragraph",
        testBuilders.insertion({ id: 1 }, ZWSP),
      ),
      testBuilders.bulletList(
        testBuilders.listItem(
          testBuilders.paragraph(
            testBuilders.insertion({ id: 1 }, ZWSP),
            "Item in list<b>",
          ),
        ),
      ),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    // Should find one pair even though block types are different
    assert(
      pairs.length === 1,
      "Expected one pair across different block types",
    );

    const pair0 = pairs[0];
    assert(pair0 !== undefined, "Pair at index 0 not found");
    assert(pair0.shouldJoin, "Cross-type pair should be joinable");
  });

  it("should handle multiple independent chains in same range", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("<a>A", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "B"),
      testBuilders.paragraph("C", testBuilders.insertion({ id: 2 }, ZWSP)),
      testBuilders.paragraph(testBuilders.insertion({ id: 2 }, ZWSP), "D<b>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwsps = findZwspsInRange(doc, tagA, tagB, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    // Should find two separate pairs: ID 1 and ID 2
    assert(pairs.length === 2, "Expected two independent pairs");

    const pair0 = pairs[0];
    const pair1 = pairs[1];
    assert(pair0 !== undefined, "Pair at index 0 not found");
    assert(pair1 !== undefined, "Pair at index 1 not found");

    assert(pair0.zwsp1.id === 1, "First pair should have ID 1");
    assert(pair0.zwsp2.id === 1, "First pair should have ID 1");
    assert(pair1.zwsp1.id === 2, "Second pair should have ID 2");
    assert(pair1.zwsp2.id === 2, "Second pair should have ID 2");
  });
});
