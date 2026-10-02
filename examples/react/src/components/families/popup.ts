// Vendored from the Fragiola UI registry (https://fragiola.com/r/popup.json, source registry/families/popup.ts). Do not edit: re-run scripts/vendor-fragiola.ts.
// Family `popup` — the floating box family.
// Origin: .cn-dropdown-menu-content, .cn-context-menu-content,
// .cn-popover-content, .cn-select-content, .cn-combobox-content in shadcn's
// style-nova.css (removed from the project after conversion).
//
// Decisions in docs/architecture.md §2 (orthogonal families) and style
// families (tv with zero variants). Drift resolved — recorded in the port
// report:
//  - min-w-32 (dropdown) vs min-w-36 (context/select/combobox/menubar)
//    → unified to min-w-36 (always — the width variant was eliminated)
//  - menubar missing data-closed:* → included (was a bug — did not animate
//    on close)
//  - padding: p-1 (menu lists) vs p-2.5 (popover block) vs none (select)
//    → p-2 always (the padding variant was eliminated); select does not
//    duplicate padding — the inner group p-1 was removed.
//  - Colour conversions: bg-popover text-popover-foreground →
//    palette-raised bg-palette-base text-palette-contrast;
//    ring-foreground/10 ring-1 → border border-palette-line
//  - cn-menu-translucent (glassmorphism) NOT included — it required
//    !important (forbidden by the rules) and is cross-cutting decoration,
//    not popup structure. See the port report.
//
// Zero variants: each member is tv({ base }) with no variants. p-2 and
// min-w-36 are always applied on `content`; the tooltip member has its own
// compact padding and sizing.
//
// ─── TWO MEMBERS, NOT TWO VARIANTS ──────────────────────────────────────────
// `content` is the menu/popover floating box: raised surface, border, radius,
// shadow, p-2, min-w-36, zoom animation. `tooltip` is a transient text label:
// inverted palette (accent as background, base as text), no border, no shadow,
// compact padding, text-xs, fade-only animation. These are genuinely different
// things — a menu list and a text label — so they are named members, not
// variants. The zero-variant rule is preserved.
//
// ─── TOOLTIP COLOURS ────────────────────────────────────────────────────────
// `bg-palette-accent text-palette-base` — the accent role (normally the
// foreground) becomes the background, and the base role (normally the
// background) becomes the text. This is a natural inversion that follows the
// 6-role contract: no new role, no new palette. In a light theme the tooltip
// is dark-on-light inverted; in a dark theme it inverts automatically.
//
// Namespace object: a single `popup` export with `content` and `tooltip`.

import { tv } from "tailwind-variants";

const content = tv({
    base: `
        palette-raised bg-palette-base text-palette-contrast
        rounded-lg border border-palette-line shadow-md
        min-w-36 p-2
        max-h-(--available-height) origin-(--transform-origin)
        overflow-x-hidden overflow-y-auto
        data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
        data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95
        data-[side=bottom]:slide-in-from-top-2
        data-[side=left]:slide-in-from-right-2
        data-[side=right]:slide-in-from-left-2
        data-[side=top]:slide-in-from-bottom-2
        data-[side=inline-start]:slide-in-from-right-2
        rtl:data-[side=inline-start]:slide-in-from-left-2
        data-[side=inline-end]:slide-in-from-left-2
        rtl:data-[side=inline-end]:slide-in-from-right-2
        duration-150 ease-out
    `,
});

// tooltip — a transient text label. Inverted palette (accent as background,
// base as text), no border, no shadow, compact padding, text-xs. Fade-only
// (a tooltip does not zoom or slide — it appears in place).
//
// `data-starting-style` / `data-ending-style` are TRANSITION markers (see
// layer.ts): the attribute lives one frame, so it drives a CSS transition,
// never a keyframe class. `data-instant` is set when the tooltip moves
// between triggers inside the provider's delay window — no fade then.
const tooltip = tv({
    base: `
        bg-palette-accent text-palette-base
        rounded-md
        max-w-72 px-2 py-1 text-xs
        transition-opacity duration-150 ease-out
        motion-reduce:transition-none data-instant:transition-none
        data-starting-style:opacity-0 data-ending-style:opacity-0
        z-50
    `,
});

export const popup = { content, tooltip };
