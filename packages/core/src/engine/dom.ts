import type { CellPosition } from "../model/types";
import type { Direction } from "../navigation/navigation";

// What the engine reads in the DOM, with no state of its own: the keys it maps, the controls and
// what takes focus in a cell, and the registry of attached viewports that tells a grid's own cells
// from a nested grid's (E4). No global `document` or `window`: what needs a document gets an
// element.

export const KEYS: Record<string, Direction> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    Home: "row-start",
    End: "row-end",
    PageUp: "page-up",
    PageDown: "page-down",
};

/** A key with Ctrl (or ⌘) held: Ctrl+Home and Ctrl+End reach the grid's ends. */
export const CTRL_KEYS: Record<string, Direction> = {
    Home: "grid-start",
    End: "grid-end",
};

/** The pixels a wheel "line" or "page" stands for (`deltaMode` 1 and 2). */
export const LINE_HEIGHT = 40;

export function isEditable(element: Element): boolean {
    const tag = element.tagName;
    return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (element as HTMLElement).isContentEditable === true
    );
}

/**
 * Roles of controls that act on their own, and of widgets holding them (a popover, a menu, a
 * toolbar): a click or a key in one is the widget's.
 */
const CONTROL_ROLES = new Set([
    "dialog",
    "alertdialog",
    "menu",
    "menubar",
    "listbox",
    "toolbar",
    "tablist",
    "radiogroup",
    "tree",
    "grid",
    "treegrid",
    "button",
    "link",
    "checkbox",
    "switch",
    "radio",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "combobox",
    "slider",
    "spinbutton",
    "tab",
    "textbox",
]);

/** Whether an element is a control of its own (a button, a link, a field, a menu trigger). */
export function isControl(element: Element): boolean {
    // upper case in HTML, as written in SVG (`a`)
    const tag = element.tagName.toUpperCase();
    if (
        tag === "BUTTON" ||
        tag === "INPUT" ||
        tag === "SELECT" ||
        tag === "TEXTAREA" ||
        tag === "SUMMARY" ||
        tag === "LABEL" ||
        (tag === "A" && element.hasAttribute("href"))
    ) {
        return true;
    }
    const role = element.getAttribute("role");
    return (
        (role !== null && CONTROL_ROLES.has(role)) ||
        (element as HTMLElement).isContentEditable === true
    );
}

/** What takes focus in a cell: its controls (the grid moves between them in interaction). */
export const FOCUSABLE = [
    "a[href]",
    "area[href]",
    "button",
    "input",
    "select",
    "textarea",
    "summary",
    "iframe",
    "audio[controls]",
    "video[controls]",
    "[tabindex]",
    '[contenteditable]:not([contenteditable="false"])',
].join(",");

/**
 * A control the app keeps as a tab stop of its own: the grid leaves its `tabindex` alone outside
 * interaction (Epic #52, I4).
 */
export const TAB_STOP_ATTRIBUTE = "data-grid-tab-stop";

/** The keys a scroll container pages itself by: every navigation key (`KEYS`) is one of them. */
export const PAGE_KEYS: ReadonlySet<string> = new Set(Object.keys(KEYS));

/**
 * A column resizer (Epic #70, W3): an element the app renders in a resizable header cell, its
 * value the column's or the group's key. The engine drags it and gives it the arrows.
 */
export const COLUMN_RESIZER_ATTRIBUTE = "data-grid-column-resizer";

/** Whether an element is a column resizer: a control of its header cell, with keys of its own. */
export function isResizer(element: Element): boolean {
    return element.hasAttribute(COLUMN_RESIZER_ATTRIBUTE);
}

/** Whether a control moves through its group with the arrows (a radio, a menu item, a tab). */
export function movesWithArrows(element: Element): boolean {
    const role = element.getAttribute("role");
    return (
        (element.tagName.toUpperCase() === "INPUT" &&
            element.getAttribute("type")?.toLowerCase() === "radio") ||
        role === "radio" ||
        role === "menuitem" ||
        role === "tab"
    );
}

/** Roles of controls with no use for the page keys (a button, a link, a box to check). */
const PAGELESS_ROLES = new Set([
    "button",
    "link",
    "checkbox",
    "switch",
    "radio",
    "menuitem",
    "tab",
]);

/** Input types with no use for the page keys. */
const PAGELESS_INPUTS = new Set([
    "checkbox",
    "radio",
    "button",
    "submit",
    "reset",
]);

/**
 * Whether a control has no use for the page keys (they would page the grid's container): a
 * button, a link, a box to check. A field, a list, media or a scrolling element keeps them.
 */
export function isPagelessControl(element: Element): boolean {
    const tag = element.tagName.toUpperCase();
    if (tag === "BUTTON" || tag === "SUMMARY" || tag === "A") return true;
    if (tag === "INPUT") {
        return PAGELESS_INPUTS.has(
            (element.getAttribute("type") ?? "text").toLowerCase(),
        );
    }
    const role = element.getAttribute("role");
    return role !== null && PAGELESS_ROLES.has(role);
}

/**
 * Elements' widths at their content's widest (Epic #80, A3), in one layout: each one's inline
 * `width` set to `max-content` (and, for a pinned cell in its row's flex, `flex-shrink` to 0: it
 * could shrink), important so no style sheet holds it; then every box read; then every `style`
 * attribute put back exactly as it was. All in one go: nothing paints between.
 */
export function maxContentWidths(
    elements: readonly HTMLElement[],
    pinned: ReadonlySet<Element>,
): number[] {
    const previous = elements.map((element) => element.getAttribute("style"));
    for (const element of elements) {
        element.style.setProperty("width", "max-content", "important");
        if (pinned.has(element)) {
            element.style.setProperty("flex-shrink", "0", "important");
        }
    }
    const widths = elements.map(
        (element) => element.getBoundingClientRect().width,
    );
    elements.forEach((element, index) => {
        const style = previous[index] ?? null;
        if (style === null) element.removeAttribute("style");
        else element.setAttribute("style", style);
    });
    return widths;
}

/** How far a press may move before its click is a drag (a text selection), in pixels. */
export const CLICK_SLOP = 4;

/**
 * Every attached viewport, across engines: a grid nested in a cell of another one is its own grid,
 * and an engine tells its cells from a nested grid's by the nearest viewport above them.
 */
export const VIEWPORTS = new WeakSet<Element>();

export function isElement(target: unknown): target is Element {
    return (
        typeof target === "object" &&
        target !== null &&
        "nodeType" in target &&
        target.nodeType === 1
    );
}

/** The nearest attached viewport at or above `element`: the grid it belongs to. */
export function ownerViewport(element: Element): Element | null {
    for (let node: Element | null = element; node; node = node.parentElement) {
        if (VIEWPORTS.has(node)) return node;
    }
    return null;
}

/** The cell elements carry their indexes: the engine finds one to focus by them. */
export function cellSelector({ rowIndex, columnIndex }: CellPosition): string {
    return `[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`;
}

/** Any cell element (a nested grid's too). */
export const CELL_SELECTOR = "[data-row-index][data-column-index]";

/** Whether an element is a cell (a header cell, a nested grid's): it carries both indexes. */
export function isCellNode(element: Element): boolean {
    return (
        element.hasAttribute("data-row-index") &&
        element.hasAttribute("data-column-index")
    );
}

/** Whether an element is hidden or inert inside its cell (what is outside the grid aside). */
export function hiddenWithin(element: Element, cell: Element): boolean {
    for (
        let node: Element | null = element;
        node && node !== cell;
        node = node.parentElement
    ) {
        if (node.hasAttribute("hidden") || node.hasAttribute("inert")) {
            return true;
        }
    }
    return false;
}
