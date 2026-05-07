# FJ SafeSpace — Design Overhaul Proposal

> **Date:** 2026-05-07
> **Scope:** Full frontend UI redesign
> **Status:** Proposal — awaiting approval before implementation
> **Tech:** Next.js 15, Tailwind CSS, shadcn/ui, Recharts
> **Brand:** Colors and fonts locked per `DESIGN_GUIDELINES.md` — this proposal is structural/layout/interaction improvements only

---

## 1. Design Philosophy

### Problem

The brand guidelines define a strong, deterministic, engineering-precision aesthetic — **medical instrument meets mission control**. The current UI follows the brand colors and fonts but doesn't execute on the *density* and *data-forward* intent of the guidelines. Elements are buried in nested cards, tables lack sparklines, empty states are missing, and inline modals replace proper dialogs. The redesign aligns the UI with the brand's "operational cockpit" DNA.

### Principle: Data Is the Hero

From `DESIGN_GUIDELINES.md` §1.1:
> "The dashboard should feel like a modern command center — clean, data-rich, and trustworthy"

From §4.2:
> "Bias toward high information density. Command centers show structured data without excessive white space."

The redesign tightens density, amplifies data visibility, and adds the missing presentation layers (KPIs, sparklines, timelines) — while keeping all brand colors, fonts, and motion intact.

### What Stays vs What Changes

| Category | Decision |
|----------|----------|
| **Primary color** `#8700E3` (fj-purple) | **LOCKED** — no change |
| **Semantic colors** (green, amber, red) | **LOCKED** — no change |
| **Gray scale** (50–300) | **LOCKED** — no change |
| **Fonts** (Montserrat + Inter + JetBrains Mono) | **LOCKED** — no change |
| **Border radius** (rounded-lg cards, rounded-full buttons) | **LOCKED** — no change |
| **Motion** (fadeIn, glowPulse, scanLine, dot-grid) | **LOCKED** — no change |
| **Layout structure** (top nav → sidebar) | **PROPOSED** |
| **Data presentation** (KPI cards, sparklines, score bars, timeline) | **PROPOSED** |
| **Component patterns** (Dialog, empty states, skeleton loading) | **PROPOSED** |
| **Information density** (spacing adjustments, card wrappers removed) | **PROPOSED** |

---

## 2. Typography Alignment

The brand guide already defines the type scale. The current code partially follows it. This proposal **enforces** the existing guidelines more strictly.

### What the Code Does Now vs What It Should Do

| Element | Current Code | Brand Guide | Action |
|---------|-------------|-------------|--------|
| Page title (H1) | `text-2xl font-bold` | `text-3xl font-heading font-bold` | Bump to `text-3xl` |
| Section title (H2) | `text-lg font-bold` | `text-2xl font-semibold` | Bump to `text-2xl`, reduce to semibold |
| Card title (H3) | `text-lg font-bold` | `text-lg font-semibold` | Keep size, reduce to semibold |
| KPI/metric value | `text-3xl font-bold` | `text-4xl font-bold tabular-nums` | Bump to `text-4xl`, add tabular-nums |
| Wellness score | `text-xl font-bold` | `font-mono tabular-nums` for data | Add `font-mono tabular-nums` |
| Body text | default (14px/Inter) | `text-sm font-normal` | Already correct |
| Labels/badges | `text-[10px]` | `text-xs font-medium tracking-wider` | Bump to `text-xs`, add tracking |

### Key Change: Monospace for Data Numbers

All wellness scores, metric values, and sensor readings should use `font-mono tabular-nums`. The brand guide explicitly calls for this (§3.2, §5.1) but it's not consistently applied.

```tsx
// Before
<div className="text-xl font-bold">{score.toFixed(1)}%</div>

// After
<div className="text-4xl font-mono tabular-nums font-bold">{score.toFixed(1)}%</div>
```

### Font Weight: Bold → Semibold for Headings

The guide says `font-bold` (700) for H1/data metrics but `font-semibold` (600) for H2/H3. The current code uses `font-bold` everywhere. This should be corrected per the type scale.

---

## 3. Color System — Already Defined, Just Needs Consistency

### Current Issue

The brand guide defines CSS variables in `globals.css` and semantic color tokens, but the codebase has **hardcoded Tailwind utilities** scattered throughout:
- `bg-red-50`, `text-red-700`, `border-red-200` in executive page
- `bg-green-50`, `text-green-600` in risk cards
- `text-muted-foreground` (Tailwind default) instead of `var(--foreground)`

### Proposed: Use Brand Tokens Consistently

| Semantic | Brand Token | Current Hardcoded Values to Replace |
|----------|------------|-----------------------------------|
| Healthy/Pass | `bg-green-50 text-green-700 border-green-200` | Already matches — keep as-is |
| Warning | `bg-amber-50 text-amber-700 border-amber-200` | `bg-amber-50 border-amber-200` → add `text-amber-700` |
| Critical | `bg-red-50 text-red-700 border-red-200 animate-glow` | Missing `animate-glow` class on critical badges |
| Brand | `bg-primary/10 text-primary border-primary/20` | `bg-primary/10` used, but `border-primary/20` not always |

### Missing CSS Animations in globals.css

The brand guide defines 4 custom animations (§5.5). Need to verify these exist in `globals.css`:
- `animate-fade-in` — fade in with translateY
- `animate-glow` — critical indicator pulse
- `animate-scan` — navbar scanning line
- `bg-dot-grid` — dot-grid background

**Action:** Audit `globals.css` and add any missing animations from the brand guide.

---

## 4. Layout: Top Nav → Sidebar

### Current

Sticky top navbar (56px) with text links: Scan Listings | Executive Summary | Customers

### Proposed: Left Sidebar (240px)

```
┌──────────────┬─────────────────────────────────────────┐
│              │  Header bar (thin, shows breadcrumbs)   │
│  FJ SafeSpace│  ────────────────────────────────────── │
│  ────────────│                                         │
│  Scans  [12] │  MAIN CONTENT                          │
│  Sites   [4] │  max-w-7xl px-6 py-6                   │
│  Executive   │                                         │
│  Customers   │                                         │
│              │                                         │
│  ────────────│                                         │
│  Settings    │                                         │
│              │                                         │
│  [Avatar]    │                                         │
│  jeff@fj     │                                         │
└──────────────┴─────────────────────────────────────────┘
```

**Details (all aligned to brand guide):**
- Active state: `bg-accent text-accent-foreground border-l-2 border-primary` (§5.3)
- Badge counts: `bg-primary/10 text-primary font-mono text-xs rounded-full`
- Icons: Lucide React, `h-4 w-4` (§7.1)
- Background: `bg-card border-r border-gray-200`
- Collapses to icon-only on tablet (`md` breakpoint, §9.2)
- Mobile: hamburger menu (§9.2)
- Fixed position, scrolls independently

**Why sidebar:** The brand guide describes this as an "operational cockpit" (§1.1). Sidebars are standard for command-center interfaces (Linear, Vercel, Grafana). Top nav reads like a website; sidebar reads like a tool.

---

## 5. Page-by-Page Redesign

### 5.1 Scan Listing (Home Page — `/`)

**Current:** Page title → Card → buttons → filter bar → table. Everything wrapped in a card.

**Proposed:**

```
┌──────────────────────────────────────────────────────────┐
│  Scan Listings                            [+ Load Scan]   │
│  IAQ scan results across all monitored sites              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Sites    │  │ Scans    │  │ Avg WI   │               │
│  │          │  │          │  │          │               │
│  │  12      │  │  847     │  │  78.3%   │               │
│  │  ↑ 2     │  │  +34     │  │  ↑ 1.2%  │               │
│  └──────────┘  └──────────┘  └──────────┘               │
│                                                          │
│  [🔍 Search sites...]                 [Scan Type ▼]      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Site         Last Scan   WI      Outcome  Findings │  │
│  │ ● Changi T3  2026-04-28  94.2%   PASS   2        │  │
│  │ ● New Park   2026-04-28  87.1%   PASS   5        │  │
│  │ ● Raffles    2026-04-15  72.8%   WATCH  12       │  │
│  │ ● Marina Bay 2026-04-15  45.2%   FAIL   28       │  │
│  │                                                    │  │
│  │  (striped rows, sticky header, hover:bg-accent/30) │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Changes:**

1. **3 KPI cards** at top — compact status cards (§6.2):
   - Active sites (with trend arrow)
   - Total scans (with today's count)
   - Average Wellness Index (with trend)
   - Numbers: `font-mono tabular-nums text-4xl font-bold`
   - Card style: white bg, `shadow-sm`, `rounded-lg`, `border border-gray-200` (§6.2)
   - Featured card (Avg WI): add `border-l-2 border-l-primary bg-accent/50`

2. **Filter bar** — moved outside card, inline row:
   - Search with icon, flex-grow
   - Scan Type dropdown, fixed width
   - Action buttons (`Load Scan Data` — primary, `rounded-full`; `Register Customer` — secondary, `rounded-md`)

3. **Table** — no card wrapper, table breathes:
   - Add **status dot** `●` before site name (colored per outcome)
   - Critical sites: `animate-glow` on the dot (§5.5)
   - Wellness Index: `font-mono tabular-nums`, color-coded text
   - Striped rows: `even:bg-gray-50/50` (§6.4)
   - Sticky header: `sticky top-0 bg-white z-10` (§6.4)
   - Hover: `hover:bg-accent/30` (§6.4)
   - Clickable row with cursor pointer

4. **Empty state** (§8.3):
   ```
   ┌─────────────────────────────────────────┐
   │  [ShieldCheck icon, h-12 w-12, muted]   │
   │                                         │
   │  No scan data yet                       │
   │  Upload a scan to get started.          │
   │                                         │
   │  [Load Scan Data]                       │
   └─────────────────────────────────────────┘
   ```

### 5.2 Executive Summary (`/executive`)

**Current:** Header → scan selector → standard selector → health summary card → 3-col grid.

**Proposed:**

```
┌──────────────────────────────────────────────────────────┐
│  Executive Summary                     [All Scans ▼]     │
│  Portfolio-level IAQ wellness overview                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                │
│  │ Sites │ │Certif │ │ AtRisk│ │Avg WI │                │
│  │  12   │ │  5 ●  │ │  3 ▲  │ │ 78.3% │                │
│  └───────┘ └───────┘ └───────┘ └───────┘                │
│                                                          │
│  ┌─────────────────────────────┐ ┌─────────────────────┐ │
│  │  Wellness Distribution      │ │  Top Risks          │ │
│  │                             │ │                     │ │
│  │  Certified  ████████ 42%    │ │  ● CO2: Site A      │ │
│  │  Verified   ██████   25%    │ │  ● PM2.5: Site B    │ │
│  │  Needs Attn ████    25%    │ │  ● TVOC: Site C     │ │
│  │  No Data    ██       8%    │ │                     │ │
│  │                             │ │  ───────────────── │ │
│  │  (horizontal bars, brand    │ │                     │ │
│  │   colors, font-mono nums)   │ │  Recommended Actions│ │
│  │                             │ │  1. Install...     │ │
│  └─────────────────────────────┘ └─────────────────────┘ │
│                                                          │
│  [SS 554] [WELL v2] [RESET] [SafeSpace]  [⚠ Needs attn]  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Site Leaderboard                                  │  │
│  │                                                    │  │
│  │  #1  Changi T3      [████████████████░░]  94.2%  ✓ │  │
│  │  #2  New Park Est.  [███████████████░░░]  87.1%  ✓ │  │
│  │  #3  Raffles Twr    [█████████████░░░░░]  72.8%  ⚠ │  │
│  │  #4  Marina Bay     [████████░░░░░░░░░░]  45.2%  ✕ │  │
│  │                                                    │  │
│  │  (score bars: fj-green for >75%, amber 50-75%,    │  │
│  │   fj-red for <50%. font-mono tabular-nums)        │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Changes:**

1. **KPI strip** — 4 compact cards replacing `HealthSummaryCard`:
   - Sites, Certified (with green dot), At Risk (with amber triangle), Avg WI
   - Style per §6.2 status cards: "Colored icon + large number + label"
   - Numbers: `font-mono tabular-nums`

2. **Wellness Distribution** — horizontal bar chart (Recharts):
   - Sharp bars, no rounded corners (deterministic, §5.1)
   - Colors: `--fj-green` for certified, `--fj-blue` for verified, amber for needs attention, gray for no data
   - Labels with font-mono percentages
   - Replaces the current `AnimatedMetric` approach

3. **Top Risks** — cleaner list:
   - Status dots instead of colored backgrounds (less visual noise)
   - Critical: `animate-glow` on the dot
   - Site name bold, metric in monospace
   - Keep the recommended action text

4. **Standard Selector** — inline pill toggles:
   - `rounded-full` badges: `bg-primary/10 text-primary border-primary/20` (brand badge style, §6.3)
   - Active: filled `bg-primary text-white`
   - "Needs attention" checkbox stays

5. **Leaderboard with Score Bars:**
   - Rank column: `#1`, `#2` — `font-mono text-muted-foreground`
   - **Score bar** per row: progress bar using brand colors
     - `--fj-green` for ≥75%, amber for 50-75%, `--fj-red` for <50%
     - Rounded ends: `rounded-full`
   - Outcome: compact icon + label (not full badge text)
     - `✓ Certified` (green), `⚠ Improvement` (amber), `✕ Insufficient` (red)
   - Hover: `hover:border-primary/50 hover:shadow-sm` (§5.3) — **no translateY**

6. **Site Findings** — replace inline modal with shadcn `<Dialog>`:
   - Proper keyboard support (Escape to close)
   - Slide-in from right (or standard dialog center)
   - Backdrop: `backdrop-blur-sm bg-white/80` (§5.4)

### 5.3 Site Detail (`/sites/[siteId]`)

**Current:** Site overview card, standard selector, zone table, scan history.

**Proposed:**

```
┌──────────────────────────────────────────────────────────┐
│  ← All Sites    Site Overview                            │
│                 New Park Estate — Block A                │
│                 Last scan: 2026-04-28                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌───────────────────────────────┐ ┌───────────────────┐ │
│  │                               │ │  Wellness Index   │ │
│  │  Overall Wellness: 87.1%      │ │                   │ │
│  │  (font-mono, text-4xl, bold)  │ │  (Radial Gauge)   │ │
│  │                               │ │                   │ │
│  │  SS 554    [████████░░]  82%  │ │  Score in center  │ │
│  │  WELL v2   [█████████░]  91%  │ │  font-mono 87.1%  │ │
│  │  RESET     [██████░░░░]  68%  │ │  ● PASS           │ │
│  │  SafeSpace [████████░░]  85%  │ │                   │ │
│  │                               │ │                   │ │
│  └───────────────────────────────┘ └───────────────────┘ │
│                                                          │
│  [SS 554] [WELL v2] [RESET] [SafeSpace]                  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Zone Readings                                     │  │
│  │                                                    │  │
│  │  Zone   CO2      PM2.5   TVOC   Temp   RH   Status │  │
│  │  ───────────────────────────────────────────────── │  │
│  │  A      450 ppm  8       0.3    22°C   55%   ●    │  │
│  │  B      1,200ppm 22      1.2    25°C   70%   ▲    │  │
│  │  C      380 ppm  5       0.1    21°C   48%   ●    │  │
│  │  (numbers right-aligned, font-mono, tabular-nums)  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Scan History                                      │  │
│  │                                                    │  │
│  │  ●  2026-04-28   PASS    87.1%   3 zones  [View]  │  │
│  │  │                                                 │  │
│  │  ●  2026-04-15   WATCH   72.3%   3 zones  [View]  │  │
│  │  │                                                 │  │
│  │  ●  2026-03-28   PASS    89.5%   3 zones  [View]  │  │
│  │                                                    │  │
│  │  (vertical timeline, dot color = outcome)          │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Changes:**

1. **Breadcrumb** — `← All Sites` link at top-left for navigation context
2. **Wellness Gauge** — Recharts `RadialBarChart` or custom SVG:
   - Arc from 0-100%
   - Color segments: green (75-100), amber (50-75), red (0-50)
   - Center: `font-mono tabular-nums text-4xl font-bold`
   - Animate on load: number counting from 0 to final value (§5.3)
   - Status dot below: `● PASS` with appropriate color

3. **Per-standard Score Bars** — horizontal progress bars:
   - `rounded-full` per brand guide (§4.4)
   - Color-coded per score range
   - Score right-aligned: `font-mono tabular-nums`

4. **Zone Readings Table:**
   - Numbers: `font-mono tabular-nums text-right` (§6.4, §8.1)
   - Units inline: `450 ppm CO₂`, `22°C` (§8.1)
   - Status: dot indicator, not badge
   - Threshold proximity: ±10% → amber, exceeds → red (§8.2)

5. **Scan History Timeline:**
   - Vertical connecting line between dots
   - Dot color = certification outcome
   - Date, outcome, score, zone count per row
   - Expandable: click to see findings
   - Replaces the current table format

### 5.4 Admin / Customers (`/admin/customers`)

**Minimal changes** — utility page:
- Remove card wrapper around table
- Add search input at top
- Empty state: "No registered customers" + Register CTA
- Replace inline modal with shadcn `<Dialog>`
- Table follows §6.4 guidelines (striped, sticky header, hover)

---

## 6. Interaction Design

All interactions aligned to brand guide §5.3:

| Interaction | Brand Guide Spec | Current | Action |
|-------------|-----------------|---------|--------|
| **Card hover** | `hover:border-primary/50 hover:shadow-sm` | No hover | Add |
| **Card hover — NO translateY** | "avoid lifting cards with translate-y; border highlights feel more technical" | N/A | Do NOT add lift |
| **Active nav** | `bg-accent text-accent-foreground border-l-2 border-primary` | `bg-muted` | Update |
| **Button press** | `active:scale-95` | No press state | Add |
| **Loading** | "skeleton sweeps or monospace loading sequences; avoid slow spinning circles" | `Loader2` spinner | Replace with Skeleton |
| **Stagger** | "50ms stagger, animate-fade-in" | Some pages have it | Standardize |
| **Number counting** | "Fast rolling numbers (tabular-nums) from 0 to final value on mount" | Static numbers | Add |
| **Critical glow** | `animate-glow` on critical badges | Hardcoded bg-red-50 | Add animation class |
| **Dot pulse** | `animate-pulse` for live, `animate-ping` for syncing (§5.2) | Not implemented | Add |

### New CSS (add to globals.css if missing)

```css
/* Already defined in brand guide §5.5 — verify these exist */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fadeIn 0.4s ease-out both;
}

@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(233, 61, 61, 0.3); }
  50%      { box-shadow: 0 0 0 6px rgba(233, 61, 61, 0); }
}
.animate-glow {
  animation: glowPulse 2s ease-in-out infinite;
}

.bg-dot-grid {
  background-image: radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px);
  background-size: 20px 20px;
}

/* Progress bar for score visualization */
.score-bar {
  height: 6px;
  border-radius: 9999px;
  background: hsl(var(--gray-200));
  overflow: hidden;
}
.score-bar-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.4s ease-out;
}
.score-bar-fill.good    { background: #37CA37; }
.score-bar-fill.warning { background: #F6AD55; }
.score-bar-fill.critical { background: #E93D3D; }
```

### Dialog Transitions

Replace custom inline modals with shadcn `<Dialog>`:
- Backdrop: `backdrop-blur-sm bg-white/80` (§5.4)
- Panel: standard shadcn DialogContent with `rounded-lg shadow-md` (§6.2 elevated)
- Close on Escape, focus trap

---

## 7. Data Visualization

All charts aligned to brand guide §5.1:

### Sparklines (Scan Listing rows)

Mini sharp-line charts (60px × 24px):
```tsx
<LineChart width={60} height={24} data={scores}>
  <Line
    type="linear"  /* NOT "monotone" — brand says sharp, tension: 0 */
    dataKey="score"
    stroke="hsl(var(--primary))"
    strokeWidth={1.5}
    dot={false}
  />
</LineChart>
```

### Wellness Distribution (Executive)

Horizontal bar chart:
- Sharp bars, no rounded corners (deterministic)
- Colors: `--fj-green`, `--fj-blue`, amber, gray
- No grid lines, no axis labels
- Labels on left, values in `font-mono` on right

### Wellness Gauge (Site Detail)

Radial gauge:
- Recharts `RadialBarChart` or custom SVG arc
- Color segments at 50%, 75% thresholds
- Center score: `font-mono tabular-nums text-4xl font-bold`
- Animate on mount: number counting

### Scan History Timeline

Custom component:
- Vertical line: `border-l-2 border-gray-200`
- Dots: `h-3 w-3 rounded-full` colored per outcome
- Critical dots: `animate-glow`
- Each entry: date, outcome badge, score, zone count, "View Details" link

### Chart Style Rules (from brand guide §5.1)

- **Lines:** `tension: 0` — sharp, deterministic. No organic smoothing.
- **Grid:** none or very subtle `stroke="hsl(var(--gray-200))"`
- **Tooltips:** shadcn-style card, `shadow-sm rounded-lg`
- **Animation:** `duration={300}` ease-out
- **Legend:** hide if obvious

---

## 8. Empty States & Loading

### Empty States (per brand guide §8.3)

Pattern: icon + headline + description + CTA

| Page | Pattern |
|------|---------|
| **Scan Listing** | ShieldCheck (muted) → "No scan data yet" → "Upload a scan to get started" → [Load Scan Data] |
| **Executive** | LayoutDashboard (muted) → "No portfolio data" → "Upload your first scan to see portfolio overview" → [Load Scan Data] |
| **Site Detail** | No scans → "No scans for this site" → [Back to Scans] |
| **Customers** | "No registered customers" → [Register Customer] |
| **Findings dialog** | ShieldCheck (green) → "All clear — no findings for this site" |

### Loading States (per brand guide §5.3)

Replace all `Loader2` spinner + text with skeleton patterns:

```tsx
// Loading KPI card
<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
  <Skeleton className="h-4 w-20 mb-3" />
  <Skeleton className="h-10 w-28" />
  <Skeleton className="h-3 w-16 mt-2" />
</div>

// Loading table row
<div className="flex items-center justify-between py-3">
  <Skeleton className="h-4 w-40" />
  <Skeleton className="h-4 w-24" />
  <Skeleton className="h-6 w-16 rounded-full" />
</div>

// Loading chart
<Skeleton className="h-48 w-full rounded-lg" />
```

---

## 9. Component Pattern Changes

### Before / After Summary

| Component | Before | After | Brand Guide Reference |
|-----------|--------|-------|----------------------|
| **H1 page title** | `text-2xl font-bold` | `text-3xl font-heading font-bold tracking-tight` | §3.2 |
| **Data numbers** | `font-bold` | `font-mono tabular-nums` | §3.2, §5.1 |
| **Card wrapper** | Every element in bordered card | Tables without wrapper; KPIs in cards | §6.2 |
| **Status badge** | Full colored badge with text | Colored dot + tooltip, animate-glow for critical | §5.2, §5.5 |
| **Certification badge** | Text label badge | Icon + short label (`✓ Certified`) | §6.3 |
| **Action buttons** | Inside card content | Top of page, right-aligned | — |
| **Filters** | Nested inside card | Inline bar, no wrapper | §4.2 (density) |
| **Modal** | Custom `fixed inset-0` div | shadcn `<Dialog>` with backdrop-blur | §5.4, §6.2 |
| **Tables** | Default shadcn table | Striped, sticky header, hover:bg-accent/30 | §6.4 |
| **Loading** | `Loader2` spinner | Skeleton blocks | §5.3 |
| **Card hover** | None | `hover:border-primary/50 hover:shadow-sm` | §5.3 |
| **Score display** | `text-xl font-bold` | `text-4xl font-mono tabular-nums font-bold` | §3.2 |
| **Charts** | Smooth curves (`monotone`) | Sharp lines (`linear`, tension: 0) | §5.1 |
| **Score bars** | Not present | Horizontal progress bars, brand colors | §4.4 |
| **Scan history** | Table | Vertical timeline with colored dots | — |
| **Sparklines** | Not present | Mini sharp-line charts in table rows | §5.1 |

---

## 10. What NOT to Change

Explicitly excluded per brand guide:

- ❌ Primary color (`#8700E3`) — locked
- ❌ Semantic colors (green `#37CA37`, amber `#F6AD55`, red `#E93D3D`) — locked
- ❌ Gray scale (50–300) — locked
- ❌ Fonts (Montserrat, Inter, JetBrains Mono) — locked
- ❌ Border radius (rounded-lg, rounded-full) — locked
- ❌ Dark mode — not supported (Phase 3+, §11)
- ❌ AI aesthetics (sparkle icons, neon, magic) — explicitly forbidden (§11)
- ❌ Conversational UI — forbidden (§11)
- ❌ Gradients on large surfaces — forbidden (§11)
- ❌ Card lift with `translateY` — "border highlights feel more technical" (§5.3)
- ❌ Organic chart smoothing — "raw data should look engineered" (§5.1)
- ❌ Slow spinning loaders — "avoid slow spinning circles" (§5.3)
- ❌ Auto-playing animations — "respect prefers-reduced-motion" (§11)

---

## 11. Implementation Order

If approved, implement in this sequence:

1. **globals.css audit** — Add missing animations from brand guide (§5.5), verify all CSS variables match §2.4
2. **Typography enforcement** — H1→text-3xl, H2→text-2xl semibold, data→font-mono tabular-nums, KPI→text-4xl
3. **Hardcoded color cleanup** — Replace hardcoded Tailwind colors with brand token classes where inconsistent
4. **Skeleton loading** — Replace all `Loader2` spinners with skeleton patterns
5. **Navbar → Sidebar** — Layout refactor (touches every page)
6. **Scan Listing** — KPI cards, filter bar outside card, table cleanup, status dots, empty state
7. **Executive Summary** — KPI strip, distribution chart, leaderboard score bars, Dialog for findings
8. **Site Detail** — Gauge chart, score bars, zone table alignment, timeline history
9. **Admin / Customers** — Light cleanup, Dialog component, empty state
10. **Interactions** — Card hover (`border-primary/50`), button press (`active:scale-95`), number counting animation
11. **Sparklines** — Add to Scan Listing table rows
12. **Accessibility audit** — Contrast (§10), keyboard, screen reader

---

## 12. Design References

### Inspiration (aligned to brand persona)

- **Grafana** — Dense data presentation, sidebar navigation, status indicators
- **Linear** — Border-highlight hover on cards (not lift), clean typography
- **Vercel Dashboard** — KPI cards, skeleton loading, table density
- **Apple Health** — Radial gauge for wellness metrics
- **Medical instrument panels** — Deterministic, no decorative elements

### Anti-patterns (from brand guide §11)

- ✨ Sparkle icons, magic wands, neon auras
- Chat bubbles, floating AI assistants
- Dark mode (Phase 3+)
- Neon colors (tech feel from layout/motion, not saturation)
- Gradients on large surfaces
- Skeuomorphism
- Auto-playing animations (respect reduced-motion)
- Stock photos in dashboard
- Excessive motion (keep under 400ms, no bouncing)
