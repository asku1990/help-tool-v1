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

## Implementation

- Shared calculations: `lib/consumption/`, exported through `lib/consumption/index.ts`.
- Full-history loading: `app/api/vehicles/[vehicleId]/summary/route.ts`.
- Summary request and hook: `queries/vehicles/getVehicleSummary.ts` and
  `hooks/vehicles/useVehicleSummary.ts`.
- Per-trip list: `components/car/FillUpList.tsx`.
- Summary badges: `components/car/ConsumptionBadges.tsx`.
- Consumption chart: `components/car/charts/ConsumptionChart/`.

List handlers, summaries, badges, and charts reuse the shared calculations instead of maintaining
independent formulas. Changes to these feature rules belong here, not in the architecture document.
