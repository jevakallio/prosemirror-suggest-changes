export {
  selectSuggestion as selectChange,
  revertSuggestion as revertTrackedChange,
  revertSuggestions as revertTrackedChanges,
  applySuggestion as applyTrackedChange,
  applySuggestions as applyTrackedChanges,
} from "./commands.js";

export {
  addSuggestionMarks,
  insertion,
  deletion,
  modification,
} from "./schema.js";

export { getSuggestionDecorations } from "./decorations.js";

export { suggestChanges, suggestChangesKey } from "./plugin.js";
