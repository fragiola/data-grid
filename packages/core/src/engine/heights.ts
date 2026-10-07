import { newRowsOf } from "../model/expansion";
import { loadedRowKey, rowKeyAt } from "../model/source";
import type { DataGridState } from "../model/types";
import { layoutScale } from "./dom";
import { type HeightObserver, type Measure, MeasuredHeights } from "./measure";

// The engine's measured heights (Epic #86, E2.2): it observes the rows and details it rendered
// while they are measured (`"auto"`), reads their heights at a commit (as their observer last told,
// else once), and keeps them in two stores (`measure.ts`) that follow their rows (`forget`). What a
// new height means for the view (the rows laid out again, the view kept) is the engine's
// (`remeasured`).

/** What the measured heights read of their engine. */
export interface HeightsContext<TRow, TNode> {
    getViewport(): HTMLElement | null;
    getState(): DataGridState<TRow, TNode>;
    /** the rendered rows and details (the engine's `row` and `detail` layers) */
    readonly rows: ReadonlySet<HTMLElement>;
    readonly details: ReadonlySet<HTMLElement>;
    /** heights changed, of the rows at `changed`: the rows are laid out again */
    remeasured(changed: readonly number[]): void;
}

/** The engine's measured heights: its rows' and details', and their observation. */
export interface Heights<TRow, TNode> {
    /** the heights measured of rows and of details */
    readonly rows: MeasuredHeights;
    readonly details: MeasuredHeights;
    /** Observes a row or a detail from the next frame on, while they are measured. */
    observeLater(element: Element): void;
    /** Stops observing an element: its height is read again if it comes back. */
    unobserve(element: Element): void;
    /** Observes the rows and details registered so far (attached, or measured from now on). */
    observeRegistered(): void;
    /** Observes nothing more, every height read forgotten (detached, or nothing measured). */
    stop(): void;
    /** The rendered rows' heights are read again (a row expanding or collapsing). */
    rereadRows(): void;
    /** Takes the heights of the rendered rows and details in (at a commit, and when told). */
    take(): void;
    /**
     * Drops the heights measured for rows no longer at their index (a new source, rows changed),
     * and every one once rows, or details, are no longer measured. Returns whether one was.
     */
    forget(
        before: DataGridState<TRow, TNode>,
        after: DataGridState<TRow, TNode>,
    ): boolean;
}

/** Whether a state's rows or details are measured. */
export function measuring<TRow, TNode>(
    state: DataGridState<TRow, TNode>,
): boolean {
    return state.rowHeight === "auto" || state.detailHeight === "auto";
}

export function createHeights<TRow, TNode>(
    context: HeightsContext<TRow, TNode>,
): Heights<TRow, TNode> {
    const { getViewport, getState } = context;
    const rows = new MeasuredHeights();
    const details = new MeasuredHeights();
    /** each measured element's border-box height, as last read or told by its observer */
    let heights = new WeakMap<Element, number>();
    /** the observer of the measured rows and details (the viewport's window's), while attached */
    let measurer: HeightObserver | null = null;
    /**
     * the elements to observe from the next frame on: an observer's first report of an element
     * rendered while observers report (a resize laid out again) would come in that same frame at
     * the same depth, which a browser defers with an error. The engine reads it at its commit.
     */
    const unobserved = new Set<Element>();
    let observeFrame: number | null = null;
    /** a pass of `take`: the heights that changed (none: nothing allocated), the scale */
    let rowChanges: Measure[] | null = null;
    let detailChanges: Measure[] | null = null;
    let scale = 0;
    /** the height of the details inside the row `takeRow` reads */
    let detailsInRow = 0;

    function observeLater(element: Element) {
        const win = getViewport()?.ownerDocument.defaultView;
        if (!measuring(getState()) || !win || !("ResizeObserver" in win)) {
            return;
        }
        unobserved.add(element);
        if (observeFrame !== null) return;
        observeFrame = win.requestAnimationFrame(() => {
            observeFrame = null;
            measurer ??= new win.ResizeObserver(onMeasured);
            for (const waiting of unobserved) measurer.observe(waiting);
            unobserved.clear();
        });
    }

    /** Elements resized (or observed for the first time): their heights, taken in. */
    function onMeasured(entries: readonly ResizeObserverEntry[]) {
        for (const { target, borderBoxSize } of entries) {
            const height = borderBoxSize?.[0]?.blockSize;
            // without a box size, read once more
            if (height === undefined) heights.delete(target);
            else heights.set(target, height);
        }
        take();
    }

    /** An element's border-box height in layout pixels: as last told, else read once. */
    function heightOf(element: Element): number {
        let height = heights.get(element);
        if (height === undefined) {
            const viewport = getViewport();
            if (scale === 0 && viewport) scale = layoutScale(viewport);
            height = element.getBoundingClientRect().height / (scale || 1);
            heights.set(element, height);
        }
        return height;
    }

    /** The row index an element carries (NaN without one). */
    function rowIndexOf(element: Element): number {
        const attribute = element.getAttribute("data-row-index");
        return attribute === null ? Number.NaN : Number(attribute);
    }

    /** A rendered detail's height, kept when it changed (a loaded row's only). */
    function takeDetail(element: HTMLElement) {
        const index = rowIndexOf(element);
        const key = loadedRowKey(getState(), index);
        if (key === undefined) return;
        const height = heightOf(element);
        if (details.holds(index, height, key)) return;
        if (!detailChanges) detailChanges = [];
        detailChanges.push({ index, height, key });
    }

    /** Adds a detail's height when it is inside the row `this` (a row's own height leaves it out). */
    function addDetailIn(this: Element, detail: HTMLElement) {
        if (this.contains(detail)) detailsInRow += heightOf(detail);
    }

    /**
     * A rendered row's own height, its element's less its details', kept when it changed (a loaded
     * row's only; one measured 0, hidden, keeps the height it had).
     */
    function takeRow(element: HTMLElement) {
        const index = rowIndexOf(element);
        // a group row's key is its group's (Epic #87)
        const key = rowKeyAt(getState(), index);
        if (key === undefined) return;
        detailsInRow = 0;
        context.details.forEach(addDetailIn, element);
        const height = heightOf(element) - detailsInRow;
        if (height <= 0 || rows.holds(index, height, key)) return;
        if (!rowChanges) rowChanges = [];
        rowChanges.push({ index, height, key });
    }

    /**
     * Each rendered element's height as its observer last told, else read once (at a commit,
     * before the browser paints). Nothing is allocated while none changed; when one did, the rows
     * are laid out again (`remeasured`).
     */
    function take() {
        const state = getState();
        if (!getViewport() || !measuring(state)) return;
        scale = 0;
        if (state.detailHeight === "auto") context.details.forEach(takeDetail);
        if (state.rowHeight === "auto") context.rows.forEach(takeRow);
        const detailsChanged = detailChanges;
        const rowsChanged = rowChanges;
        if (!detailsChanged && !rowsChanged) return;
        detailChanges = null;
        rowChanges = null;
        context.remeasured([
            ...(detailsChanged ? details.set(detailsChanged) : []),
            ...(rowsChanged ? rows.set(rowsChanged) : []),
        ]);
    }

    return {
        rows,
        details,
        observeLater,
        unobserve(element) {
            unobserved.delete(element);
            heights.delete(element);
            measurer?.unobserve(element);
        },
        observeRegistered() {
            for (const element of context.rows) observeLater(element);
            for (const element of context.details) observeLater(element);
        },
        stop() {
            measurer?.disconnect();
            measurer = null;
            unobserved.clear();
            heights = new WeakMap();
            if (observeFrame !== null) {
                getViewport()?.ownerDocument.defaultView?.cancelAnimationFrame(
                    observeFrame,
                );
                observeFrame = null;
            }
        },
        rereadRows() {
            for (const element of context.rows) heights.delete(element);
        },
        take,
        forget(before, after) {
            const keyAt = (index: number) => rowKeyAt(after, index);
            const newSource =
                after.source !== before.source ||
                after.rowKey !== before.rowKey;
            const changed = after.rowsChanged !== before.rowsChanged;
            let dropped = false;
            for (const [store, measured] of [
                [rows, after.rowHeight === "auto"],
                [details, after.detailHeight === "auto"],
            ] as const) {
                if (!measured) {
                    dropped = store.clear() || dropped;
                    continue;
                }
                if (newSource) {
                    // behind the same `getRow`, only rows added or gone (D6)
                    const { start } = newRowsOf(before, after);
                    dropped =
                        store.keep(
                            Math.min(start, after.rowCount),
                            Number.POSITIVE_INFINITY,
                            keyAt,
                        ) || dropped;
                }
                if (changed) {
                    const { start, end } = after.rowsChanged;
                    dropped = store.keep(start, end, keyAt) || dropped;
                }
            }
            return dropped;
        },
    };
}
