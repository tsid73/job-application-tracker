# Design + Performance Implementation Plan

**Status:** In progress — Batch 1 (D1 ✓ D2 ✓ D11 ✓ 0a2d408) · Batch 2 (D3 ✓ D4 ✓ D10 ✓ 8b51b54) · Batch 3 (D5 ✓ D6 ✓ D7 ✓ bbc651a) · Batch 4 (D8 ✓ D9 ✓ P1 ✓ af2553b)  
**Rule:** Max 3 sub-agents at a time. Write handoff after every 2 batches (4 phases).

---

## Phase Order & Batching

### Batch 1 — D1 + D2 + D11 (CSS/Content, low risk)
### Batch 2 — D3 + D4 + D10 (Text cleanup + Insights + Banner)
### Batch 3 — D5 + D6 + D7 (Job Boards + Hero + Notes)
### Batch 4 — D8 + D9 + P1 (Docs redesign + Modal + Gzip)
### Batch 5 — P2 + P3 + P4 (DB queries + Startup + Pagination)

---

## Design Phases

### D1 — Heights & Responsive Layout
**Files:** `public/css/styles.css`, `public/js/app.js`  
**Status:** DONE ✓

- Add CSS var `--banner-h: 0px` on `:root`, set to `52px` via JS class when banner visible
- List table container (`#applicationsTable` or parent): replace fixed height with `calc(100vh - 180px - var(--banner-h))`
- Kanban board columns: same `calc()` treatment so columns fill vertical space
- Insights content area (inner scroll container): `calc(100vh - 160px - var(--banner-h))`
- Company List table: same pattern
- Detail page: hero card does NOT get fixed height — let it be natural height, tabs/content below it are what scroll

---

### D2 — Applications Header Stats Chips
**Files:** `public/js/render.js`, `public/js/app.js`, `public/css/styles.css`  
**Status:** DONE ✓ — `.stat-chip`, `.stat-dot`, `.stat-active/interview/offer/accepted` CSS added; `buildStatChips()` in both render.js and app.js

Current: `<p>124 active, 41 interviews scheduled, 0 archived shown</p>`

Replace with chip row:
```html
<div class="header-stats">
  <span class="stat-chip stat-active">● 124 Active</span>
  <span class="stat-chip stat-interview">◆ 41 Interviews</span>
  <span class="stat-chip stat-offer">○ 20 Offers</span>
  <span class="stat-chip stat-accepted">✓ 18 Accepted</span>
</div>
```

CSS:
```css
.stat-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 500;
}
.stat-active   { background: color-mix(in srgb, var(--blue) 12%, transparent); color: var(--blue); }
.stat-interview{ background: color-mix(in srgb, var(--amber) 12%, transparent); color: var(--amber); }
.stat-offer    { background: color-mix(in srgb, var(--purple) 12%, transparent); color: var(--purple); }
.stat-accepted { background: color-mix(in srgb, var(--green) 12%, transparent); color: var(--green); }
```

- Zero-value chips hidden (`display: none` when count is 0)
- No other changes to header — no buttons moved, filters stay below as-is
- Only applies to Applications list page — NOT Kanban, Company List, or Job Boards

---

### D3 — Redundant Text & Noise Cleanup
**Files:** `public/js/render.js`, `public/js/app.js`  
**Status:** TODO

Remove/replace exactly:

| File/Location | Find | Action |
|---|---|---|
| Activity view render | `"Activity Query"` label/heading above search | Remove entirely |
| Company List render | Inner card `<h2>Company List</h2>` | Remove (page h1 already says it) |
| Content tab render | `"This is the canonical document workspace. Open existing assets directly. Generate only when a document type does not exist yet."` subtitle | Remove |
| Doc card (not generated) | `"No saved document yet."` text | Remove |
| Doc card (generated) | `"Current document"` section label | Remove |
| Generation Summary section | Whole Gemini 0 / AWS 0 section | Hide when both counts = 0, only show when queued > 0 or failed > 0 |

---

### D4 — Insights Page Redesign
**Files:** `public/js/render.js`, `public/css/styles.css`  
**Status:** TODO

4a. Funnel + Responses: split into two distinct sub-cards side by side (each with own border/bg)

4b. Funnel chart: replace SVG triangle with horizontal bar rows:
```
Applied     ████████████████████ 222
Interview   ████                  41  (18%→)
Offer       ██                    20  (49%→)
Accepted    ██                    18  (90%→)
```

4c. Response card: show response rate % prominently at top, colored bars below (Responded=blue, Rejected=red, Ghosted=muted)

4d. Top Tags grid: `grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))` — 2/3/4 cols based on width

4e. Tag rows: name left, count + interview % chip right. % chip: green if above average, muted if average/below

4f. Standardize all section headers (Lifecycle, Status Distribution, Time in Stage, Monthly Applications, Top Tags) to one consistent small label style

---

### D5 — Job Boards: Table Layout
**Files:** `public/js/render.js`, `public/css/styles.css`  
**Status:** TODO

Convert 2-col card grid to table:

Columns: NAME | DESCRIPTION | LAST CHECKED | ACTIONS

- Name: bold, full name
- Description: `max-width: 300px`, truncated with ellipsis, click → small expand or popover
- Last Checked: "Never" or relative time, muted
- Actions: `[↗ Visit]` `[✎ Edit]` `[🗑 Delete]` icon buttons, right-aligned
- "Add Job Board" button stays where it is (top right of section)
- Empty state: full-width "No job boards added yet" message in table body
- Use same table styles as applications list for visual consistency

---

### D6 — Detail Page Hero Card
**Files:** `public/js/render.js`, `public/css/styles.css`  
**Status:** TODO

6a. Action buttons (↗ view posting, 📋 copy JD) → `position: absolute; top: 16px; right: 16px` on hero card (card already `position: relative`). No longer in document flow below tags.

6b. Tags: show first row only (single line with `overflow: hidden`). Add `+N more` chip at end showing count of hidden tags. Click `+N more` → expand inline (toggle class).

6c. Breadcrumb: detail page h1 currently shows "Applications" same as list page. Change to: `← Applications` as a back-link + company name as the page title.

6d. Status badges (Rejected, Closed / Active, etc.) → move to left of title row, smaller pill style, consistent with stat chips from D2.

---

### D7 — Company Notes Modal + Recruiter Questions
**Files:** `public/js/render.js`, `public/css/styles.css`  
**Status:** TODO

7a. Company Notes:
- Collapse all inline textareas to read-only preview rows:
  ```
  Company Notes                              [Edit ✎]
  About:  "Products, market, competitors..."   ← 1-line truncated
  Role:   Not set
  ```
- `[Edit ✎]` → opens single modal with all note sections stacked
- Modal: title "Edit Company Notes", sections as labelled textareas, `[Cancel] [Save]` footer

7b. Recruiter Questions:
- Input textarea: `max-height: 120px; resize: vertical; overflow-y: auto`
- Questions list below: `max-height: 200px; overflow-y: auto; scrollbar-width: thin`

---

### D8 — Generated Documents: Content Tab Redesign
**Files:** `public/js/render.js`, `public/css/styles.css`  
**Status:** TODO

8a. 2-col compact grid replacing one-per-row full-width cards:
```
[ Tailored CV   ● Ready    Jun 30  [Open] ]  [ Cover Letter   ○ —  [Generate] ]
[ ATS Check     ○ —        [Generate]      ]  [ Role Fit       ○ —  [Generate] ]
[ Follow-up     ○ —        [Generate]      ]
```

8b. Status badge: `● Ready` green, `○` muted for not generated

8c. Not-generated: outline `[Generate]` button (not full blue)

8d. **Closed/rejected/withdrawn/ghosted apps**:
- If doc exists: show `[View]` only — no regenerate, no delete shown in grid
- If no doc: show `—` dash, no button
- "Generate Missing (N)" button hidden entirely
- Provider toggle (Gemini/AWS) hidden

8e. Active apps: "Generate Missing (N)" stays, provider toggle stays

8f. Remove all redundant text per D3

---

### D9 — Document Viewer Modal Redesign
**Files:** `public/js/render.js`, `public/css/styles.css`  
**Status:** TODO

9a. Title: remove inner `<h2>` duplicate. Modal header title is the only title.

9b. Metadata strip (one line below modal title):
`Gemini · gemini-3-flash-preview · Version 1 · Jun 30, 2026, 9:07 PM`

9c. Remove STATUS, SAVED VERSIONS, FORMAT as separate boxes — info already in metadata strip

9d. Remove `"1 saved"` heading above version list

9e. Version list: each row = `Version N · Latest/date  [Open]` — single Open button per row

9f. Remove `"Open Tailored CV"` standalone button (redundant with version Open)

9g. Actions: `[Download]  [Copy Text]` = equal secondary buttons. `[Regenerate]` = outline button. `[···]` overflow = Delete (no longer red visible button)

---

### D10 — Priority Banner Redesign
**Files:** `public/css/styles.css`, `public/js/app.js`  
**Status:** TODO

10a. Collapsed banner: slim 36px height (vs ~52px current)
```
⚠  1 overdue · 7 upcoming reminders                    [View →]  [×]
```
- Background: `color-mix(in srgb, var(--warning, #f59e0b) 8%, transparent)`
- No thick red left border
- Auto-hide when 0 reminders
- `[×]` dismisses for session

10b. Expanded state: overlay panel slides down OVER content (not pushing it). Backdrop `rgba(0,0,0,0.2)` behind panel. Content does not shrink.

10c. CSS var `--banner-h: 36px` when collapsed visible, `0px` when hidden — used by D1 calc() heights

---

### D11 — Toolkit Content
**Files:** `public/js/render.js`  
**Status:** DONE ✓ — 7 cards, "Why Toolkit Exists" removed, Offer Evaluation + Interview Day Checklist added

Remove: `01 — Why Toolkit Exists`

Updated card list:
```
01  Application Readiness      Run before submitting — confirm link, 2-3 tags, one-sentence hook
02  Company Research Frame     Use to fill Company Notes — products, competitors, roadmap, team
03  Recruiter Call Guide       Use during recruiter screen — ask stage, eliminator, team problems
04  Interview Story Bank       Build before interviews — STAR stories mapped to common questions
05  Follow-up Playbook         Use after calls — when to follow up, what to say, when to stop
06  Offer Evaluation           Run when offer arrives — salary, equity, scope, growth, team signals
07  Interview Day Checklist    Run morning of interview — logistics, mindset, questions for panel
```

---

## Performance Phases

### P1 — Network Bandwidth
**Files:** `server/utils/http.js`  
**Status:** TODO

- `serveStatic()`: add gzip compression for `.js`, `.css`, `.html` responses
- Change `'cache-control': 'no-store'` → `'cache-control': 'public, max-age=3600'` for static assets
- Add `content-encoding: gzip` header when serving compressed

### P2 — DB Query Savings
**Files:** `server/services/readApi.js`, `public/js/app.js`  
**Status:** TODO

- `getApplications()` line ~368: remove `a.notes` from SELECT
- `getReminders()` lines 22-68: add date bounds (`applied_date >= CURRENT_DATE - INTERVAL '30 days'`) to unbounded UNION sections
- `refreshApplicationRow()` `app.js:713-724`: change to fetch `/api/applications/:id` not all apps

### P3 — Startup Waterfall
**Files:** `public/js/app.js` line 37  
**Status:** TODO

- Remove from startup `Promise.all`: `loadJobBoards`, `loadTargetCompanies`, `loadReminders`, `loadCVs`
- These already lazy-load on view switch — remove duplicate startup call
- `loadNotifications()`: skip re-fetch on non-date-changing actions (status changes that don't affect dates)

### P4 — Pagination
**Files:** `server/services/readApi.js`, `public/js/render.js`, `public/js/app.js`  
**Status:** TODO

- `getApplications()`: add `LIMIT 50 OFFSET $n` 
- API: accept `?page=N` param
- Frontend: page controls (prev/next + page number) below table, or infinite scroll trigger

---

## Handoff Checkpoints

| After Batch | Update this doc with: |
|---|---|
| Batch 1 (D1+D2+D11) | Mark phases done, note any CSS var names used, flag issues |
| Batch 2 (D3+D4+D10) | Note render.js function names changed, CSS class names added |
| Batch 3 (D5+D6+D7) | Note modal IDs added, JS functions added |
| Batch 4 (D8+D9+P1) | Note API changes, compression flags |
| Batch 5 (P2+P3+P4) | Final status |
