# UMA Service — Mobile UI Design System

> **Scope:** Project-wide. Every existing and future page must follow these rules unless explicitly overridden.
>
> **Cursor rule:** `.cursor/rules/mobile-ui.mdc` (auto-applied for UI work)

---

## Design Philosophy

The application is used by showroom staff **50–100 times per day on mobile phones**.

### Priorities (in order)

1. Speed
2. Information density
3. One-hand mobile usage
4. Minimal scrolling
5. Primary task visibility
6. Compact layouts
7. Mobile-first design

The application must **never** feel like a desktop website squeezed into a mobile screen.

### Core question

> **Can the user perform their most common task without scrolling?**

If the answer is **NO**, redesign the page.

---

## Global UI Rules

### 1. Compact Header (60–80px max)

**Do not use:**

- "Home Appliance Service"
- Large role titles ("Technician Dashboard", "Reception Dashboard")
- Redundant subtitles ("Jobs assigned to you")

**Use:**

```
UMA SERVICE                              Logout
Jeeva (Technician)
```

Examples: `Reception`, `Jeeva (Technician)`, `Admin`

- App title is always **UMA SERVICE** (`APP_NAME` in `src/lib/constants.ts`)
- Second line shows user identity and role

### 2. Remove Unnecessary Headings

Avoid dashboard titles that repeat what the user already knows from their login role.

Only display headings when they provide **useful information** (e.g. a customer name in search results, a report period selector).

Prefer `PageHeader` with `compact` prop or omit entirely when the nav/header already provides context.

### 3. Information-First Principle

Every page content order:

1. Primary task
2. Important data
3. Statistics
4. Secondary actions
5. Settings

| Role | Page order |
|------|------------|
| **Technician** | My Jobs / All Jobs toggle → Job cards → Status summary → Search → Update Status |
| **Reception** | New Job → Search → Ready for Delivery → Today's Jobs |
| **Admin** | Reports / Collections → Job stats → Ready for Pickup → Settings |

---

## Mobile Design Rules

**Target viewports:** 390×844, 412×915

| Requirement | Target |
|-------------|--------|
| Job cards visible without scroll | ≥ 2 |
| Card padding | Minimal (`p-2.5` – `p-3`) |
| Section gaps | `mb-3` / `space-y-2` |
| Heading sizes | `text-sm` – `text-base`, not `text-2xl` |
| Main content padding | `p-3` on mobile |

- Prefer horizontal layouts over stacked sections when possible
- Prefer information density over decorative spacing
- Avoid large `CardHeader` padding — use compact section labels

---

## Job Card Design

**Do not use** verbose multi-line labels (Brand, Complaint, Assigned Technician as separate labeled rows).

**Use** this compact layout:

```
UT 10                    Ready
Customer Name              Call
Prestige Cooker
Not Heating
```

Rules:

- Status badge: top-right, always visible
- Call button: always visible
- Minimize vertical spacing
- Implemented in: `src/components/JobListCard.tsx`

**Exception:** Job Details (`/jobs/[id]`) and other detail pages — see [Page Types](#page-types) below.

---

## Page Types

Not every page should be ultra-compact. Match layout to the page's purpose.

### Operational Pages

These pages should be:

- Compact
- Minimal scrolling
- Action first
- Information dense

Examples:

- New Job
- Search
- Delivery
- Pending Jobs
- Technician Dashboard
- Ready For Delivery

### Analytical Pages

These pages should be:

- Readability first
- Slightly larger spacing is acceptable
- Information first

Examples:

- Admin Dashboard
- Reports
- Technician Analytics
- Collection Reports
- Brand Reports
- Appliance Reports

### Detail Pages

These pages should be:

- Readability first
- Section-based layout
- Easy to scan
- Compactness is **NOT** mandatory

Examples:

- Job Details Page (`/jobs/[id]`)
- Customer Details
- Report Details

**Job Details page order:**

1. UT Number
2. Customer Details (name, mobile + call, customer ID)
3. Product Details (type, brand, model)
4. Complaint
5. Physical Condition
6. Current Status
7. Assigned Technician
8. Completed By Technician
9. Service Amount
10. Remarks
11. Expected Delivery Date *(if available in data)*
12. Actions: Change Status, Print Receipt, Reprint Receipt, Call Customer

The "2 cards per screen" rule does **not** apply to detail pages.

---

## Call Button Rule

Wherever a customer mobile number or customer name is displayed, a **Call button/icon must be available**.

Examples:

- Search
- Pending Jobs
- Delivery
- Technician Dashboard
- Job Details
- Ready For Delivery
- Customer Tracking

The user should never have to copy or remember a mobile number.

Implemented via `CallCustomerButton` and `tel:` links on detail/action rows.

---

## Print Receipt Rule

Every Job Details page must always provide:

- **Print Receipt**
- **Reprint Receipt**

Used when a customer loses the original job card.

Workflow:

```
Search Customer → Open Job Details → Print / Reprint Receipt → Done
```

Implemented via `ReceiptActions` with `variant="jobDetail"` on `/jobs/[id]`.

---

## Role-Specific Rules

### Technician

- **Default view:** My Jobs (toggle to All Jobs)
- Assigned jobs **must** appear at the top — no scrolling before seeing jobs
- Order: toggle → cards → stats → search/update actions
- Technicians do **not** see service amounts on job cards
- Technicians do **not** create job cards

### Reception

**Priority:** New Job → Search → Ready for Delivery → Today's Jobs

**Must NOT see:**

- Total / Monthly / Yearly Collection
- Pending Collection totals
- Technician Revenue
- Brand Revenue
- Collection Reports

Reception may see individual job amounts at delivery/pickup when operational (delivery page, ready list).

### Admin

**Only admin** may view:

- Total / Monthly / Yearly / Pending Collection
- Technician Revenue & performance
- Average Service Amount
- Brand Revenue
- Collection Reports (`/admin?tab=reports`)

---

## Search Page

- Instant filtering (debounced input, no unnecessary submit-only flow)
- Customer history shows **only** for the searched customer
- Compact job cards with call button
- Minimal headings and scrolling

---

## Navigation

**Maximum 5 primary nav items:**

| Item | Route |
|------|-------|
| Home | `/dashboard` (reception/admin) or `/jobs/pending` (technician) |
| New Job | `/jobs/new` |
| Delivery | `/jobs/delivery` |
| Pending | `/jobs/pending` |
| Search | `/jobs/search` |

- Secondary actions (Admin settings, Reports) live **inside pages**, not in the main nav
- Admin access: link from admin dashboard or `/admin` bookmark

Implemented in: `src/components/AppNav.tsx`

---

## Performance

| Operation | Target |
|-----------|--------|
| Page load | < 500 ms |
| Search | < 500 ms |
| Job creation | < 2 s |
| Status update | < 1 s |
| Delivery | < 1 s |
| Reports | < 2 s |

Avoid:

- Duplicate API calls
- Multiple auth fetches per page
- Large API payloads
- Unnecessary loading states
- Blocking operations on the main thread

---

## Shared Components Reference

| Component | Purpose |
|-----------|---------|
| `AppShell` | Page wrapper, compact main padding |
| `AppNav` | Compact header + role-aware navigation |
| `PageHeader` | Optional; use `compact` or omit |
| `JobListCard` | Standard compact job row |
| `StatCard` | Compact stat tile |
| `TechnicianJobScopeToggle` | My Jobs / All Jobs |
| `ReadyPickupList` | Compact ready-for-pickup rows |

---

## Checklist for New Pages

- [ ] Primary task visible without scrolling on 390×844
- [ ] No redundant role/dashboard headings
- [ ] Job cards use `JobListCard`
- [ ] Call button present where customer contact is needed
- [ ] Financial data gated by role (admin only for collections/reports)
- [ ] Nav has ≤ 5 primary items
- [ ] Spacing uses compact tokens (`p-3`, `mb-3`, `space-y-2`)
- [ ] No duplicate API calls

---

## Mandatory Rule

Every existing page must be reviewed against this document when touched.

Every new component or page **must** follow these rules by default.

**Do not redesign functionality** — only improve mobile usability, information density, layout hierarchy, spacing, compactness, and performance perception.
