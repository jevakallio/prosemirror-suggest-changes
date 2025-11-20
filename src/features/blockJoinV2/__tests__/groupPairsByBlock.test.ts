/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect } from "vitest";
import { testBuilders } from "../../../testing/testBuilders.js";
import { groupPairsByBlock } from "../utils/groupPairsByBlock.js";
import { findZwspsInRange } from "../utils/findZwspsInRange.js";
import { findZwspPairs } from "../utils/findZwspPairs.js";

const ZWSP = "\u200B";

describe("groupPairsByBlock", () => {
  const insertionMarkType = testBuilders.schema.marks.insertion;

  it("should return empty array for no pairs", () => {
    const groups = groupPairsByBlock([]);
    expect(groups).toEqual([]);
  });

  it("should create groups for valid pairs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("First", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "Second"),
    );

    const zwsps = findZwspsInRange(doc, 0, doc.content.size, insertionMarkType);
    const pairs = findZwspPairs(zwsps);
    const groups = groupPairsByBlock(pairs);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.zwspPositions).toEqual([6, 9]);
    expect(groups[0]!.reason).toBe("in-range");
  });

  it("should handle multiple pairs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("A", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, ZWSP),
        "B",
        testBuilders.insertion({ id: 2 }, ZWSP),
      ),
      testBuilders.paragraph(testBuilders.insertion({ id: 2 }, ZWSP), "C"),
    );

    const zwsps = findZwspsInRange(doc, 0, doc.content.size, insertionMarkType);
    const pairs = findZwspPairs(zwsps);
    const groups = groupPairsByBlock(pairs);

    expect(groups).toHaveLength(2);
  });
});
