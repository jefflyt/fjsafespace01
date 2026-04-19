# FJDashboard — Corporate Design Guidelines

## 1. Brand Identity

### 1.1 Brand Essence
FJ SafeSpace is a **technology-driven indoor air quality and wellness platform**. The dashboard should feel like a modern command center — clean, data-rich, and trustworthy — with subtle technological flair that signals sophistication without overwhelming the user.

### 1.2 Visual Personality
- **Primary**: Professional, clinical, trustworthy (healthcare/wellness domain)
- **Secondary**: Modern, tech-forward, data-driven (IoT monitoring, real-time analytics)
- **Tone**: Calm but authoritative — like a medical instrument meets a mission control dashboard

---

## 2. Color Palette

### 2.1 Core Brand Colors (from fjsafespace.com)

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--fj-purple` | `#8700E3` | `276 100% 44%` | Primary brand color, CTAs, active states |
| `--fj-purple-light` | `#C9B9FF` | `258 100% 87%` | Accent highlights, subtle backgrounds |
| `--fj-green` | `#37CA37` | `120 57% 50%` | Wellness/passing indicators, health metrics |
| `--fj-mint` | `#E8F5F2` | `167 30% 94%` | Page background, card surfaces |
| `--fj-blue` | `#188BF6` | `211 91% 53%` | Secondary actions, info states |
| `--fj-dark` | `#333333` | `0 0% 20%` | Primary text |
| `--fj-gray` | `#666666` | `0 0% 40%` | Secondary text, labels |
| `--fj-white` | `#FFFFFF` | `0 0% 100%` | Card backgrounds, content surfaces |

### 2.2 Semantic Colors

| Semantic | Hex | Usage |
|----------|-----|-------|
| **Healthy / Pass** | `#37CA37` | Certified sites, within threshold |
| **Warning / Advisory** | `#F6AD55` | Near threshold, needs monitoring |
| **Critical / Fail** | `#E93D3D` | Exceeds threshold, immediate action |
| **Info** | `#63B3ED` | Neutral data, metadata |
| **Advisory Only** | `#CBD5E0` | Non-current standards |

### 2.3 Tailwind Mapping (globals.css)

```css
:root {
  --background: 167 30% 98%;    /* Light mint page bg */
  --foreground: 0 0% 20%;       /* Dark text */
  --card: 0 0% 100%;            /* White card surfaces */
  --primary: 276 100% 44%;      /* FJ Purple #8700E3 */
  --primary-foreground: 0 0% 100%;
  --secondary: 167 30% 94%;     /* FJ Mint */
  --muted: 167 15% 90%;
  --accent: 276 100% 96%;       /* Light purple tint */
  --destructive: 0 75% 57%;     /* Critical red */
  --border: 167 20% 85%;        /* Mint-tinted borders */
  --radius: 1rem;               /* 16px rounded corners */
}
```

---

## 3. Typography

### 3.1 Font Families

| Role | Font | Weight | Source |
|------|------|--------|--------|
| **Headlines** | Montserrat | 500–700 | fjsafespace.com |
| **Body** | Open Sans | 400–600 | fjsafespace.com |
| **Data / Code** | Inter | 400–600 | Dashboard numbers, badges |
| **Fallback** | system-ui, sans-serif | — | All layers |

### 3.2 Type Scale

| Element | Size | Weight | Line-height | Letter-spacing |
|---------|------|--------|-------------|----------------|
| H1 (page title) | 32px / `text-3xl` | 700 | 1.2 | -0.02em |
| H2 (section) | 24px / `text-2xl` | 600 | 1.3 | -0.01em |
| H3 (card title) | 18px / `text-lg` | 600 | 1.4 | 0 |
| Body | 14px / `text-sm` | 400 | 1.6 | 0 |
| Small / Label | 12px / `text-xs` | 500 | 1.4 | 0.05em (uppercase) |
| Data / Metric | 28px+ / `text-4xl` | 700 | 1.1 | -0.03em |

### 3.3 Typography Rules
- **Never use more than 2 font families per view** (Montserrat for headings + Inter for body/data)
- **Data numbers** should always use `tabular-nums` font feature
- **Uppercase labels** use `tracking-widest` (0.1em) for tech feel
- **Never bold body text** — use color contrast instead

---

## 4. Layout & Spacing

### 4.1 Grid System
- **Desktop**: 12-column grid, `max-w-7xl` container, `px-6` padding
- **Tablet**: 8-column grid
- **Mobile**: 4-column grid, full bleed

### 4.2 Spacing Scale
Use Tailwind's default spacing scale. Key patterns:
- **Card gap**: `gap-4` (16px) between cards
- **Section gap**: `gap-6` (24px) between sections
- **Card padding**: `p-6` (24px) internal
- **Page padding**: `p-6` (24px) on main content area

### 4.3 Card Anatomy
```
┌─────────────────────────────────────┐
│  [Icon]  Card Title          [Badge]│  ← Header: icon + title + optional badge
│                                     │
│  ─────────────────────────────────  │  ← Divider (border-b, subtle)
│                                     │
│  Content / Metric / Chart           │  ← Main content area
│                                     │
│  [Optional footer / actions]        │  ← Footer (if needed)
└─────────────────────────────────────┘
```

### 4.4 Border Radius
- **Cards**: `rounded-xl` (16px) — matches brand radius
- **Buttons**: `rounded-full` (pill) for primary CTAs, `rounded-md` for secondary
- **Badges**: `rounded-full` (pill)
- **Inputs**: `rounded-md` (8px)

---

## 5. Technology Feel Elements

These subtle touches differentiate the dashboard from a generic admin panel:

### 5.1 Data Visualization Style
- **Charts**: Clean lines, no grid clutter, smooth curves (`tension: 0.4`)
- **Sparklines**: Inline mini-charts for trend indicators
- **Pulse animations**: Subtle `animate-pulse` on live data indicators
- **Monospace numbers**: Use `font-mono tabular-nums` for metric values

### 5.2 Status Indicators
```
● Live    — green dot with animate-pulse
● Syncing — amber dot with animate-ping
● Offline — gray dot, static
```

### 5.3 Micro-interactions
- **Hover on cards**: `transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`
- **Active nav items**: `bg-muted` with left border accent (`border-l-2 border-primary`)
- **Button press**: `active:scale-95` for tactile feedback
- **Loading states**: Skeleton shimmer, not spinners (where possible)

### 5.4 Tech Accents (use sparingly)
- **Subtle grid pattern** on hero/overview backgrounds (`bg-[url(...)]` or CSS pattern)
- **Gradient borders** on featured cards (`border-gradient` effect)
- **Glass morphism** on overlays: `backdrop-blur-sm bg-white/80`
- **Data stream animation** on the navbar "Ops Mode" badge (already implemented)

---

## 6. Component Guidelines

### 6.1 Buttons

| Variant | Style | Use When |
|---------|-------|----------|
| **Primary** | `bg-primary text-white rounded-full` | Main actions (Upload, Generate Report) |
| **Secondary** | `border border-primary/20 text-primary rounded-md` | Supporting actions |
| **Ghost** | `hover:bg-muted rounded-md` | Tertiary actions, filters |
| **Destructive** | `bg-destructive text-white rounded-md` | Delete, cancel, reject |

**Button sizing**: `sm` (32px), `default` (40px), `lg` (48px)
**Never use**: Outlined buttons with gray borders on white backgrounds (low contrast)

### 6.2 Cards

- **Default**: White bg, `shadow-sm`, `rounded-xl`, `border`
- **Elevated**: Add `shadow-md` for modals, dialogs
- **Status cards** (health ratings): Colored icon + large number + label
- **Data cards**: Header row + chart/table content

### 6.3 Badges

| Variant | Style | Use |
|---------|-------|-----|
| **Healthy** | `bg-green-100 text-green-800` | PASS, Certified |
| **Warning** | `bg-yellow-100 text-yellow-800` | Advisory, Improvement |
| **Critical** | `bg-red-100 text-red-800` | FAIL, Critical |
| **Info** | `bg-blue-100 text-blue-800` | Info, metadata |
| **Purple** | `bg-primary/10 text-primary` | Brand badges, source type |

### 6.4 Tables
- **Striped rows**: `even:bg-muted/50` for readability
- **Sticky header**: `sticky top-0 bg-white z-10`
- **Hover row**: `hover:bg-muted`
- **Compact**: `text-sm` default, never smaller than `text-xs`
- **Alignment**: Numbers right-aligned, text left-aligned

### 6.5 Forms
- **Labels**: Above input, `text-sm font-medium text-foreground`
- **Required**: Red asterisk `*` after label text
- **Error state**: Red border + helper text below input
- **Success state**: Green border (brief, auto-clear)

---

## 7. Iconography

### 7.1 Icon Library
- **Lucide React** as primary icon set (already in use)
- **Size**: `h-4 w-4` inline, `h-5 w-5` standalone, `h-6 w-6` hero
- **Stroke**: `stroke-width: 2` (default)

### 7.2 Icon Mappings
| Concept | Icon | Context |
|---------|------|---------|
| Upload | `UploadCloud` | CSV ingest |
| Findings | `Search` / `AlertTriangle` | Rule violations |
| Report | `FileText` | Report generation |
| Dashboard | `LayoutDashboard` | Overview |
| Health | `ShieldCheck` | Certified |
| Warning | `AlertTriangle` | Advisory |
| Refresh | `RefreshCw` | Reload data |
| Settings | `Settings` | Configuration |
| Notifications | `Bell` | Alerts |

---

## 8. Data Presentation Rules

### 8.1 Numbers
- **Wellness Index**: Always show as `XX/100` with color-coded background
- **Percentages**: Always 1 decimal place (`85.3%`)
- **Concentrations**: Include units inline (`450 ppm CO₂`)
- **Dates**: `YYYY-MM-DD` format in tables, `DD MMM YYYY` in reports

### 8.2 Thresholds
- **Within range**: Green text or badge
- **±10% of threshold**: Amber warning
- **Exceeds threshold**: Red text or badge + bold

### 8.3 Empty States
- Never show blank tables — use illustration + text + CTA
- Pattern: "No data yet" → "Upload a scan to get started" → [Upload Button]

---

## 9. Responsive Behavior

### 9.1 Breakpoints
- **sm** (640px): Mobile, single column
- **md** (768px): Tablet, 2-column grids
- **lg** (1024px): Desktop, 3-4 column grids
- **xl** (1280px): Wide desktop, sidebar + content

### 9.2 Mobile Adaptations
- **Sidebar**: Becomes bottom nav or hamburger menu
- **Tables**: Card-based list view on mobile
- **Charts**: Full width, reduced height
- **Cards**: Stack vertically, full width

---

## 10. Accessibility

- **Contrast**: Minimum 4.5:1 for body text, 3:1 for large text
- **Focus**: Visible focus ring on all interactive elements (`ring-2 ring-primary`)
- **ARIA**: All icons with `aria-label`, form inputs with `label` + `id`
- **Keyboard**: Full keyboard navigation, tab order follows visual layout
- **Screen reader**: Semantic HTML, `sr-only` for icon-only buttons

---

## 11. What to Avoid

- **No dark mode** — brand is light and airy (dark mode is a Phase 3+ consideration)
- **No neon colors** — the tech feel comes from layout and motion, not saturated colors
- **No gradients on large surfaces** — use subtle tints, not full gradients
- **No skeuomorphism** — flat design with subtle shadows only
- **No auto-playing animations** — respect `prefers-reduced-motion`
- **No stock photos** in the dashboard — data is the hero

---

## 12. Reference: fjsafespace.com Design Alignment

| Website Element | Dashboard Equivalent |
|-----------------|---------------------|
| Purple CTA buttons | Primary buttons use `#8700E3` |
| Green health indicators | Wellness Index uses `#37CA37` |
| Clean white cards on mint bg | Same pattern in dashboard |
| Montserrat headlines | Dashboard H1/H2 use Montserrat |
| Shield icon branding | Dashboard uses `ShieldCheck` icon |
| SAFE-AIR Protocol visuals | Rulebook section uses similar treatment |

The dashboard should feel like the **operational cockpit** of the brand shown on fjsafespace.com — same DNA, but optimized for dense data and quick decisions.
