export {
  selectSuggestion,
  revertSuggestion,
  revertSuggestions,
  applySuggestion,
  applySuggestions,
  enableSuggestChanges,
  disableSuggestChanges,
  toggleSuggestChanges,
} from "./commands.js";

export {
  addSuggestionMarks,
  insertion,
  deletion,
  modification,
} from "./schema.js";

export { getSuggestionDecorations } from "./decorations.js";

export {
  suggestChanges,
  suggestChangesKey,
  isSuggestChangesEnabled,
} from "./plugin.js";

export { withSuggestChanges } from "./withSuggestChanges.js";
