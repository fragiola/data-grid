import type { DataGridModel } from "../model/model";
import type { CellPosition, DataGridState } from "../model/types";
import {
    CELL_SELECTOR,
    FOCUSABLE,
    hiddenWithin,
    isCellNode,
    isElement,
    ownerViewport,
    TAB_STOP_ATTRIBUTE,
    VIEWPORTS,
} from "./dom";
import type { EngineEventKey, EngineEventMap } from "./types";

// Interactive cells (Epic #52): the state machine of a cell whose controls have the keys. Outside
// interaction the controls inside the engine's own cells stay out of the tab order (their own
// `tabindex` kept); entering a cell gives them back and focuses one, leaving takes them out again.

/** What the interaction needs of its engine. */
export interface InteractionContext<TRow, TNode> {
    /** the attached viewport, or `null` */
    readonly getViewport: () => HTMLElement | null;
    /** the model's state, as it is now */
    readonly getState: () => DataGridState<TRow, TNode>;
    readonly model: DataGridModel<TRow, TNode>;
    /** this grid's own element of a cell */
    readonly cellElement: (position: CellPosition) => HTMLElement | null;
    /** the cell of this grid an event happened in */
    readonly cellOf: (target: EventTarget | null) => CellPosition | null;
    /** whether an element is one of this grid's cells (or header cells) itself */
    readonly isCellElement: (element: Element) => boolean;
    /** whether `a` is the cell `b` (a header cell spanning rows is the same on each of them) */
    readonly same: (a: CellPosition | null, b: CellPosition) => boolean;
    /** the view shows something new: the next update builds one */
    readonly markStale: () => void;
    readonly update: () => void;
    readonly emit: <K extends EngineEventKey>(
        event: K,
        value: EngineEventMap[K],
    ) => void;
}

/** The interaction of one engine. */
export interface Interaction {
    /** the cell whose controls have the keys (its element's position), or `null` */
    readonly cell: CellPosition | null;
    /** a cell `interact-cell` asked for before it was rendered: entered on the commit that shows it */
    readonly pending: { position: CellPosition; focus: boolean } | null;
    /** waits for a cell to enter once it is active and shows controls */
    wait(position: CellPosition, focus: boolean): void;
    /** drops the entry waiting for its cell, if any */
    cancelPending(): void;
    /** ends the interaction, without focusing, when its cell is no longer rendered */
    dropUnrendered(): void;
    manageTabOrder(cell: Element): void;
    cellsUnder(node: Node): Element[];
    onMutations(records: readonly MutationRecord[]): void;
    enterCell(
        position: CellPosition,
        focus: boolean,
        activating?: boolean,
    ): boolean;
    leaveCell(focusCell: boolean): void;
    cycleControls(cell: Element, from: Element, back: boolean): void;
}

/** Creates the interaction of an engine: no cell's controls have the keys yet. */
export function createInteraction<TRow, TNode>({
    getViewport,
    getState,
    model,
    cellElement,
    cellOf,
    isCellElement,
    same,
    markStale,
    update,
    emit,
}: InteractionContext<TRow, TNode>): Interaction {
    /** the cell whose controls have the keys (its element's position), or `null` */
    let interaction: CellPosition | null = null;
    /** a cell `interact-cell` asked for before it was rendered: entered on the commit that shows it */
    let pendingInteraction: { position: CellPosition; focus: boolean } | null =
        null;
    /** the controls' own `tabindex` (`null`: none), kept while the grid holds them at -1 */
    const ownTabIndex = new WeakMap<Element, string | null>();

    /**
     * A cell's controls, in order: what takes focus inside it, its own (a nested grid's are that
     * grid's), and not disabled. `cell` is one of this grid's.
     */
    function controlsOf(cell: Element): HTMLElement[] {
        return [...cell.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
            (element) =>
                // inside the cell with no grid between (a nested grid's viewport is no control)
                !VIEWPORTS.has(element) &&
                cellElementOf(element) === cell &&
                // the app's own tab stop is no control of the grid's: never cycled, never entered
                !element.hasAttribute(TAB_STOP_ATTRIBUTE) &&
                !element.hasAttribute("disabled") &&
                !(
                    element.tagName === "INPUT" &&
                    element.getAttribute("type") === "hidden"
                ) &&
                // an element the app took out itself (a wrapper at -1) is no stop of its own
                !(
                    element.getAttribute("tabindex") === "-1" &&
                    !ownTabIndex.has(element)
                ) &&
                !hiddenWithin(element, cell),
        );
    }

    /** The nearest cell holding an element (itself excluded), with no grid's viewport between. */
    function cellElementOf(element: Element): Element | null {
        const viewport = getViewport();
        for (
            let node = element.parentElement;
            node && node !== viewport;
            node = node.parentElement
        ) {
            if (VIEWPORTS.has(node)) return null;
            if (isCellNode(node)) return node;
        }
        return null;
    }

    /**
     * Keeps a cell's controls out of the tab order outside interaction (`tabindex` -1, their own
     * value kept), and gives it back in interaction. A control with `TAB_STOP_ATTRIBUTE` is the
     * app's.
     */
    function manageTabOrder(cell: Element) {
        const interacting =
            interaction !== null && same(cellOf(cell), interaction);
        for (const control of controlsOf(cell)) {
            if (interacting) restoreTabIndex(control);
            else if (control.getAttribute("tabindex") !== "-1") {
                ownTabIndex.set(control, control.getAttribute("tabindex"));
                writeTabIndex(control, "-1");
            }
        }
        // a control the app marked as its own stop after the grid took it out: its value back
        for (const own of cell.querySelectorAll(`[${TAB_STOP_ATTRIBUTE}]`)) {
            restoreTabIndex(own);
        }
    }

    /** A control's own tab index back, if the grid holds it at -1. */
    function restoreTabIndex(control: Element) {
        if (!ownTabIndex.has(control)) return;
        const own = ownTabIndex.get(control) ?? null;
        ownTabIndex.delete(control);
        writeTabIndex(control, own);
    }

    /** What the grid wrote to a control's `tabindex`: its own change, which the observer skips. */
    const writtenTabIndex = new WeakMap<Element, string | null>();

    function writeTabIndex(control: Element, value: string | null) {
        writtenTabIndex.set(control, value);
        if (value === null) control.removeAttribute("tabindex");
        else control.setAttribute("tabindex", value);
    }

    /** Every cell of this grid under a node (the node itself included). */
    function cellsUnder(node: Node): Element[] {
        if (!isElement(node)) return [];
        const viewport = getViewport();
        const cells = [...node.querySelectorAll(CELL_SELECTOR)];
        if (isCellNode(node)) cells.unshift(node);
        return cells.filter((cell) => ownerViewport(cell) === viewport);
    }

    /** The cells a set of DOM changes touched: rendered, or whose content changed. */
    function onMutations(records: readonly MutationRecord[]) {
        const viewport = getViewport();
        const touched = new Set<Element>();
        let moved = false;
        for (const record of records) {
            const target = record.target;
            if (isElement(target)) {
                const name = record.attributeName;
                const isCell = isCellElement(target);
                // the grid's own write, and a cell's own roving tab index, change no control
                if (
                    name === "tabindex" &&
                    (isCell ||
                        writtenTabIndex.get(target) ===
                            target.getAttribute("tabindex"))
                ) {
                    continue;
                }
                if (name === "data-row-index" || name === "data-column-index") {
                    moved = true;
                }
                const holder = isCell ? target : cellElementOf(target);
                // a nested grid's cell is that grid's
                if (holder && (isCell || ownerViewport(holder) === viewport)) {
                    touched.add(holder);
                }
            }
            for (const added of record.addedNodes) {
                for (const cell of cellsUnder(added)) touched.add(cell);
            }
        }
        // the cell in interaction moved to another index (a keyed row re-sorted): the
        // interaction follows the cell that holds focus, as the active cell
        if (moved && interaction) followFocusedCell();
        for (const cell of touched) manageTabOrder(cell);
    }

    /** After cells moved: the interaction goes with the cell holding focus, or ends. */
    function followFocusedCell() {
        const focused = getViewport()?.ownerDocument.activeElement;
        const holder = focused ? cellElementOf(focused) : null;
        const now = holder ? cellOf(holder) : null;
        if (now && same(interaction, now)) return;
        interaction = null;
        // an entry that does not happen (a controlled parent to follow) tells nothing itself
        if (!now || !enterCell(now, false)) emitInteraction();
    }

    function emitInteraction() {
        markStale();
        update();
        emit("interaction", interaction);
    }

    /**
     * Hands the keys to a cell's controls. `focus`: the first control takes focus (Enter, F2,
     * the action); a control that took focus itself keeps it. Returns whether it did.
     */
    function enterCell(
        position: CellPosition,
        focus: boolean,
        activating = true,
    ): boolean {
        const cell = cellElement(position);
        if (!cell) return false;
        const controls = controlsOf(cell);
        if (controls.length === 0) return false;
        const at = cellOf(cell) ?? position;
        if (!same(getState().activePosition, at)) {
            // asked once: a caller that asked already (a focus) waits for the answer instead
            if (activating) model.run("active-position.set", at);
            // the cell in interaction is always the active one: a controlled parent that follows
            // later makes it so (the entry waits for it); a middleware that redirected it, never
            if (!same(getState().activePosition, at)) {
                pendingInteraction = { position: at, focus };
                return false;
            }
        }
        const before = interaction;
        const previous = interaction ? cellElement(interaction) : null;
        interaction = at;
        pendingInteraction = null;
        if (previous && previous !== cell) manageTabOrder(previous);
        manageTabOrder(cell);
        // the first control that takes focus (one hidden by the app's CSS cannot): none, and the
        // cell stays in navigation
        if (focus && !focusFrom(controls, 0, 1)) {
            interaction = null;
            manageTabOrder(cell);
            if (before) emitInteraction();
            return false;
        }
        emitInteraction();
        return true;
    }

    /**
     * Focuses the first of `controls` that takes focus, from `start` in `step` direction,
     * wrapping; returns whether one did.
     */
    function focusFrom(
        controls: readonly HTMLElement[],
        start: number,
        step: 1 | -1,
    ): boolean {
        const doc = getViewport()?.ownerDocument;
        for (let tried = 0; tried < controls.length; tried++) {
            const index =
                (((start + tried * step) % controls.length) + controls.length) %
                controls.length;
            const control = controls[index];
            control?.focus();
            if (control && doc?.activeElement === control) return true;
        }
        return false;
    }

    /** Gives the keys back to the grid; `focusCell`: the cell takes focus (Escape, the action). */
    function leaveCell(focusCell: boolean) {
        if (!interaction) return;
        const cell = cellElement(interaction);
        interaction = null;
        if (cell) {
            manageTabOrder(cell);
            if (focusCell) cell.focus({ preventScroll: true });
        }
        emitInteraction();
    }

    /** Tab and Shift+Tab in interaction: the cell's next or previous control, wrapping around. */
    function cycleControls(cell: Element, from: Element, back: boolean) {
        const controls = controlsOf(cell);
        if (controls.length === 0) return;
        // the control itself, else the innermost one holding it (a wrapper holds its buttons):
        // the last one, in document order, that contains it
        let at = controls.length - 1;
        while (at >= 0 && !controls[at]?.contains(from)) at--;
        const step = back ? -1 : 1;
        const start = at < 0 ? (back ? controls.length - 1 : 0) : at + step;
        // a control that cannot take focus (hidden by the app's CSS) is passed over
        focusFrom(controls, start, step);
    }

    return {
        get cell() {
            return interaction;
        },
        get pending() {
            return pendingInteraction;
        },
        wait(position, focus) {
            pendingInteraction = { position, focus };
        },
        cancelPending() {
            pendingInteraction = null;
        },
        dropUnrendered() {
            // the cell in interaction scrolled out of the rendered ones: back to navigation
            if (interaction && !cellElement(interaction)) {
                interaction = null;
                emitInteraction();
            }
        },
        manageTabOrder,
        cellsUnder,
        onMutations,
        enterCell,
        leaveCell,
        cycleControls,
    };
}
