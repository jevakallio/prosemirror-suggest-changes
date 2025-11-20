/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect } from "vitest";
import { testBuilders } from "../../../testing/testBuilders.js";
import { findZwspsInRange } from "../utils/findZwspsInRange.js";

const ZWSP = "\u200B";

describe("findZwspsInRange", () => {
  const insertionMarkType = testBuilders.schema.marks.insertion;

  it("should return empty array for range with no ZWSPs", () => {
    const doc = testBuilders.doc(testBuilders.paragraph("Hello world"));

    const result = findZwspsInRange(
      doc,
      0,
      doc.content.size,
      insertionMarkType,
    );

    expect(result).toEqual([]);
  });

  it("should find ZWSP at block start", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "Hello"),
    );

    const result = findZwspsInRange(
      doc,
      0,
      doc.content.size,
      insertionMarkType,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      pos: 1,
      id: 1,
      isBlockStart: true,
      isBlockEnd: false,
    });
  });

  it("should find ZWSP at block end", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("Hello", testBuilders.insertion({ id: 2 }, ZWSP)),
    );

    const result = findZwspsInRange(
      doc,
      0,
      doc.content.size,
      insertionMarkType,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      pos: 6,
      id: 2,
      isBlockStart: false,
      isBlockEnd: true,
    });
  });

  it("should find multiple ZWSPs in single block", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, ZWSP),
        "Hello",
        testBuilders.insertion({ id: 1 }, ZWSP),
      ),
    );

    const result = findZwspsInRange(
      doc,
      0,
      doc.content.size,
      insertionMarkType,
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.pos).toBe(1);
    expect(result[1]!.pos).toBe(7);
  });

  it("should find ZWSPs across multiple blocks", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("First", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "Second"),
    );

    const result = findZwspsInRange(
      doc,
      0,
      doc.content.size,
      insertionMarkType,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      pos: 6,
      id: 1,
      isBlockStart: false,
      isBlockEnd: true,
    });
    expect(result[1]).toMatchObject({
      pos: 9,
      id: 1,
      isBlockStart: true,
      isBlockEnd: false,
    });
  });

  it("should handle ZWSP without insertion mark ID", () => {
    const doc = testBuilders.doc(testBuilders.paragraph(ZWSP, "Hello"));

    const result = findZwspsInRange(
      doc,
      0,
      doc.content.size,
      insertionMarkType,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      pos: 1,
      id: null,
      isBlockStart: true,
      isBlockEnd: false,
    });
  });

  it("should ignore ZWSPs in middle of text (not on block boundaries)", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "Hel",
        testBuilders.insertion({ id: 3 }, ZWSP),
        "lo",
      ),
    );

    const result = findZwspsInRange(
      doc,
      0,
      doc.content.size,
      insertionMarkType,
    );

    expect(result).toHaveLength(0);
  });

  it("should respect range boundaries", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "First"),
      testBuilders.paragraph(testBuilders.insertion({ id: 2 }, ZWSP), "Second"),
      testBuilders.paragraph(testBuilders.insertion({ id: 3 }, ZWSP), "Third"),
    );

    const result = findZwspsInRange(doc, 8, 16, insertionMarkType);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      pos: 9,
      id: 2,
    });
  });

  it("should handle nested blocks (lists)", () => {
    const doc = testBuilders.doc(
      testBuilders.bulletList(
        testBuilders.listItem(
          testBuilders.paragraph(
            testBuilders.insertion({ id: 1 }, ZWSP),
            "Item 1",
          ),
        ),
        testBuilders.listItem(
          testBuilders.paragraph(
            testBuilders.insertion({ id: 2 }, ZWSP),
            "Item 2",
          ),
        ),
      ),
    );

    const result = findZwspsInRange(
      doc,
      0,
      doc.content.size,
      insertionMarkType,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 1,
      isBlockStart: true,
    });
    expect(result[1]).toMatchObject({
      id: 2,
      isBlockStart: true,
    });
  });

  it("should correctly set blockDepth", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, ZWSP),
        "Top level",
      ),
      testBuilders.bulletList(
        testBuilders.listItem(
          testBuilders.paragraph(
            testBuilders.insertion({ id: 2 }, ZWSP),
            "Nested",
          ),
        ),
      ),
    );

    const result = findZwspsInRange(
      doc,
      0,
      doc.content.size,
      insertionMarkType,
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.blockDepth).toBe(1);
    expect(result[1]!.blockDepth).toBeGreaterThan(1);
  });

  it("should handle empty range", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "Hello"),
    );

    const result = findZwspsInRange(doc, 5, 5, insertionMarkType);

    expect(result).toEqual([]);
  });

  it("should find ZWSPs with different IDs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("A", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(testBuilders.insertion({ id: 2 }, ZWSP), "B"),
      testBuilders.paragraph("C", testBuilders.insertion({ id: 3 }, ZWSP)),
    );

    const result = findZwspsInRange(
      doc,
      0,
      doc.content.size,
      insertionMarkType,
    );

    expect(result).toHaveLength(3);
    expect(result[0]!.id).toBe(1);
    expect(result[1]!.id).toBe(2);
    expect(result[2]!.id).toBe(3);
  });
});
