# Note Launcher

An Obsidian plugin that opens one quick-switcher-style picker from anywhere in the app, listing the notes related to the note in focus alongside lists you define by frontmatter.

## What it does

The plugin adds a "Jump to note" command. It replaces a Templater script that did the same job but needed an open editor to run, so the command now works from any tab, from the sidebar, or with no tab open at all.

With a markdown note in focus, the picker shows that note's relation lists first: its adjacent date notes, the notes it links to (frontmatter links included), the notes that link to it, and the notes from the same day. Your custom lists follow. With anything else in focus, or no tab at all, the picker shows only the custom lists.

Each note appears once, under the first list that holds it, and the note in focus is left out. Within a list the notes are sorted by name. When no list has any note, the command says "No notes to jump to." instead of opening an empty picker.

## Rows and matching

Every row reads `<prefix> | <note name>`, where the prefix is the one set for its list. A date note adds its period in brackets: the weekday for a day note, `week N` for a week note, `month - <Month>` for a month note and `year` for a year note, as in `🔗 out | 2024-03-05 (Tuesday)`. Rows in the adjacent dates list also say which way they point, as in `📅 day | 2024-03-06 (next day - Wednesday)` or `📅 day | 2024-W09 (prev week - week 9)`.

Typing filters the rows by in-order matching: a row stays when the characters you typed appear in it in the same order, ignoring case, with anything in between. Because the prefix is part of the row, typing part of a prefix narrows the picker towards that list. Picking a row opens the note in the active tab, or in a new tab when none is open.

## Date notes

A note counts as a date note when its frontmatter `period` is `day`, `week`, `month` or `year`, or when it sits under `on/` and its name is a day (`2024-03-05`), an ISO week (`2024-W10`) or a month (`2024-03`).

The adjacent dates list holds the previous and next day, week or month of the date note in focus, when those notes exist anywhere in the vault. The same day list holds the notes created on the same day as the note in focus; for a day note it uses the date in its name rather than when the file was created.

## Settings

Under "Built-in lists" there is one row per relation list, in picker order: "Adjacent dates", "Outbound links", "Inbound links" and "Same day". Each row has a prefix text field and a toggle that shows or hides the list. The default prefixes are `📅 day`, `🔗 out`, `🔗 in ` and `🔅 ctx`.

Under "Custom lists" each list shows every note in the vault whose frontmatter property matches. A list has a prefix, a property name and an operator:

- "Is true" matches when the property is `true` or the text `"true"`.
- "Equals" matches when the property equals the value.
- "Contains" matches when the property is a list with an item equal to the value, or text that contains the value. Wiki-links are compared by their link text, so `[[Project]]` matches the value `Project`.
- "Exists" matches when the note has the property with any value; a property left blank does not count.

The value field appears only for "Equals" and "Contains". The trash button removes a list, and "Add custom list" below the lists adds one.

## Differences from the Templater script

The command runs without an editor, so it works from any view. The category column is gone, because the prefix already says which list a row came from. The lists and their prefixes are configurable in settings instead of being fixed in the script.

## Installation

Once the plugin is listed in the community browser, open Settings → Community plugins → Browse, search for Note Launcher, then install and enable it.

To install it by hand, download `main.js`, `manifest.json` and `styles.css` from a release, put them in `<vault>/.obsidian/plugins/note-launcher/`, and enable Note Launcher under Settings → Community plugins. It needs Obsidian 1.7.2 or later and runs on both desktop and mobile.

## Development

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
```

`npm run dev` rebuilds on every change, `npm run build` typechecks and writes the production bundle, and `npm test` runs the unit tests.

Install into a test vault by symlinking the repository itself, so the plugin always loads the build `npm run dev` just wrote:

```bash
ln -s "$PWD" "<vault>/.obsidian/plugins/note-launcher"
```

## License

[MIT](LICENSE).
