import type { CellPosition, GridDirection } from "../model/types";
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

/**
 * A key as the grid reads it (E1.1): in a right-to-left grid the left and right arrows swap, so
 * ArrowLeft goes to the next column, as it goes to the right in a left-to-right one. Home and End
 * stay the row's start and end.
 */
export function inlineKey(key: string, direction: GridDirection): string {
    if (direction === "ltr") return key;
    if (key === "ArrowLeft") return "ArrowRight";
    return key === "ArrowRight" ? "ArrowLeft" : key;
}

/** A key with Ctrl (or ⌘) held: Ctrl+Home and Ctrl+End reach the grid's ends. */
export const CTRL_KEYS: Record<string, Direction> = {
    Home: "grid-start",
    End: "grid-end",
};

/** The pixels a wheel "line" or "page" stands for (`deltaMode` 1 and 2). */
export const LINE_HEIGHT = 40;

/**
 * The Latin letter a shortcut is pressed with (Epic #89): its key's own, else, on a layout whose
 * letters are not Latin (Cyrillic, Greek), its key's place on the keyboard (`code`), as the
 * system's shortcuts read it.
 */
export function shortcutLetter(event: KeyboardEvent): string {
    const key = event.key.toLowerCase();
    if (key.length === 1 && key >= "a" && key <= "z") return key;
    return event.code.startsWith("Key")
        ? event.code.slice(3).toLowerCase()
        : key;
}

/**
 * Whether a key is Ctrl/⌘+A, without Shift: select all (the cells, the rows), its letter read as
 * the system's shortcuts read it (`shortcutLetter`: on a Cyrillic or a Greek layout too).
 */
export function isSelectAll(event: KeyboardEvent): boolean {
    return (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        shortcutLetter(event) === "a"
    );
}

/**
 * Whether a key is part of a composition (an IME): `isComposing`, or the key code browsers give
 * its keys (229), which Safari's confirming Enter carries with `isComposing` false.
 */
export function isComposing(event: KeyboardEvent): boolean {
    return event.isComposing || event.keyCode === 229;
}

/**
 * Whether a key with Alt types a character: AltGr (Ctrl and Alt, on Windows) or macOS's Option
 * alone, a printable key other than Space; never with ⌘.
 */
export function isAltCharacter(event: KeyboardEvent): boolean {
    return (
        event.altKey &&
        !event.metaKey &&
        event.key !== " " &&
        [...event.key].length === 1
    );
}

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

/**
 * A row's drag handle (Epic #86, E2.3): an element the app renders in a row (a cell of it), its
 * value the row's index. A press on it drags the row while rows move (`reorderableRows`).
 */
export const ROW_DRAG_HANDLE_ATTRIBUTE = "data-grid-row-drag-handle";

/**
 * A group's label (Epic #85, E1.3): an element the app renders in a group's header cell, its value
 * the group's key. The engine keeps it in view while the group scrolls (the `label` layer).
 */
export const GROUP_LABEL_ATTRIBUTE = "data-grid-group-label";

/**
 * A row group's toggle (Epic #87): the control the app renders in a group row (or a row that
 * expands), its value the row's index. A click on it toggles the row's group (`row-groups.toggle`).
 */
export const GROUP_TOGGLE_ATTRIBUTE = "data-grid-group-toggle";

/**
 * A fill handle (Epic #88, E4.4): an element the app renders in the cell at the corner of the
 * range (or the active cell), its value that cell's row index. A press on it drags a fill.
 */
export const FILL_HANDLE_ATTRIBUTE = "data-grid-fill-handle";

/**
 * What belongs to an edit outside its cell (Epic #88, E4.3): an element the app marks with the
 * edit's `editorProps` (a select's or a date picker's popover, portalled out of the grid), its
 * value naming that edit of that grid. A press or focus there keeps the edit open; anywhere else
 * outside the edited cell, it commits.
 */
export const EDITOR_ATTRIBUTE = "data-grid-editor";

/** The grid's own controls an app renders in cells: a group's toggle, a row's drag handle, a fill handle, a resizer. */
const GRID_CONTROLS = [
    GROUP_TOGGLE_ATTRIBUTE,
    ROW_DRAG_HANDLE_ATTRIBUTE,
    FILL_HANDLE_ATTRIBUTE,
    COLUMN_RESIZER_ATTRIBUTE,
]
    .map((attribute) => `[${attribute}]`)
    .join(",");

/** Whether an element is (or is inside) one of the grid's own controls (`GRID_CONTROLS`): no editor. */
export function isGridControl(element: Element): boolean {
    return element.closest(GRID_CONTROLS) !== null;
}

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
 * How much a transform above `reference` (the viewport) scales the boxes a page reads: a box's
 * size over it is in layout pixels. 1 without one.
 */
export function layoutScale(reference: HTMLElement): number {
    const layout = reference.offsetWidth;
    const box = reference.getBoundingClientRect().width;
    return layout > 0 && box > 0 ? box / layout : 1;
}

/**
 * Elements' widths at their content's widest (Epic #80, A3), in one layout: each one's inline
 * `width` set to `max-content` (and, for a pinned cell in its row's flex, `flex-shrink` to 0: it
 * could shrink), important so no style sheet holds it; then every box read; then every `style`
 * attribute put back exactly as it was. All in one go: nothing paints between. The widths are
 * layout pixels: a box scaled by a transform above `reference` (the viewport) is scaled back.
 */
export function maxContentWidths(
    elements: readonly HTMLElement[],
    pinned: ReadonlySet<Element>,
    reference: HTMLElement,
): number[] {
    const previous = elements.map((element) => element.getAttribute("style"));
    for (const element of elements) {
        element.style.setProperty("width", "max-content", "important");
        if (pinned.has(element)) {
            element.style.setProperty("flex-shrink", "0", "important");
        }
    }
    const scale = layoutScale(reference);
    const widths = elements.map(
        (element) => element.getBoundingClientRect().width / scale,
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

/** What a grid tells the grids nested in it (Epic #89, E5.2): whether its active cell holds one. */
export interface NestingHost {
    /** whether the outer grid's active cell (or row, for one in a detail) holds `element` */
    holds(element: Element): boolean;
    /** listens to the outer grid's active cell; returns the unsubscribe */
    listen(listener: () => void): () => void;
}

/** Every attached viewport's host, for the grids nested in it. */
export const HOSTS = new WeakMap<Element, NestingHost>();

/**
 * Every attached grid's search for the grid it is nested in (`findHost`), by its viewport: a
 * viewport attaching or detaching asks the grids inside it again (`rehostWithin`: an outer
 * viewport attaches after the ones in its cells, refs attach child first; a grid between two
 * others may attach after both; a host detaching leaves its grids to the next one out).
 */
export const NESTINGS = new Map<Element, () => void>();

/** Asks the grids nested inside `element` for their host again (it attached or detached). */
export function rehostWithin(element: Element): void {
    for (const [viewport, find] of [...NESTINGS]) {
        if (viewport !== element && element.contains(viewport)) find();
    }
}

export function isElement(target: unknown): target is Element {
    return (
        typeof target === "object" &&
        target !== null &&
        "nodeType" in target &&
        target.nodeType === 1
    );
}

/** Whether an `overscroll-behavior` value keeps a scroll at the element's end from chaining. */
function keepsWheel(overscroll: string): boolean {
    return overscroll === "contain" || overscroll === "none";
}

/** Whether an `overflow` value lets a person scroll the element (the wheel, a swipe). */
function scrollsOverflow(overflow: string): boolean {
    return overflow === "auto" || overflow === "scroll";
}

/**
 * A wheel's gesture (Epic #89, E5.2): wheels this close together (ms) are one, the styles read for
 * the first one kept for the others.
 */
export const WHEEL_GESTURE = 300;

/** What a wheel reads of an element's style: where it scrolls, keeps a wheel, is laid out. */
interface WheelStyle {
    readonly x: boolean;
    readonly y: boolean;
    readonly keepsX: boolean;
    readonly keepsY: boolean;
    readonly rtl: boolean;
}

/** The styles read during a wheel's gesture, by element. */
export type WheelStyles = WeakMap<Element, WheelStyle>;

/** An element's styles a wheel reads, once a gesture (`styles`). */
function wheelStyleOf(element: Element, styles: WheelStyles): WheelStyle {
    let style = styles.get(element);
    if (!style) {
        const computed =
            element.ownerDocument.defaultView?.getComputedStyle(element);
        style = {
            x: scrollsOverflow(computed?.overflowX ?? ""),
            y: scrollsOverflow(computed?.overflowY ?? ""),
            keepsX: keepsWheel(computed?.overscrollBehaviorX ?? ""),
            keepsY: keepsWheel(computed?.overscrollBehaviorY ?? ""),
            rtl: computed?.direction === "rtl",
        };
        styles.set(element, style);
    }
    return style;
}

/**
 * The element from `target` up to the viewport (excluded) that still scrolls a wheel's part
 * on one axis (`inline`: across, `delta` physical): one whose `overflow` scrolls on it, with
 * content beyond its edge that way (right to left mirrored), or that never chains a wheel at
 * its end (`overscroll-behavior`); `null` for none. Its scroll sizes are read only where its
 * style lets it scroll.
 */
export function scrollerBefore(
    target: Element,
    viewport: Element | null,
    inline: boolean,
    delta: number,
    styles: WheelStyles,
): Element | null {
    for (
        let node: Element | null = target;
        node && node !== viewport;
        node = node.parentElement
    ) {
        const style = wheelStyleOf(node, styles);
        if (!(inline ? style.x : style.y)) continue;
        const max = inline
            ? node.scrollWidth - node.clientWidth
            : node.scrollHeight - node.clientHeight;
        if (max < 1) continue;
        if (inline ? style.keepsX : style.keepsY) return node;
        // from the start, whatever the side it is laid out from
        const at = inline
            ? style.rtl
                ? -node.scrollLeft
                : node.scrollLeft
            : node.scrollTop;
        const toEnd = inline && style.rtl ? delta < 0 : delta > 0;
        if (toEnd ? at < max - 0.5 : at > 0.5) return node;
    }
    return null;
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

/**
 * The style of the node a copy or a paste selects (`holdSelection`, Epic #88): out of the
 * cell's layout, unseen, and selectable whatever the cell's `user-select`.
 */
const CLIPBOARD_NODE_STYLE: readonly (readonly [string, string])[] = [
    ["position", "absolute"],
    ["width", "1px"],
    ["height", "1px"],
    ["overflow", "hidden"],
    ["opacity", "0"],
    ["pointer-events", "none"],
    ["user-select", "text"],
    ["-webkit-user-select", "text"],
];

/** The page's selection held in a cell's own node (`holdSelection`), and its ranges before. */
export interface HeldSelection {
    readonly node: Element;
    readonly ranges: readonly ReturnType<Selection["getRangeAt"]>[];
}

/** Whether `selection` is text selected inside `cell` itself (its content, its editor). */
export function selectedIn(selection: Selection, cell: Element): boolean {
    return (
        !selection.isCollapsed &&
        cell.contains(selection.anchorNode) &&
        cell.contains(selection.focusNode)
    );
}

/**
 * Selects a node of the cell's own, hidden and selectable, in place of the page's selection
 * (collapsed, as the grid keeps it, or text selected elsewhere on the page, which would take a
 * copy or a paste): the clipboard's events then come to the cell (Epic #89). Returns what puts
 * the selection back (`releaseSelection`).
 */
export function holdSelection(
    cell: Element,
    selection: Selection,
): HeldSelection {
    const ranges = Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index),
    );
    const node = cell.ownerDocument.createElement("span");
    node.textContent = "\u200b";
    node.setAttribute("aria-hidden", "true");
    for (const [property, value] of CLIPBOARD_NODE_STYLE) {
        node.style.setProperty(property, value);
    }
    cell.append(node);
    selection.selectAllChildren(node);
    return { node, ranges };
}

/** Puts the selection back as it was before `holdSelection`, and removes its node. */
export function releaseSelection({ node, ranges }: HeldSelection): void {
    const selection = node.ownerDocument.getSelection();
    selection?.removeAllRanges();
    for (const range of ranges) selection?.addRange(range);
    node.remove();
}
