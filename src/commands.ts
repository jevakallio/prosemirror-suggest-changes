import {
  Fragment,
  type Mark,
  type MarkType,
  type Node,
  Slice,
} from "prosemirror-model";
import {
  type Command,
  type EditorState,
  TextSelection,
  type Transaction,
} from "prosemirror-state";
import { Transform } from "prosemirror-transform";
import { type EditorView } from "prosemirror-view";

import { findSuggestionMarkEnd } from "./findSuggestionMarkEnd.js";
import { suggestChangesKey, getSuggestChangesGenerateId } from "./plugin.js";
import { getStepHandler } from "./withSuggestChanges.js";

/**
 * Given a node and a transform, add a set of steps to the
 * transform that applies all marks of type markTypeToApply
 * and reverts all marks of type markTypeToRevert.
 *
 * If suggestionId is provided, will only add steps that impact
 * deletions, insertions, and modifications with that id.
 */
function applySuggestionsToTransform(
  node: Node,
  tr: Transform,
  markTypeToApply: MarkType,
  markTypeToRevert: MarkType,
  suggestionId?: string,
) {
  const toApplyIsInSet =
    suggestionId === undefined
      ? (marks: readonly Mark[]) => markTypeToApply.isInSet(marks)
      : (marks: readonly Mark[]) =>
          markTypeToApply.create({ id: suggestionId }).isInSet(marks);

  const toRevertIsInSet =
    suggestionId === undefined
      ? (marks: readonly Mark[]) => markTypeToRevert.isInSet(marks)
      : (marks: readonly Mark[]) =>
          markTypeToRevert.create({ id: suggestionId }).isInSet(marks);

  const isToApply = toApplyIsInSet(node.marks);

  if (isToApply) {
    if (node.isInline) {
      tr.removeMark(0, node.nodeSize, markTypeToApply);
    } else {
      tr.removeNodeMark(0, markTypeToApply);
    }
  }

  node.descendants((child, pos) => {
    const isToRevert = toRevertIsInSet(child.marks);
    const isToApply = toApplyIsInSet(child.marks);
    if (!isToRevert && !isToApply) {
      return true;
    }

    if (isToRevert) {
      const { pos: deletionFrom, deleted } = tr.mapping.mapResult(pos);
      if (deleted) return false;
      const deletionTo = findSuggestionMarkEnd(
        tr.doc.resolve(deletionFrom + child.nodeSize),
        markTypeToRevert,
      );
      tr.deleteRange(deletionFrom, deletionTo);
      return false;
    }

    const insertionFrom = tr.mapping.map(pos);
    const insertionTo = insertionFrom + child.nodeSize;
    if (child.isInline) {
      tr.removeMark(insertionFrom, insertionTo, markTypeToApply);
      if (child.text === "\u200B") {
        tr.delete(insertionFrom, insertionTo);
      }
    } else {
      tr.removeNodeMark(insertionFrom, markTypeToApply);
    }
    return true;
  });
}

function revertModifications(node: Node, pos: number, tr: Transform) {
  const existingMods = node.marks.filter(
    (mark) => mark.type === node.type.schema.marks["modification"],
  );
  for (const mod of existingMods) {
    if (
      mod.attrs["type"] === "attr" &&
      typeof mod.attrs["attrName"] === "string"
    ) {
      tr.setNodeAttribute(
        pos,
        mod.attrs["attrName"],
        mod.attrs["previousValue"],
      );
    } else if (mod.attrs["type"] === "mark") {
      if (mod.attrs["previousValue"]) {
        tr.addNodeMark(
          0,
          node.type.schema.markFromJSON(mod.attrs["previousValue"]),
        );
      } else {
        tr.removeNodeMark(
          pos,
          node.type.schema.markFromJSON(mod.attrs["previousValue"]),
        );
      }
    } else if (mod.attrs["type"] === "nodeType") {
      tr.setNodeMarkup(
        pos,
        node.type.schema.nodes[mod.attrs["previousValue"] as string],
        null,
      );
    } else {
      throw new Error("Unknown modification type");
    }
  }
}

function applyModificationsToTransform(
  node: Node,
  tr: Transform,
  dir: number,
  suggestionId?: string,
) {
  const { modification } = node.type.schema.marks;
  if (!modification) {
    throw new Error(
      `Failed to apply modifications to node: schema does not contain modification mark. Did you forget to add it?`,
    );
  }

  const modificationIsInSet =
    suggestionId === undefined
      ? (marks: readonly Mark[]) => modification.isInSet(marks)
      : (marks: readonly Mark[]) =>
          modification.create({ id: suggestionId }).isInSet(marks);

  const isModification = modificationIsInSet(node.marks);

  if (isModification) {
    let prevLength: number;
    do {
      // https://github.com/ProseMirror/prosemirror/issues/1525
      prevLength = tr.steps.length;
      tr.removeNodeMark(0, modification);
    } while (tr.steps.length > prevLength);
    if (dir < 0) {
      revertModifications(node, 0, tr);
    }
  }

  node.descendants((child, pos) => {
    const isModification = modificationIsInSet(child.marks);
    if (!isModification) {
      return true;
    }

    let prevLength: number;
    do {
      // https://github.com/ProseMirror/prosemirror/issues/1525
      prevLength = tr.steps.length;
      tr.removeNodeMark(pos, modification);
    } while (tr.steps.length > prevLength);

    if (dir < 0) {
      revertModifications(child, pos, tr);
    }
    return true;
  });
}

function applySuggestionsToNode(node: Node) {
  const { deletion, insertion } = node.type.schema.marks;
  if (!deletion) {
    throw new Error(
      `Failed to apply tracked changes to node: schema does not contain deletion mark. Did you forget to add it?`,
    );
  }
  if (!insertion) {
    throw new Error(
      `Failed to apply tracked changes to node: schema does not contain insertion mark. Did you forget to add it?`,
    );
  }

  if (deletion.isInSet(node.marks)) {
    return null;
  }

  const transform = new Transform(node);
  applySuggestionsToTransform(node, transform, insertion, deletion);
  applyModificationsToTransform(node, transform, 1);
  return transform.doc;
}

export function applySuggestionsToSlice(slice: Slice) {
  const nodes: Node[] = [];
  slice.content.forEach((node) => {
    const applied = applySuggestionsToNode(node);
    if (applied) nodes.push(applied);
  });
  return new Slice(Fragment.from(nodes), slice.openStart, slice.openEnd);
}

/**
 * Command that applies all tracked changes in a document.
 *
 * This means that all content within deletion marks will be deleted.
 * Insertion marks and modification marks will be removed, and their
 * contents left in the doc.
 */
export function applySuggestions(
  state: EditorState,
  dispatch?: EditorView["dispatch"],
) {
  const { deletion, insertion } = state.schema.marks;
  if (!deletion) {
    throw new Error(
      `Failed to apply tracked changes to node: schema does not contain deletion mark. Did you forget to add it?`,
    );
  }
  if (!insertion) {
    throw new Error(
      `Failed to apply tracked changes to node: schema does not contain insertion mark. Did you forget to add it?`,
    );
  }

  const tr = state.tr;
  applySuggestionsToTransform(state.doc, tr, insertion, deletion);
  applyModificationsToTransform(tr.doc, tr, 1);
  tr.setMeta(suggestChangesKey, { skip: true });
  dispatch?.(tr);
  return true;
}

/**
 * Command that applies a given tracked change to a document.
 *
 * This means that all content within the deletion mark will be deleted.
 * The insertion mark and modification mark will be removed, and their
 * contents left in the doc.
 */
export function applySuggestion(suggestionId: string): Command {
  return (state, dispatch) => {
    const { deletion, insertion } = state.schema.marks;
    if (!deletion) {
      throw new Error(
        `Failed to apply tracked changes to node: schema does not contain deletion mark. Did you forget to add it?`,
      );
    }
    if (!insertion) {
      throw new Error(
        `Failed to apply tracked changes to node: schema does not contain insertion mark. Did you forget to add it?`,
      );
    }

    const tr = state.tr;
    applySuggestionsToTransform(
      state.doc,
      tr,
      insertion,
      deletion,
      suggestionId,
    );
    applyModificationsToTransform(tr.doc, tr, 1);
    if (!tr.steps.length) return false;
    tr.setMeta(suggestChangesKey, { skip: true });
    dispatch?.(tr);
    return true;
  };
}

/**
 * Command that reverts all tracked changes in a document.
 *
 * This means that all content within insertion marks will be deleted.
 * Deletion marks will be removed, and their contents left in the doc.
 * Modifications tracked in modification marks will be reverted.
 */
export function revertSuggestions(
  state: EditorState,
  dispatch?: EditorView["dispatch"],
) {
  const { deletion, insertion } = state.schema.marks;
  if (!deletion) {
    throw new Error(
      `Failed to apply tracked changes to node: schema does not contain deletion mark. Did you forget to add it?`,
    );
  }
  if (!insertion) {
    throw new Error(
      `Failed to apply tracked changes to node: schema does not contain insertion mark. Did you forget to add it?`,
    );
  }
  const tr = state.tr;
  applySuggestionsToTransform(state.doc, tr, deletion, insertion);
  applyModificationsToTransform(tr.doc, tr, -1);
  tr.setMeta(suggestChangesKey, { skip: true });
  dispatch?.(tr);
  return true;
}

/**
 * Command that reverts a given tracked change in a document.
 *
 * This means that all content within the insertion mark will be deleted.
 * The deletion mark will be removed, and their contents left in the doc.
 * Modifications tracked in modification marks will be reverted.
 */
export function revertSuggestion(suggestionId: string): Command {
  return (state, dispatch) => {
    const { deletion, insertion } = state.schema.marks;
    if (!deletion) {
      throw new Error(
        `Failed to apply tracked changes to node: schema does not contain deletion mark. Did you forget to add it?`,
      );
    }
    if (!insertion) {
      throw new Error(
        `Failed to apply tracked changes to node: schema does not contain insertion mark. Did you forget to add it?`,
      );
    }

    const tr = state.tr;
    applySuggestionsToTransform(
      state.doc,
      tr,
      deletion,
      insertion,
      suggestionId,
    );
    if (!tr.steps.length) return false;
    tr.setMeta(suggestChangesKey, { skip: true });
    applyModificationsToTransform(tr.doc, tr, -1);
    dispatch?.(tr);
    return true;
  };
}

/**
 * Command that updates the selection to cover an existing change.
 */
export function selectSuggestion(suggestionId: string): Command {
  return (state, dispatch) => {
    const { deletion, insertion, modification } = state.schema.marks;
    if (!deletion) {
      throw new Error(
        `Failed to apply tracked changes to node: schema does not contain deletion mark. Did you forget to add it?`,
      );
    }
    if (!insertion) {
      throw new Error(
        `Failed to apply tracked changes to node: schema does not contain insertion mark. Did you forget to add it?`,
      );
    }
    if (!modification) {
      throw new Error(
        `Failed to apply tracked changes to node: schema does not contain modification mark. Did you forget to add it?`,
      );
    }

    let changeStart = null as number | null;
    let changeEnd = null as number | null;
    state.doc.descendants((node, pos) => {
      const mark = node.marks.find(
        (mark) =>
          mark.type === insertion ||
          mark.type === deletion ||
          mark.type === modification,
      );
      if (mark?.attrs["id"] !== suggestionId) return true;
      if (changeStart === null) {
        changeStart = pos;
        changeEnd = pos + node.nodeSize;
        return false;
      }
      changeEnd = pos + node.nodeSize;
      return false;
    });
    if (changeStart === null || changeEnd === null) {
      return false;
    }
    if (!dispatch) return true;

    dispatch(
      state.tr
        .setSelection(
          TextSelection.create(
            state.doc,
            changeStart as unknown as number,
            changeEnd as unknown as number,
          ),
        )
        .scrollIntoView(),
    );
    return true;
  };
}

/** Command that enables suggest changes */
export function enableSuggestChanges(
  state: EditorState,
  dispatch?: EditorView["dispatch"],
) {
  if (!suggestChangesKey.getState(state)) return false;
  if (!dispatch) return true;

  dispatch(state.tr.setMeta(suggestChangesKey, { skip: true, enabled: true }));
  return true;
}

/** Command that disables suggest changes */
export function disableSuggestChanges(
  state: EditorState,
  dispatch?: EditorView["dispatch"],
) {
  if (!suggestChangesKey.getState(state)) return false;
  if (!dispatch) return true;

  dispatch(state.tr.setMeta(suggestChangesKey, { skip: true, enabled: false }));
  return true;
}

/** Command that toggles suggest changes on or off */
export function toggleSuggestChanges(
  state: EditorState,
  dispatch?: EditorView["dispatch"],
) {
  const pluginState = suggestChangesKey.getState(state);
  if (!pluginState) return false;
  if (!dispatch) return true;

  dispatch(
    state.tr.setMeta(suggestChangesKey, {
      skip: true,
      enabled: !pluginState.enabled,
    }),
  );
  return true;
}

/**
 * Create a suggestion transaction from a regular transaction.
 *
 * This function converts a standard ProseMirror transaction into one that
 * tracks changes as suggestions instead of applying them directly. This is
 * useful for programmatically creating suggestions outside of the normal
 * plugin flow.
 *
 * @param originalTransaction - The transaction to convert to suggestions
 * @param state - The current editor state
 * @param suggestionId - Optional custom ID for all suggestions in this transaction.
 *                      If not provided, will use the plugin's generateId function
 *                      or fall back to a default generator.
 * @returns A new transaction that tracks changes as suggestions
 *
 * @example
 * ```typescript
 * // Create a transaction that deletes and inserts as suggestions
 * const tr = state.tr.delete(10, 20).insert(15, "new text");
 * const suggestionTr = createSuggestionTransaction(tr, state, "my-edit-123");
 * dispatch(suggestionTr);
 * ```
 */
export function createSuggestionTransaction(
  originalTransaction: Transaction,
  state: EditorState,
  suggestionId?: string,
): Transaction {
  const { deletion, insertion, modification } = state.schema.marks;
  if (!deletion) {
    throw new Error(
      `Failed to create suggestion transaction: schema does not contain deletion mark. Did you forget to add it?`,
    );
  }
  if (!insertion) {
    throw new Error(
      `Failed to create suggestion transaction: schema does not contain insertion mark. Did you forget to add it?`,
    );
  }
  if (!modification) {
    throw new Error(
      `Failed to create suggestion transaction: schema does not contain modification mark. Did you forget to add it?`,
    );
  }

  // If no custom suggestion ID is provided, try to get the generator from plugin state
  let generateId: () => string;
  if (suggestionId) {
    // Use the provided ID for all operations in this transaction
    generateId = () => suggestionId;
  } else {
    try {
      // Try to get the generateId function from the plugin state
      generateId = getSuggestChangesGenerateId(state);
    } catch {
      // Fallback to a simple generator if plugin is not available
      generateId = () => {
        const timestamp = Date.now().toString();
        const randomStr = Math.random().toString(36).substring(2, 9);
        return `suggestion-${timestamp}-${randomStr}`;
      };
    }
  }

  // Create a new transaction from scratch. The original transaction
  // is going to be dropped in favor of this one.
  const trackedTransaction = state.tr;

  for (let i = 0; i < originalTransaction.steps.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const step = originalTransaction.steps[i]!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const doc = originalTransaction.docs[i]!;

    const stepTracker = getStepHandler(step);

    // Generate a new unique ID for this step (or use the provided one)
    const stepSuggestionId = generateId();

    stepTracker(
      trackedTransaction,
      state,
      doc,
      step,
      originalTransaction.steps.slice(0, i),
      stepSuggestionId,
    );
  }

  // Preserve other transaction properties
  if (originalTransaction.selectionSet && !trackedTransaction.selectionSet) {
    const originalBaseDoc = originalTransaction.docs[0];
    const base = originalBaseDoc
      ? originalTransaction.selection.map(
          originalBaseDoc,
          originalTransaction.mapping.invert(),
        )
      : originalTransaction.selection;

    trackedTransaction.setSelection(
      base.map(trackedTransaction.doc, trackedTransaction.mapping),
    );
  }

  if (originalTransaction.scrolledIntoView) {
    trackedTransaction.scrollIntoView();
  }

  if (originalTransaction.storedMarksSet) {
    trackedTransaction.setStoredMarks(originalTransaction.storedMarks);
  }

  // Copy over metadata, but mark this as a suggestion transaction
  // @ts-expect-error Preserve original transaction meta exactly as-is
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  trackedTransaction.meta = { ...originalTransaction.meta };

  // Mark this transaction to skip further processing by withSuggestChanges
  trackedTransaction.setMeta(suggestChangesKey, { skip: true });

  return trackedTransaction;
}

/**
 * Converts any ProseMirror command into a suggestion-generating version.
 *
 * This decorator wraps a regular ProseMirror command so that when executed,
 * it will create suggestions instead of directly applying changes.
 *
 * @param command - The ProseMirror command to wrap
 * @param suggestionId - Optional custom ID for suggestions created by this command
 * @returns A new command that creates suggestions
 *
 * @example
 * ```typescript
 * import { deleteSelection } from 'prosemirror-commands';
 *
 * const suggestDeleteCommand = asSuggestionCommand(deleteSelection, "delete-123");
 * suggestDeleteCommand(state, dispatch);
 * ```
 */
export function asSuggestionCommand<T extends Command>(
  command: T,
  suggestionId?: string,
): T {
  return ((
    state: EditorState,
    dispatch?: EditorView["dispatch"],
    view?: EditorView,
  ) => {
    if (!dispatch) {
      // For .can() checks, just run the original command without dispatch
      return command(state, undefined, view);
    }

    // Create a temporary transaction to capture what the command would do
    let tempTransaction = state.tr;
    let commandResult = false;

    const tempDispatch = (tr: Transaction) => {
      tempTransaction = tr;
      commandResult = true;
    };

    // Run the command with our temporary dispatch
    const result = command(state, tempDispatch, view);

    if (!result || !commandResult || !tempTransaction.docChanged) {
      // If command failed or made no changes, just run it normally
      return command(state, dispatch, view);
    }

    // Convert the captured transaction to a suggestion transaction
    const suggestionTransaction = createSuggestionTransaction(
      tempTransaction,
      state,
      suggestionId,
    );

    dispatch(suggestionTransaction);
    return true;
  }) as T;
}
