import { describe, it, expect } from "vitest";
import { testBuilders } from "../../../testing/testBuilders.js";
import { findZwspsInRange } from "../utils/findZwspsInRange.js";
import { findBorderZwsps } from "../utils/findBorderZwsps.js";

const ZWSP = "\u200B";

describe("findBorderZwsps", () => {
  const insertionMarkType = testBuilders.schema.marks.insertion;

  it("should return empty arrays when no ZWSPs at borders", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("First"),
      testBuilders.paragraph("Second"),
    );

    const zwspsInRange = findZwspsInRange(doc, 1, 6, insertionMarkType);
    const result = findBorderZwsps(doc, 1, 6, zwspsInRange, insertionMarkType);

    expect(result.leftZwsps).toEqual([]);
    expect(result.rightZwsps).toEqual([]);
    expect(result.pairsAcrossBorder).toEqual([]);
  });

  it("should find pair when one ZWSP is at border and its pair is outside range", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("A", testBuilders.insertion({ id: 1 }, ZWSP)),
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "B"),
      testBuilders.paragraph("C"),
    );

    // Include only the second ZWSP in the range
    const zwspsInRange = findZwspsInRange(doc, 5, 8, insertionMarkType);
    const result = findBorderZwsps(doc, 5, 8, zwspsInRange, insertionMarkType);

    // Should find the first ZWSP at the left border and identify the pair
    expect(result.pairsAcrossBorder.length).toBeGreaterThan(0);
  });

  // Simplified test - we'll refine the border scanning logic during integration
  it("should handle range at document boundaries", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("First"),
      testBuilders.paragraph("Second"),
    );

    const zwspsInRange1 = findZwspsInRange(doc, 0, 5, insertionMarkType);
    const result1 = findBorderZwsps(
      doc,
      0,
      5,
      zwspsInRange1,
      insertionMarkType,
    );
    expect(result1.leftZwsps).toEqual([]);

    const zwspsInRange2 = findZwspsInRange(
      doc,
      8,
      doc.content.size,
      insertionMarkType,
    );
    const result2 = findBorderZwsps(
      doc,
      8,
      doc.content.size,
      zwspsInRange2,
      insertionMarkType,
    );
    expect(result2.rightZwsps).toEqual([]);
  });
});
