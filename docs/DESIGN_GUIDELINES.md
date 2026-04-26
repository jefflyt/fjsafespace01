# FJDashboard — Corporate Design Guidelines

## 1. Brand Identity

### 1.1 Brand Essence

FJ SafeSpace is a **technology-driven indoor air quality and wellness platform**. The dashboard should feel like a modern command center — clean, data-rich, and trustworthy — with subtle technological flair that signals sophistication without overwhelming the user. It must convey engineering precision and deterministic outcomes, specifically avoiding any "generative AI" aesthetics or ambiguity.

### 1.2 Visual Personality

- **Primary**: Professional, clinical, trustworthy (healthcare/wellness domain)
- **Secondary**: Modern, tech-forward, data-driven (IoT monitoring, real-time analytics)
- **Anti-Persona**: Not conversational, not "magical", no AI-fluff
- **Tone**: Calm but authoritative — like a medical instrument meets a mission control dashboard

---

## 2. Color Palette

### 2.1 Core Brand Colors (from fjsafespace.com)

| Token | Hex | HSL | Usage |
| ------- | ----- | ----- | ------- |
| `--fj-purple` | `#8700E3` | `276 100% 44%` | Primary brand color, CTAs, active states |
| `--fj-purple-light` | `#C9B9FF` | `258 100% 87%` | Accent highlights, subtle backgrounds |
| `--fj-green` | `#37CA37` | `120 57% 50%` | Wellness/passing indicators, health metrics |
| `--fj-blue` | `#188BF6` | `211 91% 53%` | Secondary actions, info states |
| `--fj-dark` | `#333333` | `0 0% 20%` | Primary text |
| `--fj-gray` | `#666666` | `0 0% 40%` | Secondary text, labels |
| `--fj-white` | `#FFFFFF` | `0 0% 100%` | Card backgrounds, content surfaces |

### 2.2 Neutral Gray Scale (UI surfaces)

| Token | Hex | HSL | Usage |
| ------- | ----- | ----- | ------- |
| `--gray-50` | `#F9FAFB` | `220 14% 97%` | Alternating table rows, subtle fills |
| `--gray-100` | `#F3F4F6` | `220 14% 96%` | Page background |
| `--gray-200` | `#E5E7EB` | `219 14% 90%` | Borders, dividers, disabled states |
| `--gray-300` | `#D1D5DB` | `220 10% 84%` | Disabled borders, placeholder rings |

### 2.3 Semantic Colors & Accessibility

To ensure WCAG AA compliance (4.5:1 contrast ratio) on light backgrounds, semantic colors are split into **Base** (for icons, charts, and fills) and **Text** (for typography). The base brand colors are too light to be legible as text on white backgrounds.

| Semantic | Base Hex (Fills/Icons) | Text Hex (Typography) | Usage |
| ---------- | ---------------------- | --------------------- | ------- |
| **Healthy / Pass** | `#37CA37` | `#15803D` (Green 700) | Certified sites, within threshold |
| **Warning / Advisory** | `#F6AD55` | `#B45309` (Amber 700) | Near threshold, needs monitoring |
| **Critical / Fail** | `#E93D3D` | `#B91C1C` (Red 700) | Exceeds threshold, immediate action |
| **Info** | `#188BF6` | `#1D4ED8` (Blue 700) | Neutral data, metadata |
| **Advisory Only** | `#D1D5DB` | `#4B5563` (Gray 600) | Non-current standards |

### 2.4 Tailwind Mapping (globals.css)

```css
:root {
  --background: 220 14% 96%;    /* Neutral light page bg */
  --foreground: 0 0% 20%;       /* Dark text */
  --card: 0 0% 100%;            /* White card surfaces */
  --primary: 276 100% 44%;      /* FJ Purple #8700E3 */
  --primary-foreground: 0 0% 100%;
  --secondary: 220 14% 96%;     /* Neutral light */
  --muted: 220 14% 90%;         /* Gray divider */
  --accent: 276 80% 92%;        /* Visible purple tint */
  --destructive: 0 75% 57%;     /* Critical red */
  --border: 219 14% 90%;        /* Neutral borders */
  --radius: 0.75rem;            /* 12px rounded corners */
}
```

---

## 3. Typography

### 3.1 Font Families

| Role | Font | Weight | Source |
| ------ | ------ | -------- | -------- |
| **Headlines** | Montserrat | 500–700 | fjsafespace.com |
| **Body UI** | Inter | 400–600 | General interface text, labels |
| **Telemetry**| JetBrains Mono / Roboto Mono | 400–500 | Sensor IDs, MAC addresses, exact timestamps, raw metrics |
| **Fallback** | system-ui, sans-serif | — | All layers |

### 3.2 Type Scale

| Element | Size | Weight | Line-height | Letter-spacing |
| --------- | ------ | -------- | ------------- | ---------------- |
| H1 (page title) | 32px / `text-3xl` | 700 | 1.2 | -0.02em |
| H2 (section) | 24px / `text-2xl` | 600 | 1.3 | -0.01em |
| H3 (card title) | 18px / `text-lg` | 600 | 1.4 | 0 |
| Body | 14px / `text-sm` | 400 | 1.6 | 0 |
| Small / Label | 12px / `text-xs` | 500 | 1.4 | 0.05em (uppercase) |
| Data / Metric | 28px+ / `text-4xl` | 700 | 1.1 | -0.03em |

### 3.3 Typography Rules

- **Font Hierarchy**: Montserrat for semantic headings, Inter for UI text/body, and a strict **Monospace font** for machine data (MAC addresses, exact timestamps, raw telemetry).
- **Data numbers** should always use `tabular-nums` font feature, and ideally use the monospace font for alignment.
- **Uppercase labels** use `tracking-wider` (0.05em) for readability, `tracking-widest` (0.1em) for tech badges only

---

## 4. Layout & Spacing

### 4.1 Grid System

- **Desktop**: 12-column grid, `max-w-7xl` container, `px-6` padding
- **Tablet**: 8-column grid
- **Mobile**: 4-column grid, full bleed

### 4.2 Spacing Scale & Density

Use Tailwind's default spacing scale, but bias toward **high information density**. Command centers show structured data without excessive white space. Key patterns:

- **Card gap**: `gap-4` (16px) between cards
- **Section gap**: `gap-6` (24px) between sections
- **Card padding**: `p-6` (24px) internal
- **Page padding**: `p-6` (24px) on main content area

### 4.3 Card Anatomy

```text
┌─────────────────────────────────────┐
│  [Icon]  Card Title          [Badge]│  ← Header: icon + left accent bar on featured
│                                     │
│  ─────────────────────────────────  │  ← Divider (border-b, subtle)
│                                     │
│  Content / Metric / Chart           │  ← Main content area
│                                     │
│  [Optional footer / actions]        │  ← Footer (if needed)
└─────────────────────────────────────┘
```

### 4.4 Border Radius

- **Cards**: `rounded-lg` (8px) — clean, professional
- **Buttons**: `rounded-full` (pill) for primary CTAs, `rounded-md` for secondary
- **Badges**: `rounded-full` (pill)
- **Inputs**: `rounded-md` (8px)

---

## 5. Technology Feel & Motion

These elements differentiate the dashboard from a generic admin panel, while strictly maintaining a deterministic, engineered feel rather than an "AI" feel:

### 5.1 Data Visualization Style

- **Charts**: Sharp, deterministic lines (`tension: 0` or stepped curves). Avoid organic smoothing (`tension: 0.4`); raw data should look engineered and precise.
- **Sparklines**: Inline mini-charts for trend indicators, using sharp line segments.
- **Pulse indicators**: Subtle animated dot on live data status
- **Monospace numbers**: Use `font-mono tabular-nums` for metric values

### 5.2 Status Indicators

```text
● Live    — green dot with animate-pulse
● Syncing — amber dot with animate-ping
● Offline — gray dot, static
```

### 5.3 Micro-interactions

- **Hover on cards**: `transition-all duration-150 ease-out hover:border-primary/50 hover:shadow-sm` (avoid lifting cards with `translate-y`; border highlights feel more technical)
- **Active nav items**: `bg-accent text-accent-foreground` with strict left border accent (`border-l-2 border-primary`)
- **Button press**: `active:scale-95` for immediate tactile feedback
- **Loading states**: Fast, deterministic skeleton sweeps or monospace loading sequences (e.g., `[...]`); avoid slow spinning circles.
- **Staggered entrance**: Cards in a grid fade in with fast 50ms stagger (`animate-fade-in`)
- **Number counting**: Fast rolling numbers (`tabular-nums`) from 0 to final value on mount.

### 5.4 Tech Accents (use sparingly)

- **Subtle dot-grid pattern** on page background behind hero section — very faint, `opacity: 0.03`
- **Gradient border** on featured/hero cards — thin purple-to-blue gradient on the left edge
- **Glass morphism** on overlays: `backdrop-blur-sm bg-white/80`
- **Scanning line animation** on the navbar "Ops Mode" badge — thin horizontal sweep
- **Data glow**: Critical alert badges have a very subtle `box-shadow` pulse

### 5.5 CSS Animations

Add these to `globals.css`:

```css
/* Fade-in with stagger — apply to grid children */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fadeIn 0.4s ease-out both;
}

/* Subtle glow pulse for critical indicators */
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(233, 61, 61, 0.3); }
  50%      { box-shadow: 0 0 0 6px rgba(233, 61, 61, 0); }
}
.animate-glow {
  animation: glowPulse 2s ease-in-out infinite;
}

/* Scanning line sweep */
@keyframes scanLine {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
.animate-scan::after {
  content: "";
  position: absolute;
  top: 0; left: 0;
  width: 30%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(135, 0, 227, 0.06), transparent);
  animation: scanLine 3s ease-in-out infinite;
  pointer-events: none;
}

/* Dot-grid background pattern */
.bg-dot-grid {
  background-image: radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px);
  background-size: 20px 20px;
}
```

---

## 6. Component Guidelines

### 6.1 Buttons

| Variant | Style | Use When |
| --------- | ------- | ---------- |
| **Primary** | `bg-primary text-white rounded-full` | Main actions (Upload, Generate Report) |
| **Secondary** | `border border-primary/20 text-primary rounded-md` | Supporting actions |
| **Ghost** | `hover:bg-accent rounded-md` | Tertiary actions, filters |
| **Destructive** | `bg-destructive text-white rounded-md` | Delete, cancel, reject |

**Button sizing**: `sm` (32px), `default` (40px), `lg` (48px)

### 6.2 Cards

- **Default**: White bg, `shadow-sm`, `rounded-lg`, `border border-gray-200`
- **Featured/Hero**: Add `border-l-2 border-l-primary` with subtle purple accent bg (`bg-accent/50`)
- **Elevated**: Add `shadow-md` for modals, dialogs
- **Status cards** (health ratings): Colored icon + large number + label
- **Data cards**: Header row + chart/table content

### 6.3 Badges

| Variant | Style | Use |
| --------- | ------- | ----- |
| **Healthy** | `bg-green-50 text-green-700 border border-green-200` | PASS, Certified |
| **Warning** | `bg-amber-50 text-amber-700 border border-amber-200` | Advisory, Improvement |
| **Critical** | `bg-red-50 text-red-700 border border-red-200 animate-glow` | FAIL, Critical |
| **Info** | `bg-blue-50 text-blue-700 border border-blue-200` | Info, metadata |
| **Brand** | `bg-primary/10 text-primary border border-primary/20` | Source type, version |

### 6.4 Tables

- **Striped rows**: `even:bg-gray-50/50` for readability
- **Sticky header**: `sticky top-0 bg-white z-10`
- **Hover row**: `hover:bg-accent/30`
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
| --------- | ------ | --------- |
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

- **Wellness Index**: Always show as `XX/100` with color-coded text
- **Percentages**: Always 1 decimal place (`85.3%`)
- **Concentrations**: Include units inline (`450 ppm CO₂`)
- **Dates**: `YYYY-MM-DD` format in tables, `DD MMM YYYY` in reports

### 8.2 Thresholds

- **Within range**: Green text or badge
- **±10% of threshold**: Amber warning
- **Exceeds threshold**: Red text or badge + `font-semibold`

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

- **No AI aesthetics** — no sparkle icons (✨), magic wands, blurred neon aurora backgrounds, or text-streaming animations. The platform is deterministic and engineered, not "magical".
- **No conversational UI** — avoid chat bubbles or floating AI assistants. Present data directly and authoritatively.
- **No dark mode** — brand is light and airy (dark mode is a Phase 3+ consideration)
- **No neon colors** — the tech feel comes from layout and motion, not saturated colors
- **No gradients on large surfaces** — use subtle tints, not full gradients
- **No skeuomorphism** — flat design with subtle shadows only
- **No auto-playing animations** — respect `prefers-reduced-motion`
- **No stock photos** in the dashboard — data is the hero
- **No excessive motion** — keep animations under 400ms, no bouncing or spinning

---

## 12. Reference: fjsafespace.com Design Alignment

| Website Element | Dashboard Equivalent |
| ----------------- | --------------------- |
| Purple CTA buttons | Primary buttons use `#8700E3` |
| Green health indicators | Wellness Index uses `#37CA37` |
| Clean white cards on neutral bg | Same pattern — neutral gray page bg, white cards |
| Montserrat headlines | Dashboard H1/H2 use Montserrat |
| Shield icon branding | Dashboard uses `ShieldCheck` icon |
| SAFE-AIR Protocol visuals | Rulebook section uses similar treatment |

The dashboard should feel like the **operational cockpit** of the brand shown on fjsafespace.com — same DNA, but optimized for dense data and quick decisions.
