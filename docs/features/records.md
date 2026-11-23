# Viewing Saved Records

## Vehicle Overview

The overview header shows the vehicle name, registration plate, and one inspection status.
The plate and inspection status sit side by side when they fit and wrap on narrow screens.
The status shows the date when more than 30 days away and uses plain-language urgency
when due soon or overdue.
To open a different vehicle, use **Back to vehicles** and choose it from the list.
The summary groups and records share the same content width as the header. White panels
on a blue-gray canvas distinguish sections without heavy borders in the light theme.

**Add fill-up**, **Add expense**, and **More** sit together to the right of the vehicle
details on large screens and align left below them on smaller screens. The add buttons are
available to owners and editors.
**More** groups the less frequent actions: **Download backup** and **Download for spreadsheet**
for anyone with read access, **Import backup** for owners and editors, and **Edit** and
**Delete vehicle** for owners only. Vehicle deletion requires confirmation. Tap or click
outside the menu to close it. Closing a menu dialog returns focus to **More**.

On the vehicles list, **Add vehicle** is visible and **Restore Backup** is in the
**⋯** menu. Tap or click outside to close the menu. Closing the restore dialog
returns focus to **⋯**.

Manual Mac and iPhone Safari regression check: with Web Inspector closed, open **⋯**
on the vehicles list and click or tap the **Vehicles** heading once. Then open a
vehicle, open **More**, and repeat on the **Fill-ups** heading. Visually confirm each
panel disappears immediately, without scrolling, changing focus, opening a dialog,
or navigating.
The [mobile WebKit test](../commands.md#tests) checks the same flow in emulation;
it does not replace the real-device check.

Use **Download backup** for restore, not for opening in a spreadsheet. Use **Download for
spreadsheet** to view the records in a spreadsheet app. Import this copy as a comma-delimited
CSV. It prefixes formula-like text with `Text:` so the spreadsheet treats it as text, and
it cannot be used to restore records.

Neither **Import backup** on the vehicle page nor **Restore Backup** on the vehicles list
clears existing records. Replacing records is not available. If an import fails partway
through, records already imported remain saved.
When importing into an existing vehicle, selected active tire sets or tire-change entries
can change which set is marked as mounted, even if the entries are old. The dialog warns
before importing. To keep the current mount, uncheck active sets and tire-change entries
in the Tires tab.

Select the vehicle name to see saved basic information without opening the edit form.
Closing Details returns focus to the name. The registration plate stays selectable text.
The summary shows the saved inspection due date
and interval, not an estimate based on maintenance entries. Missing values display as
`—`; a saved initial odometer of zero displays as `0 km`.
Vehicle, fill-up, and expense Details share the same field layout and Close controls.

The **Files** section loads when Vehicle Details opens. Anyone with vehicle read
access can open a file in a new tab. If the list fails, vehicle information stays
visible and the list can be refreshed. Owners and editors can choose **Manage files**
to upload, rename, or permanently delete a file, then **Done** to return to Details.
Only owners see **Edit details**. Save or Cancel there returns to Details;
entering via **More → Edit** instead closes back to More.

## Fill-ups and Expenses

Select the date and summary area of an expense or fill-up to open **Details**. It is a
keyboard-accessible button with a chevron, not an invisible
click handler on the whole row. Details opens a read-only summary with the saved record
information, full notes, and attachment links. Fill-ups also show completed-trip figures when those are available
in the list response; the dialog does not calculate new consumption values.
Both dialogs show Odometer directly below Date, with `km` on the reading. Consumption in
Details is shown in `L/100 km` for fuel and `L/10,000 km` for oil.

Details opens in view mode. Opening and closing it does not save anything.
Optional missing values display an unavailable marker; numeric zero remains visible.
Expense and fill-up Details have two independent actions. **Edit details** edits fields in the same
dialog; **Save changes** or **Cancel** returns to the summary. **⋯ → Edit** starts
directly in field editing and closes after Save or Cancel. **Manage files** replaces
the summary with the file manager in the same dialog. The date and odometer identify
a fill-up; the date and vendor (or category) identify an expense. File changes save
immediately. **Done** in the footer returns to Details.

For owners and editors, each row has a touch-friendly **⋯** disclosure with **Edit**
and **Delete**, separated by a divider. Details is not duplicated in the menu.
It closes after selection, on an outside pointer press, or on
Escape. Keyboard users can activate the native disclosure, Tab through its buttons,
and press Escape to close it and return focus to the trigger. Delete retains its existing
confirmation.

The existing list responses include a server-derived `canWrite` flag. Viewers and callers
without a confirmed write capability can open Details from the row summary, but see no
action disclosure or empty-list creation action.
This is presentation only; server authorization remains required for every mutation.
Attachment requests are not used to determine record write permissions.

Attachment metadata loads only when Details opens and refreshes when it is reopened.
Loading, empty, and error states are explicit. A failed attachment request leaves the
record details readable, with a manual refresh action and the ability to close the dialog.
Filenames open in a new tab through the existing authenticated attachment endpoint.
See [attachment storage](../development/attachments.md#open-an-attachment) for access
and signed-link behavior.

The `components/car/expenses/` and `components/car/fillups/` folders each own their form,
list, dialog, and tests. Both lists use the date/summary trigger in
`components/car/records/RecordSummaryButton.tsx`; `formatRecordFields.ts` formats
the saved values for Details. Both use `SavedRecordDialog`
for view, edit, and file management. Its shared `RecordEditForm` owns the field layout,
save errors, and Save/Cancel actions; `ExpenseDialog` and `FillUpDialog` supply their fields,
draft validation, and save requests. Both render
`RecordAttachments` and use record data already loaded by the list.

In card layout, each entry is outlined and spaced from the next. The date and summary align
with the rest of the entry, the **⋯** menu stays at the top right, and the remaining
details use the full width underneath. With enough space, both lists are tables with visible
column headings and a narrow actions column. Odometer follows Date in both lists,
before the expense vendor and category. Readings
include `km` and are part of the Details button’s accessible name. Missing values are
marked with a dash in the table without shifting other columns.
Both lists switch between a table and cards based on their available width.
Fuel purchase shows the total first and wraps the quantity and unit price as needed.
The tank status and odometer stay readable; notes use the remaining table space.
Note previews use at most two lines in cards and one in the table;
Details keeps the full notes.
Fill-up status and consumption figures are outside the note preview and remain visible.
Expenses without odometer or oil-consumption values do not render an empty metrics line in
cards; numeric zero is still shown. The vendor appears first, followed by a smaller category
label that can wrap. If there is no vendor, the category is the main text.
Amounts remain fully visible and right-aligned in the table.
Attachment counts remain separate work.

## Editing a Saved Record

Fill-up and expense editors open with the focus on the heading, not an input. The native
date picker remains available when the user activates the date field. The editor uses a
single column on phones and a centered dialog on wider screens.

**Cancel** and **Save changes** are below the fields. Save changes applies only
to changed record values. Changing only a number's formatting (for example, `10` to `10.00`)
does not enable Save or include that field when saving other changes. The odometer must be a
whole number in the signed 32-bit range (−2,147,483,648 to 2,147,483,647);
only expenses allow it to be blank. The server recalculates
the fill-up total when liters or price changes. The edited expense's oil-consumption figure is
updated in the same transaction when the date, category, odometer, or liters are edited.
Changes to other fields leave that figure untouched. Expense creation and editing use the same
[oil-consumption calculation](../../lib/oil-consumption/calculateOilConsumption.ts). Cancel, Close, and Escape ask before
discarding unsaved form changes; tapping outside does not dismiss the editor. Reopening
starts from the saved values. Attachment actions save separately and are not undone by
discarding form changes. Saving or processing an attachment action blocks dismissal.

When saving from Details, the refreshed row supplies the summary. If it is no
longer on the current page, Details closes and returns focus to the list. If the
refresh fails, **Retry refresh** reloads the summary without repeating the save.

The menu editor closes once the server confirms the save. **Edit** and **Load more** wait for the
list refresh, which reloads saved fields and derived figures together. Fill-up rows and their
trip figures are read from the same database snapshot. If the refresh fails,
use **Retry** on the list; the record save does not need to be repeated. If **Load more**
fails, **Retry** requests that page again. A list refresh does not discard an open draft,
even if its row moves outside the loaded pages. For the menu shortcut, after Save, focus goes to the list; after
Cancel, focus returns to the row's action menu if it is still available.

The file picker and **Upload file** are above the saved files, side by side on wider
screens and stacked on phones. Choosing a file does not upload it until **Upload file**
is pressed.

Manual check: on iPhone Safari and Android Chrome, open Edit without a calendar or
keyboard appearing, then tap Date to open the picker. With the keyboard open, check that
the fields and actions remain reachable by scrolling. On desktop, check keyboard
navigation, Esc with unsaved changes, and focus returning to the row's action menu.

## Attachments After Creating a Record

**Add expense** and **Add fill-up** open with focus on the heading. Select **Date**
to open the native date picker.

Both creation dialogs offer the existing **Save expense / Save fill-up** action and a
**Save & add attachments** action. Ordinary Save closes after a successful save.
Save & add attachments creates the record first, then keeps the same dialog open with a
a short confirmation in place of the form: the date, amount, and vendor/category for an
expense, or the date, total, and odometer for a fill-up. Focus moves to this summary.
The same Files controls used in Details manage files for the ID returned by creation.

Choose **Done** to close, with or without uploading files. The record is already saved;
closing does not roll it back. Reopening Add starts a fresh form. File selection before
record creation is not supported.

Creation failures leave the form editable and do not load attachments. After confirmed
creation, no Save action remains and upload retries cannot create another record.
An inspection expense can be saved even if the subsequent vehicle inspection-date update
fails: the dialog then shows an explicit warning alongside the saved summary.
Check the vehicle inspection settings rather than creating the expense again.

Record fields and dismissal are blocked during saving. Done and dismissal are also blocked
during attachment mutations. Existing attachment permissions, limits, progress, errors,
refresh-before-retry behavior, and storage limitations still apply.

Manual check: create each record type using both Save actions. With Save & add attachments,
upload a disposable file without reopening Edit, retry a failed upload, and close with Done.
Confirm the record is created once, its form is replaced after saving, and reopening Add
starts a fresh form. Also check an inspection-date update failure does not offer another
expense creation attempt.

## Mobile Dialog Layout

On phones, Add vehicle, Add fill-up, Add expense, saved-record Details/Edit/Manage files,
tire entry and swap forms, and Backup Import/Restore use a full-screen dialog with a
left-aligned title and no card border or shadow. Details lets long field labels wrap so
the values have more room. Backup previews can scroll within the dialog.
Login/Account and Delete vehicle remain compact, and browser confirmations are unchanged.
On wider screens, dialogs keep their centered card layouts.

## Manual Viewing Checks

Manual check: open Details for an expense and a fill-up, including a record with long notes,
no attachments, and available attachments. Confirm there are no editable fields or mutation
controls before entering management, files still open, and closing does not save.
Reopen after managing files in Details and confirm the
attachment list refreshes. Check both write and viewer roles.
Verify the action disclosure opens independently of Details, dismisses outside/on Escape,
and regains focus after editing. Closing Details returns focus to the row summary.
Viewers must have no action disclosure.
