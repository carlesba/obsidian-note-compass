# Create note

"Create note" makes a new note that belongs to one of your link properties, so "Jump to note" and "Set properties" offer it from then on.

[← Back to the README](../README.md)

## Creating a note

Create note gives you a new note in the right folder, from the right template, already in a property's list. It works with or without a note in focus. It opens the new note once it is made, in place of the note in focus, without linking it from that note.

1. Run "Create note". The first picker, "Create a note for…", has one row per enabled link or links property that has "Allow creating notes" switched on, with the folder the note will go to beside it, or `vault root`.

   ![The first step of Create note, listing the people, collections and category properties with the folder each one creates notes in](images/create-note-choose.png)

2. Choose a property, then type the name of the new note. A usable name shows a single row, `➕ Create "<name>" in <folder>`.

   ![The second step of Create note, offering to create "Ada Lovelace" in samples/people](images/create-note-name.png)

3. Choose that row. The note is created and Note Compass says where, as in `Created "Ada Lovelace" in samples/people.` The new note opens in the current tab.

Escape in the second step goes back to the first. When no property qualifies, the command says "No link property can create notes."

## Names that are refused

Some names cannot be used, and the row says why. Choosing one of these rows keeps the prompt open with what you typed.

- A name with characters Obsidian cannot use in a file name.
- A name that any note in the vault already has, in any folder and ignoring case, as in `"Ann" already exists at people/Ann.md.` A second note with that name would make `[[Ann]]` links ambiguous.

"Create note" never touches an existing note. When a note already exists at the path it would create, nothing is created and nothing opens.

## Where the note goes

The folder comes from the property, in this order:

1. The source's folder, when the property offers notes from a folder.
2. The property's "Folder" under "Create notes".
3. Where Obsidian puts new notes, when that is empty.

## Templates

When the property has a "Template", the new note starts from it.

| Setup | What happens |
| --- | --- |
| Templater plugin enabled | Templater creates the note, so its `<% %>` commands run. If Templater fails, nothing more is done. |
| No Templater | The template's content is copied and its placeholders are filled in. |

| Placeholder | Becomes |
| --- | --- |
| `{{title}}` | The note's name. |
| `{{date}}` | The current date, in the format set in the core Templates plugin, `YYYY-MM-DD` by default. |
| `{{time}}` | The current time, in the format set in the core Templates plugin, `HH:mm` by default. |
| `{{date:FORMAT}}`, `{{time:FORMAT}}` | The current date or time in the format given. |

## Joining the property's list

After the note is made, it joins the property's source, so it shows up in that property's list straight away.

| Source | What the new note gets |
| --- | --- |
| Notes in a folder | It is already in the folder. |
| Notes linking to a note | A link to that note at the end of the body, unless the content already links there. |
| Notes modified today | Nothing more, it was just made. |
| Filter with a single property condition | The property the condition asks for, such as `true` for "is true", the value for "is", or a list with the value for "has item". |

## Which properties can create notes

A property can create notes when its source can hold a new note. The "Allow creating notes" switch on its page is disabled and explains why when it cannot.

- Sources that qualify: notes in a folder, notes linking to a note, notes modified today, and filters made of a single property condition under "All the following are true" that gives a value to write, such as "is true", "is", "has item", or "is set" on a checkbox.
- Sources that do not: the relation sources, filters with more than one condition or with groups, and conditions such as "greater than".

To set up the folder and template, see [Property pages](settings.md#property-pages).
