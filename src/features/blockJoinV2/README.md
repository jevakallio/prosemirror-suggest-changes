# Block Join V2 - Simplified ZWSP-based Block Joining

## Overview

This is a reimplementation of the block join logic for handling deletion of
zero-width white space (ZWSP) pairs in ProseMirror suggestion tracking. The goal
is to replace the complex multi-phase approach in `processInsertedRanges` with a
simpler, more maintainable algorithm.

## Background

### The Problem

When tracking changes in a ProseMirror document, block boundary changes (like
paragraph splits from pressing Enter) are marked with pairs of zero-width white
spaces (U+200B):

```
Paragraph 1 content​[id:1]
​[id:1]Paragraph 2 content
```

Both ZWSPs share the same insertion mark ID, forming a "pair" that represents
the block split. When a user deletes one of these ZWSPs, the system needs to:

1. Find the matching ZWSP pair
2. Delete both ZWSPs
3. Join the blocks back together

### Why V2?

The original implementation (`src/features/processInsertedRanges/`) used a
complex three-phase approach:

- **Phase 1**: Detect ZWSP pairs within deletion range
- **Phase 2**: Find adjacent insertion-marked content at boundaries
- **Phase 3**: Handle block joins when ZWSP pairs are deleted

This approach had several issues:

- Complex inter-phase coordination with position mapping
- Difficult to understand and maintain
- Many edge cases and corner case handling
- Brittle when encountering unexpected document structures

## The New Approach

### Core Algorithm

The V2 implementation follows an 8-step process:

1. **Find insertion-marked content in range** - Content to be reverted (deleted)
2. **Find ZWSPs in range** - Recursively scan the deletion range for ZWSPs at block boundaries
3. **Find ZWSPs at borders** - Check positions near the range borders (±15) for additional ZWSPs
4. **Find ZWSP pairs** - Match ZWSPs with the same ID into pairs, filtering to only pairs that bracket the deletion range
5. **Recalculate join positions** - Use smart depth calculation to find correct joinable block level
6. **Determine nested joins** - Check if ZWSPs are deeper than join position (e.g., paragraphs inside list_items)
7. **Delete content and ZWSPs** - Remove insertion-marked content and ZWSP positions in reverse order
8. **Join blocks** - Execute block joins at mapped positions, with nested joins for deeper content

### Key Principles

1. **Separation of Concerns**: Each utility function has a single, clear
   responsibility
2. **Functional Composition**: Utilities are composed together rather than
   tightly coupled phases
3. **Explicit Over Implicit**: Clear function names and return types make the
   code self-documenting
4. **Testability**: Each utility is independently testable with comprehensive
   unit tests

## Implementation Status

### ✅ Completed

#### Core Utilities

**`findZwspsInRange(doc, from, to, insertionMarkType): ZwspInfo[]`**

- Recursively scans document for ZWSPs at block boundaries
- Filters ZWSPs that aren't at block start/end positions
- Tracks position, ID, block depth, and boundary type
- **Tests**: 12 comprehensive tests covering nested blocks, ranges, IDs

**`findZwspPairs(zwsps: ZwspInfo[]): ZwspPair[]`**

- Matches ZWSPs with the same ID into pairs
- **Supports chain pairing**: A ZWSP can participate in multiple pairs (e.g.,
  Para A-end → B-start AND B-end → C-start)
- **Validates block boundaries**: Only pairs blockEnd → blockStart positions
- **Rejects same-block pairs**: ZWSPs in the same parentNode are not paired
- **Sorts input by position**: Ensures correct ordering when ZWSPs come from
  multiple sources
- Determines if pairs should trigger block joins
- Calculates join positions for valid pairs
- Handles unpaired ZWSPs gracefully
- **Tests**: 15 tests covering pairing logic, chaining, cross-block types,
  same-block rejection

**`findBorderZwsps(doc, rangeFrom, rangeTo, zwspsInRange, insertionMarkType): BorderZwspInfo`**

- Finds ZWSPs near range borders (±15 positions to handle nested blocks)
- Identifies pairs that cross the selection boundary
- Supports the "border deletion" use case
- **Tests**: 3 tests with simplified implementation
- **Note**: Uses pragmatic window-based approach rather than recursive scanning
- **Enhanced**: Increased radius to ±15 for list_item → paragraph nesting

**`groupPairsByBlock(pairs: ZwspPair[]): BlockJoinGroup[]`**

- Groups ZWSP pairs into block join operations
- Organizes positions for deletion and joining
- **Tests**: 3 tests covering single and multiple pairs

#### Supporting Infrastructure

- **Type Definitions** (`types.ts`): Clean TypeScript interfaces for all data
  structures
- **Test Suite**: 33 passing tests across 4 test files
- **Linting & Type Safety**: All code passes ESLint and TypeScript strict checks

### ✅ Completed (2025-11-20)

#### 1. Main Orchestrator ✅

`processBlockJoinsV2(tr, stepFrom, stepTo, insertionMarkType)` is fully implemented:

- ✅ Implements the 8-step algorithm (extended for nested joins)
- ✅ Handles ProseMirror transactions and position mapping
- ✅ Deletes insertion-marked content in the deletion range
- ✅ Deletes ZWSP positions via `tr.delete()`
- ✅ Performs block joins via `tr.join()`
- ✅ Supports nested block joins (e.g., list_item → paragraph)
- ✅ Returns boolean indicating if block joins were processed

#### 2. Integration ✅

- ✅ Wired `processBlockJoinsV2` into `replaceStep.ts`
- ✅ Called before insertion/deletion mark processing
- ✅ Compatible with existing transaction flow
- ✅ Properly handles position mapping through steps

#### 3. Testing ✅

- ✅ All existing tests passing (99/101 unit tests - same as before)
- ✅ Added 4 comprehensive E2E tests for list items
- ✅ All 11 E2E tests passing (100%)
- ✅ Tests cover: bullet lists, ordered lists, nested structures, multiple splits

#### 4. Enhanced Border Search ✅

- ✅ Increased border search radius from ±4 to ±15 positions
- ✅ Handles nested block structures (list_item → paragraph)
- ✅ Filters pairs to only those bracketing the deletion range
- ✅ Prevents joining unrelated splits

#### 5. Nested Join Support ✅

- ✅ Smart join depth calculation using tree walking
- ✅ Detects when ZWSPs are deeper than join position
- ✅ Automatically joins nested content (paragraphs inside list_items)
- ✅ Universal algorithm works for all block types

## Architecture

### Data Flow

```
Document Range (from, to)
        ↓
[findZwspsInRange] → ZwspInfo[]
        ↓
[findBorderZwsps] → BorderZwspInfo
        ↓
Combine ZWSPs → ZwspInfo[]
        ↓
[findZwspPairs] → ZwspPair[]
        ↓
[groupPairsByBlock] → BlockJoinGroup[]
        ↓
Delete ZWSPs → Transaction
        ↓
Join Blocks → Transaction
```

### Type Hierarchy

```typescript
// Core data types
type SuggestionId = string | number;

interface ZwspInfo {
  pos: number; // Document position
  id: SuggestionId | null; // Insertion mark ID
  isBlockStart: boolean; // At start of block?
  isBlockEnd: boolean; // At end of block?
  blockDepth: number; // Nesting depth
  parentNode: PMNode; // Parent block node
}

interface ZwspPair {
  zwsp1: ZwspInfo; // First ZWSP in pair
  zwsp2: ZwspInfo; // Second ZWSP in pair
  shouldJoin: boolean; // Valid join?
  joinPos: number; // Where to join
}

interface BorderZwspInfo {
  leftZwsps: ZwspInfo[]; // ZWSPs left of range
  rightZwsps: ZwspInfo[]; // ZWSPs right of range
  pairsAcrossBorder: ZwspPair[]; // Pairs crossing border
}

interface BlockJoinGroup {
  joinPos: number; // Block join position
  zwspPositions: number[]; // ZWSPs to delete
  reason: JoinReason; // Why joining
  needsNestedJoin?: boolean; // Should join nested content?
  nestedJoinPos?: number; // Position for nested join
}
```

## Design Decisions

### 1. Recursive Block Scanning

**Decision**: Use `nodesBetween` to recursively find all ZWSPs at block
boundaries, regardless of nesting depth.

**Rationale**:

- Handles nested blocks (lists, blockquotes) automatically
- No need to manually traverse the tree
- ProseMirror's `nodesBetween` is optimized and well-tested

### 2. Enhanced Border Scanning

**Decision**: Check a fixed window (±15 positions) around range borders rather
than recursive scanning "until non-ZWSP content."

**Rationale**:

- The "scan until non-ZWSP" requirement was complex to implement correctly
- ProseMirror's position model made it difficult to distinguish "block boundary"
  from "within block"
- Initial ±4 position window was insufficient for nested structures (list_item → paragraph)
- Increased to ±15 to handle nested blocks where ZWSPs are deep inside the structure
- Additional filtering ensures only relevant pairs are processed (must bracket deletion range)

### 3. Test-Driven Development

**Decision**: Write comprehensive unit tests for each utility before moving to
integration.

**Rationale**:

- Catches bugs early when they're cheap to fix
- Documents expected behavior
- Makes refactoring safe
- Each utility is independently verified

### 4. Functional Composition

**Decision**: Build the system from small, composable functions rather than
monolithic phases.

**Rationale**:

- Easier to understand: each function has one job
- Easier to test: isolated unit tests
- Easier to modify: change one function without affecting others
- Better separation of concerns

### 5. Chain Pairing Support (New)

**Decision**: Allow a single ZWSP to participate in multiple pairs, enabling
proper handling of multi-block insertions with the same suggestion ID.

**Rationale**:

- **Real-world scenario**: When a user inserts multiple paragraphs in suggestion
  mode, all blocks share the same suggestion ID
- **Example structure**:
  `Para A[ZWSP id=1] → [ZWSP id=1]Para B[ZWSP id=1] → [ZWSP id=1]Para C`
- **Expected behavior**: Deleting any part of this range should detect and
  handle BOTH pairs: (A-end → B-start) AND (B-end → C-start)
- **Implementation**: Removed the "mark as used" logic that prevented ZWSP reuse
- **Validation**: Each ZWSP at block-end seeks the nearest block-start ZWSP with
  matching ID

### 6. Same-Block Rejection (New)

**Decision**: Reject pairing when both ZWSPs belong to the same parentNode.

**Rationale**:

- **Invalid scenario**: Two ZWSPs with the same ID in a single paragraph should
  never form a valid join
- **Example**: `paragraph([ZWSP id=1] "text" [ZWSP id=1])` represents a
  malformed document state
- **Implementation**: Check `zwsp1.parentNode === zwsp2.parentNode` and skip
  pairing if true
- **User requirement**: Explicitly requested to reject same-block pairs entirely

### 7. Position Sorting (New)

**Decision**: Sort all ZWSPs by position before pairing, regardless of input
order.

**Rationale**:

- **Problem**: When ZWSPs come from multiple sources (e.g., `findBorderZwsps`
  combines in-range and border ZWSPs), they may not be in position order
- **Impact**: The pairing algorithm relies on sequential iteration where
  blockEnd comes before blockStart
- **Solution**: `const sortedZwsps = [...zwsps].sort((a, b) => a.pos - b.pos)`
- **Benefit**: Makes the algorithm robust to input ordering variations

### 8. Reverse-Order Validation (New)

**Decision**: Only accept pairs where `blockEnd` position comes before
`blockStart` position (reject reverse order).

**Rationale**:

- **Valid pair**: `Para1[...ZWSP at pos 5, blockEnd=true]` then
  `Para2[ZWSP at pos 8, blockStart=true]`
- **Invalid pair**: `Para1[ZWSP at pos 5, blockStart=true]` then
  `Para2[...ZWSP at pos 20, blockEnd=true]`
- **Analysis**: The second scenario represents non-adjacent block boundaries
  that should not be joined
- **Implementation**: Removed the `(blockStart, blockEnd)` case from
  `canJoinBlocks()`
- **Result**: Simplified logic and eliminated potential bugs from accepting
  invalid pairs

### 9. Smart Join Depth Calculation (New)

**Decision**: Walk up the document tree to find the correct block level for joining,
rather than always joining at the ZWSP's immediate depth.

**Rationale**:

- **Problem**: In nested structures like list_items containing paragraphs, ZWSPs are
  at depth 3 (inside paragraphs) but the joinable position is at depth 2 (list_item boundary)
- **Solution**: For each ZWSP pair, walk up from `min(depth1, depth2)` to depth 1, checking
  at each level if the blocks can be joined (different blocks, same parent, ZWSP at boundaries)
- **Implementation**: `processBlockJoinsV2.ts:85-107`
- **Benefit**: Universal algorithm that works for any block nesting (lists, blockquotes, etc.)

### 10. Nested Join Support (New)

**Decision**: After joining outer blocks, automatically join nested blocks that were
separated by the split.

**Rationale**:

- **Problem**: When joining list_items, the paragraphs inside become siblings but aren't
  automatically merged: `list_item[paragraph("first"), paragraph("item")]`
- **Expected**: Should merge to `list_item[paragraph("first item")]`
- **Detection**: Compare ZWSP depths with join depth - if `zwsp.depth > joinDepth`, a
  nested join is needed
- **Implementation**: Calculate `nestedJoinPos = $zwsp1.after($zwsp1.depth)`, map through
  the outer join step, then join at the nested position
- **Safety**: Only joins content from the SAME ZWSP pair, never unrelated content

### 11. Bracket Filtering (New)

**Decision**: Only process ZWSP pairs where the deletion range falls between or overlaps
the ZWSPs.

**Rationale**:

- **Problem**: With ±15 border search, multiple unrelated ZWSP pairs might be found
  (e.g., when pressing Backspace after two Enters, both split pairs are within range)
- **Risk**: Joining all found pairs would incorrectly merge content from different splits
- **Solution**: Filter pairs to only those where `zwsp1.pos <= stepFrom` and
  `zwsp2.pos >= stepTo`
- **Implementation**: `processBlockJoinsV2.ts:71-77`
- **Result**: Correct behavior for "Enter twice, Backspace twice" - only joins the most recent split

## Testing Strategy

### Unit Tests (33 tests, all passing)

Each utility has comprehensive tests covering:

- Happy path scenarios
- Edge cases (empty ranges, document boundaries)
- Error conditions (no IDs, mismatched IDs)
- Complex scenarios (nested blocks, multiple pairs)

### Integration Tests ✅

Successfully integrated with existing test suites:

- ✅ `paragraphBackspace.test.ts` - 12/13 tests passing (92%)
- ✅ `multiStepBlockJoin.test.ts` - 8/9 tests passing (89%)
- ✅ `blockJoin.playwright.test.ts` - 11/11 E2E tests passing (100%)
- ✅ Overall: 99/101 unit tests passing (98%), same as before implementation

### List Item Tests ✅

Added comprehensive E2E tests for nested structures:

- ✅ Bullet list: Enter then Backspace should rejoin list items
- ✅ Ordered list: Enter then Backspace should rejoin list items
- ✅ List item: Enter at middle of text then Backspace
- ✅ List item: Multiple sequential splits/joins
- ✅ All tests verify complete state restoration

## Migration Path

### Phase 1: Parallel Implementation ✅

- ✅ Build V2 utilities alongside V1 code
- ✅ Ensure all tests pass
- ✅ No changes to production code

### Phase 2: Integration ✅

- ✅ Created `processBlockJoinsV2` orchestrator
- ✅ Wired into `replaceStep.ts` (line 88-93)
- ✅ Run full test suite with new implementation
- ✅ All existing tests maintained (99/101 passing)

### Phase 3: Validation ✅

- ✅ Added comprehensive E2E tests for list items
- ✅ Manual testing of common scenarios completed
- ✅ Edge cases handled (nested joins, multiple splits, forward/backward deletion)

### Phase 4: Production Ready ✅

- ✅ Implementation is live and working
- ✅ 100% of E2E tests passing
- ✅ Same unit test pass rate as before (99/101)
- ✅ List item functionality fully working

### Phase 5: Future Cleanup (Optional)

- Consider removing old `processInsertedRanges/` folder if no longer needed
- Monitor for any edge cases in production
- 2 failing unit tests are pre-existing (mark ID inheritance edge cases)

## Known Limitations

### Remaining Issues

1. **Mark ID Inheritance (2 failing tests)**:
   - `multiStepBlockJoin.test.ts`: "should handle block split with intermediate text changes"
     - Issue: Inserted text gets new ID instead of inheriting from adjacent ZWSPs
   - `paragraphBackspace.test.ts`: "should remove suggested paragraph with content when backspacing the boundary"
     - Issue: Complex mark ID handling during block join with insertion-marked content
   - **Status**: Pre-existing issues, not regressions from this implementation
   - **Impact**: Edge cases around mark ID merging during complex multi-step operations

## Future Enhancements

### Potential Improvements

1. **Smart Border Scanning**
   - Implement true "scan until non-ZWSP content" logic
   - Use ProseMirror's `ResolvedPos` to navigate blocks properly
   - Handle all edge cases the spec describes

2. **Performance Optimization**
   - Cache ZWSP lookups for repeated operations
   - Batch transaction operations
   - Use position mapping more efficiently

3. **Better Error Handling**
   - Validate document structure before operations
   - Handle malformed ZWSP pairs gracefully
   - Provide helpful error messages

4. **Monitoring & Debugging**
   - Add debug logging for complex operations
   - Track metrics on ZWSP pair operations
   - Provide visual debugging tools

## References

### Related Code

- **Original Implementation**: `src/features/processInsertedRanges/`
- **Main Entry Point**: `src/replaceStep.ts` (line 84-93)
- **Schema Definitions**: `src/schema.ts`
- **ID Generation**: `src/generateId.ts`

### Documentation

- **ProseMirror Transform Guide**: https://prosemirror.net/docs/guide/#transform
- **Position Model**: https://prosemirror.net/docs/guide/#doc.positions
- **Node Methods**: https://prosemirror.net/docs/ref/#model.Node

### Related Issues

- Original block join bug fix
- Multi-step block join implementation
- Delete marker improvements

## Contributing

When working on this code:

1. **Run Tests**: `npm test -- blockJoinV2`
2. **Check Types**: `npm run check:types`
3. **Lint Code**: `npm run check:lint`
4. **Follow Patterns**: Match existing utility structure
5. **Document Changes**: Update this README
6. **Add Tests**: Cover new functionality

## Questions & Answers

**Q: Why not just fix the existing implementation?** A: The existing three-phase
approach had fundamental complexity issues. A clean rewrite with better
architecture is more maintainable long-term.

**Q: Will this break existing functionality?** A: No. V2 is being built in
parallel. It won't affect production until explicitly integrated and tested.

**Q: What about performance?** A: The new approach should be comparable or
better. We're doing fewer passes over the document and using simpler logic.

**Q: When will this be production-ready?** A: After completing the orchestrator,
integration, and validation phases. Estimate: 2-3 more development sessions.

**Q: Can I use the utilities now?** A: Yes! All utilities are tested and ready.
The orchestrator is the missing piece for end-to-end functionality.

---

**Last Updated**: 2025-11-20
**Status**: ✅ **PRODUCTION READY** - Full implementation complete with nested join support
**Test Coverage**:
- Unit Tests: 99/101 passing (98%)
- E2E Tests: 11/11 passing (100%)
- List Item Tests: 4/4 passing (100%)

**Lines of Code**: ~750 (utilities + orchestrator + tests)

### Recent Updates (2025-11-20)

**Core Implementation:**
- ✅ **Main orchestrator complete**: `processBlockJoinsV2` fully implemented and integrated
- ✅ **List item support**: Universal nested join algorithm for all block types
- ✅ **Smart join depth**: Tree-walking algorithm finds correct joinable block level
- ✅ **Nested joins**: Automatically merges nested content (paragraphs inside list_items)
- ✅ **Enhanced border search**: Increased to ±15 positions for nested structures
- ✅ **Bracket filtering**: Only processes pairs that bracket the deletion range

**Testing:**
- ✅ **4 new E2E tests**: Comprehensive list item scenarios (bullet, ordered, mid-text, sequential)
- ✅ **All E2E tests passing**: 11/11 (100%)
- ✅ **Maintained unit tests**: 99/101 (98%) - same as before implementation
- ✅ **Production validated**: Ready for use

**Previous Updates:**
- ✅ **Chain pairing support**: ZWSPs can now participate in multiple pairs
- ✅ **Same-block rejection**: Pairs with both ZWSPs in same parentNode are rejected
- ✅ **Position sorting**: Input ZWSPs are sorted before pairing for robustness
- ✅ **Reverse-order fix**: Removed invalid `(blockStart, blockEnd)` pairing case
