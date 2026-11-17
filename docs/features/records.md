# Viewing Saved Records

Select the date and summary area of an expense or fill-up to open **Details**. It is a
keyboard-accessible button with a pointer cursor and hover highlighting, not an invisible
click handler on the whole row. Details opens a read-only dialog with the saved record
information, full notes, and attachment links. Fill-ups also show completed-trip figures when those are available
in the list response; the dialog does not calculate new consumption values.

Details contains no record form, Save action, or attachment upload, rename, or delete
controls, including for owners and editors. Opening and closing it does not save anything.
Optional missing values display an unavailable marker; numeric zero remains visible.
The existing Edit dialogs remain the place to change records and manage attachments.

Each row has a touch-friendly **⋯** disclosure containing **Details**, followed by
**Edit** and **Delete** for owners and editors. Viewers get **Details** only.
It closes after selection, on an outside pointer press, or on
Escape. Keyboard users can activate the native disclosure, Tab through its buttons,
and press Escape to close it and return focus to the trigger. Closing Edit also returns
focus to the trigger. Delete retains its existing confirmation.

The existing list responses include a server-derived `canWrite` flag. Viewers and callers
without a confirmed write capability see only Details in the disclosure and no empty-list creation action.
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

The lists retain their existing values. Note previews use at most two lines on mobile
and one on desktop; Details keeps the full notes. Fill-up status and consumption figures
are outside the note preview and remain visible. Expenses without odometer or oil-consumption
values do not render an empty metrics row; numeric zero is still shown and amounts stay
aligned on desktop. Attachment counts and attachments in creation forms remain separate work.

Manual check: open Details for an expense and a fill-up, including a record with long notes,
no attachments, and available attachments. Confirm there are no editable fields or mutation
controls, files still open, and closing does not save. Reopen after managing files through
Edit and confirm the attachment list refreshes. Check both write and viewer roles.
Verify the action disclosure opens independently of Details, dismisses outside/on Escape,
and returns focus after editing or viewing Details from the menu. Viewers must have no Edit/Delete actions.
