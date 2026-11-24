# Vehicles

## Vehicle List and Overview

The overview header shows the vehicle name, registration plate, and, for active vehicles, one inspection status.
The plate and inspection status sit side by side when they fit and wrap on narrow screens.
The status shows the date when more than 30 days away and uses plain-language urgency
when due soon or overdue.
To open a different vehicle, use **Back to vehicles** and choose it from the list.
The summary groups and records share the same content width as the header. Dashboard
sections and their loading placeholders use the shared subtle card style. In the light
theme, white panels sit on a blue-gray canvas without heavy borders.

**Add fill-up**, **Add expense**, and **More** sit together to the right of the vehicle
details on large screens and align left below them on smaller screens. The add buttons are
available to owners and editors.
**More** offers **Download for spreadsheet** for anyone with read access, and **Edit** and
**Delete vehicle** for owners only. Vehicle deletion requires confirmation. Tap or click
outside the menu to close it. Closing a menu dialog returns focus to **More**.

Permanent deletion is blocked if the vehicle, any expense, or any fill-up still has
files. Remove those files through **Details → Manage files** before retrying. Archive
instead if you want to keep the vehicle’s history and files.

On the vehicles list, **Add vehicle** is in the **⋯** menu.
Tap or click outside to close the menu. Closing the dialog returns focus to **⋯**.

The vehicles list shows one linked card per vehicle, with its name, known vehicle
details, registration plate, and, for active vehicles, the same inspection status as the vehicle overview.
Cards use one column on phones and up to three on wider screens. Loading placeholders
follow the same grid; the first-vehicle prompt only appears when the list is empty.

The list opens on **Active**. Owners can use **More → Archive vehicle** to move a
sold car to **Archived** for everyone with access. Open the archived card to see
the same records and documents. Its archive date replaces the card's inspection
reminder. On its overview, an **Archived vehicle** banner replaces the inspection
status. Owners can select **Restore vehicle** to return it to Active. Archiving does
not change anyone's permissions or delete records.

After a successful archive or restore, the lists load fresh results so a car doesn’t
appear in its previous list. A failed refresh offers **Retry**. If the list is empty
and a request is waiting for a connection, the list shows an offline message instead
of an empty garage.

Manual Mac and iPhone Safari regression check: with Web Inspector closed, open **⋯**
on the vehicles list and click or tap the **Vehicles** heading once. Then open a
vehicle, open **More**, and repeat on the **Fill-ups** heading. Visually confirm each
panel disappears immediately, without scrolling, changing focus, opening a dialog,
or navigating.
The [mobile WebKit test](../commands.md#tests) checks the same flow in emulation;
it does not replace the real-device check.

Use **Download for spreadsheet** to view records in a spreadsheet app. Open it as a
comma-delimited CSV. Formula-like text is prefixed with `Text:` so the spreadsheet
treats it as text. For recovery, use [database backups](../database.md), not spreadsheet exports.

Select the vehicle name to see saved basic information without opening the edit form.
Closing Details returns focus to the name. The registration plate stays selectable text.
The summary shows the saved inspection due date and interval, not an estimate based on
maintenance entries. Missing values display as `—`; a saved initial odometer of zero
displays as `0 km`.

The **Files** section loads when Vehicle Details opens. Anyone with vehicle read
access can open a file in a new tab. If the list fails, vehicle information stays
visible and the list can be refreshed. Owners and editors can choose **Manage files**
to upload, rename, or permanently delete a file, then **Done** to return to Details.
Only owners see **Edit details**. Save or Cancel there returns to Details;
entering via **More → Edit** instead closes back to More.

For saved expense and fill-up details and dialogs, see [viewing saved records](records.md).

## Mobile Dialog Layout

On phones, Add vehicle and Delete vehicle use compact dialogs. On wider screens,
dialogs keep their centered card layouts. Saved-record dialog behavior is described
in [viewing saved records](records.md#mobile-dialog-layout).
