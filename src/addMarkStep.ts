import { type Node } from "prosemirror-model";
import { type EditorState, type Transaction } from "prosemirror-state";
import {
  type AddMarkStep,
  type ReplaceStep,
  type Step,
  replaceStep,
} from "prosemirror-transform";

import { applySuggestionsToSlice } from "./commands.js";
import { suggestReplaceStep } from "./replaceStep.js";

/**
 * Transform an add mark step into its equivalent tracked steps.
 *
 * Add mark steps are treated as replace steps in this model. An
 * equivalent replace step will be generated, and then processed via
 * trackReplaceStep().
 */
export function trackAddMarkStep(
  trackedTransaction: Transaction,
  state: EditorState,
  doc: Node,
  step: AddMarkStep,
  prevSteps: Step[],
  suggestionId: string,
): boolean {
  const applied = step.apply(doc).doc;
  if (!applied) return false;

  // Check if the entire range is within a single existing suggestion
  const { insertion, deletion } = state.schema.marks;
  const $from = doc.resolve(step.from);
  const $to = doc.resolve(step.to);

  // Check if we're entirely within a single text node with suggestion marks
  let useExistingId = false;
  let existingId: string | undefined;

  if ($from.parent === $to.parent && $from.parent.isTextblock) {
    // Get marks at the start position
    const marksAtStart = $from.marks();
    const suggestionMarkAtStart = marksAtStart.find(
      (mark) => mark.type === insertion || mark.type === deletion,
    );

    if (suggestionMarkAtStart) {
      // Check if the entire range has the same suggestion mark
      let allHaveSameMark = true;
      for (let pos = step.from; pos < step.to; pos++) {
        const $pos = doc.resolve(pos);
        const marks = $pos.marks();
        const hasSameMark = marks.some(
          (mark) =>
            (mark.type === insertion || mark.type === deletion) &&
            mark.attrs["id"] === suggestionMarkAtStart.attrs["id"],
        );
        if (!hasSameMark) {
          allHaveSameMark = false;
          break;
        }
      }

      if (allHaveSameMark) {
        useExistingId = true;
        existingId = suggestionMarkAtStart.attrs["id"] as string;
      }
    }
  }

  // Use existing suggestion ID if the entire range is within one suggestion
  const markId = useExistingId && existingId ? existingId : suggestionId;

  // Only apply suggestions if we're not within an existing suggestion
  const slice = applied.slice(step.from, step.to);
  const processedSlice = useExistingId ? slice : applySuggestionsToSlice(slice);

  const replace = replaceStep(doc, step.from, step.to, processedSlice);
  if (!replace) return false;

  return suggestReplaceStep(
    trackedTransaction,
    state,
    doc,
    replace as ReplaceStep,
    prevSteps,
    markId,
  );
}
