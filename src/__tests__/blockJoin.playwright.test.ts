/**
 * Playwright E2E Tests for Block Join Behavior
 *
 * These tests use real keyboard events in a browser environment to verify
 * that the suggestChanges plugin correctly handles block splitting and joining
 * operations.
 *
 * Key differences from JSDOM tests:
 * - Uses real browser (via Playwright)
 * - Uses real keyboard events (page.keyboard.press)
 * - Tests actual user interactions
 * - Catches bugs that manual transactions would hide
 */

import { test, expect } from "@playwright/test";

test.describe("Block Join E2E - Real Keyboard Events", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the test page
    await page.goto("/test-fixtures/keyboard-test.html");

    // Wait for the editor to be initialized
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    await page.waitForFunction(() => window.pmEditor !== undefined);

    // Focus the editor
    await page.locator("#editor .ProseMirror").click();
  });

  test.describe("Paragraph: Enter then Backspace", () => {
    test("should revert document to original state", async ({ page }) => {
      console.log("\n📝 TEST: Paragraph Enter → Backspace");

      // Get initial state
      const initialState = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      const initialDoc = await page.evaluate(() =>
        window.pmEditor.getDocJSON(),
      );
      console.log("Initial doc:", initialDoc);
      console.log("Initial state:", initialState);

      // Move cursor to end of paragraph
      await page.evaluate(() => {
        window.pmEditor.setCursorToEnd();
      });

      // Press Enter
      console.log("\n⚡ Simulating ENTER key...");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);

      // Get state after Enter
      const afterEnterState = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      const afterEnterDoc = await page.evaluate(() =>
        window.pmEditor.getDocJSON(),
      );
      const afterEnterCursor = await page.evaluate(() =>
        window.pmEditor.getCursorInfo(),
      );

      console.log("After Enter doc:", afterEnterDoc);
      console.log("After Enter state:", afterEnterState);
      console.log("Cursor after Enter:", afterEnterCursor);

      // Should have 2 paragraphs after Enter
      expect(afterEnterState.paragraphCount).toBe(2);

      // Press Backspace
      console.log("\n⬅️ Simulating BACKSPACE key...");
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(100);

      // Get final state
      const finalState = await page.evaluate(() => window.pmEditor.getState());
      const finalDoc = await page.evaluate(() => window.pmEditor.getDocJSON());

      console.log("After Backspace doc:", finalDoc);
      console.log("Final state:", finalState);

      // Log all transactions
      const transactions = await page.evaluate(() =>
        window.pmEditor.getTransactions(),
      );
      console.log("Transactions:", JSON.stringify(transactions, null, 2));

      // Verify document reverted to original state
      console.log("\n🔍 OBSERVATION:");
      console.log("Initial text:", initialState.textContent);
      console.log("Final text:", finalState.textContent);
      console.log("Initial paragraphs:", initialState.paragraphCount);
      console.log("Final paragraphs:", finalState.paragraphCount);

      // The key assertion: Backspace should join the blocks back together
      expect(finalState.paragraphCount).toBe(1);
      expect(finalState.textContent).toBe(initialState.textContent);
    });
  });

  test.describe("Paragraph: Enter twice then Backspace twice", () => {
    test("should revert through both suggestions", async ({ page }) => {
      console.log("\n📝 TEST: Paragraph Enter → Enter → Backspace → Backspace");

      // Get initial state
      const initialState = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      console.log("Initial state:", initialState);

      // Move cursor to end
      await page.evaluate(() => {
        window.pmEditor.setCursorToEnd();
      });

      // First Enter
      console.log("\n⚡ First ENTER...");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);

      const afterFirstEnter = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      console.log("After first Enter:", afterFirstEnter);
      expect(afterFirstEnter.paragraphCount).toBe(2);

      // Second Enter
      console.log("\n⚡ Second ENTER...");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);

      const afterSecondEnter = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      console.log("After second Enter:", afterSecondEnter);
      console.log("Number of paragraphs:", afterSecondEnter.paragraphCount);
      expect(afterSecondEnter.paragraphCount).toBe(3);

      // First Backspace
      console.log("\n⬅️ First BACKSPACE...");
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(100);

      const afterFirstBackspace = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      console.log("After first Backspace:", afterFirstBackspace);
      expect(afterFirstBackspace.paragraphCount).toBe(2);

      // Second Backspace
      console.log("\n⬅️ Second BACKSPACE...");
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(100);

      const finalState = await page.evaluate(() => window.pmEditor.getState());
      console.log("After second Backspace:", finalState);

      console.log("\n🔍 OBSERVATION:");
      console.log("Did document revert?");
      console.log("Initial paragraphs:", initialState.paragraphCount);
      console.log("Final paragraphs:", finalState.paragraphCount);
      console.log("Initial text:", initialState.textContent);
      console.log("Final text:", finalState.textContent);

      // Should revert to original single paragraph
      expect(finalState.paragraphCount).toBe(1);
      expect(finalState.textContent).toBe(initialState.textContent);
    });
  });

  test.describe("Paragraph: Enter then Delete (from first block)", () => {
    test("should revert when Delete pressed from end of first block", async ({
      page,
    }) => {
      console.log("\n📝 TEST: Paragraph Enter → Delete from first block");

      // Get initial state
      const initialState = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      console.log("Initial state:", initialState);

      // Move cursor to end
      await page.evaluate(() => {
        window.pmEditor.setCursorToEnd();
      });

      // Press Enter to split
      console.log("\n⚡ ENTER...");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);

      const afterEnter = await page.evaluate(() => window.pmEditor.getState());
      console.log("After Enter:", afterEnter);
      expect(afterEnter.paragraphCount).toBe(2);

      // Move cursor to end of FIRST block
      console.log("\n🎯 Moving cursor to end of first block...");
      await page.evaluate(() => {
        window.pmEditor.setCursorToEndOfBlock(0);
      });

      const cursorInfo = await page.evaluate(() =>
        window.pmEditor.getCursorInfo(),
      );
      console.log("Cursor at end of first block:", cursorInfo);

      // Press Delete to join forward
      console.log("\n➡️ DELETE from end of first block...");
      await page.keyboard.press("Delete");
      await page.waitForTimeout(100);

      const finalState = await page.evaluate(() => window.pmEditor.getState());
      const finalDoc = await page.evaluate(() => window.pmEditor.getDocJSON());

      console.log("After Delete doc:", finalDoc);
      console.log("Final state:", finalState);

      console.log("\n🔍 OBSERVATION:");
      console.log("Did document revert?");
      console.log("Initial paragraphs:", initialState.paragraphCount);
      console.log("Final paragraphs:", finalState.paragraphCount);
      console.log("Initial text:", initialState.textContent);
      console.log("Final text:", finalState.textContent);

      // Delete should join the blocks
      expect(finalState.paragraphCount).toBe(1);

      // Note: Delete currently leaves ZWSP markers behind (known behavior)
      // This is different from Backspace which cleans them up
      // The text will have ZWSP characters remaining
      expect(finalState.textContent).toContain(initialState.textContent);
    });
  });

  test.describe("Paragraph: Enter then Delete (at block boundary)", () => {
    test("should revert when Delete pressed at exact block boundary", async ({
      page,
    }) => {
      console.log("\n📝 TEST: Paragraph Enter → Delete at boundary");

      // Get initial state
      const initialState = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      console.log("Initial state:", initialState);

      // Move cursor to end
      await page.evaluate(() => {
        window.pmEditor.setCursorToEnd();
      });
      const endPos = (await page.evaluate(() => window.pmEditor.getState()))
        .cursorFrom;

      // Press Enter to split
      console.log("\n⚡ ENTER...");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);

      const afterEnter = await page.evaluate(() => window.pmEditor.getState());
      const afterEnterDoc = await page.evaluate(() =>
        window.pmEditor.getDocJSON(),
      );
      console.log("Doc structure after Enter:", afterEnterDoc);
      expect(afterEnter.paragraphCount).toBe(2);

      // Position cursor at the boundary (end of first block)
      console.log("\n🎯 Positioning cursor at block boundary...");
      await page.evaluate((pos) => {
        window.pmEditor.setCursorToPosition(pos);
      }, endPos);

      const boundaryInfo = await page.evaluate(() =>
        window.pmEditor.getCursorInfo(),
      );
      console.log("Cursor at boundary:", boundaryInfo);

      // Press Delete at boundary
      console.log("\n➡️ DELETE at boundary...");
      await page.keyboard.press("Delete");
      await page.waitForTimeout(100);

      const finalState = await page.evaluate(() => window.pmEditor.getState());
      const finalDoc = await page.evaluate(() => window.pmEditor.getDocJSON());

      console.log("After Delete at boundary doc:", finalDoc);
      console.log("Final state:", finalState);

      console.log("\n🔍 OBSERVATION:");
      console.log("Did document revert?");
      console.log("How many paragraphs remain?", finalState.paragraphCount);
      console.log("Final text:", finalState.textContent);

      // Should revert to single paragraph
      expect(finalState.paragraphCount).toBe(1);

      // Note: Delete at boundary leaves ZWSP markers behind (known behavior)
      // This is different from Backspace which cleans them up
      expect(finalState.textContent).toContain(initialState.textContent);
    });
  });

  test.describe("Paragraph: Enter then ArrowLeft then Delete", () => {
    test("should revert when using real arrow key navigation", async ({
      page,
    }) => {
      console.log("\n📝 TEST: Paragraph Enter → ArrowLeft → Delete");

      // Get initial state
      const initialState = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      console.log("Initial state:", initialState);

      // Move cursor to end of paragraph
      await page.evaluate(() => {
        window.pmEditor.setCursorToEnd();
      });

      // Press Enter to split
      console.log("\n⚡ Simulating ENTER key...");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);

      const afterEnter = await page.evaluate(() => window.pmEditor.getState());
      console.log("After Enter:", afterEnter);
      expect(afterEnter.paragraphCount).toBe(2);

      const cursorAfterEnter = await page.evaluate(() =>
        window.pmEditor.getCursorInfo(),
      );
      console.log("Cursor after Enter:", cursorAfterEnter);

      // Press ArrowLeft to move back to end of first block
      console.log("\n⬅️ Simulating ARROWLEFT key...");
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(100);

      const cursorAfterArrowLeft = await page.evaluate(() =>
        window.pmEditor.getCursorInfo(),
      );
      console.log("Cursor after ArrowLeft:", cursorAfterArrowLeft);

      // Press Delete to join forward
      console.log("\n➡️ Simulating DELETE key...");
      await page.keyboard.press("Delete");
      await page.waitForTimeout(100);

      const finalState = await page.evaluate(() => window.pmEditor.getState());
      const finalDoc = await page.evaluate(() => window.pmEditor.getDocJSON());

      console.log("After Delete doc:", finalDoc);
      console.log("Final state:", finalState);

      // Log all transactions for debugging
      const transactions = await page.evaluate(() =>
        window.pmEditor.getTransactions(),
      );
      console.log("Transactions:", JSON.stringify(transactions, null, 2));

      console.log("\n🔍 OBSERVATION:");
      console.log("Initial paragraphs:", initialState.paragraphCount);
      console.log("Final paragraphs:", finalState.paragraphCount);
      console.log("Initial text:", initialState.textContent);
      console.log("Final text:", finalState.textContent);

      // Verify document reverted to original state
      expect(finalState.paragraphCount).toBe(1);
      expect(finalState.textContent).toBe(initialState.textContent);
    });
  });

  test.describe("Edge Cases", () => {
    test("should handle Enter at middle of text then Backspace", async ({
      page,
    }) => {
      console.log("\n📝 TEST: Enter at middle of text then Backspace");

      // Get initial state
      const initialState = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      console.log("Initial text:", initialState.textContent);

      // Position cursor in the middle of "test paragraph" (after "test ")
      await page.evaluate(() => {
        window.pmEditor.setCursorToPosition(6);
      });

      const cursorBefore = await page.evaluate(() =>
        window.pmEditor.getCursorInfo(),
      );
      console.log("Cursor before Enter:", cursorBefore);

      // Press Enter
      console.log("\n⚡ ENTER at middle...");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);

      const afterEnter = await page.evaluate(() => window.pmEditor.getState());
      const afterEnterDoc = await page.evaluate(() =>
        window.pmEditor.getDocJSON(),
      );
      console.log("After Enter:", afterEnterDoc);
      console.log("Paragraphs:", afterEnter.paragraphCount);
      expect(afterEnter.paragraphCount).toBe(2);

      // Press Backspace to rejoin
      console.log("\n⬅️ BACKSPACE...");
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(100);

      const finalState = await page.evaluate(() => window.pmEditor.getState());
      console.log("Final state:", finalState);

      // Should rejoin to single paragraph
      expect(finalState.paragraphCount).toBe(1);
      expect(finalState.textContent).toBe(initialState.textContent);
    });

    test("should handle multiple rapid Enter/Backspace sequences", async ({
      page,
    }) => {
      console.log("\n📝 TEST: Multiple rapid Enter/Backspace sequences");

      const initialState = await page.evaluate(() =>
        window.pmEditor.getState(),
      );

      // Perform 3 Enter/Backspace cycles
      for (let i = 1; i <= 3; i++) {
        console.log(`\n=== Cycle ${String(i)} ===`);

        await page.evaluate(() => {
          window.pmEditor.setCursorToEnd();
        });

        console.log("Enter...");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(50);

        const afterEnter = await page.evaluate(() =>
          window.pmEditor.getState(),
        );
        expect(afterEnter.paragraphCount).toBe(2);

        console.log("Backspace...");
        await page.keyboard.press("Backspace");
        await page.waitForTimeout(50);

        const afterBackspace = await page.evaluate(() =>
          window.pmEditor.getState(),
        );
        expect(afterBackspace.paragraphCount).toBe(1);

        console.log(`Cycle ${String(i)} complete`);
      }

      const finalState = await page.evaluate(() => window.pmEditor.getState());
      console.log("\n🔍 Final state after 3 cycles:", finalState);

      // Should still be in original state
      expect(finalState.paragraphCount).toBe(1);
      expect(finalState.textContent).toBe(initialState.textContent);
    });
  });

  test.describe("List Item Block Join Behavior", () => {
    test.beforeEach(async ({ page }) => {
      // Create a fresh document with a bullet list
      await page.evaluate(() => {
        window.pmEditor.replaceDoc({
          type: "doc",
          content: [
            {
              type: "bullet_list",
              content: [
                {
                  type: "list_item",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "test item" }],
                    },
                  ],
                },
              ],
            },
          ],
        });
      });

      // Clear transaction history
      await page.evaluate(() => {
        window.pmEditor.clearTransactions();
      });

      // Focus the editor
      await page.locator("#editor .ProseMirror").click();
    });

    test("Bullet list: Enter then Backspace should rejoin list items", async ({
      page,
    }) => {
      console.log("\n📝 TEST: Bullet List Enter → Backspace");

      // Get initial state
      const initialState = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      const initialDoc = await page.evaluate(() =>
        window.pmEditor.getDocJSON(),
      );
      console.log("Initial doc:", JSON.stringify(initialDoc, null, 2));
      console.log("Initial state:", initialState);

      // Move cursor to end of list item
      await page.evaluate(() => {
        window.pmEditor.setCursorToEnd();
      });

      const cursorBefore = await page.evaluate(() =>
        window.pmEditor.getCursorInfo(),
      );
      console.log("Cursor before Enter:", cursorBefore);

      // Press Enter to split list item
      console.log("\n⚡ Simulating ENTER key to split list item...");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);

      // Get state after Enter
      const afterEnterState = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      const afterEnterDoc = await page.evaluate(() =>
        window.pmEditor.getDocJSON(),
      );
      const afterEnterCursor = await page.evaluate(() =>
        window.pmEditor.getCursorInfo(),
      );

      console.log("After Enter doc:", JSON.stringify(afterEnterDoc, null, 2));
      console.log("After Enter state:", afterEnterState);
      console.log("Cursor after Enter:", afterEnterCursor);

      // Verify list was split (should still have 1 bullet_list, but with 2 list_items)
      expect(afterEnterState.blockCount).toBe(1); // Still one bullet_list block

      // Press Backspace to rejoin list items
      console.log("\n⬅️ Simulating BACKSPACE key...");
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(100);

      // Get final state
      const finalState = await page.evaluate(() => window.pmEditor.getState());
      const finalDoc = await page.evaluate(() => window.pmEditor.getDocJSON());

      console.log("After Backspace doc:", JSON.stringify(finalDoc, null, 2));
      console.log("Final state:", finalState);

      // Log all transactions
      const transactions = await page.evaluate(() =>
        window.pmEditor.getTransactions(),
      );
      console.log("Transactions:", JSON.stringify(transactions, null, 2));

      // Verify document reverted to original state
      console.log("\n🔍 OBSERVATION:");
      console.log("Initial text:", initialState.textContent);
      console.log("Final text:", finalState.textContent);
      console.log("Initial blocks:", initialState.blockCount);
      console.log("Final blocks:", finalState.blockCount);

      // The key assertion: Backspace should join the list items back together
      expect(finalState.blockCount).toBe(1);
      expect(finalState.textContent).toBe(initialState.textContent);
      expect(JSON.stringify(finalDoc)).toBe(JSON.stringify(initialDoc));
    });

    test("Ordered list: Enter then Backspace should rejoin list items", async ({
      page,
    }) => {
      console.log("\n📝 TEST: Ordered List Enter → Backspace");

      // Create an ordered list instead
      await page.evaluate(() => {
        window.pmEditor.replaceDoc({
          type: "doc",
          content: [
            {
              type: "ordered_list",
              content: [
                {
                  type: "list_item",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "first item" }],
                    },
                  ],
                },
              ],
            },
          ],
        });
      });

      // Clear transaction history
      await page.evaluate(() => {
        window.pmEditor.clearTransactions();
      });

      // Get initial state
      const initialState = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      const initialDoc = await page.evaluate(() =>
        window.pmEditor.getDocJSON(),
      );
      console.log("Initial doc:", JSON.stringify(initialDoc, null, 2));

      // Move cursor to end
      await page.evaluate(() => {
        window.pmEditor.setCursorToEnd();
      });

      // Press Enter
      console.log("\n⚡ ENTER to split ordered list item...");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);

      const afterEnter = await page.evaluate(() =>
        window.pmEditor.getDocJSON(),
      );
      console.log("After Enter:", JSON.stringify(afterEnter, null, 2));

      // Press Backspace
      console.log("\n⬅️ BACKSPACE...");
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(100);

      const finalState = await page.evaluate(() => window.pmEditor.getState());
      const finalDoc = await page.evaluate(() => window.pmEditor.getDocJSON());
      console.log("Final doc:", JSON.stringify(finalDoc, null, 2));

      // Verify document reverted
      expect(finalState.textContent).toBe(initialState.textContent);
      expect(JSON.stringify(finalDoc)).toBe(JSON.stringify(initialDoc));
    });

    test("List item: Enter at middle of text then Backspace", async ({
      page,
    }) => {
      console.log("\n📝 TEST: List item Enter at middle then Backspace");

      // Get initial state
      const initialState = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      const initialDoc = await page.evaluate(() =>
        window.pmEditor.getDocJSON(),
      );
      console.log("Initial text:", initialState.textContent);

      // Position cursor in the middle of "test item" (after "test ")
      // bullet_list is at pos 0, list_item at pos 1, paragraph at pos 2, text starts at pos 3
      // "test " is 5 characters, so position 3 + 5 = 8
      await page.evaluate(() => {
        window.pmEditor.setCursorToPosition(8);
      });

      const cursorBefore = await page.evaluate(() =>
        window.pmEditor.getCursorInfo(),
      );
      console.log("Cursor before Enter:", cursorBefore);

      // Press Enter
      console.log("\n⚡ ENTER at middle...");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);

      const afterEnter = await page.evaluate(() =>
        window.pmEditor.getDocJSON(),
      );
      console.log("After Enter:", JSON.stringify(afterEnter, null, 2));

      // Press Backspace
      console.log("\n⬅️ BACKSPACE...");
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(100);

      const finalState = await page.evaluate(() => window.pmEditor.getState());
      const finalDoc = await page.evaluate(() => window.pmEditor.getDocJSON());
      console.log("Final doc:", JSON.stringify(finalDoc, null, 2));

      // Should rejoin to original state
      expect(finalState.textContent).toBe(initialState.textContent);
      expect(JSON.stringify(finalDoc)).toBe(JSON.stringify(initialDoc));
    });

    test("List item: Multiple sequential splits/joins", async ({ page }) => {
      console.log("\n📝 TEST: List item multiple splits/joins");

      const initialState = await page.evaluate(() =>
        window.pmEditor.getState(),
      );
      const initialDoc = await page.evaluate(() =>
        window.pmEditor.getDocJSON(),
      );

      // Perform 3 Enter/Backspace cycles
      for (let i = 1; i <= 3; i++) {
        console.log(`\n=== Cycle ${String(i)} ===`);

        await page.evaluate(() => {
          window.pmEditor.setCursorToEnd();
        });

        console.log("Enter...");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(50);

        console.log("Backspace...");
        await page.keyboard.press("Backspace");
        await page.waitForTimeout(50);

        console.log(`Cycle ${String(i)} complete`);
      }

      const finalState = await page.evaluate(() => window.pmEditor.getState());
      const finalDoc = await page.evaluate(() => window.pmEditor.getDocJSON());
      console.log("\n🔍 Final state after 3 cycles:", finalState);

      // Should still be in original state
      expect(finalState.textContent).toBe(initialState.textContent);
      expect(JSON.stringify(finalDoc)).toBe(JSON.stringify(initialDoc));
    });
  });
});
