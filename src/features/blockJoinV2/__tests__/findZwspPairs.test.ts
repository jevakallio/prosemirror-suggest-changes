/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect } from "vitest";
import { testBuilders } from "../../../testing/testBuilders.js";
import { findZwspsInRange } from "../utils/findZwspsInRange.js";
import { findZwspPairs } from "../utils/findZwspPairs.js";
import type { ZwspInfo } from "../utils/types.js";

const ZWSP = "\u200B";

describe("findZwspPairs", () => {
  const insertionMarkType = testBuilders.schema.marks.insertion;

  it("should return empty array for no ZWSPs", () => {
    const pairs = findZwspPairs([]);
    expect(pairs).toEqual([]);
  });

  it("should return empty array for single ZWSP", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "Hello"),
    );

    const zwsps = findZwspsInRange(doc, 0, doc.content.size, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    expect(pairs).toEqual([]);
  });

  it("should find pair across two blocks", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("First", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "Second"),
    );

    const zwsps = findZwspsInRange(doc, 0, doc.content.size, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.zwsp1.pos).toBe(6);
    expect(pairs[0]!.zwsp2.pos).toBe(9);
    expect(pairs[0]!.shouldJoin).toBe(true);
    expect(pairs[0]!.joinPos).toBe(7);
  });

  it("should not pair ZWSPs with different IDs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("First", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(testBuilders.insertion({ id: 2 }, ZWSP), "Second"),
    );

    const zwsps = findZwspsInRange(doc, 0, doc.content.size, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    expect(pairs).toEqual([]);
  });

  it("should handle multiple pairs with different IDs", () => {
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

    expect(pairs).toHaveLength(2);
    expect(pairs[0]!.zwsp1.id).toBe(1);
    expect(pairs[0]!.zwsp2.id).toBe(1);
    expect(pairs[1]!.zwsp1.id).toBe(2);
    expect(pairs[1]!.zwsp2.id).toBe(2);
  });

  it("should skip ZWSPs without IDs", () => {
    const zwsps: ZwspInfo[] = [
      {
        pos: 1,
        id: null,
        isBlockStart: true,
        isBlockEnd: false,
        blockDepth: 1,
        parentNode: testBuilders.paragraph("test"),
      },
      {
        pos: 5,
        id: null,
        isBlockStart: true,
        isBlockEnd: false,
        blockDepth: 1,
        parentNode: testBuilders.paragraph("test"),
      },
    ];

    const pairs = findZwspPairs(zwsps);
    expect(pairs).toEqual([]);
  });

  it("should handle mix of ZWSPs with and without IDs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        ZWSP,
        "A",
        testBuilders.insertion({ id: 1 }, ZWSP),
      ),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "B"),
    );

    const zwsps = findZwspsInRange(doc, 0, doc.content.size, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.zwsp1.id).toBe(1);
    expect(pairs[0]!.zwsp2.id).toBe(1);
  });

  it("should not create duplicate pairs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("A", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "B"),
    );

    const zwsps = findZwspsInRange(doc, 0, doc.content.size, insertionMarkType);
    const pairs = findZwspPairs(zwsps);

    expect(pairs).toHaveLength(1);
  });

  it("should handle three ZWSPs with same ID by pairing first two", () => {
    const zwsps: ZwspInfo[] = [
      {
        pos: 1,
        id: 1,
        isBlockStart: false,
        isBlockEnd: true,
        blockDepth: 1,
        parentNode: testBuilders.paragraph("test"),
      },
      {
        pos: 5,
        id: 1,
        isBlockStart: true,
        isBlockEnd: false,
        blockDepth: 1,
        parentNode: testBuilders.paragraph("test"),
      },
      {
        pos: 10,
        id: 1,
        isBlockStart: false,
        isBlockEnd: true,
        blockDepth: 1,
        parentNode: testBuilders.paragraph("test"),
      },
    ];

    const pairs = findZwspPairs(zwsps);

    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.zwsp1.pos).toBe(1);
    expect(pairs[0]!.zwsp2.pos).toBe(5);
  });

  it("should calculate joinPos correctly for blockEnd-blockStart pair", () => {
    const zwsps: ZwspInfo[] = [
      {
        pos: 6,
        id: 1,
        isBlockStart: false,
        isBlockEnd: true,
        blockDepth: 1,
        parentNode: testBuilders.paragraph("test"),
      },
      {
        pos: 9,
        id: 1,
        isBlockStart: true,
        isBlockEnd: false,
        blockDepth: 1,
        parentNode: testBuilders.paragraph("test"),
      },
    ];

    const pairs = findZwspPairs(zwsps);

    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.joinPos).toBe(7);
  });

  it("should set shouldJoin to false for invalid pair positions", () => {
    const zwsps: ZwspInfo[] = [
      {
        pos: 10,
        id: 1,
        isBlockStart: false,
        isBlockEnd: true,
        blockDepth: 1,
        parentNode: testBuilders.paragraph("test"),
      },
      {
        pos: 5,
        id: 1,
        isBlockStart: true,
        isBlockEnd: false,
        blockDepth: 1,
        parentNode: testBuilders.paragraph("test"),
      },
    ];

    const pairs = findZwspPairs(zwsps);

    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.shouldJoin).toBe(false);
  });
});
