// Vendored from the Fragiola UI registry (https://fragiola.com/r/choice.json, source registry/families/choice.ts). Do not edit: re-run scripts/vendor-fragiola.ts.
// Family `choice` — checkable controls (root, control, indicator, label,
// description). Shared by Checkbox, Radio and Switch.
//
// Origin: three components with the same visual skeleton — a box that fills
// with an icon when checked. shadcn duplicated the entire surface three
// times. This family writes it once.
//
// Decisions in docs/architecture.md §2 (orthogonal families), style families
// (tv, zero variants), and palette (palette kills colour duplication).
//
// Drift resolved — recorded in the port report:
//  - peer-peer-[data-state=checked]:border-input (radio) → eliminated;
//    palette handles it via data-checked:bg-palette-base
//  - focus-visible:ring-* on all three → field-focus:outline-2
//    field-focus:outline-palette-ring (the project's focus convention)
//  - text-primary-foreground (indicator icon) → text-palette-contrast
//  - data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground
//    → data-checked:bg-palette-base data-checked:text-palette-contrast
//  - data-[state=unchecked]:bg-transparent → eliminated (default is no bg)
//  - dark theme blocks → eliminated (palette handles both themes)
//
// ─── STATE NORMALIZATION ───────────────────────────────────────────────────
// Base UI emits data-checked and data-unchecked (not data-state=checked).
// The highlighted custom variant covers focus. The themes register
// data-checked as a state selector.
//
// ─── ZERO VARIANTS ─────────────────────────────────────────────────────────
// root has no size variant. The three controls share the same size
// (size-4.5 → 18px). If switch ever needs a different size, that is a
// variant — until then, unify.

import { tv } from "tailwind-variants";

// root — the box. size-4.5 (18px) for checkbox and radio; switch overrides
// width via its own className. Border, background, radius and focus ring
// all live here. data-checked fills with palette-base and swaps text to
// contrast — the indicator icon inherits text-palette-contrast.
const root = tv({
    base: `
        peer field-control shrink-0 rounded-sm border border-palette-line
        bg-palette-soft text-palette-contrast
        field-focus:outline-2 field-focus:outline-palette-ring
        data-disabled:cursor-not-allowed data-disabled:opacity-50
        [&_svg:not([class*='size-'])]:size-3.5
    `,
});

// control — the indicator area. For checkbox and radio, this is the same
// element as root (the indicator is a child). For switch, this is the thumb
// that slides. Kept as a separate member for the switch thumb.
const control = tv({
    base: "pointer-events-none flex items-center justify-center text-palette-contrast",
});

// indicator — the icon shown when checked. For checkbox: a check mark.
// For radio: a dot. For switch: nothing (the thumb position is the
// indicator). The indicator is conditionally rendered by Base UI.
const indicator = tv({
    base: "flex items-center justify-center text-palette-contrast",
});

// label — points at Text.Label via render in the composition. The family
// declares only palette and state, not typography.
const label = tv({
    base: "text-palette-accent/85 leading-none data-disabled:opacity-50",
});

// description — points at Text.Paragraph via render.
const description = tv({
    base: "text-palette-accent/85 data-disabled:opacity-50",
});

export const choice = {
    root,
    control,
    indicator,
    label,
    description,
};
