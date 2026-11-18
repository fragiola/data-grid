import { mount, type VueWrapper } from "@vue/test-utils";
import { afterAll, beforeAll } from "vitest";
import { type Component, defineComponent, h, nextTick } from "vue";
import { clipboard } from "../src/clipboard";
import { columnGroupCollapse } from "../src/column-group-collapse";
import { columnPinning } from "../src/column-pinning";
import { columnReorder } from "../src/column-reorder";
import { columnResize } from "../src/column-resize";
import { editing } from "../src/editing";
import { fillHandle } from "../src/fill";
import { navigation } from "../src/navigation";
import { cellRange } from "../src/range";
import { rowExpansion } from "../src/row-expansion";
import { rowGrouping } from "../src/row-grouping";
import { rowReorder } from "../src/row-reorder";
import { rowSelection } from "../src/row-selection";
import { cellSpans } from "../src/spans";
import { summaryRows } from "../src/summary-rows";

// What the Vue tests share (the React tests' helpers, for Vue): a grid root's size (jsdom lays
// nothing out), mounting a grid, counting renders (D9), the parts by their `data-grid-part` and
// indexes, and the tags that render a grid as a table, and the features the tests of the grid's
// keys, selections, ranges, clipboard and fill install (Epic #144).

/**
 * Every feature these behaviours were before Epics #144, #146, #148 and #151 (navigation, row
 * selection, cell ranges, the clipboard, the fill handle, cell editing, column resizing,
 * reordering, pinning and collapsible groups, column spans, row grouping, row expansion, summary
 * rows and row reorder): a test of them installs them (`features: FEATURES`
 * on `Root`, `typedDataGrid<TRow, Features>()`), and behaves as it did.
 */
export const FEATURES = [
    navigation(),
    rowSelection(),
    cellRange(),
    clipboard(),
    fillHandle(),
    editing(),
    columnResize(),
    columnReorder(),
    columnPinning(),
    columnGroupCollapse(),
    cellSpans(),
    rowGrouping(),
    rowExpansion(),
    summaryRows(),
    rowReorder(),
] as const;

/** The type of `FEATURES`, for `typedDataGrid`, `RootProps` and the refs. */
export type Features = typeof FEATURES;

/** Gives every grid root a `width` × `height` client size during the file's tests. */
export function stubViewportSize(width: number, height: number) {
    beforeAll(() => {
        for (const [property, size] of [
            ["clientWidth", width],
            ["clientHeight", height],
        ] as const) {
            Object.defineProperty(HTMLElement.prototype, property, {
                configurable: true,
                get(this: HTMLElement) {
                    return this.dataset.gridPart === "root" ? size : 0;
                },
            });
        }
    });
    afterAll(() => {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
        delete (HTMLElement.prototype as { clientHeight?: number })
            .clientHeight;
    });
}

/** A mounted grid: its container (attached to the document, so focus works) and its wrapper. */
export interface Mounted {
    readonly container: HTMLElement;
    readonly wrapper: VueWrapper;
    /** how many component renders there were since the mount or the last `resetRenders()` */
    renders(): number;
    resetRenders(): void;
    /** the renders of the components named `name` (`DataGridCell`, …) since the last reset */
    rendersOf(name: string): number;
    unmount(): void;
}

/**
 * Mounts `render` (a render function, or a component) attached to the document, counting every
 * component's renders (D9: a global mixin's `beforeUpdate` and `beforeMount`, by name).
 */
export function renderGrid(render: (() => unknown) | Component): Mounted {
    const container = document.createElement("div");
    document.body.append(container);
    const counts = new Map<string, number>();
    let total = 0;
    const count = function (this: { $options: { name?: string } }) {
        total += 1;
        const name = this.$options.name ?? "";
        counts.set(name, (counts.get(name) ?? 0) + 1);
    };
    const component =
        typeof render === "function" &&
        !("setup" in render) &&
        !("render" in render)
            ? defineComponent({ setup: () => render as () => never })
            : (render as Component);
    const wrapper = mount(component, {
        attachTo: container,
        global: { mixins: [{ beforeMount: count, beforeUpdate: count }] },
    });
    return {
        container,
        wrapper,
        renders: () => total,
        resetRenders: () => {
            total = 0;
            counts.clear();
        },
        rendersOf: (name) => counts.get(name) ?? 0,
        unmount: () => wrapper.unmount(),
    };
}

/** Lets Vue flush (renders, watchers) and the engine's microtasks run. */
export async function settled() {
    await nextTick();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await nextTick();
}

/** Scrolls a grid's root to `top` and `left` (the ones given) and fires its scroll. */
export function scrollRoot(
    element: HTMLElement,
    { top, left }: { top?: number; left?: number },
) {
    if (top !== undefined) element.scrollTop = top;
    if (left !== undefined) element.scrollLeft = left;
    element.dispatchEvent(new Event("scroll"));
}

function find(container: ParentNode, selector: string): HTMLElement {
    const element = container.querySelector(selector);
    if (!(element instanceof HTMLElement)) throw new Error(`no ${selector}`);
    return element;
}

/** The grid's root. */
export const root = (container: ParentNode) =>
    find(container, '[data-grid-part="root"]');

/** The body row at `rowIndex`. */
export const rowAt = (container: ParentNode, rowIndex: number) =>
    find(container, `[data-grid-part="row"][data-row-index="${rowIndex}"]`);

/** The cell at `rowIndex` and `columnIndex`: a header cell above row 0. */
export const cellAt = (
    container: ParentNode,
    rowIndex: number,
    columnIndex = 0,
) =>
    find(
        container,
        `[data-grid-part="${rowIndex < 0 ? "header-cell" : "cell"}"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
    );

/** The first header cell of the column at `columnIndex`. */
export const headerAt = (container: ParentNode, columnIndex: number) =>
    find(
        container,
        `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]`,
    );

const TABLE = {
    grid: "table",
    header: "thead",
    headerRow: "tr",
    headerCell: "th",
    body: "tbody",
    row: "tr",
    cell: "td",
};

/** The `as` tag of each part: a table's, or none (the parts' own divs). */
export const tags = (table: boolean): Partial<typeof TABLE> =>
    table ? TABLE : {};

/** Fires a native event at `target`, bubbling and cancelable (keys, pointers, clicks). */
export function fire<E extends Event>(target: EventTarget, event: E): E {
    target.dispatchEvent(event);
    return event;
}

/** A key pressed on `target`: its `keydown`, bubbling and cancelable. */
export function keyDown(target: EventTarget, init: KeyboardEventInit) {
    return fire(
        target,
        new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            ...init,
        }),
    );
}

/** A click on `target`, bubbling. */
export function click(target: HTMLElement, init: MouseEventInit = {}) {
    return fire(
        target,
        new MouseEvent("click", { bubbles: true, cancelable: true, ...init }),
    );
}

/** A pointer press on `target`, bubbling and cancelable. */
export function pointerDown(target: EventTarget, init: PointerEventInit = {}) {
    const Pointer =
        typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
    return fire(
        target,
        new Pointer("pointerdown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            ...init,
        }),
    );
}

export { h };
