# Note Launcher

An Obsidian plugin that opens one quick-switcher-style picker from anywhere in the app, listing the notes related to the note in focus alongside lists you define by property, folder or link.

## What it does

The plugin adds a "Jump to note" command. It replaces a Templater script that did the same job but needed an open editor to run, so the command now works from any tab, from the sidebar, or with no tab open at all. A second command, "Set properties", is described below.

With a markdown note in focus, the picker can show that note's relation lists: its adjacent date notes, the notes it links to (links in properties included), the notes that link to it, and the notes from the same day. The other lists do not depend on the note in focus. The picker shows the lists in the order you set, and with anything else in focus, or no tab at all, it leaves out the relation lists.

Each note appears once, under the first list that holds it, and the note in focus is left out. Within a list the notes are sorted by name. When no list has any note, the command says "No notes to jump to." instead of opening an empty picker.

## Rows and matching

Every row reads `<prefix> <note name>`, where the prefix is the one set for its list, separator included, so the default `🔗 out |` gives `🔗 out | Project`. A list with an empty prefix shows the note name alone. A date note adds its period in parentheses: the weekday for a day note, `week N` for a week note, `month - <Month>` for a month note and `year` for a year note, as in `🔗 out | 2024-03-05 (Tuesday)`. Rows in the adjacent dates list also say which way they point, as in `📅 day | 2024-03-06 (next day - Wednesday)` or `📅 day | 2024-W09 (prev week - week 9)`.

Typing filters the rows by in-order matching: a row stays when the characters you typed appear in it in the same order, ignoring case, with anything in between. Because the prefix is part of the row, typing part of a prefix narrows the picker towards that list. Picking a row opens the note in the active tab, or in a new tab when none is open.

## Date notes

A note is a date note when it sits directly in the folder set for its period and its name matches that period's format exactly. There are five periods, day, week, month, quarter and year, and each has its own folder, format and on/off switch.

The adjacent dates list holds the previous and next note of the same period as the date note in focus, when those notes exist. The same day list holds the notes created on the same day as the note in focus; for a day note it uses the date in its name rather than when the file was created.

Two limits follow from matching the name inside the period's folder. A day format containing `/`, such as `YYYY/MM/DD`, never matches, because the name is compared without its folders. And with the default formats, year notes such as `on/2024` count as date notes too, so turn the year period off under Custom if you keep other notes named after a year in that folder.

## Settings

Settings fit a narrow window and work the same on mobile. Under "Jump to note", which picks a note related to the one in focus, there is one row per list, in the order the picker shows them. Each row shows the list's prefix and what it lists, and says "off" when the list is hidden from the picker. Drag a row to reorder the lists, delete it to remove the list, or use "Add list" to add one; a new list starts switched off, so it stays out of the picker until you open it and fill it in.

Opening a row shows the list's page. "Enabled" shows or hides the list, "Prefix" sets the text each of its rows starts with, and "Source" chooses what it lists: adjacent dates, outbound links, inbound links, same day, notes with a property, notes linking to a note, notes in a folder, or notes modified today. The default lists are the four relations, with the prefixes `📅 day |`, `🔗 out |`, `🔗 in  |` and `🔅 ctx |`. Settings saved by an earlier version, whose prefixes had no separator, get ` |` appended once when they load.

A "Links to note" list asks for a note and lists the notes that link to it, in their text or in a property. An "In folder" list asks for a folder and lists the notes in it and in its subfolders. A "Modified today" list asks for nothing and lists the notes changed since midnight.

A property list asks for the property, suggesting the vault's properties with their types, then a condition offered for that type:

- Checkbox properties can be true, false, set or not set. "Is false" needs an explicit `false`.
- Text properties can be equal to a value, contain it, be set or not set.
- List, tag and alias properties can have an item equal to the value, be set or not set. Wiki-links are compared by their link text, so `[[Project]]` matches the value `Project`.
- Number properties can be equal to, less than or greater than a number, or be set.
- Date properties can be on, before or after a fixed date, today, or a number of days ago or from now, or be set. A relative date is worked out each time the picker opens.

"Is not set" also matches a property left blank. If a property later changes type, its list keeps the old condition and its page says the condition no longer applies; the list shows nothing until you pick a new one. Lists saved by an earlier version with an "equals" condition on a number, checkbox or date property show it as "(does not apply)" in the same way, until you edit it.

The "Date notes" section's "Read from" row chooses where the formats come from, and its description says what each period is read from. "Automatic" uses the Periodic Notes plugin when it is enabled, then the core Daily notes plugin, then the plugin's own Custom formats. Daily notes covers days only, so the other periods come from Custom. Whenever a period comes from Custom, a pencil on the row opens its formats, where you set each period's folder and format, as a [Moment format](https://momentjs.com/docs/#/displaying/format/), and switch it on or off. By default every period lives in `on/`, as `2024-03-05`, `2024-W10`, `2024-03` and `2024`, with quarters such as `2024-Q1` switched off.

## Set properties

The "Set properties" command edits the properties of the markdown note in focus from one picker, and only appears in the command palette when such a note has focus. It replaces the Templater script that set a note's flags and links.

The main picker lists properties, never notes. Its first two rows are always `🏁 Save & close` and `🛑 Cancel`, followed by one row per enabled property in settings order, reading `<prefix> <property>` and the value the property will be saved with: `true` or `false`, the text, number or date itself, the titles of the linked notes joined by commas, or `—` when it is unset. A row whose value you changed is marked `•`. Nothing is written until you choose "Save & close", which writes only the properties you changed, and Escape or "Cancel" discards every change.

Choosing a row opens that property's own picker, where the row matching the current value is marked `✓` and the last row, `🗑️ Clear`, removes the property. Escape there returns to the main picker without changing anything.

- A checkbox offers `true` and `false`, so it can now be saved as `false`.
- Text offers `✏️ Use "<what you typed>"` and the values the property already has in the vault, most used first. Number does the same, offering "Use" only for a number.
- A date offers "Use" for a date typed as `YYYYMMDD` or `YYYY-MM-DD`, then Today, Tomorrow, Next Monday and In a week, and is saved as `YYYY-MM-DD`. A date with a time offers "Use" for `YYYYMMDD HHmm`, `YYYY-MM-DD HH:mm` or `YYYY-MM-DDTHH:mm`, then Now, and is saved as `YYYY-MM-DDTHH:mm`.
- A link offers the notes from its source, selected first and then the most recently modified. Choosing a note sets it as `"[[Note]]"` and returns, and choosing the selected note clears it.
- Links offer the same notes under `↩ Done`. Choosing a note switches it on or off and keeps the picker open, Done returns with the changes, and Escape drops every change made since the picker opened. Links are saved as a list such as `["[[Alice]]", "[[Bob]]"]`, and links the property already holds that the source does not offer are kept.

Link pickers never offer the note in focus, notes in the property's left-out folder or notes with `archived: true`.

Its settings sit under "Set properties", after the jump lists, as one list of typed properties. Each row reads `<prefix> <property> · <type>`, or "New property" until a property is chosen, and works like a jump list row: switch it on or off, drag it to reorder the picker, delete it, or use "Add property", which adds a checkbox switched off. Several rows may write the same property, such as the default `related` rows with different sources; they share one value, and the first enabled row decides its type. A row says so when two rows for one property disagree on type.

Opening a row shows the property's page: "Enabled", "Prefix", "Property", which suggests the vault's properties with their types, and "Type", which can be checkbox, text, number, date, datetime, link for one note or links for several. Picking a property from the suggestions sets its type from the vault's: checkbox, number, date and datetime keep theirs, lists and tags become links, and anything else becomes text. "Type" stays disabled until a property is chosen. A link or links property also has "Offer notes from", the same source a jump list has, and "Leave out folder", whose notes are never offered. The defaults are a checkbox each for active, someday, evergreen, blocked and archived, and links for people, trackers, collections, the category, evergreen and active notes, companies and notes modified today, all leaving out `templates`.

Settings saved by an earlier version move to this list when they load: each flag becomes a checkbox with the flags prefix, and each link list becomes a links property, or a link property in single mode, keeping its id, prefix, source and property and leaving out the old templates folder.

## Differences from the Templater script

The command runs without an editor, so it works from any view. The category column is gone, because the prefix already says which list a row came from. The lists and their prefixes are configurable in settings instead of being fixed in the script.

## Installation

Once the plugin is listed in the community browser, open Settings → Community plugins → Browse, search for Note Launcher, then install and enable it.

To install it by hand, download `main.js`, `manifest.json` and `styles.css` from a release, put them in `<vault>/.obsidian/plugins/note-launcher/`, and enable Note Launcher under Settings → Community plugins. It needs Obsidian 1.13.0 or later and runs on both desktop and mobile.

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
