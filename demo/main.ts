import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { inputRules, wrappingInputRule } from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import { EditorState, Plugin } from "prosemirror-state";
import {
  isSuggestChangesEnabled,
  suggestChanges,
  toggleSuggestChanges,
  withSuggestChanges,
} from "../src/index.js";
import { EditorView } from "prosemirror-view";
import "prosemirror-view/style/prosemirror.css";
import { nodes, marks } from "prosemirror-schema-basic";
import { bulletList, listItem, orderedList } from "prosemirror-schema-list";
import { addSuggestionMarks } from "../src/index.js";
import { Schema } from "prosemirror-model";

export const schema = new Schema({
  nodes: {
    ...nodes,
    image: { ...nodes.image, group: "block", inline: false },
    doc: { ...nodes.doc, marks: "insertion deletion modification" },
    ordered_list: { ...orderedList, group: "block", content: "list_item+" },
    bullet_list: { ...bulletList, group: "block", content: "list_item+" },
    list_item: { ...listItem, content: "block+" },
  },
  marks: addSuggestionMarks(marks),
});

const editorState = EditorState.create({
  schema,
  plugins: [
    inputRules({
      rules: [wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.list)],
    }),
    history(),
    suggestChanges(),
  ],
});

const suggestChangesUiPlugin = new Plugin({
  view(view) {
    const button = document.createElement("button");
    button.appendChild(document.createTextNode("Enable suggestions"));
    button.addEventListener("click", () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      toggleSuggestChanges(view.state, view.dispatch);
      view.focus();
    });
    view.dom.parentElement?.prepend(button);
    return {
      update() {
        if (isSuggestChangesEnabled(view.state)) {
          button.replaceChildren(
            document.createTextNode("Disable suggestions"),
          );
        } else {
          button.replaceChildren(document.createTextNode("Enable suggestions"));
        }
      },
      destroy() {
        button.remove();
      },
    };
  },
});

const plugins = [
  keymap({
    ...baseKeymap,
    "Mod-i": toggleMark(schema.marks.em),
    "Mod-b": toggleMark(schema.marks.strong),
    "Mod-Shift-c": toggleMark(schema.marks.code),
    "Mod-z": undo,
    "Mod-Shift-z": redo,
    "Mod-y": redo,
  }),
  suggestChangesUiPlugin,
];

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const editorEl = document.getElementById("editor")!;

new EditorView(editorEl, {
  state: editorState,
  plugins,
  dispatchTransaction: withSuggestChanges(),
});
