# Task commands

Process the tasks in the active Markdown note with your own command-palette commands.

[← Back to the README](../README.md)

## Quick start

1. Open Settings → Note Compass → Tasks and choose `+` to add a command.
2. Give it a name, then open a Markdown note with tasks and run that name from the command palette. You can also assign it a hotkey.
3. Type to find a task. Enter runs the action chosen in "Enter runs"; ⚙ or Alt+Enter opens all actions.
4. With "Batch mode" on, choose `🏁 Finish processing` to save, or `🛑 Cancel` to discard the staged changes.

![The task picker on a daily note, with ⚡ Apply to all 5 tasks first, the open tasks below it, then 🏁 Finish processing with its count of changes and 🛑 Cancel last](images/task-picker.png)

Only enabled commands with at least one action are offered. If no tasks match, a notice appears instead of an empty picker.

## Command page

Each command has its own page under Settings → Note Compass → Tasks.

| Section | Setting | What it does |
| --- | --- | --- |
| Command | Enabled, Name | Offers the command under this name in the command palette. |
| Tasks to list | Status pills | Lists tasks with these checkbox characters. Empty means every task. |
| Tasks to skip | Status pills | Excludes these statuses even when listed above. Empty means none. |
| Options | Select all | Adds `⚡ Apply to all N tasks` when more than one task matches the typed search. |
| Options | Batch mode | Stages changes until you finish instead of writing immediately. |
| Actions | Enter runs | An action, or "Show the actions menu". |
| Actions | Action list | Add, drag to reorder, duplicate or delete actions; click a row to edit it inline. |

"Add status" offers Open `[ ]`, Completed `[x]`, Cancelled `[-]`, Migrated `[>]`, Scheduled `[<]`, In progress `[/]` and "Custom…". For a custom status, type one character and press Enter. Use a pill's × to remove it. Status characters are case-sensitive.

The main settings rows for commands and forms show only their name, with a second line only when there is a warning. An unreadable command is kept switched off with a warning until you remove it.

## Actions

Each action has a "Label", one "Action" kind and a one-character "Status".

### Change status

Changes the checkbox character on the source line. "Completion date" optionally appends a suffix.

| Completion date | Appended text |
| --- | --- |
| Off | Nothing. |
| Date | ` ✅ 2028-10-30` |
| Date as link | ` ✅ [[2028-10-30]]` |
| Timestamp | ` ✅ 2028-10-30 09:00` |

These are examples: dates use the daily-note format in "Date notes", and timestamps add the time format from the core Templates plugin. The date is today, not the source note's date. A date link does not create its note.

### Copy to note

Appends an open task `[ ]` to the end of another note and sets "Status" on the original. It copies only the task line, not its nested tasks or continuation lines; indentation and blockquote prefixes are not copied.

| Setting | What it does |
| --- | --- |
| Destinations | Opens a separate page; add with `+`, drag to reorder and use × to remove. The back arrow returns to the command. |
| Copied task prefix / suffix | Literal text around the copied body only, before its block ID and source link. Include any spaces; empty by default. Works immediately and in batches. |
| Link the destination | Adds ` → [[destination]]` to the original task. |
| Link the source | Adds ` ← [[source]]` to the copy. |

![Copy to which note? for Migrate, offering Tomorrow, This week, Next week marked new note, and This month, each with its note's name](images/task-destinations.png)

Destinations can be Today, Tomorrow, This week, Next week, This month, Next month, This quarter, Next quarter, This year, Next year or a Specific note.

- Periods are relative to today, not the source note's date, and use the enabled periods, folders and formats in "Date notes".
- One available destination runs directly; several open "Copy to which note?" in the configured order, marking any note still to be created as `new note`. The source note and duplicate destinations are never offered.
- Missing specific notes are skipped with a notice. If no destination remains, nothing changes.
- Missing periodic notes are created when changes are saved. When "Date notes" uses Periodic Notes, Note Compass first asks that plugin to create the note with its template. If that API is unavailable, fails or leaves the expected path missing, an empty note is created instead. Other sources, including core Daily notes and Custom, start empty before the task is appended.

## Picker and batch mode

Type to filter task text; matching is case-insensitive and in order, like the other pickers.

![The actions menu, Apply which action?, with ✅ Complete, 🚫 Cancel, ➡️ Migrate and 📅 Schedule](images/task-actions.png)

| Key or row | Does |
| --- | --- |
| Enter on a task | Runs "Enter runs", or opens the actions menu. |
| ⚙ or Alt+Enter | Opens the menu of all actions, including the Enter action. |
| `⚡ Apply to all N tasks` | Uses the chosen action on every task matching the search, not every task in the note. |
| `🏁 Finish processing` · N changes | Writes all staged changes and closes. |
| `🛑 Cancel` or Escape in the task picker | Discards all staged changes. |
| Escape in the action or destination picker | Goes back without discarding earlier staged changes. |

With "Batch mode" on, each choice is staged and the task picker reopens with the remaining tasks and an empty search. Processing the last task finishes automatically. Choosing `⚡ Apply to all N tasks` also finishes immediately, even if the search left other tasks hidden.

With "Batch mode" off, one choice writes immediately and closes the picker. Escape cannot undo a change already written. In either mode, source lines changed since the picker opened are skipped with a notice.

## New-command defaults

A new command starts with a Bullet Journal setup named "Process open tasks": enabled, listing only Open `[ ]`, skipping none, "Select all" off and "Batch mode" on. Enter runs "✅ Complete".

| Action | Source status | Other settings |
| --- | --- | --- |
| ✅ Complete | `[x]` | Completion date Off. |
| 🚫 Cancel | `[-]` | Completion date Off. |
| ➡️ Migrate | `[>]` | Tomorrow, This week, Next week, This month; links the destination only. |
| 📅 Schedule | `[<]` | Next month, Next quarter, Next year; links both destination and source. |

## Known behaviour

- Writes across several notes are not atomic: a failure can leave some notes updated and others unchanged.
- Copying keeps inline text, including existing suffixes and block IDs, so a copied block ID is duplicated rather than regenerated.

See [Settings](settings.md) and [Tips and known behaviour](tips.md).

These defaults apply only to new commands; saved destinations are unchanged.
