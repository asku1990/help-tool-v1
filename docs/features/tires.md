# Tire Management

On the vehicle overview, the Tires card shows which set is mounted. Select **Manage tires**
to open that vehicle's Tires page. Viewers can read sets, notes, and change history. Owners
and editors can also make changes.

- **Add tire set** saves a stored set without mounting it. **Edit details** changes its name,
  type, optional purchase date, and optional notes. Record condition, such as tread depth
  or uneven wear, on the set you inspected.
- Use **Mount** for a stored set or **Change tires** for a swap. Choose the date and
  enter the exact odometer reading if you know it. The field is optional and starts
  blank. A swap moves the outgoing set to storage. Use the optional change note for the
  event itself, such as why you switched sets that day.
- In **Tire change history**, **Edit change** updates the date, reading, or note without
  changing the set's details or its own notes.
- Retire a set from storage. A retired set can be restored to storage with
  **Restore to stored** and mounted again. Mounted sets and sets with change history cannot
  be deleted individually.

## Mileage

- **Confirmed mileage** is the difference between the odometer readings at the start
  and end of each completed stint. Both must be confirmed. Missing and unverified readings
  leave the stint untracked; any confirmed subtotal is marked incomplete. Adding or
  correcting a reading in **Edit change** updates the affected totals.
- **Mileage since install** is a separate estimate for the currently mounted set. It uses
  the confirmed install reading and the latest recorded fill-up on a later date. A
  same-day fill-up is excluded because there is no way to know which came first. Expenses
  and the vehicle's initial odometer are not used.
- Existing readings and previous totals are preserved as **unverified**, not added to
  the confirmed subtotal. To confirm an old reading, enter the exact value in
  **Edit change**. Leaving a legacy reading blank in the edit form keeps the old value.
- Changes are ordered by date, then entry creation time. A backdated change does not
  replace a newer mount. Confirmed readings must not decrease across changes.
- Spreadsheet exports show `ConfirmedKm` for completed stints, separately from the
  unverified `PreviousTrackedKm`. `ConfirmedKm` is blank when no stint is confirmed
  and does not include the current estimate. Exported change logs distinguish blank
  odometers from zero readings and include confirmation status.
