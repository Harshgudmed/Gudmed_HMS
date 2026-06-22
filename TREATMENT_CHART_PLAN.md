# Treatment Chart / Scheduled Orders — Build Plan

## The problem (in plain words)

When a doctor orders something that **repeats** — e.g. *"ABG 3 times a day for 2 days"*, *"Inj. Heparin BD for 3 days"*, or *"Chest X-ray daily for 2 days"* — the system today only stores the words **"frequency"** and **"duration"** as plain text. It never breaks them into the **actual individual times** the task must happen.

As a result:
- **Medicines** have only a half-working chart (4 fixed daily slots, navigate day by day).
- **Lab tests** (CBC, ABG) have **no chart at all** — one order, one tick.
- **Radiology** has **no chart at all**.

So a nurse cannot see "this test is due 6 times" and tick each one off.

## The goal

One **Treatment Chart** in the nurse portal that works for **medicines, lab tests, and radiology** alike:

1. Doctor places a repeating order (frequency + duration).
2. The system **expands** it into the exact occurrences (e.g. `TDS × 2 days` → 6 slots at 08:00, 14:00, 20:00 on each day).
3. The nurse sees a **chart/table** of every occurrence.
4. The nurse **ticks ✔️** each one when done → the record saves automatically (time + nurse name).

## How it's built

### 1. New data table — `OrderTask`
Each repeating order generates one `OrderTask` row **per occurrence**:

| Field | Meaning |
|---|---|
| `orderId` | which order this belongs to |
| `orderType` | LAB / RADIOLOGY / PHARMACY / PROCEDURE |
| `itemName` | snapshot of the test/drug name |
| `scheduledAt` | the exact date + time this occurrence is due |
| `status` | DUE / DONE / MISSED / HELD / SKIPPED |
| `doneAt`, `doneByName` | when and who completed it |
| `resultValue`, `notes` | optional reading / observation |

### 2. Schedule expander (`scheduleService.js`)
Reads the order's **frequency** and **duration** and produces the list of occurrence times.

| Frequency | Times per day |
|---|---|
| OD / QD | 08:00 |
| BD / BID | 08:00, 20:00 |
| TDS / TID | 08:00, 14:00, 20:00 |
| QID | 08:00, 14:00, 20:00, 22:00 |
| HS | 22:00 |
| q6h / q8h ("every N hours") | spread across the day |
| STAT / SOS / PRN / blank | single occurrence |

Duration like *"2 days" / "2d" / "x2"* → 2 days. (Safety cap so a typo can't generate thousands of rows.)

### 3. Auto-generate on order creation
When a repeating order is created, its occurrences are generated automatically. (If generation fails, the order itself is unaffected — occurrences can be regenerated.)

### 4. Backend endpoints
- `GET  ?resource=order-tasks&admissionId=…` — fetch the chart for a patient.
- `PATCH ?resource=order-task` — tick a slot (set DONE/MISSED + who/when).

### 5. Nurse portal — "Treatment Chart" tab
A new tab in the Nursing Station, with date navigation (like the medicine chart). Each **row** is an order; each **cell** is a scheduled occurrence with a **Tick** button → green badge once done. Covers medicines, labs, and radiology in one place.

## Rollout order
1. Data model + schedule expander (backend) — *foundation*
2. Auto-generation + endpoints (backend)
3. Treatment Chart tab (frontend) — *what the nurse sees*

## Not in this phase (future)
- Auto-marking overdue slots as MISSED on a timer.
- Lab result-value capture inline (currently a free-text field).
- Linking each tick to billing.
