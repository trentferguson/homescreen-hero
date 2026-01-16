# HomeScreen Hero Design System

## Direction & Feel
**Data & Analysis with approachability** — This is a media management dashboard that combines technical precision with visual warmth. Users manage Plex collections and view analytics, so it needs clear hierarchy and readable data displays, but the media context (posters, artwork) keeps it from feeling sterile.

## Depth Strategy
**Subtle shadows with borders** — Cards use soft shadows (`shadow-sm` → `shadow-md` on hover) combined with border separation. Status indicators use glowing shadows for emphasis (e.g., `shadow-[0_0_16px_rgba(52,211,153,0.65)]` for success states).

## Spacing & Sizing
**Base unit: 4px** (Tailwind's default spacing scale)
- Card padding: `p-4` (16px) or `p-5` (20px) for emphasis
- Inter-element spacing: `mt-1`, `mt-2`, `mt-2.5`
- Card height for health cards: `h-32`
- Consistent use of multiples: 4, 8, 12, 16, 20, 24px

## Border Radius
**Rounded and friendly** — `rounded-2xl` (16px) for cards creates an approachable, modern feel
- Smaller elements: `rounded-lg` (8px) or `rounded-full` for status dots

## Color System

### Background
- **Light mode card:** `bg-white` with `border-slate-200/80`
- **Dark mode card:** `bg-card-dark` with `border-slate-800/80`
- **Dark mode default:** Dark theme is preferred default (set in theme.tsx)

### Text Hierarchy
- **Primary:** `text-slate-900 dark:text-white`
- **Secondary:** `text-slate-600 dark:text-slate-400`
- **Tertiary/Hints:** `text-slate-400` (light), `text-slate-500 dark:text-slate-400` (loading)
- **Data labels:** `text-sm text-slate-300` on dark backgrounds

### Semantic Colors
- **Success:** `text-emerald-600 dark:text-emerald-400`, status dot `bg-emerald-400`
- **Warning:** `text-amber-500 dark:text-amber-300`, status dot `bg-amber-400`
- **Neutral/Loading:** `text-slate-500 dark:text-slate-400`, status dot `bg-slate-500`

### Status Indicators
Glowing dots with shadow blur for emphasis:
```
bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.65)]  // Success
bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.55)]    // Warning
bg-slate-500 shadow-[0_0_16px_rgba(148,163,184,0.45)]   // Loading
```

## Typography

### Hierarchy
- **Display (card status):** `text-3xl sm:text-4xl font-extrabold tracking-tight leading-none`
- **Heading (card title):** `text-sm font-medium`
- **Body/Detail:** `text-xs sm:text-sm font-semibold`
- **Data value:** `text-2xl font-bold`
- **Data label:** `text-sm`

### Responsive Scaling
Use responsive text sizing for readability:
- `text-3xl sm:text-4xl` for primary metrics
- `text-xs sm:text-sm` for supporting details

## Card Patterns

### StatCard (Simple Data Display)
```tsx
<div className="rounded-2xl bg-slate-800 p-4 shadow">
  <div className="text-slate-300 text-sm">{label}</div>
  <div className="text-2xl font-bold mt-1">{value}</div>
  {hint && <div className="text-slate-400 text-xs mt-2">{hint}</div>}
</div>
```

### HealthCard (Status Display)
```tsx
<div className="group relative overflow-hidden rounded-2xl
               bg-white border border-slate-200/80 shadow-sm hover:shadow-md
               p-5 h-32
               dark:bg-card-dark dark:border-slate-800/80 dark:hover:border-slate-700
               transition-all duration-300">

  {/* Gradient overlays for depth */}
  <div className="pointer-events-none absolute inset-0
                  bg-gradient-to-br from-slate-100/60 via-transparent to-transparent
                  dark:from-white/5" />

  <div className="pointer-events-none absolute inset-0
                  bg-gradient-to-t from-transparent via-transparent to-white/40
                  dark:to-white/[0.02] opacity-0 group-hover:opacity-100
                  transition-opacity duration-500" />

  {/* Content */}
  <div className="relative h-full flex items-center justify-between">
    {/* Text hierarchy */}
    {/* Icon with status dot */}
  </div>
</div>
```

## Animations & Transitions

### Interaction Timing
- **Fast transitions:** `duration-200` (transform, scale)
- **Medium transitions:** `duration-300` (shadow, border, all)
- **Slow atmospheric:** `duration-500` (gradient overlays)

### Micro-interactions
- **Hover scale:** `group-hover:scale-110` on icons
- **Shadow lift:** `hover:shadow-md` on cards
- **Pulse:** `animate-pulse` on loading indicators

### Easing
Use Tailwind defaults (smooth cubic-bezier) — no bouncy/spring effects

## Gradient Overlays

Cards use layered gradients for subtle depth:
```tsx
// Base ambient gradient
<div className="absolute inset-0 bg-gradient-to-br
               from-slate-100/60 via-transparent to-transparent
               dark:from-white/5" />

// Hover glow (appears on interaction)
<div className="absolute inset-0 bg-gradient-to-t
               from-transparent via-transparent to-white/40
               dark:to-white/[0.02]
               opacity-0 group-hover:opacity-100
               transition-opacity duration-500" />
```

## Component Utilities

### Truncation Pattern
```tsx
className="whitespace-nowrap overflow-hidden text-ellipsis"
title={fullText}
```

### Responsive Visibility
Use `sm:` breakpoint for desktop enhancements, mobile-first by default

### Dark Mode
- Always provide `dark:` variants for colors
- Test both themes — dark is default
- Use semantic variables when available (`bg-card-dark`)

## Avoid

- Pure black backgrounds (use slate-800 or slate-900)
- Dramatic shadows (keep it subtle: sm → md on hover)
- Mixing depth strategies (stick to shadows + borders)
- Random spacing values (use Tailwind scale: 1, 2, 4, 5, etc.)
- Multiple accent colors (emerald for success, amber for warning, keep it limited)
