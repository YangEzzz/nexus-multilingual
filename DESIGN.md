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

The product shares Helios’ restrained black, white and gray visual family while remaining a well-organized translation editor: a quiet technical work surface where source text, target languages, validation, and publishing state can be compared without visual noise.

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

Use semantic runtime roles rather than raw feature colors for primary surfaces and controls. Background, foreground, muted, border, primary, and danger map directly to the CSS custom properties with the same role. Main surfaces and workflow summaries use neutral gray tones, matching Helios. Use small blue, green, amber and violet content accents for icons, badges, metric markers and progress; main navigation, card surfaces and primary actions remain neutral. Error and destructive states retain semantic red. Dark themes remap semantics without changing hierarchy.

## Typography

The interface uses the system sans stack for predictable Chinese and multilingual rendering. Keys, locale codes, counts, and other machine-readable identifiers use the data monospace stack. Hierarchy comes from size, weight, and spacing; italics are not used for missing data or important localized content.

## Layout

The shell follows the Helios family: a neutral sidebar, no global utility header, and a pale gray workspace with white panels. Desktop navigation can collapse into an icon rail; users can resize the expanded sidebar from 220px to 360px (264px default), with keyboard controls and persistent local preference. Narrow screens use the shared off-canvas navigation drawer, opened by a single compact button without a top menu bar. Each route owns its content padding; workbench pages use a bounded content area with one vertical owner. The workbench header and filter panel stay compact, while the table owns its horizontal and vertical overflow. At narrow widths controls reflow, while the comparison table retains explicit horizontal scrolling. Panel rhythm follows the existing 12–24px utility spacing used by shared components.

## Elevation & Depth

Static hierarchy uses tonal surfaces and borders first. A restrained small shadow may separate top-level workbench panels from the muted page background. Sticky headers use opaque or lightly blurred semantic surfaces so scrolling content never shows through. Heavy floating shadows are reserved for true overlays.

## Shapes

Controls follow the runtime 10px radius. Major workbench panels use the semantic radius-xl (base radius plus 4px); status indicators may use pills. Dense table cells stay rectangular so rows remain easy to compare.

## Components

### Foundational visual states

All interactive controls expose hover, focus-visible, active, disabled, and busy states through shared components. Selection combines a subtle primary tint with checkbox state. Loading preserves panel geometry. Empty datasets and no-results states use different copy and recovery actions.

### Buttons and actions

Use one solid primary action per decision area. Secondary utilities use outline or ghost emphasis. Destructive actions remain visually separated and use the shared destructive intent. Busy buttons retain their dimensions and pair a spinner with stable action wording.

### Navigation and data display

Desktop navigation uses explicit labels when expanded and canonical icon tooltips when collapsed. Appearance and collapse controls have one owner in the sidebar footer. The workbench header carries project context and the source-to-target language rail. Filters and bulk actions share one stable-height panel. Table headers remain visible while scrolling; identifier columns may freeze at desktop widths only. Keys and locale codes use monospace typography.

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

## Helios family alignment (2026-10-14)

The user requested a full UI refactor aligned with Helios. Project cards become compact directory rows; summaries use the shared metric-strip recipe; business pages use workspace-page spacing. Login uses a split composition with an original-to-translation-to-publication rail. Typography uses Segoe UI / Microsoft YaHei / system sans for interface and the existing monospace stack for identifiers. Semantic CSS remains canonical (Model B): src/style.css → Tailwind semantic utilities → shared shadcn-vue primitives; src/assets/themes.css remaps existing user-selected palettes. workspace-surface and panel-shadow derive from active semantic colors. Retain theme preferences and all permission, session, draft, import, export and release contracts.

## 内容点缀色（2026-10-14）

主体保持黑白灰，内容可用少量彩色点缀。info（蓝）用于项目与身份，success（绿）用于完成与启用，warning（琥珀）用于待处理，violet（紫）用于权限或 AI。颜色仅用于图标底、标签、细指标线、进度条和少量重点文字；不铺满卡片、不染色导航和主按钮。src/style.css owns --detail-\* and their dark adapters → data-tone → detail-icon/detail-text/detail-badge/detail-progress shared recipes. Labels/icons always carry the meaning independently of color.

点缀采用鲜明色值而非暗灰色调：蓝 #3b82f6、绿 #10b981、橙 #f59e0b、紫 #8b5cf6。它们用于图标、进度和细标记；说明与状态文字使用 foreground，避免亮色小字在白底上降低可读性。
