---
version: alpha
name: "Nexus Multilingual"
description: "A focused localization operations desk for translating, reviewing, and publishing software terminology."
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.205 0 0)"
  muted: "oklch(0.97 0 0)"
  border: "oklch(0.922 0 0)"
  danger: "oklch(0.577 0.245 27.325)"
typography:
  interface:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
  data:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
rounded:
  DEFAULT: "0.625rem"
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
spacing:
  control: "0.75rem"
  panel: "1rem"
  page: "1.5rem"
components:
  workbench-header:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "{spacing.panel}"
  filter-panel:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "{spacing.control}"
  data-table:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "{spacing.control}"
  button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.control}"
  danger-action:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.background}"
    rounded: "{rounded.DEFAULT}"
  muted-surface:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
---

# Nexus Multilingual Design System

## Overview

### Creative North Star

The product should feel like a well-organized translation editor: a quiet technical work surface where source text, target languages, validation, and publishing state can be compared without visual noise.

### Product context and register

- **Audience and primary job:** Product, development, translation, and review roles manage software terms from draft through publication.
- **Target market(s) and evidence:** The repository defines a multilingual product but does not establish a market-specific contract.
- **Locale(s) and language policy:** The current owned UI is Simplified Chinese; term content supports the language list configured by each project.
- **Usage scene:** Desktop-first, repeated operational use with wide, dense translation tables and frequent filtering and bulk actions.
- **Register:** Product/admin.
- **Memorable signature:** The source-language-to-target-language rail identifies the workbench as a localization tool, not a generic CRUD table.
- **Restraint:** Table cells, forms, destructive actions, and status feedback remain familiar and task-oriented.
- **Anti-references:** Avoid marketing dashboards, floating action clutter, decorative gradients, oversized KPI cards, and spreadsheet chrome that obscures the publishing workflow.
- **Token ownership/runtime mapping:** Existing runtime CSS is canonical. `src/style.css` provides semantic Tailwind tokens, `src/assets/themes.css` supplies user-selectable theme mappings, and `src/assets/scrollbar.css` owns the global scrollbar baseline. This file mirrors those accepted values and documents their use.

## Colors

Use semantic runtime roles rather than raw feature colors for primary surfaces and controls. Background, foreground, muted, border, primary, and danger map directly to the CSS custom properties with the same role. Workflow states may use restrained amber, sky/indigo, and emerald tints, always paired with text or icons. Dark themes remap semantics without changing hierarchy.

## Typography

The interface uses the system sans stack for predictable Chinese and multilingual rendering. Keys, locale codes, counts, and other machine-readable identifiers use the data monospace stack. Hierarchy comes from size, weight, and spacing; italics are not used for missing data or important localized content.

## Layout

The application shell uses a permanently expanded desktop sidebar and no global top utility header, keeping vertical space available for operational pages. Appearance controls live above the account area in the sidebar. On narrow screens the sidebar becomes an off-canvas navigation drawer opened from a minimal mobile-only bar. Each route owns its content padding; workbench pages use a bounded content area with one vertical owner. The workbench header and filter panel stay compact, while the table owns its horizontal and vertical overflow. At narrow widths controls reflow, while the comparison table retains explicit horizontal scrolling. Panel rhythm follows the existing 12–24px utility spacing used by shared components.

## Elevation & Depth

Static hierarchy uses tonal surfaces and borders first. A restrained small shadow may separate top-level workbench panels from the muted page background. Sticky headers use opaque or lightly blurred semantic surfaces so scrolling content never shows through. Heavy floating shadows are reserved for true overlays.

## Shapes

Controls follow the runtime 10px radius. Major workbench panels use a slightly larger 14px radius; status indicators may use pills. Dense table cells stay rectangular so rows remain easy to compare.

## Components

### Foundational visual states

All interactive controls expose hover, focus-visible, active, disabled, and busy states through shared components. Selection combines a subtle primary tint with checkbox state. Loading preserves panel geometry. Empty datasets and no-results states use different copy and recovery actions.

### Buttons and actions

Use one solid primary action per decision area. Secondary utilities use outline or ghost emphasis. Destructive actions remain visually separated and use the shared destructive intent. Busy buttons retain their dimensions and pair a spinner with stable action wording.

### Navigation and data display

Desktop navigation remains fully expanded so labels are always visible; do not add a desktop collapse rail or duplicate utility header. The workbench header carries project context and the source-to-target language rail. Filters and bulk actions share one stable-height panel. Table headers remain visible while scrolling; identifier columns may freeze at desktop widths only. Keys and locale codes use monospace typography.

### Forms and overlays

Search inputs have accessible labels and immediate clear controls. Authored selects use the shared Reka UI-based primitive. Dialogs and drawers reuse project-owned primitives, keep actions reachable, and display validation or server failures in context.

### Iconography

Lucide is the canonical icon family. Use 14–18px outline icons in controls; icon-only actions require a localized accessible name and tooltip where the meaning is not universal.

### Motion

Motion communicates state changes in roughly 150–200ms. Avoid perpetual decorative animation in status badges. Spinners are reserved for active work, and reduced-motion preferences must remain usable.

### Content and data visualization

Use concise Simplified Chinese, explicit verbs, and consistent lifecycle vocabulary: 草稿、待翻译、待校对、待发布、已发布. Counts and percentages are compact context, not decorative hero metrics.

## Do's and Don'ts

- **Do:** Keep source language, target language, Key, workflow status, and validation visible in the scanning path.
- **Do:** Reuse semantic tokens and shared UI primitives across every workbench action.
- **Don't:** Float bulk toolbars over navigation or content.
- **Don't:** Replace missing content with ambiguous English placeholders or color-only status.
