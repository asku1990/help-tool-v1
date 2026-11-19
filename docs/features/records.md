# Viewing Saved Records

## Vehicle Overview

The overview header shows the vehicle name, registration plate, and one inspection status.
On phones, the inspection status gets its own line. It shows the date when more than
30 days away, and uses plain-language urgency when due soon or overdue.
**Switch vehicle** appears on large screens only when another vehicle is available.
On smaller screens, use **Back to vehicles** to switch.
The summary groups and records share the same content width as the header. White panels
on a blue-gray canvas distinguish sections without heavy borders in the light theme.

**Add fill-up** and **Add expense** are the primary actions for owners and editors.
**⋯** groups the less frequent actions: **Download backup** and **Download for spreadsheet**
for anyone with read access, **Import backup** for owners and editors, and **Edit** and
**Delete vehicle** for owners only. Vehicle deletion requires confirmation. Closing a menu
dialog returns focus to **⋯**.

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
The read-only dialog shows the saved inspection due date
and interval, not an estimate based on maintenance entries. Missing values display as
`—`; a saved initial odometer of zero displays as `0 km`.
Vehicle, fill-up, and expense Details share the same field layout and Close controls.

## Fill-ups and Expenses

Select the date and summary area of an expense or fill-up to open **Details**. It is a
keyboard-accessible button with a chevron, not an invisible
click handler on the whole row. Details opens a read-only dialog with the saved record
information, full notes, and attachment links. Fill-ups also show completed-trip figures when those are available
in the list response; the dialog does not calculate new consumption values.

Details contains no record form, Save action, or attachment upload, rename, or delete
controls, including for owners and editors. Opening and closing it does not save anything.
Optional missing values display an unavailable marker; numeric zero remains visible.
The existing Edit dialogs remain the place to change records and manage attachments.

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

Implementation: `components/car/records/RecordDetailsButton.tsx`, used by both lists,
and the read-only mode of `components/car/attachments/RecordAttachments.tsx`.
The dialog uses the record data already loaded by the list, without new record endpoints.

On mobile, each entry is outlined and spaced from the next. The date and summary align
with the rest of the entry, the **⋯** menu stays at the top right, and the remaining
details use the full width underneath. On desktop, both lists are tables with visible
column headings aligned to the start of each cell, one line per record, and a narrow actions
column. Odometer follows Date in both tables. Missing values are marked with a dash
without shifting other columns.
The lists retain their existing values. Note previews use at most two lines on mobile
and one on desktop; Details keeps the full notes. Long fuel purchase and odometer/oil
previews truncate on desktop; open Details from the date to see the full values.
Fill-up status and consumption figures are outside the note preview and remain visible.
Expenses without odometer or oil-consumption values do not render an empty metrics row;
numeric zero is still shown and amounts stay aligned on desktop. Attachment counts remain
separate work.

## Editing a Saved Record

Fill-up and expense editors open with the focus on the heading, not an input. The native
date picker remains available when the user activates the date field. The editor uses a
single column on phones and a centered dialog on wider screens.

**Cancel** and **Save changes** are below the attachment section. Save changes applies only
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

The editor closes once the server confirms the save. **Edit** and **Load more** wait for the
list refresh, which reloads saved fields and derived figures together. Fill-up rows and their
trip figures are read from the same database snapshot. If the refresh fails,
use **Retry** on the list; the record save does not need to be repeated. If **Load more**
fails, **Retry** requests that page again. A list refresh does not discard an open draft,
even if its row moves outside the loaded pages. After Save, focus goes to the list; after
Cancel, focus returns to the row's action menu if it is still available.

The file picker and **Upload file** are above the saved files, side by side on wider
screens and stacked on phones. Choosing a file does not upload it until **Upload file**
is pressed.

Manual check: on iPhone Safari and Android Chrome, open Edit without a calendar or
keyboard appearing, then tap Date to open the picker. With the keyboard open, check that
the fields and actions remain reachable by scrolling. On desktop, check keyboard
navigation, Esc with unsaved changes, and focus returning to the row's action menu.

## Attachments After Creating a Record

Both creation dialogs offer the existing **Save expense / Save fill-up** action and a
**Save & add attachments** action. Ordinary Save closes after a successful save.
Save & add attachments creates the record first, then keeps the same dialog open with a
saved confirmation, disabled record fields, and the existing attachment-management panel.
The panel is outside the record form and uses the real ID returned by creation.

Choose **Done** to close, with or without uploading files. The record is already saved;
closing does not roll it back. Reopening Add starts a fresh form. File selection before
record creation is not supported.

Creation failures leave the form editable and do not load attachments. After confirmed
creation, no Save action remains and upload retries cannot create another record.
An inspection expense can be saved even if the subsequent vehicle inspection-date update
fails: the dialog then shows an explicit warning and keeps the record fields locked.
Check the vehicle inspection settings rather than creating the expense again.

Record fields and dismissal are blocked during saving. Done and dismissal are also blocked
during attachment mutations. Existing attachment permissions, limits, progress, errors,
refresh-before-retry behavior, and storage limitations still apply.

Manual check: create each record type using both Save actions. With Save & add attachments,
upload a disposable file without reopening Edit, retry a failed upload, and close with Done.
Confirm the record is created once, its fields stay locked after saving, and reopening Add
starts a fresh form. Also check an inspection-date update failure does not offer another
expense creation attempt.

## Manual Viewing Checks

Manual check: open Details for an expense and a fill-up, including a record with long notes,
no attachments, and available attachments. Confirm there are no editable fields or mutation
controls, files still open, and closing does not save. Reopen after managing files through
Edit and confirm the attachment list refreshes. Check both write and viewer roles.
Verify the action disclosure opens independently of Details, dismisses outside/on Escape,
and regains focus after editing. Closing Details returns focus to the row summary.
Viewers must have no action disclosure.
