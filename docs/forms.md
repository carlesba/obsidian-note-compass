# Forms

A form asks a few questions and creates one new note from the answers, with its name, text and properties filled in.

[← Back to the README](../README.md)

## What a form is

A form turns a note you make often into a few questions, such as a reading log entry that asks for the book and a rating, or a meeting note that asks for the people. You define forms in Settings → Note Compass → Forms. Each form has a pattern for the note's name, the note's text, a folder, and a list of fields that are either fixed values or questions.

## Fill form and per-form commands

There are two ways to run a form, both working with or without a note in focus.

- "Fill form" lists your enabled forms under "Fill which form?" and runs the one you choose.
- Each enabled form is also a command of its own, named after the form, so you can give it a hotkey.

![The Fill form picker, titled Fill which form?, listing the Reading log and Meeting note forms](images/fill-form-picker.png)

When there are no forms, "Fill form" says "No forms yet. Add one in Settings → Note Compass → Forms."

## Running a form

Running a form takes you through its questions, then a summary where you check the answers and create the note.

1. Answer each question. A form asks one question per asked field, in the order of its "Fields" list.
2. Review the summary, "Check the answers…", that opens after the last question.
3. Choose `✅ Create "<name>"`.

![A question for the rating field of the Reading log form, with Skip first and the fixed options 1 · Poor to 5 · Great shown by their labels](images/form-question.png)

### Moving around

| Key or row | Does |
| --- | --- |
| Enter | Answers the question with the highlighted row. |
| `⏭️ Skip` | Skips an optional question. A skipped property is not written at all, and a skipped variable is empty. |
| Escape | Goes back to the previous question. On the first question it closes the form without making a note. |
| ⌘↵, or Ctrl+Enter on Windows and Linux | Creates the note from any question once every required question has an answer. |

The answers you already gave are kept when you go back, and show a check.

### The summary

The summary shows what the note will get before anything is written.

![The summary of the Reading log form, with Create "Dune" first, one row per field with its value or skipped, and Cancel last](images/form-confirm.png)

- The first row is `✅ Create "<name>"`, with the note's name worked out from your answers.
- Then one row per field with the value it will get, or `skipped`.
- The last row is `🛑 Cancel`.
- Choosing an asked field opens its question again, and comes back to the summary after you answer it.
- Escape goes back to the last question, or closes the form when it asks no questions.

### Creating the note

When you choose `✅ Create "<name>"`, Note Compass writes the note and tells you where it went.

1. The note goes in the form's "Folder", or where Obsidian puts new notes when that is empty.
2. When a note with that name already exists there, ignoring case, the new one gets a number, as in `Dune 2`.
3. The note's text is written first, then its properties in the order of the fields.
4. Note Compass says where the note went, as in `Created "Dune" in reading.`, and opens it unless "Open the note after creating it" is off.

## Form page

A form's page, under Settings → Note Compass → Forms, holds everything the form needs.

![The page of the Reading log form, with its name, note name and content patterns, folder, and the Fields list where each row shows its key and badges](images/form-settings.png)

| Setting | What it is |
| --- | --- |
| Enabled | Offers the form in "Fill form" and as a command. |
| Name | Shown in "Fill form" and as the command name. |
| Note name | The pattern for the new note's name, such as `{{date:YYMMDDHHmm}} {{book}}`. Type `@` to insert a [placeholder](#placeholders). |
| Note content | The new note's text, with the same [placeholders](#placeholders). |
| Folder | Where new notes go. |
| Open the note after creating it | On by default. Switch it off to stay where you are. |
| Fields | The values the form fills in or asks for. Their order is the order of the questions. |

In the note name, spaces repeated by an empty placeholder are collapsed. A name that ends up empty, or with characters Obsidian cannot use in a file name, is refused with a message, keeping you on the summary.

### The fields list

The fields list works like the other lists in the settings.

- Drag the handle to reorder the fields.
- The copy icon duplicates a field right below it.
- The cross deletes a field.
- The `+` in the header opens a picker to add one, described under [Adding fields](#adding-fields).

Each row shows the field's key, followed by small badges for how it is used, who fills it and its data type, as in `book` `variable` `ask` `text`. Property badges are blue and variable badges are purple. The badge for who fills it reads `fixed`, `ask`, `ask, optional` or `entry time`, and the type badge adds the source of an asked field when it is not typed, as in `list · notes` or `number · options`.

Click the row or its chevron to edit the field right below it, and click again to close it. One field is open at a time, and a new field opens straight away.

![The rating field of the Reading log form opened inline below its row, with Key, Stored as, Filled by, Question, Data type, Source, its Options and Optional](images/form-field-editor.png)

### Adding fields

The `+` in the "Fields" header opens a searchable picker, "Add which field?", with your [custom fields](#custom-fields) first and the built-in fields after them. Type to filter, and press Enter or click to add the highlighted one.

![The picker of the Fields + button, with the Custom group listing the user's templates and the Built-in group with Blank field, Date, Time, Timestamp, ISO timestamp, the entry confirmations and Conditional block](images/form-fields-add-menu.png)

| Group | Entry | Adds |
| --- | --- | --- |
| Custom | Each custom field, by its name or key | An independent copy of the template, with its key, type, source, options and the rest. See [Custom fields](#custom-fields). |
| Built-in | Blank field | An empty asked text field. |
| Built-in | Date | A fixed field set at creation, keyed `date`, formatted `YYYY-MM-DD`. |
| Built-in | Time | A fixed field set at creation, keyed `time`, formatted `HH:mm`. |
| Built-in | Timestamp | A fixed field set at creation, keyed `timestamp`, formatted `YYYY-MM-DDTHH:mm`. |
| Built-in | ISO timestamp | A fixed field set at creation, keyed `iso-timestamp`, formatted as ISO 8601. |
| Built-in | Confirm entry date / Confirm entry time | Asked variables `entry-date` / `entry-time` that change only the date / time. Both can be used in one form. See [Entry time](#entry-time). |
| Built-in | Conditional block | A [block](#conditional-blocks) of fields that are only used when its conditions hold. Not offered by the `+` inside a block. |

Custom entries carry a bookmark icon and show the template's key and badges under the name. The date and time presets show what they would write right now, and a preset key already in use gets a number, as in `timestamp-2`. A custom field keeps its key even when the form already has it, since [repeated keys](#repeated-keys) are allowed.

## Fields

Every field is a fixed value the form fills in, or a question it asks.

| Setting | Options |
| --- | --- |
| Key | The property name or the variable's name, used as `{{key}}` in both cases. |
| Stored as | "Property", the default, writes the value to the new note's frontmatter under its key. "Variable" is never written and only fills `{{key}}` in the name and content. |
| Filled by | "Fixed value" fills it in every time the form runs. "Question" asks for it when the form runs, with the "Question" row as its prompt. |
| Data type | What kind of value the field writes: text, number, checkbox, list, date, time or datetime. |
| Source | For an asked text, number or list, where the answer comes from: "Typed input", "Fixed options" or "Notes". See [Sources](#sources). |

### Fixed values

A fixed field writes the same value every time the form runs, or a date worked out when it runs.

| Type | Value |
| --- | --- |
| Text | Any text. Typing `[[` suggests the vault's notes, and `@` inserts a [placeholder](#placeholders). |
| Number | Only keeps numbers. |
| Checkbox | A switch. |
| List | A box where each item shows as a chip. Type an item and press Enter to add it, and use its × to remove it. `[[` and `@` work as in a text value. |
| Date, time, datetime | See [Dates and times](#dates-and-times). |

List items may be links, so `[[Books]]` and `[[Reading]]` write `categories: ["[[Books]]", "[[Reading]]"]`. This is how a form links its notes to other notes. In a fixed text value or the list's box, typing `[[` suggests the vault's notes, and picking one writes its link, such as `[[Books]]`, using the folder only when two notes share the name. In the list's box the picked link becomes a chip straight away.

A fixed text value and each list item can also be composed from the form's other fields and from the date, with the same [placeholders](#placeholders) as the note name. A `dates` list with the item `[[today]]` writes `dates: ["[[2026-10-31]]"]`, linking the new note to today's daily note, and a `summary` text with `{{book}} rated {{rating}}` writes `Dune rated 4`. The order of the fields does not matter.

- A list item that ends up empty or as `[[]]`, because the field it uses was skipped, is dropped.
- A text value that ends up empty is not written.
- Conditions on a composed field compare against the composed value.

### Asked questions

An asked field becomes one question when the form runs. Its data type says what is written, and its source says where the answer comes from.

| Setting | What it does |
| --- | --- |
| Question | The prompt. When empty, the field's key is used. |
| Source | Only for text, number and list. Changing the data type to one that cannot use the source resets it to "Typed input". |
| Optional | Puts `⏭️ Skip` first in the question. A skipped property is not written at all, and a skipped variable is empty. |

| Data type | Typed input | Fixed options | Notes |
| --- | --- | --- | --- |
| Text | Anything you type. A property also offers the values it already has in the vault. | One of the options, written as text. | One note, written as its `[[link]]`. |
| Number | A number you type, with the property's vault values. | One of the options, written as a number. | — |
| List | Items you type one by one, with the property's vault values. Each item toggles with a check; finish with `🏁 Done`. | Several of the options, written as items. | Several notes, written as links. |
| Checkbox | `true` or `false`. | — | — |
| Date, time, datetime | See [Dates and times](#dates-and-times). | — | — |

### Sources

A source is where the answer to a text, number or list question comes from. Checkbox, date and time fields have no source row.

**Typed input** is the default. The question takes what you type, and a property also offers the values it already has in the vault, most used first. A list adds each item you type or pick, marked with a check, until you choose `🏁 Done`.

**Fixed options** shows a list of "Options", each with a value and an optional label.

- The `+` in the "Options" header adds one, the cross removes one, and dragging an option's handle reorders it.
- The question shows the label, or the value when there is none, and the note gets the value. A number field writes the value as a number, so the option `4` with the label `4 · Great` writes the number 4. A list writes the picked values as items.
- A value may hold [placeholders](#placeholders), typed with `@` as in a fixed value, such as `[[{{today}}]]`. They are filled when the form runs, and an option that ends up empty is skipped.

**Notes** offers notes from a "Notes from" source, chosen as a list of "Jump to note" is: a filter, notes that link to a note, notes in a folder, notes modified today, or the notes linked from, linking to or sharing the day of the note in focus. The question lists the notes most recently changed first, and the note gets the note's `[[link]]`, with the folder only when two notes share the name. A text field writes one link, and a list writes the links of every picked note. In the note name and content, `{{key}}` becomes the note's name without brackets, so it can name the new note, and `[[{{key}}]]` links it.

### Dates and times

Date, time and datetime fields write a moment in the format you choose.

| Format | Example |
| --- | --- |
| `YYYY-MM-DD` | `2028-10-30` |
| `HH:mm` | `09:00` |
| `YYYY-MM-DDTHH:mm` | `2028-10-30T09:00` |
| ISO 8601 | `2028-10-30T08:00:00.000Z`, in UTC |
| Custom | Any Moment.js format, such as `dddd`. |

A fixed one takes its "Value" from one of these:

| Value | Writes |
| --- | --- |
| At creation | The time the form started. |
| On a set date | A date you type below it. |
| From field … | The value of another date or time field of the form. When that field is skipped, this one is skipped too. |

A set date is typed as digits, `YYYYMMDD` for a date, `HHmm` for a time and `YYYYMMDDHHmm` for a datetime, or with dashes and colons. The line under it shows how it was read, such as `✓ Mon 30 Oct 2028, 09:00`.

"From field" lets one asked time feed several properties, such as a `day` with `YYYY-MM-DD` and a `timestamp` with ISO 8601.

An asked one offers "Now", and a date also offers "Today", "Tomorrow", "Next Monday" and "In a week". You can also type `20240311`, `2024-03-11`, `0930`, `09:30`, `202403110930` or `20240311 0930`, as in the date pickers of "Set properties". A time is that time today.

### Entry time

Add "Confirm entry date" and/or "Confirm entry time" to confirm when the note is for. Existing fields with "Use as the entry date/time" remain supported, including datetime fields that replace the full timestamp.

![The entry-time question with a compact text input and Keep as the first row](images/form-entry-time.png)

- Type `YYYYMMDD` for a date or `HHmm` for a time. Options underneath preview the full `YYYY-MM-DD HH:mm`; Enter keeps the shown value.
- Changing the date preserves the time; changing the time preserves the date, including a previously confirmed date. Both fields can be edited again from the final review.
- The combined timestamp fills `{{date}}`, `{{time}}`, the note name and fields set "At creation". Fields that change the same component show a warning.

### Details

<details><summary>Warnings and unreadable forms</summary>

- A field without a key, fixed options without any option, a notes source without its note or folder, or a date taken from a field that is not a date warn on the field's row and on the form.
- A block without conditions or fields, a condition without a field or value, a condition on a field that is not above the block, or a condition that does not apply to its field's type warn on the block's row and on the form.
- A form this version of Note Compass cannot read stays in the list switched off, with a warning and no pencil, like an unreadable list. Its saved setup is kept until you delete it.
- A duplicated form or custom field is named `<name> copy`.
- A custom field this version cannot read stays in the "Custom fields" list with a warning and no copy icon, is left out of the `+` picker, and keeps its saved setup until you delete it.

</details>

## Conditional blocks

A conditional block holds fields that the form only uses when an earlier answer matches, such as asking for the pages only when the note is about a book.

```
⋮⋮ kind          property  ask    text · options
⋮⋮ When  kind is book
│  ⋮⋮ pages       property  ask    number
│  ⋮⋮ categories  property  fixed  list   [[Books]]
└─ + Add field to this block
⋮⋮ When  kind is article
│  ⋮⋮ categories  property  fixed  list   [[Articles]]
└─ + Add field to this block
```

### Adding and arranging blocks

- "Conditional block" in the `+` picker of the "Fields" header adds an empty block at the end of the list.
- The `+` at the bottom of a block adds a field inside it, with the same picker minus "Conditional block".
- Drag a field between a block's heading and its bottom row to move it in, and drag it out to move it back to the list.
- Dragging a block's heading moves the whole block. A block cannot go inside another block.
- Deleting a block keeps its fields, which stay in the list where the block was.
- The copy icon on a block's heading copies the block with its fields right below it.

### Conditions

Click a block's heading to edit its conditions. Each condition picks a field, a check and, for most checks, a value. The block runs only when every condition holds.

| Data type | Checks |
| --- | --- |
| Text | is, is not, is set, is not set |
| List | has item, does not have item, is set, is not set |
| Number | =, ≠, <, >, is set, is not set |
| Checkbox | is true, is false |
| Date, time, datetime | on, not on, before, after, is set, is not set |

A field with fixed options offers them as the value, and the other fields take a typed value. A field answered from notes holds links, so its value is typed as `[[Dune]]`. A date, time or datetime is typed like a [set date](#dates-and-times), as `YYYYMMDD`, `HHmm` or `YYYYMMDDHHmm`, and a datetime compared with a date alone is compared by day.

A condition can only look at fields above its block, outside any block or in an earlier block that runs. Changing an answer from the summary checks the blocks again, and a required question that a block now asks comes next.

### When a block does not run

- Its questions are not asked, and its fields are left out of the summary.
- Its fields are not written, and their placeholders are empty, as if they were skipped.

### Repeated keys

Several fields may share a key, such as a `categories` in each of two blocks. The last field with a value wins, and the property keeps the place of the first field with that key. A skipped field does not clear the value of an earlier one.

## Custom fields

A custom field is a field you define once, under "Custom fields" on the Forms page, and add to any form from the `+` picker of its "Fields" list, such as a `rating` with its five options or a `people` list answered from your person notes.

```
Forms
⋮⋮ Reading log      ●  ⧉ ✎
⋮⋮ Meeting note     ●  ⧉ ✎

Custom fields
⋮⋮ Rating 1–5  rating  property  ask  number · options
⋮⋮ people             property  ask  list · notes
```

- The list works like a form's "Fields" list: drag the handle to reorder, the copy icon duplicates, the cross deletes, and clicking a row opens its editor right below it.
- The editor is the same as a form field's, with "Name" first: the name shown in the `+` picker, falling back to the key when empty. Then Key, Stored as, Filled by, Question, Data type, Source, options or notes source, Optional and the date settings, as described under [Fields](#fields).
- Its order in the list is its order in the picker's "Custom" group.
- A `@` placeholder in a fixed value or option offers `today`, `tomorrow`, `yesterday`, `date`, `time` and the custom field's own key, since there is no form around it yet.

Adding a custom field to a form inserts a copy with a fresh id. From then on the copy belongs to the form: edit it there as any other field, and editing or deleting the custom field later changes no form. Deleting a custom field only removes it from the picker.

## Placeholders

Placeholders fill a form's note name, note content, fixed text values and list items with its answers and the time.

| Placeholder | Becomes |
| --- | --- |
| `{{date}}`, `{{time}}` | The time the form started, or the entry time, in the formats set in the core Templates plugin. |
| `{{date:FORMAT}}`, `{{time:FORMAT}}` | The same time in the format given. |
| `{{today}}`, `{{tomorrow}}`, `{{yesterday}}` | The entry date, the day after or the day before, in the daily-note format of the [Date notes source](settings.md), or `YYYY-MM-DD` without one. `{{today:FORMAT}}` uses the format given. |
| `{{key}}` | The value of the field called `key`. Lists are joined with commas, and a skipped field is empty. A field called `today` wins over the built-in `{{today}}`. |
| `{{key:FORMAT}}` | A date or time field in the format given, such as `{{started:dddd}}`. |
| `{{title}}` | The new note's name. In the content only. |

Wrapping a placeholder in a link, as in `[[{{today}}]]`, links the note it names, so `[[{{today}}]]` becomes `[[2026-10-31]]`. Any other placeholder is left as it is.

### Typing placeholders

Type `@` at the start of the text or after a space, `[` or `(` to open a menu of the placeholders the form knows, filtered by what you type after the `@`.

- The menu offers `today`, `tomorrow` and `yesterday` with the date they would write right now, every field key of the form, including fields inside conditional blocks, then `date` and `time`, and `title` in the note content.
- Each entry comes twice: plain, as `today`, and as a link, as `[[today]]`.
- Picking an entry replaces `@` and what you typed with a pill. A pill is one block: the caret jumps over it and Backspace or Delete removes it whole. Escape closes the menu and keeps the text.
- A placeholder typed or pasted by hand, such as `{{book}}`, becomes a pill too, and `[[{{book}}]]` becomes one link pill. A pill for a key the form does not have is drawn with a dashed border and left as it is when the note is created.
- The settings keep plain text with `{{…}}`; pills are only how the inputs show it.

## Example

A "Reading log" form could have these fields:

| Key | Stored as | Filled by | Data type | Source | Value |
| --- | --- | --- | --- | --- | --- |
| `book` | property | ask | text | Notes | Notes from the `Books` folder, written as a link such as `[[Dune]]`. |
| `rating` | property | ask | number | Fixed options | Options `1` to `5` with labels such as `5 · Great`, written as numbers. |
| `people` | property | ask | list | Notes | Notes that link to `Person`, written as links. |
| `started` | property | fixed | date | | At creation. |
| `categories` | property | fixed | list | | `[[Books]]`, `[[Reading]]`. |
| `dates` | property | fixed | list | | `[[today]]`, typed with `@`. |
| `entry-time` | variable | ask | time | | Use as the entry date/time. |

With the note name `{{date:YYMMDDHHmm}} {{book}}`, each run asks for the book, the rating, the people and the time, and creates a note such as `2810300930 Dune` linked to `[[Dune]]`, `[[Books]]`, `[[Reading]]` and the daily note `[[2028-10-30]]`.
