---
version: alpha
name: "Nexus Multilingual"
description: "A focused localization operations desk for translating, reviewing, and publishing software terminology."
colors:
  background: "#ffffff"
  foreground: "#262d33"
  primary: "#007f7c"
  muted: "#f2f5f7"
  border: "#e5eaf0"
  danger: "#c43d58"
typography:
  interface:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
  data:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
rounded:
  DEFAULT: "0.375rem"
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.375rem"
  xl: "0.5rem"
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
  table-divider:
    backgroundColor: "{colors.border}"
    height: "1px"
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

The product adopts the user’s light enterprise-dashboard reference: pale gray workspaces, white panels, teal navigation and actions, and restrained blue/violet accents. The source-to-target language rail remains the recognizable translation-workspace signature. Overview pages may use independent metric cards and light charts; editing stays compact and task focused.

### Product context and register

- **Audience and primary job:** Product, development, translation, and review roles manage software terms from draft through publication.
- **Target market(s) and evidence:** The repository defines a multilingual product but does not establish a market-specific contract.
- **Locale(s) and language policy:** The current owned UI is Simplified Chinese; term content supports the language list configured by each project.
- **Usage scene:** Desktop-first, repeated operational use with wide, dense translation tables and frequent filtering and bulk actions.
- **Register:** Product/admin.
- **Memorable signature:** The source-language-to-target-language rail identifies the workbench as a localization tool, not a generic CRUD table.
- **Restraint:** Table cells, forms, destructive actions, and status feedback remain familiar and task-oriented.
- **Anti-references:** Avoid marketing-style hero metrics, floating action clutter, decorative gradients, oversized KPI cards, and spreadsheet chrome that obscures the publishing workflow.
- **Token ownership/runtime mapping:** Existing runtime CSS is canonical. `src/style.css` provides semantic Tailwind tokens, `src/assets/themes.css` supplies user-selectable theme mappings, and `src/assets/scrollbar.css` owns the global scrollbar baseline. This file mirrors those accepted values and documents their use.

## Colors

Use semantic runtime roles rather than raw feature colors. The default teal palette uses primary #007f7c with white text, foreground #262d33, card/background #ffffff, muted #f2f5f7, muted foreground #697582, border #e5eaf0, input boundary #8995a1 and destructive #c43d58. The workspace surface derives from background 25% + muted 75%. Sidebar selection uses a pale teal surface with deep teal text and a narrow active marker. Charts use teal, blue, violet, pink and amber; ordinary text never inherits bright chart colors.

The default theme is teal; existing persisted theme/radius preferences remain respected. src/style.css owns the base teal palette and its dark adapter. src/assets/themes.css owns alternate theme remapping, including an explicit neutral zinc adapter. assets/index.css is a compatibility entry without duplicated tokens; accordion animation is compiled with style.css. Theme files do not own radius. useSystemTheme is the sole DOM theme/radius synchronizer. Dark mode keeps panel hierarchy with #152126 background, #1c2b31 cards and #55d5ca primary; text remains semantic.

## Typography

The interface uses the system sans stack for predictable Chinese and multilingual rendering. Keys, locale codes, counts, and other machine-readable identifiers use the data monospace stack. Hierarchy comes from size, weight, and spacing; italics are not used for missing data or important localized content.

## Layout

The shell uses a white sidebar with teal selection, no global utility header, and a pale gray workspace with white panels. Desktop navigation can collapse into an icon rail; users can resize the expanded sidebar from 220px to 360px (264px default), with keyboard controls and persistent local preference. Narrow screens use the shared off-canvas navigation drawer, opened by a single compact button without a top menu bar. Each route owns its content padding; workbench pages use a bounded content area with one vertical owner. The workbench header and filter panel stay compact, while the table owns its horizontal and vertical overflow. At narrow widths controls reflow, while the comparison table retains explicit horizontal scrolling. Panel rhythm follows a 4px scale: 16px module gaps, 16–20px panel padding and 24px desktop page padding; narrow pages use 12px side padding. Overview uses six compact metric cards at wide widths, three below 1280px and two below 640px. Inside an existing panel, metric-strip--inline uses dividers instead of nested cards.

## Elevation & Depth

Static hierarchy uses tonal surfaces and borders first. A restrained small shadow may separate top-level workbench panels from the muted page background. Sticky headers use opaque or lightly blurred semantic surfaces so scrolling content never shows through. Heavy floating shadows are reserved for true overlays.

## Shapes

Controls use the default 6px base radius and panels use 8px (base plus 2px), a slightly softer adaptation of the reference. Small radius is max(0px, base minus 2px); medium and large equal base. User radius preferences remain functional; status indicators may use pills. Dense table cells stay rectangular so rows remain easy to compare.

## Components

### Foundational visual states

All interactive controls expose hover, focus-visible, active, disabled, and busy states through shared components. Selection combines a subtle primary tint with checkbox state. Loading preserves panel geometry. Empty datasets and no-results states use different copy and recovery actions.

### Buttons and actions

Use one solid primary action per decision area. Secondary utilities use outline or ghost emphasis. Destructive actions remain visually separated and use the shared destructive intent. Busy buttons retain their dimensions and pair a spinner with stable action wording.

### Navigation and data display

Desktop navigation uses explicit labels when expanded and canonical icon tooltips when collapsed. Appearance and collapse controls have one owner in the sidebar footer. The workbench header carries project context and the source-to-target language rail. Filters and bulk actions share one stable-height panel. Table headers remain visible while scrolling; identifier columns may freeze at desktop widths only. Keys and locale codes use monospace typography.

### Forms and overlays

The #app viewport owns page scrolling and stable scrollbar space; html/body do not scroll. Body-portaled overlays keep their normal background interaction lock through AppUiProvider without extra padding or margin. The page scrollbar stays visible when dialogs, selects, or menus open; overlay scrolling remains independent. Router history restores #app positions, and print uses natural document flow.

Search inputs have accessible labels and immediate clear controls. Authored selects use the shared Reka UI-based primitive. Dialogs and drawers reuse project-owned primitives, keep actions reachable, and display validation or server failures in context.

Selected-term snippets reuse TermExportDialog: show the frozen selection count, an authored language Select, and a bounded monospace read-only preview. Keep copy wording stable while busy, show skipped empty translations, and retain the preview when clipboard permission fails.

### Iconography

Lucide is the canonical icon family. Use 14–18px outline icons in controls; icon-only actions require a localized accessible name and tooltip where the meaning is not universal.

### Motion

Motion communicates state changes in roughly 150–200ms. Avoid perpetual decorative animation in status badges. Spinners are reserved for active work, and reduced-motion preferences must remain usable.

### Content and data visualization

Use concise Simplified Chinese, explicit verbs, and consistent lifecycle vocabulary: 草稿、待翻译、待校对、待发布、已发布. Counts and percentages are compact context. Overview charts use real API data; empty data is distinct from zero. Daily activity is a straight-line area chart with an accessible daily-values disclosure. Language progress uses horizontal bars and explicit counts.

## Do's and Don'ts

- **Do:** Keep source language, target language, Key, workflow status, and validation visible in the scanning path.
- **Do:** Reuse semantic tokens and shared UI primitives across every workbench action.
- **Don't:** Float bulk toolbars over navigation or content.
- **Don't:** Replace missing content with ambiguous English placeholders or color-only status.

## Reference-led refactor (2026-10-20)

The user approved implementing design-spec.md with flexibility rather than literal screenshot reproduction. Adopt teal primary/selection, white light panels, compact metric cards and chart-based overview. Keep the resizable sidebar, no global top bar, project directory rows and translation table workflows. Use 6px controls / 8px panels rather than strictly 4px controls so the application remains approachable. Existing theme/radius preferences continue to work.

### Runtime mapping (Model B)

| Role                            | Canonical owner                            | Adapter / consumer                                                     |
| ------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| Default and dark palette        | src/style.css :root / .dark                | Tailwind @theme inline → shared shadcn-vue controls                    |
| Alternate palettes              | src/assets/themes.css                      | useSystemTheme → theme class; persisted store preserves user selection |
| Radius                          | src/store/theme.ts default 0.375rem        | useSystemTheme → --radius → sm/md/lg/xl adapters                       |
| Panel / metric / table geometry | src/style.css                              | workspace-panel, metric-strip, dashboard-metrics, table slots          |
| Content accents                 | src/style.css --detail-\*                  | data-tone → detail-icon/detail-text/detail-badge/detail-progress       |
| Scroll / overlays               | src/assets/scrollbar.css and AppUiProvider | Existing #app scroll ownership and Reka overlays                       |

### Intentional changes from the previous Helios direction

| Previous rule                  | Current implementation                                     | Decision                                 |
| ------------------------------ | ---------------------------------------------------------- | ---------------------------------------- |
| Neutral primary and navigation | Teal actions, pale teal active navigation                  | Approved reference direction             |
| Connected metrics everywhere   | Independent overview cards; inline variant inside panels   | Improve scanning without nesting cards   |
| 10px controls / 14px panels    | 6px controls / 8px panels                                  | Lighter, more precise reference geometry |
| Multiple global token blocks   | style.css is canonical; index.css is a compatibility entry | Prevent import-order drift               |

Content accents stay small: blue for context, teal for progress, amber for pending work and violet for AI. Status text uses readable foreground and labels/icons carry meaning independently of color. Business and recovery contracts remain in UX-CONTRACT.md.

## Real-data verification (2026-10-20)

The real localhost:5173 app was inspected after Helios login, with a 95-term / 17-language project. Translation columns use a fixed 260px width and wrap previews up to four lines; full content remains available through the existing accessible term-detail action, with a visible table hint; the selection/action/key columns retain 40/96/220px widths so sticky offsets remain aligned. Horizontal scrolling belongs to the table. Overview resolves the same effective source language as the workbench and only flags target languages with missing translations. Local frontend access follows docs/helios-sso.md: use localhost:5173 consistently with the registered callback and allowed origin.
