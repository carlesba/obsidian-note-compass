# Note Launcher

An Obsidian plugin that opens one quick-switcher-style picker from anywhere in the app, listing the notes related to the note in focus alongside lists you define by property, folder or link.

## What it does

The plugin adds a "Jump to note" command. It replaces a Templater script that did the same job but needed an open editor to run, so the command now works from any tab, from the sidebar, or with no tab open at all. Two more commands, "Set properties" and "Create note", are described below.

With a markdown note in focus, the picker can show that note's relation lists: its adjacent date notes, the notes it links to (links in properties included), the notes that link to it, and the notes from the same day. The other lists do not depend on the note in focus. The picker shows the lists in the order you set, and with anything else in focus, or no tab at all, it leaves out the relation lists.

Each note appears once, under the first list that holds it, and the note in focus is left out. Within a list the notes are sorted by name. When no list has any note, the command says "No notes to jump to." instead of opening an empty picker.

## Rows and matching

Every row reads `<prefix> <note name>`, where the prefix is the one set for its list and shows as a muted chip that keeps it apart from the name, so the default `🔗 out` gives `🔗 out Project`. Every chip in a picker is as wide as the widest one, up to about twelve characters with longer prefixes cut short, so the names after them line up, and a list with a prefix colour tints its chips with it. A list with an empty prefix shows the note name alone. A date note adds its period in parentheses: the weekday for a day note, `week N` for a week note, `month - <Month>` for a month note and `year` for a year note, as in `🔗 out 2024-03-05 (Tuesday)`. Rows in the adjacent dates list also say which way they point, as in `📅 day 2024-03-06 (next day - Wednesday)` or `📅 day 2024-W09 (prev week - week 9)`.

Typing filters the rows by in-order matching: a row stays when the characters you typed appear in it in the same order, ignoring case, with anything in between. Because the prefix is part of the row, typing part of a prefix narrows the picker towards that list. Picking a row opens the note in the active tab, or in a new tab when none is open.

## Date notes

A note is a date note when it sits directly in the folder set for its period and its name matches that period's format exactly. There are five periods, day, week, month, quarter and year, and each has its own folder, format and on/off switch.

The adjacent dates list holds the previous and next note of the same period as the date note in focus, when those notes exist. The same day list holds the notes created on the same day as the note in focus; for a day note it uses the date in its name rather than when the file was created.

Two limits follow from matching the name inside the period's folder. A day format containing `/`, such as `YYYY/MM/DD`, never matches, because the name is compared without its folders. And with the default formats, year notes such as `on/2024` count as date notes too, so turn the year period off under Custom if you keep other notes named after a year in that folder.

## Settings

Settings fit a narrow window and work the same on mobile. The first group, "Display", holds "Show prefixes", which is on by default. Turning it off removes the prefix from every picker row, in Jump to note, Set properties and Create note, and leaves it out of what typing matches. Link rows in Set properties then name the property they write as their value instead, as in `✓ Marta Vidal · people` or `Joan Puig · people`, and the `… N more, type to filter` row types the property name. The settings rows lose their prefix chips and the list and property pages hide their "Prefix" and "Prefix colour" fields, but the prefixes and their colours stay saved, so turning the setting back on restores them.

Under "Jump to note", which picks a note related to the one in focus, there is one row per list, in the order the picker shows them. Each row shows the list's prefix and what it lists, and says "off" when the list is hidden from the picker. The prefix sits in a muted chip at the start of the row, or as a faint `prefix` chip when it is empty. The chips in one list share the width of its widest chip, so the row names line up. Click the chip, or focus it and press Enter, to edit the prefix in place. A colour swatch and a "Remove colour" button sit beside the text while you edit, and the chip previews the colour as you pick it. Enter or clicking away saves both, and Escape leaves both unchanged. Drag a row to reorder the lists, delete it to remove the list, or use "Add list" to add one; a new list starts switched off, so it stays out of the picker until you open it and fill it in.

Opening a row shows the list's page. "Enabled" shows or hides the list, "Prefix" sets the text each of its rows starts with, "Prefix colour" tints its chip in the pickers and settings, "Remove prefix colour" brings back the plain grey chip, and "Source" chooses what it lists: adjacent dates, outbound links, inbound links, same day, notes with a property, notes linking to a note, notes in a folder, or notes modified today. The default lists are the four relations, with the prefixes `📅 day`, `🔗 out`, `🔗 in` and `🔅 ctx`. The chip provides the spacing a separator used to, so a prefix saved with a trailing `|` loses it when settings load.

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

The main picker sets values directly. Its first two rows are always `🏁 Save & close` and `🛑 Cancel`. Nothing is written until you choose "Save & close", which writes only the properties you changed, and Escape or "Cancel" discards every change.

Next come the values the note will be saved with, each marked `✓`: one row per linked note, showing its title, and one row for a checkbox, text, number or date with the value beside it. A value is listed once even when several properties in the settings write it, such as the default `related` rows. A value you changed is also marked `•`. Choosing a set link or text removes it, so a links property loses that one note, while choosing a set checkbox, number or date opens its own picker.

Then each enabled property in settings order offers what it can add:

- A link or links property lists the notes from its source that are not set yet, as `<prefix> <note>`, most recently modified first. Choosing one adds it to links, or replaces the note a link holds. Links are saved as a list such as `["[[Alice]]", "[[Bob]]"]`, and links the property already holds that the source does not offer are kept.
- A text property lists the values it already has in the vault, most used first. Choosing one replaces the value. While you type something no value matches, it also offers `✏️ <prefix> <property>: use "<what you typed>"`.
- A checkbox, number, date or datetime property that is not set shows one row, `<prefix> <property>`, which opens its own picker.

With nothing typed, each property shows at most five values, followed by `<prefix> … N more, type to filter`, which types the prefix for you. Once you type, every matching row is shown. After you choose a value the picker reopens with what you typed, so the note you just picked shows up at the top as set.

The picker only links notes that already exist. To link a new note, make it first with "Create note" and then run "Set properties".

A property's own picker marks its current value `✓`, ends with `🗑️ Clear`, which removes the property, and returns to the main picker on Escape without changing anything.

- A checkbox offers `true` and `false`, so it can now be saved as `false`.
- A number offers `✏️ Use "<what you typed>"` for a number and the numbers the property already has in the vault, most used first.
- A date offers "Use" for a date typed as `YYYYMMDD` or `YYYY-MM-DD`, then Today, Tomorrow, Next Monday and In a week, and is saved as `YYYY-MM-DD`. A date with a time offers "Use" for `YYYYMMDD HHmm`, `YYYY-MM-DD HH:mm` or `YYYY-MM-DDTHH:mm`, then Now, and is saved as `YYYY-MM-DDTHH:mm`.

Link properties never offer the note in focus, notes in the property's excluded folders or notes with `archived: true`. Rows read in columns: marks and action icons such as `🏁` and `🛑` sit in their own column, the prefix shows as a muted chip, the name follows it, and a value follows the name in muted text after a `·`. "Jump to note" draws its rows the same way, without the mark column.

Its settings sit under "Set properties", after the jump lists, as one list of typed properties. Each row reads `<property> · <type>` after its prefix chip, or "New property" until a property is chosen, and works like a jump list row: click the chip to edit the prefix, switch it on or off, drag it to reorder the picker, delete it, or use "Add property", which adds a checkbox switched off. Several rows may write the same property, such as the default `related` rows with different sources; they share one value, and the first enabled row decides its type. A row says so when two rows for one property disagree on type.

Opening a row shows the property's page: "Enabled", "Prefix", "Prefix colour" as on a list's page, "Property", which suggests the vault's properties with their types, and "Type", which can be checkbox, text, number, date, datetime, link for one note or links for several. Picking a property from the suggestions sets its type from the vault's: checkbox, number, date and datetime keep theirs, lists and tags become links, and anything else becomes text. "Type" stays disabled until a property is chosen. A link or links property also has "Offer notes from", the same source a jump list has, then "Excluded folders", a list of folders whose notes are never offered: the `+` in its header adds a folder row and each row can be deleted, while an empty row excludes nothing. Its last section, "Create notes", decides whether the property appears in the "Create note" command. "Allow creating notes" switches that on; it is disabled, with the reason beside it, for a source that cannot hold a new note, such as a relation source or a condition with no value to write. Once it is on, "Folder" sets where new notes go, except for an "In folder" source, whose folder decides, and "Template" sets the note a new note starts from. Templater runs the template when it is enabled; otherwise `{{title}}`, `{{date}}` and `{{time}}` are filled in as the core Templates plugin does. Left empty, the folder is where Obsidian puts new notes, and the note still gets the link or property its source needs. The defaults are a checkbox each for active, someday, evergreen, blocked and archived, and links for people, trackers, collections, the category, evergreen and active notes, companies and notes modified today, all leaving out `templates` and none allowing note creation.

Settings saved by an earlier version move to this list when they load: each flag becomes a checkbox with the flags prefix, and each link list becomes a links property, or a link property in single mode, keeping its id, prefix, source and property and leaving out the old templates folder. A link property saved with a single left-out folder keeps it as its only excluded folder, and one saved before "Allow creating notes" existed has it on only when it set a new note folder or template.

## Create note

The "Create note" command makes a new note that belongs to one of the link properties from "Set properties", so that property offers it from then on. It works with or without a note in focus, and it neither opens the new note nor links it anywhere.

It works in two steps. The first picker, "Create a note for…", has one row per enabled link or links property with "Allow creating notes" on whose source can hold a new note: notes in a folder, notes linking to a note, notes modified today, and property lists whose condition gives a value to write, such as "is true", "is", "has item", or "is set" on a checkbox. The relation sources and conditions such as "greater than" have no row. Several rows writing the same property, like the default `related` rows, each get their own row because their sources differ. Each row reads `<prefix> <property>` with the folder the note will go to beside it, or `vault root`, and typing filters the rows as in the other pickers. When no property qualifies, the command says "No link property can create notes." instead of opening the picker.

Choosing a row opens the second prompt, "Name of the new <property> note…", which shows a single row for what you type. With nothing typed it reads `Type a name`. A name with characters Obsidian cannot use in a file name, or a name any note in the vault already has, ignoring folder and case, gets a row saying so, as in `"Ann" already exists at people/Ann.md.`, because a second note with that name would make `[[Ann]]` links ambiguous. Choosing one of these rows keeps the prompt open with what you typed. A usable name reads `➕ <prefix> Create "<name>" in <folder>`, and Escape goes back to the first picker.

Choosing it creates the note and says where, as in `Created "John" in people.`; if a note already exists at that path, it is left untouched and the command says so. The note goes in the source's folder for an "In folder" source, otherwise in the property's "Folder" under "Create notes", otherwise where Obsidian puts new notes. It then joins the source: it links to the source's note at the end of its body, unless its content already links there, or it gets the property its condition asks for, such as `true` for "is true", the value for "is" or a list with the value for "has item".

When the property has a "Template" under "Create notes" and the Templater plugin is enabled, Templater creates the note from it, so its `<% %>` commands run, and the link or property is added afterwards. If Templater fails, nothing more is done. Without Templater, the template's content is copied and `{{title}}` becomes the note's name, while `{{date}}` and `{{time}}` become the current date and time in the formats set in the core Templates plugin, `YYYY-MM-DD` and `HH:mm` by default, and `{{date:FORMAT}}` or `{{time:FORMAT}}` use the format given, as the core plugin does.

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
