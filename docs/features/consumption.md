# Fuel Consumption and Vehicle Summaries

This document owns the fuel-consumption feature's calculation and display behavior.
For application layers and dependency rules, see [architecture](../architecture.md).

## Completed Trips

- Order fill-ups by timestamp ascending, then odometer ascending, with a deterministic ID
  tie-breaker. Do not assume server response or insertion order is chronological.
- A consumption segment runs from one full tank to the next. Use the odometer difference and
  include fuel and cost from intervening partial fills plus the ending full fill; exclude the
  starting full fill. Unfinished intervals do not produce consumption values.

## Calculations

- Consumption is `100 × total liters / total distance`. Cost per 100 km is
  `100 × total fuel cost / total distance`. Aggregate totals first rather than averaging trip
  rates equally.
- AVG (3) and AVG (6) use the latest three or six completed segments, or all available completed
  segments if fewer exist. Badges and charts use the same distance-weighted calculation.
- Lifetime and period summaries use complete relevant history independently of loaded list
  pages. A total over loaded rows must be labeled as such.
- A period's consumption distance and fuel cost use segments ending in that period; this is
  an interval-based estimate, not a daily allocation of driving. Spend and category breakdowns
  use record dates.
- Month-to-date spending uses the current calendar month in `Europe/Helsinki`, including
  daylight-saving changes, regardless of the API server's timezone. Both fill-up and expense
  dates are evaluated in that reporting timezone. The 30/90-day windows remain rolling durations.
- No completed distance means unavailable consumption or cost/km, not zero. JSON uses `null`
  for unavailable ratios; the UI displays an unavailable marker.

## Per-Trip Display

Consumption badges compare against the previous completed trip:

- Green: lower consumption.
- Red: higher consumption.
- Neutral: unchanged or no previous trip to compare.

These are relative comparisons, not absolute efficiency ratings. Keep the numeric value,
signed delta when available, and comparison description readable without relying on color.
Partial fill-ups and the initial full-tank baseline do not have completed-trip consumption.

On smaller screens, completed trips have their own line below the purchase details and notes.
Distance sits on the left and the consumption badge on the right. The delta can wrap
below the badge if space runs out. In table layout, trip figures have a labeled column
in the fill-up table. Fill-ups and Expenses stack at the full
vehicle-page content width so switching to Chart does not constrain the chart to a column.

## Consumption Chart

- The vehicle's Fill-ups section uses a segmented **List / Chart** switch with one selected view.
- Recharts renders one point per completed full-tank-to-full-tank segment, dated by its ending
  fill-up. Points are ordered chronologically and spaced by elapsed time.
- The axes show calendar dates and consumption in L/100 km. The actual span of completed
  segments determines the date labels, not the selected range's maximum duration.
  Spans up to 62 days show day.month labels (for example, 20.10.) at daily, three-day,
  or weekly intervals. Longer spans show month.year labels (for example, 3.2026) at month
  boundaries. Labels are independent of trip dates and may be skipped to avoid overlap
  on narrow screens. A single trip still has a date label.
  Month tick generation is capped at 24 ticks, using a larger month interval for long
  histories; invalid segment dates are ignored.
  Hovering or tapping a point shows its exact date, consumption, and completed segment distance.
- The 30/90/180-day, 1 year (rolling 365 days), 2 years (rolling 730 days), and All filters select
  segments by their ending date. The dashed line and Avg/Min/Max summary describe the selected
  segments; the average remains distance-weighted.
- A single completed segment is shown as a point; no segments in the selected range shows
  the empty state rather than a zero-consumption chart.
- On narrow charts, the unit stays in the title and is not repeated on the vertical axis.

## Implementation

- Shared calculations: `lib/consumption/`, exported through `lib/consumption/index.ts`.
- Full-history loading: `app/api/vehicles/[vehicleId]/summary/route.ts`.
- Summary request and hook: `queries/vehicles/getVehicleSummary.ts` and
  `hooks/vehicles/useVehicleSummary.ts`.
- Per-trip list: `components/car/fillups/FillUpList.tsx`.
- Summary badges: `components/car/vehicle-detail/ConsumptionBadges.tsx`.
- Consumption chart: `components/car/charts/ConsumptionChart/`.

List handlers, summaries, badges, and charts reuse the shared calculations instead of maintaining
independent formulas. Changes to these feature rules belong here, not in the architecture document.
