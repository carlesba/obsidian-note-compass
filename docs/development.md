# Development

How to build, test and try Note Compass from its source, and how to help with translations.

[← Back to the README](../README.md)

## Commands

The project uses npm scripts for every step.

```bash
npm ci
npm run dev
npm run build
npm test
npm run lint
```

| Command | Does |
| --- | --- |
| `npm ci` | Installs the dependencies. |
| `npm run dev` | Rebuilds on every change. |
| `npm run build` | Typechecks and writes the production bundle. |
| `npm test` | Runs the unit tests. |
| `npm run lint` | Runs the same Obsidian lint rules the community review applies. |

## Trying the plugin in a test vault

Symlink the repository into the vault's plugins folder, so the vault always loads the build `npm run dev` just wrote:

```bash
ln -s "$PWD" "<vault>/.obsidian/plugins/note-compass"
```

## Translations

The translations live in `src/i18n/`, and the manual is also available in each of those languages from the links at the top of the README. Both were drafted by machine, so some wording may read oddly, and the English manual is the reference.

Corrections are welcome as pull requests. Adding a language takes one new file in that folder and one line in its registry, and any text a language does not translate yet shows in English.
