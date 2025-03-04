# @handlewithcare/prosemirror-suggest-changes

## Installation

Install `@handlewithcare/prosemirror-suggest-changes` and its peer dependencies:

npm:

```sh
npm install @handlewithcare/prosemirror-suggest-changes prosemirror-view prosemirror-transform prosemirror-state prosemirror-model
```

yarn:

```sh
yarn add @handlewithcare/prosemirror-suggest-changes prosemirror-view prosemirror-transform prosemirror-state prosemirror-model
```

## Usage

First, add the suggestion marks to your schema:

```ts
import { addSuggestionMarks } from "@handlewithcare/prosemirror-suggest-changes";

export const schema = new Schema({
  nodes: {
    ...nodes,
    doc: {
      ...nodes.doc,
      // We need to allow these marks as block marks as well,
      // to support block-level suggestions, like inserting a
      // new list item
      marks: "insertion modification deletion",
    },
  },
  marks: addSuggestionMarks(marks),
});
```

Then, add the plugin to your editor state:

```ts
import { suggestChanges } from "@handlewithcare/prosemirror-suggest-changes";

const editorState = EditorState.create({
  schema,
  doc,
  plugins: [
    // ... your other plugins
    suggestChanges(),
  ],
});
```

Use the `dispatchTransaction` decorator to intercept and transform transactions,
and add suggestion decorations:

```ts
import {
  withSuggestChanges,
  getSuggestionDecorations,
} from "@handlewithcare/prosemirror-suggest-changes";

const editorEl = document.getElementById("editor")!;

const view = new EditorView(editorEl, {
  state: editorState,
  decorations: getSuggestionDecorations,
  dispatchTransaction: withSuggestChanges(),
});
```

And finally, use the commands to control the suggest changes state, apply
suggestions, and revert suggestions. Here’s a sample view plugin that renders a
simple menu with some suggestion-related commands:

```ts
import {
  toggleSuggestChanges,
  applySuggestions,
  revertSuggestions,
  isSuggestChangesEnabled,
} from "@handlewithcare/prosemirror-suggest-changes";

const suggestChangesViewPlugin = new Plugin({
  view(view) {
    const toggleButton = document.createElement("button");
    toggleButton.appendChild(document.createTextNode("Enable suggestions"));
    toggleButton.addEventListener("click", () => {
      toggleSuggestChanges(view.state, view.dispatch);
      view.focus();
    });

    const applyAllButton = document.createElement("button");
    applyAllButton.appendChild(document.createTextNode("Apply all"));
    applyAllButton.addEventListener("click", () => {
      applySuggestions(view.state, view.dispatch);
      view.focus();
    });

    const revertAllButton = document.createElement("button");
    revertAllButton.appendChild(document.createTextNode("Revert all"));
    revertAllButton.addEventListener("click", () => {
      revertSuggestions(view.state, view.dispatch);
      view.focus();
    });

    const commandsContainer = document.createElement("div");
    commandsContainer.append(applyAllButton, revertAllButton);

    const container = document.createElement("div");
    container.classList.add("menu");
    container.append(toggleButton, commandsContainer);

    view.dom.parentElement?.prepend(container);

    return {
      update() {
        if (isSuggestChangesEnabled(view.state)) {
          toggleButton.replaceChildren(
            document.createTextNode("Disable suggestions"),
          );
        } else {
          toggleButton.replaceChildren(
            document.createTextNode("Enable suggestions"),
          );
        }
      },
      destroy() {
        container.remove();
      },
    };
  },
});
```

## How it works

This library provides three mark types:

- `insertion` represents newly inserted content, including new text content and
  new
