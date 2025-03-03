import { Plugin, PluginKey, type Transaction } from "prosemirror-state";
import { transformToSuggestionTransaction } from "./suggestionTransactions.js";

class SuggestChangesPlugin extends Plugin<{ enabled: boolean }> {
  public filteredTransaction: Transaction | undefined;
}

export const suggestChangesKey = new PluginKey<{ enabled: boolean }>(
  "@handlewithcare/prosemirror-suggest-changes",
);

export const suggestChanges = new SuggestChangesPlugin({
  filteredTransactions: [],
  state: {
    init() {
      return { enabled: false };
    },
    apply(tr, value) {
      const meta = tr.getMeta(suggestChangesKey) as
        | { enabled: boolean }
        | undefined;
      if (meta) return meta;
      return value;
    },
  },
  filterTransaction(tr, state) {
    const plugin = suggestChangesKey.get(state) as SuggestChangesPlugin;
    const pluginState = suggestChangesKey.getState(state);
    if (!pluginState?.enabled) return true;
    plugin.filteredTransaction = tr;
    return false;
  },
  appendTransaction(_trs, _oldState, newState) {
    const plugin = suggestChangesKey.get(newState) as SuggestChangesPlugin;
    const pluginState = suggestChangesKey.getState(newState);
    if (!pluginState?.enabled) return;
    if (!plugin.filteredTransaction) return;
    return transformToSuggestionTransaction(
      plugin.filteredTransaction,
      newState,
    );
  },
});
