# Tips and known behaviour

Ways to get more out of Note Compass, and behaviour that may surprise you.

[← Back to the README](../README.md)

## Tips

These tips keep the pickers fast and easy to read.

- Give the commands hotkeys you can press without looking. The plugin is built around opening a picker, typing a few letters and pressing Enter.
- Keep prefixes short, such as an emoji and a three or four letter tag like `👤 peop` or `📅 due`. All chips share the width of the widest one, so one long prefix pushes every name to the right.
- Use colours to group related lists, such as one colour for all your people and company lists and another for project lists, so you can tell them apart at a glance.
- Type a prefix tag to narrow a picker towards one list, such as `peop` for the people rows in "Set properties".
- Use a "Links to note" source as a lightweight tag. Create a note such as `Person` and point the people property at "Links to note: Person". Every note created through "Create note" for that property gets a link to `Person`, so it shows up in the list without you tagging it by hand.
- Add your templates folder to "Excluded folders" on every link property, so template notes are never offered as values.
- Turn "Show prefixes" off for a minimal look once you know your lists. Link rows then name their property instead.
- In "Set properties", Escape in a value picker only steps back to the main picker. The changes you already made are kept until you choose "Save & close" or "Cancel".
- Give the forms you use most a hotkey of their own, since each enabled form is a command named after it.

## Known behaviour

These cases follow from how Note Compass reads your notes.

- A day format containing `/`, such as `YYYY/MM/DD`, never matches, because a note's name is compared without its folders.
- With the default formats, notes named after a year in the date notes folder, such as `on/2024`, count as year notes. Switch the year period off in the Custom formats if you keep other notes named that way in that folder.
- If a property changes type, a filter condition on it keeps its old condition and matches nothing until you pick a new one. The condition, its list's row and its page say that the condition no longer applies.
- "Create note" never touches an existing note. If a note already exists at the path it would create, it is left alone and the command says so.
