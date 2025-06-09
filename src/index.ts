export {
  addSuggestionMarks,
  insertion,
  deletion,
  modification,
} from "./schema.js";

export {
  selectSuggestion,
  revertSuggestion,
  revertSuggestions,
  applySuggestion,
  applySuggestions,
  applySuggestionsToSlice,
  createSuggestionTransaction,
  enableSuggestChanges,
  disableSuggestChanges,
  toggleSuggestChanges,
  asSuggestionCommand,
} from "./commands.js";

export {
  suggestChanges,
  suggestChangesKey,
  isSuggestChangesEnabled,
  getSuggestChangesGenerateId,
  type SuggestChangesOptions,
  type SuggestChangesPluginState,
} from "./plugin.js";

export { withSuggestChanges } from "./withSuggestChanges.js";
