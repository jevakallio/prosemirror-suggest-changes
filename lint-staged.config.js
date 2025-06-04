/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
  "*.{tsx,ts,js,cjs,json}": ["eslint --fix", "prettier --write"],
  // If typescript files or json files (Typescript statically types .json
  // files, and package.json and tsconfig.json files can change type
  // correctness) change, we run tsc on the whole project. We use
  // incremental: true in our tsconfig, so this isn't very expensive if
  // only a few files have changed.
  //
  // Note that we use the function configuration option here, instead of
  // just a string or array of strings. lint-staged calls this function
  // with an array of filenames and expects us to produce an entire command
  // (including filename arguments). Since we just want to run check:types
  // on the whole project, not some specific files, we ignore this file list.
  "*.{tsx,ts,json}": () => "pnpm check:types",
  // Keep the table of contents up to date in the README file
  "README.md": () => "pnpm fix:toc",
  // For markdown, HTML, and YAML files, we just run Prettier. ESLint doesn't have
  // anything to say about these.
  "*.{md,yml,html,swcrc}": "prettier --write",
};
