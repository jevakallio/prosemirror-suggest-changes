# Process Inserted Ranges

## Purpose

Enables proper reversion of insertion suggestions at block boundaries. When a
user presses Enter to split a paragraph and then presses Backspace, the
paragraph should rejoin cleanly—as if the split never happened.

## Core Principle

**Removing an insertion suggestion should revert the document to its state
before the suggestion was created.**

## How It Works

### ZWSP Markers

When Enter creates a paragraph split, we insert **zero-width space characters**
(`\u200B`) at block boundaries:

- One ZWSP at the end of the first block
- One ZWSP at the start of the second block
- Both marked with the same insertion suggestion ID

These paired markers act as anchors that let us detect when a block join should
occur.

### Detection Algorithm

The feature runs in three phases:

**Phase 1: Collect inserted ranges** (`index.ts`)

- Scans the deletion range for insertion-marked content
- Extracts suggestion IDs from marks

**Phase 2: Check adjacent positions** (`index.ts`)

- For small deletions (≤2 chars) at block boundaries
- Looks before and after the deletion for ZWSP markers
- Adds any found ZWSPs to the ranges list

**Phase 3: Handle block join** (`blockJoinOnZwspDeletion.ts`)

- Searches for ZWSP pairs with matching suggestion IDs
- Supports both directions:
  - **Backspace**: Deleting ZWSP at start of second block → look backward for
    matching ZWSP
  - **Delete**: Deleting ZWSP at end of first block → look forward for matching
    ZWSP
- If pair found:
  1. Delete both ZWSPs (in reverse position order)
  2. Join the blocks at the boundary
  3. Use position mapping to track changes through deletions

### Key Details

- **ID Matching**: Only joins blocks with identical suggestion IDs
- **Position Mapping**: Uses transaction mapping to adjust positions after ZWSP
  deletions
- **Reverse Order**: Deletes from highest to lowest position to avoid position
  shifts
- **Safety**: Validates with `canJoin()` before joining blocks

## Integration

Called from `replaceStep.ts` during every replace operation. If block join is
handled, skips normal deletion marking logic.

## File Structure

```
src/features/processInsertedRanges/
├── index.ts                      # Phases 1-2: Range collection
└── blockJoinOnZwspDeletion.ts   # Phase 3: ZWSP pair detection & joining
```

## Testing

- **Unit tests**: `src/__tests__/paragraphBackspace.test.ts`
- **E2E tests**: `src/__tests__/blockJoin.playwright.test.ts`

## Known Limitations

1. **Delete key**: May leave ZWSP markers in some cases (Backspace cleans up
   better)
2. **Block types**: Primarily tested with paragraphs; other block types may need
   additional support
3. **Complex nesting**: Edge cases may exist in deeply nested structures
