# Jump to note

A navigation picker shows the notes related to the note in focus and the lists you define, so you can move to any of them in a few keystrokes. You can create several named navigation pickers, each with its own lists and its own command.

[← Back to the README](../README.md)

## Navigation pickers

Each navigation picker you create under Settings → Note Compass → Navigation is offered in the command palette as "Navigation: <name>", so you can give each one its own hotkey. A new install starts with one picker named "Default", and the lists saved before navigation pickers existed move into it unchanged.

A picker's own filter, under Settings → Note Compass → Navigation → the picker, narrows all of its lists at once, such as leaving out notes in an `Archive` folder from every list. It applies to the date notes a list would create too, as if they were notes with no properties or tags.

"Jump to note" asks "Open which navigation picker?" and lists every enabled picker, then opens the one you choose.

## The picker

The picker lets you choose a note to move to. Picking a row opens the note in the active tab, or in a new tab when none is open.

![The Jump to note picker on a daily note, with the previous and next day, its outbound links, a note from the same day, this week, month and year, the active projects and the people](images/jump-to-note.png)

A picker shows the lists you set up on its page in settings, in the order you set. To change them, see [Settings](settings.md#list-pages).

- A note appears under every list that holds it, in the order of your lists.
- The note in focus is left out.
- Within a list the notes are sorted by name.
- When no list has any note, the command says "No notes to jump to." instead of opening an empty picker.

## Lists

Each list is built from a source, which decides what notes it holds.

### Relation lists

These four lists depend on the markdown note in focus. They are left out when anything else has focus or no tab is open.

| List | What it holds |
| --- | --- |
| Adjacent dates | The date notes just before and after the note in focus, for every period: the previous and next day, week, month, quarter and year, as in `📅 day 2024-03-06 (next day - Wednesday)` or `📅 day 2024-W09 (prev week - week 9)`. Periods shorter than the note in focus are skipped, so a week note lists no days. You choose which entries to list, in which order, and whether missing ones are offered, as described in [Settings](settings.md#list-pages). |
| Outbound links | The notes the note in focus links to, links in properties included. |
| Inbound links | The notes that link to the note in focus. |
| Same day | The notes created on the same day as the note in focus. For a day note it uses the date in its name rather than when the file was created. |

### Other lists

These lists do not depend on the note in focus.

| List | What it holds |
| --- | --- |
| Filter | The notes that match a set of conditions, such as `status is active`, notes tagged `#project`, or notes in `work` modified in the last week. Conditions can be grouped, as described in [Settings](settings.md#filters). |
| Links to note | The notes that link to a chosen note, in their text or in a property. |
| In folder | The notes in a folder and its subfolders. |
| Modified today | The notes changed since midnight. |
| Current date notes | The date notes for today, this week, this month, this quarter and this year, each one you switch on, in the order you set. |

<details><summary>Details on current date notes</summary>

- The rows keep the order set on the list's page, today to this year by default, instead of being sorted by name.
- Each row says which period it is, such as `this week - week 10`.
- A note that does not exist yet shows as `create this week`, unless "Show notes that don't exist yet" is off on the list's page. Choosing it creates and opens it the way your date notes plugin does, with the same template: Periodic Notes, or core Daily notes for days.
- Periods that come from the Custom formats start as an empty note.
- A link property in "Set properties" with this source only offers the notes that exist.

</details>

## Rows

Each row shows the list it comes from and the note's name.

- Every row starts with its list's prefix, shown as a small chip so it stays apart from the name.
- All chips in a picker share the width of the widest one, up to about twelve characters, so the names line up.
- A list with a prefix colour tints its chips.
- A date note adds its period after the name: the weekday for a day note, `week N` for a week note, `month - <Month>` for a month note and `year` for a year note.

## Typing to filter

Typing narrows the rows to the ones you are looking for. A row stays when the characters you typed appear in it in the same order, ignoring case, with anything in between.

The prefix is part of the row, so typing part of a prefix narrows the picker to that list.

## Editing a row's properties

You can edit a note's properties from the jump list without opening the note.

1. Highlight the note's row.
2. Press ⌥↵ (Alt+Enter), or tap the sliders icon at the end of the row. The icon shows on the highlighted row on desktop and on every row on phones.
3. "Set properties" opens for that note instead of the note in focus.

Escape, `🛑 Cancel` and `🏁 Save & close` in that "Set properties" all bring you back to the jump list with what you had typed, so you can edit several notes in a row. Press Escape in the jump list when you are done. Rows that would create a missing date note have no icon.

## Date notes

Date notes are the notes Note Compass treats as a day, week, month, quarter or year, for the "Adjacent dates", "Same day" and "Current date notes" lists.

A note is a date note when it sits directly in the folder set for its period and its name matches that period's format exactly. Each of the five periods has its own folder, format and on/off switch.

The "Read from" setting under "Date notes" chooses where those formats come from:

| Read from | Formats used |
| --- | --- |
| Automatic | The Periodic Notes plugin when it is enabled, then the core Daily notes plugin, then the plugin's own Custom formats. |
| Periodic Notes | The Periodic Notes plugin. |
| Daily notes | The core Daily notes plugin, for days only. The other periods come from Custom. |
| Custom | The plugin's own formats. |

Whenever a period comes from Custom, a pencil next to "Read from" opens its formats. There you set each period's folder and its format as a Moment format:

https://momentjs.com/docs/#/displaying/format/

By default every period lives in `on/`:

| Period | Default format | Example | Default |
| --- | --- | --- | --- |
| Day | `YYYY-MM-DD` | `2024-03-05` | on |
| Week | `GGGG-[W]WW` | `2024-W10` | on |
| Month | `YYYY-MM` | `2024-03` | on |
| Quarter | `YYYY-[Q]Q` | `2024-Q1` | off |
| Year | `YYYY` | `2024` | on |

See [Known behaviour](tips.md#known-behaviour) for formats that never match and for year notes.
