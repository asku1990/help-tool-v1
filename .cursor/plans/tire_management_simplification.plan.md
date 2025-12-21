# Tire Management Simplification Plan

## Current State (Confusing)

The tire tracking is split across multiple areas:

1. **TIRES expense category** — For logging tire purchase costs
2. **TireManager component** — For creating/managing tire sets (TireSet model)
3. **TireUsageChart component** — For visualizing km per tire set
4. **TireChangeLog model** — For tracking when tires are swapped

This creates confusion: Do I add a tire expense OR use TireManager? What's the difference?---

## Options to Simplify

### Option A: Expenses-Only (Simplest)

**Remove all tire-specific tracking. Just use expenses.**

- Delete: `TireSet`, `TireChangeLog` models
- Delete: `TireManager`, `TireUsageChart` components
- Keep: `TIRES` expense category with notes like "Winter tires installed"

**Pros:**

- Simplest approach
- No extra UI complexity
- Consistent with how other expenses work

**Cons:**

- Can't track which tire set is currently on the car
- No structured history of tire changes

---

### Option B: Integrated Tire Tracking (Balanced)

**Simplify TireManager but keep structured tracking.**

- Keep: `TireSet` model (name, type, status)
- Keep: `TireChangeLog` for swap history
- Remove: `TireUsageChart` (overkill)
- Modify: When adding TIRES expense, optionally link to a tire set
- Add: Simple "Current Tires" badge on vehicle page

**Pros:**

- Structured tracking of tire sets
- Simple UI (no complex charts)
- Clear what's on the car now

**Cons:**

- Still some complexity

---

### Option C: Remove Tire Tracking Entirely

**Remove everything tire-related.**

- Delete: `TireSet`, `TireChangeLog` models
- Delete: `TireManager`, `TireUsageChart` components
- Delete: `TIRES` expense category
- Use: `MAINTENANCE` category with notes for tire info

**Pros:**

- Minimal complexity
- Consistent with basic expense tracking

**Cons:**

- No dedicated tire tracking at all

---

## Recommendation

**Option B (Integrated Tire Tracking)** seems like the best balance:

1. Remove `TireUsageChart` — it's overkill for most users
2. Simplify `TireManager` — just show:

- Current active tire set (badge style)
- Button to "Change Tires" (logs to TireChangeLog)
- List of tire sets with basic info

3. Keep `TIRES` expense — for purchase/service costs
4. Optional: Link TIRES expense to a tire set

---

## Next Steps

- [ ] Discuss with user which option to implement
- [ ] If Option B: Remove TireUsageChart
- [ ] If Option B: Simplify TireManager to show current tires + change button
- [ ] If Option A: Remove TireSet, TireChangeLog, TireManager, TireUsageChart
- [ ] Update tests accordingly
- [ ] Update migration if models removed

---

## Questions for User

1. What tire info do you actually need to track?

- Just costs?
- Which tires are on the car now?
- When you swap summer/winter?
- Tire wear/km per set?

2. How often do you swap tires?

- Twice a year (summer/winter)?
- Rarely?
