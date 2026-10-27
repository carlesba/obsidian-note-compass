# Set properties

"Set properties" edits the properties of the markdown note in focus from one picker, and writes your changes only when you save.

[← Back to the README](../README.md)

## The picker

The picker gathers every property you set up under "Set properties" in settings, so you can change several at once. It only appears in the command palette when a markdown note has focus. You can also open it for another note from the [Jump to note](jump-to-note.md#editing-a-rows-properties) picker.

![The Set properties picker, with Save & close and Cancel at the top, the note's current values marked with a check, and more values to add below](images/set-properties.png)

Nothing is written while you work in the picker. The rows come in this order:

1. `🏁 Save & close`, which writes only the properties you changed.
2. `🛑 Cancel`, which discards every change.
3. The values the note will be saved with, each marked `✓`.
4. What each enabled property can add, in the order of your settings.

## Set values

The set values show what the note will hold when you save. There is one row per linked note, and one row for each checkbox, text, number or date with its value beside it. A value you changed in this session is also marked `•`.

| Choosing a set… | Does |
| --- | --- |
| Link | Removes it, so a links property loses that one note. |
| Text, number or date | Opens the property's own picker. |
| Checkbox | What the [checkbox behaviour](#checkbox-behaviour) setting says. |

## Values to add

Below the set values, each enabled property offers what it can add.

| Property type | Offers |
| --- | --- |
| Link or links | The notes from its source that are not set yet, most recently modified first. Choosing one adds it to a links property, or replaces the note a link property holds. |
| Text, number, date or datetime, not set | One row with its name, which opens its own picker. The values the vault already has are offered there, not here. |
| Text or number | The preset values whose main menu switch is on, so one choice sets the value. |
| Text | `✏️ <property>: use "<what you typed>"` when you type something that is not one of those presets. |
| Checkbox, not set | One row with its name, which works as the [checkbox behaviour](#checkbox-behaviour) setting says. |

With nothing typed, each property shows at most five values, followed by `… N more, type to filter`, which types the property's prefix for you. Once you type, every matching row is shown.

After you choose a value the picker reopens with the filter cleared. `🏁 Save & close` is back at the top and the value you just chose shows up below it as set.

![Set properties after typing "joan": Joan Puig is now set and marked as changed, and the status property offers to use "joan" as a new value](images/set-properties-search.png)

<details><summary>Details on link properties</summary>

- Links are saved as a list such as `["[[Alice]]", "[[Bob]]"]`.
- Links the property already holds that its source does not offer are kept.
- Link properties never offer the note in focus, notes in the property's excluded folders, or notes with `archived: true`.
- The picker only links notes that already exist. To link a new note, make it first with a [form](forms.md).

</details>

## Value pickers

A property's own picker lets you choose or type one value for it. It marks the current value `✓` and ends with `🗑️ Clear`, which removes the property, or leaves it empty when "Remove when empty" is off.

![The value picker of a date property, with Today, Tomorrow, Next Monday, In a week and Clear](images/set-properties-date.png)

| Type | Offers | Saved as |
| --- | --- | --- |
| Checkbox | `true` and `false`. | `true` or `false` |
| Text | `✏️ Use "<what you typed>"` for a new value, then its preset values, then the other values the property already has in the vault, most used first, with how often each is used. | The text |
| Number | `✏️ Use "<what you typed>"` for a number, then its preset values, then the other numbers the property already has in the vault, most used first. | The number |
| Date | "Use" for a date typed as `YYYYMMDD` or `YYYY-MM-DD`, then Today, Tomorrow, Next Monday and In a week. | `YYYY-MM-DD` |
| Datetime | "Use" for `YYYYMMDDHHmm`, `YYYYMMDD HHmm`, `YYYY-MM-DD HH:mm` or `YYYY-MM-DDTHH:mm`, then Now. | `YYYY-MM-DDTHH:mm` |

Escape returns to the main picker without changing that property, and the changes you already made there are kept.

## Presets

Presets put the values you use most one choice away. A text or number property can have a list of preset values, such as `todo`, `doing` and `done` for a `status` property, which you set on its [property page](settings.md#property-pages).

- Every preset is offered first in the property's own picker.
- A preset whose switch is on is also offered in the main picker.
- Presets are helpers rather than limits: the picker still offers the other values the vault has, and anything you type.

## Checkbox behaviour

The "Checkbox behaviour" setting, below the Set properties list in settings, decides what choosing a checkbox in the main picker does. It applies to every checkbox property.

| Setting | Choosing the checkbox |
| --- | --- |
| Open a picker with true, false and Clear (default) | Opens the checkbox's own picker. |
| Toggle between true and not set | Sets `true`, and choosing it again while it is `true` clears it. |
| Cycle through true, false and not set | Moves it one step each time, from not set to `true`, then `false`, then not set again. |

A mode chosen for a single property in 0.6.1 or 0.6.2 becomes this setting.

## Shortcuts

| Key | Does |
| --- | --- |
| Enter | Chooses the highlighted row. |
| Escape in the main picker | Same as `🛑 Cancel`. |
| Escape in a value picker | Back to the main picker, keeping your changes. |
| ⌘↵, or Ctrl+Enter on Windows and Linux | Saves what you have so far and closes the picker from anywhere, including a property's own picker. |
