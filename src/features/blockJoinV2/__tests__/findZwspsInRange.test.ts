import { describe, it, assert } from "vitest";
import { testBuilders, type TaggedNode } from "../../../testing/testBuilders.js";
import { findZwspsInRange } from "../utils/findZwspsInRange.js";

const ZWSP = "\u200B";

describe("findZwspsInRange", () => {
  const insertionMarkType = testBuilders.schema.marks.insertion;

  it("should return empty array for range with no ZWSPs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("Hello<a> world<b>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const result = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );

    assert(result.length === 0, "Expected no ZWSPs in range");
  });

  it("should find ZWSP at block start", () => {
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

    const result = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );

    assert(result.length === 1, "Expected one ZWSP");
    const zwsp0 = result[0];
    assert(zwsp0 !== undefined, "ZWSP at index 0 not found");
    assert(zwsp0.id === 1, "Expected ZWSP to have ID 1");
    assert(zwsp0.isBlockStart, "Expected ZWSP at block start");
    assert(!zwsp0.isBlockEnd, "Expected ZWSP not at block end");
  });

  it("should find ZWSP at block end", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<a>Hello",
        testBuilders.insertion({ id: 2 }, ZWSP),
        "<b>",
      ),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const result = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );

    assert(result.length === 1, "Expected one ZWSP");
    const zwsp0 = result[0];
    assert(zwsp0 !== undefined, "ZWSP at index 0 not found");
    assert(zwsp0.id === 2, "Expected ZWSP to have ID 2");
    assert(!zwsp0.isBlockStart, "Expected ZWSP not at block start");
    assert(zwsp0.isBlockEnd, "Expected ZWSP at block end");
  });

  it("should find multiple ZWSPs in single block", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<a>",
        testBuilders.insertion({ id: 1 }, ZWSP),
        "Hello",
        testBuilders.insertion({ id: 1 }, ZWSP),
        "<b>",
      ),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const result = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );

    assert(result.length === 2, "Expected two ZWSPs");
    const zwsp0 = result[0];
    const zwsp1 = result[1];
    assert(zwsp0 !== undefined, "ZWSP at index 0 not found");
    assert(zwsp1 !== undefined, "ZWSP at index 1 not found");
    assert(zwsp0.isBlockStart, "First ZWSP should be at block start");
    assert(zwsp1.isBlockEnd, "Second ZWSP should be at block end");
  });

  it("should find ZWSPs across multiple blocks", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<start>First",
        testBuilders.insertion({ id: 1 }, ZWSP),
      ),
      testBuilders.paragraph(
        testBuilders.insertion({ id: 1 }, ZWSP),
        "Second<end>",
      ),
    ) as TaggedNode;

    const tagStart = doc.tag["start"];
    const tagEnd = doc.tag["end"];
    assert(tagStart !== undefined, "Tag 'start' not found");
    assert(tagEnd !== undefined, "Tag 'end' not found");

    const result = findZwspsInRange(
      doc,
      tagStart,
      tagEnd,
      insertionMarkType,
    );

    assert(result.length === 2, "Expected two ZWSPs");
    const zwsp0 = result[0];
    const zwsp1 = result[1];
    assert(zwsp0 !== undefined, "ZWSP at index 0 not found");
    assert(zwsp1 !== undefined, "ZWSP at index 1 not found");
    assert(zwsp0.id === 1, "First ZWSP should have ID 1");
    assert(zwsp0.isBlockEnd, "First ZWSP should be at block end");
    assert(zwsp1.id === 1, "Second ZWSP should have ID 1");
    assert(zwsp1.isBlockStart, "Second ZWSP should be at block start");
  });

  it("should handle ZWSP without insertion mark ID", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph("<a>", ZWSP, "Hello<b>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const result = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );

    assert(result.length === 1, "Expected one ZWSP");
    const zwsp0 = result[0];
    assert(zwsp0 !== undefined, "ZWSP at index 0 not found");
    assert(zwsp0.id === null, "Expected ZWSP to have null ID");
    assert(zwsp0.isBlockStart, "Expected ZWSP at block start");
  });

  it("should ignore ZWSPs in middle of text (not on block boundaries)", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<a>Hel",
        testBuilders.insertion({ id: 3 }, ZWSP),
        "lo<b>",
      ),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const result = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );

    assert(result.length === 0, "Expected no ZWSPs at block boundaries");
  });

  it("should respect range boundaries", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "First"),
      testBuilders.paragraph(
        "<start>",
        testBuilders.insertion({ id: 2 }, ZWSP),
        "Second<end>",
      ),
      testBuilders.paragraph(testBuilders.insertion({ id: 3 }, ZWSP), "Third"),
    ) as TaggedNode;

    const tagStart = doc.tag["start"];
    const tagEnd = doc.tag["end"];
    assert(tagStart !== undefined, "Tag 'start' not found");
    assert(tagEnd !== undefined, "Tag 'end' not found");

    const result = findZwspsInRange(
      doc,
      tagStart,
      tagEnd,
      insertionMarkType,
    );

    assert(result.length === 1, "Expected one ZWSP in range");
    const zwsp0 = result[0];
    assert(zwsp0 !== undefined, "ZWSP at index 0 not found");
    assert(zwsp0.id === 2, "Expected ZWSP with ID 2");
  });

  it("should handle nested blocks (lists)", () => {
    const doc = testBuilders.doc(
      testBuilders.bulletList(
        testBuilders.listItem(
          testBuilders.paragraph(
            "<a>",
            testBuilders.insertion({ id: 1 }, ZWSP),
            "Item 1",
          ),
        ),
        testBuilders.listItem(
          testBuilders.paragraph(
            testBuilders.insertion({ id: 2 }, ZWSP),
            "Item 2<b>",
          ),
        ),
      ),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const result = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );

    assert(result.length === 2, "Expected two ZWSPs");
    const zwsp0 = result[0];
    const zwsp1 = result[1];
    assert(zwsp0 !== undefined, "ZWSP at index 0 not found");
    assert(zwsp1 !== undefined, "ZWSP at index 1 not found");
    assert(zwsp0.id === 1, "First ZWSP should have ID 1");
    assert(zwsp0.isBlockStart, "First ZWSP should be at block start");
    assert(zwsp1.id === 2, "Second ZWSP should have ID 2");
    assert(zwsp1.isBlockStart, "Second ZWSP should be at block start");
  });

  it("should correctly set blockDepth", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<a>",
        testBuilders.insertion({ id: 1 }, ZWSP),
        "Top level",
      ),
      testBuilders.bulletList(
        testBuilders.listItem(
          testBuilders.paragraph(
            testBuilders.insertion({ id: 2 }, ZWSP),
            "Nested<b>",
          ),
        ),
      ),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const result = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );

    assert(result.length === 2, "Expected two ZWSPs");
    const zwsp0 = result[0];
    const zwsp1 = result[1];
    assert(zwsp0 !== undefined, "ZWSP at index 0 not found");
    assert(zwsp1 !== undefined, "ZWSP at index 1 not found");
    assert(zwsp0.blockDepth === 1, "Top-level ZWSP should have depth 1");
    assert(zwsp1.blockDepth > 1, "Nested ZWSP should have depth > 1");
  });

  it("should handle empty range", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(testBuilders.insertion({ id: 1 }, ZWSP), "He<a>llo"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    assert(tagA !== undefined, "Tag 'a' not found");

    const result = findZwspsInRange(doc, tagA, tagA, insertionMarkType);

    assert(result.length === 0, "Expected no ZWSPs in empty range");
  });

  it("should find ZWSPs with different IDs", () => {
    const doc = testBuilders.doc(
      testBuilders.paragraph(
        "<a>A",
        testBuilders.insertion({ id: 1 }, ZWSP),
      ),
      testBuilders.paragraph(testBuilders.insertion({ id: 2 }, ZWSP), "B"),
      testBuilders.paragraph("C", testBuilders.insertion({ id: 3 }, ZWSP), "<b>"),
    ) as TaggedNode;

    const tagA = doc.tag["a"];
    const tagB = doc.tag["b"];
    assert(tagA !== undefined, "Tag 'a' not found");
    assert(tagB !== undefined, "Tag 'b' not found");

    const result = findZwspsInRange(
      doc,
      tagA,
      tagB,
      insertionMarkType,
    );

    assert(result.length === 3, "Expected three ZWSPs");
    const zwsp0 = result[0];
    const zwsp1 = result[1];
    const zwsp2 = result[2];
    assert(zwsp0 !== undefined, "ZWSP at index 0 not found");
    assert(zwsp1 !== undefined, "ZWSP at index 1 not found");
    assert(zwsp2 !== undefined, "ZWSP at index 2 not found");
    assert(zwsp0.id === 1, "First ZWSP should have ID 1");
    assert(zwsp1.id === 2, "Second ZWSP should have ID 2");
    assert(zwsp2.id === 3, "Third ZWSP should have ID 3");
  });
});
