import { type EditorState, Plugin, PluginKey } from "prosemirror-state";

export const suggestChangesKey = new PluginKey<{ enabled: boolean }>(
  "@handlewithcare/prosemirror-suggest-changes",
);

export function suggestChanges() {
  return new Plugin<{ enabled: boolean }>({
    key: suggestChangesKey,
    state: {
      init() {
        return { enabled: false };
      },
      apply(tr, value) {
        const meta = tr.getMeta(suggestChangesKey) as
          | { enabled: boolean }
          | { skip: true }
          | undefined;
        if (meta && "enabled" in meta) return meta;
        return value;
      },
    },
  });
}

export function isSuggestChangesEnabled(state: EditorState) {
  return !!suggestChangesKey.getState(state)?.enabled;
}
