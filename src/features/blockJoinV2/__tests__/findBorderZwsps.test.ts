import { describe, it, assert } from "vitest";
import { testBuilders, type TaggedNode } from "../../../testing/testBuilders.js";
import { findZwspsInRange } from "../utils/findZwspsInRange.js";
import { findBorderZwsps } from "../utils/findBorderZwsps.js";

const ZWSP = "\u200B";

describe("findBorderZwsps", () => {
  const insertionMarkType = testBuilders.schema.marks.insertion;

  it("should return empty arrays when no ZWSPs at borders", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("<a>First<b>"),
      testBuilders.paragraph("Second"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwspsInRange = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );
    const result = findBorderZwsps(
      doc,
      tagA,
      tagB,
      zwspsInRange,
      insertionMarkType,
    );

    assert(result.leftZwsps.length === 0, "Expected no left border ZWSPs");
    assert(result.rightZwsps.length === 0, "Expected no right border ZWSPs");
    assert(result.pairsAcrossBorder.length === 0, "Expected no cross-border pairs");
  });

  it("should find pair when one ZWSP is at border and its pair is outside range", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("A", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(
        "<a>",
        testBuilders.insertion({ id: 1 }, ZWSP),
        "B<b>",
      ),
      testBuilders.paragraph("C"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    // Include only the second ZWSP in the range
    const zwspsInRange = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );
    const result = findBorderZwsps(
      doc,
      tagA,
      tagB,
      zwspsInRange,
      insertionMarkType,
    );

    // Should find the first ZWSP at the left border and identify the pair
    assert(result.pairsAcrossBorder.length > 0, "Expected cross-border pair to be found");
  });

  it("should handle range at document boundaries", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("<a>First<b>"),
      testBuilders.paragraph("Second"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const zwspsInRange1 = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );
    const result1 = findBorderZwsps(
      doc,
      tagA,
      tagB,
      zwspsInRange1,
      insertionMarkType,
    );
    assert(result1.leftZwsps.length === 0, "Expected no left ZWSPs at document start");

    const doc2 = testBuilders.doc(
      testBuilders.paragraph("First"),
      testBuilders.paragraph("Second<a><b>"),
    ) as TaggedNode;

    const tagA2 = doc2.tag["a"];
    const tagB2 = doc2.tag["b"];
    assert(tagA2 !== undefined, "Tag 'a' not found in doc2");
    assert(tagB2 !== undefined, "Tag 'b' not found in doc2");

    const zwspsInRange2 = findZwspsInRange(
      doc2,
      tagA2,
      tagB2,
      insertionMarkType,
    );
    const result2 = findBorderZwsps(
      doc2,
      tagA2,
      tagB2,
      zwspsInRange2,
      insertionMarkType,
    );
    assert(result2.rightZwsps.length === 0, "Expected no right ZWSPs at document end");
  });
});
