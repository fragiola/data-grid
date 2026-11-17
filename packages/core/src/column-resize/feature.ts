import { COLUMN_RESIZER_ATTRIBUTE, PAGE_KEYS } from "../engine/dom";
import type { FeatureDrag } from "../engine/drag";
import { inlineSign } from "../engine/geometry";
import type { HeaderCellState } from "../engine/parts";
import type { ColumnResize, GridView } from "../engine/types";
import {
    type DataGridFeature,
    defineControlled,
    defineFeature,
    type FeatureEngine,
    type FeatureEngineContext,
    type FeaturePartContribution,
    type FeatureState,
} from "../feature/feature";
import { columnPart, pinnedEndFrom } from "../header/header";
import { done, fail, invalid } from "../model/result";
import type { Column, ColumnWidths, HeaderCellLayout } from "../model/types";
import {
    hasEngineSized,
    isFlex,
    isResizable,
    NO_WIDTHS,
    sameWidths,
    withinLimits,
} from "../model/widths";
import { resizeEdge } from "./parts";
import type {
    ColumnResizeProps,
    ColumnResizeTypes,
    ColumnResizeView,
} from "./types";
import {
    hasResizable,
    keptWidths,
    keptWidthsOf,
    resizedWidths,
    resizeMaximum,
    type SpanWidths,
    spanResizable,
    spanWidths,
    unresizedWidth,
    withoutWidths,
} from "./widths";

// Column resizing (Epic #70, W1–W6) and fitting (Epic #80, A2–A4), a feature since Epic #148: the
// model keeps the resized columns' widths (`column-widths.set`, `.resize`, `.reset`) over their
// declared sizing (`width`, `flex`, `autoSize`: the core's), a resizer the app renders in a
// header cell drags (from either edge, right to left mirrored), moves with its keys, and fits its
// columns to their content on a double click or Enter (`fit-columns`). Without it, nothing
// resizes: a column is its declared width.

/** The state as resizing reads it. */
type State = FeatureState<ColumnResizeTypes>;

/** The keys a focused resizer resizes with (W6). */
const RESIZE_KEYS: ReadonlySet<string> = new Set([
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
]);

/** The resizer keys' steps in pixels (W6): an arrow, and Shift with it. */
const RESIZE_STEP = 10;
const RESIZE_SHIFT_STEP = 50;

/** The state with the columns' widths (the same object when they did not change), and them. */
function withWidths(state: State, columnWidths: ColumnWidths) {
    const next =
        columnWidths === state.columnWidths
            ? state
            : { ...state, columnWidths };
    return done(next, next.columnWidths);
}

/** The columns of a span: a column's or a group's header cell (`header.cellByKey`). */
function columnsOf(
    state: State,
    span: { readonly columnIndex: number; readonly columnSpan: number },
): readonly Column<unknown, unknown>[] {
    return state.columns.slice(
        span.columnIndex,
        span.columnIndex + span.columnSpan,
    );
}

/** A header cell's resize: resizable (one of its columns), and being resized by a drag. */
function headerCellPart(
    view: GridView<unknown, unknown>,
    cell: HeaderCellLayout<unknown, unknown>,
): FeaturePartContribution<HeaderCellState> {
    // its engine's field, on the view by name
    const resize = (view as GridView<unknown, unknown> & ColumnResizeView)
        .columnResize;
    return {
        state: {
            resizable: spanResizable(view.columnDefs, cell),
            resizing: resize?.columnKey === cell.key,
        },
    };
}

/** A measured content width as a column's width: rounded up, within its limits. */
function fittedWidth(
    column: Column<unknown, unknown>,
    measured: number,
): number {
    return withinLimits(column, Math.ceil(measured));
}

/** A drag on a column resizer (W4): it drags from its press. */
interface ResizeDrag extends FeatureDrag {
    /** the column's or the group's key */
    readonly columnKey: string;
    /** the column's (or the group's) width when it started */
    readonly startWidth: number;
    /** which way it grows on screen (`resizeSign`) */
    readonly sign: number;
    /** the engine's widths when it started: its columns resized back to them need none of theirs */
    readonly autoWidths: ColumnWidths;
    /** the x the last resize was for */
    appliedX: number;
}

/** Resizing's resizers, keys, fits and drag in one engine (W3–W6, A2–A4). */
function resizeEngine(
    context: FeatureEngineContext<ColumnResizeTypes>,
): FeatureEngine {
    const { model, engine: kit } = context;
    /** the drag on now, and the column it resizes (`ColumnResize`) */
    let current: ResizeDrag | null = null;
    let resize: ColumnResize | null = null;
    /** the value last told (`column-resize`): a follow of the columns tells it once laid out */
    let told: ColumnResize | null = null;

    function setResize(next: ColumnResize | null) {
        resize = next;
        told = next;
        kit.refresh();
        kit.emit("column-resize", next);
    }

    /** This grid's column resizer an event happened in. */
    function resizerOf(
        target: EventTarget | null,
    ): { element: HTMLElement; columnKey: string } | null {
        const marked = kit.markedOf(target, COLUMN_RESIZER_ATTRIBUTE);
        return marked && { element: marked.element, columnKey: marked.value };
    }

    /** A column's or a group's width and limits, or `null` when none of its columns resizes. */
    function resizeSpan(columnKey: string): SpanWidths | null {
        const { header, columns } = model.state;
        const cell = header.cellByKey(columnKey);
        return cell && spanResizable(columns, cell)
            ? spanWidths(columns, kit.columnAxis(), cell)
            : null;
    }

    /**
     * Which way a column (or a group) grows on screen, 1 to the right, -1 to the left: toward the
     * end, from its end edge, or for one pinned at the end toward the start, from its start edge
     * (the boundary with the columns that scroll: `columnResizerPart`'s `edge`); mirrored right to
     * left.
     */
    function resizeSign(columnKey: string): number {
        const cell = model.state.header.cellByKey(columnKey);
        const pinned = kit.pinned();
        const edge = resizeEdge(
            cell &&
                columnPart(
                    cell.columnIndex,
                    pinned.startCount,
                    pinnedEndFrom(kit.columnAxis().count, pinned.endCount),
                ),
        );
        const sign = inlineSign(kit.direction());
        return edge === "start" ? -sign : sign;
    }

    /** Resizes a drag's column to its pointer, growing the way `resizeSign` says. */
    function resizeTo(drag: ResizeDrag) {
        drag.appliedX = drag.x;
        // from the engine's widths when it started: dragged back, a column needs no width (A2)
        model.run("column-widths.resize", {
            columnKey: drag.columnKey,
            width: drag.startWidth + drag.sign * (drag.x - drag.startX),
            autoWidths: drag.autoWidths,
        });
    }

    /**
     * The engine's widths a resize or a fit of `columns` starts from (A2): the ones in effect,
     * and for each of them with an override the engine would size otherwise (a flex share, an
     * automatic width), the width it has without that override: back to it, it needs none, by a
     * drag, a key or a fit alike.
     */
    function unresizedWidthsOf(
        columns: readonly Column<unknown, unknown>[],
    ): ColumnWidths {
        const state = model.state;
        if (!hasEngineSized(state.columns)) return NO_WIDTHS;
        let record: Record<string, number> | null = null;
        for (const column of columns) {
            const { key } = column;
            if (
                !isResizable(column) ||
                !Object.hasOwn(state.columnWidths, key) ||
                !(isFlex(column) || column.autoSize === true)
            ) {
                continue;
            }
            const own = kit.autoWidths(
                withoutWidths(state.columnWidths, [key]),
            )[key];
            if (own !== undefined) {
                record ??= { ...kit.autoWidths() };
                record[key] = own;
            }
        }
        return record ?? kit.autoWidths();
    }

    /** What a resize of a column or a group starts from (`unresizedWidthsOf` its columns). */
    function resizeFrom(columnKey: string): ColumnWidths {
        const state = model.state;
        const cell = state.header.cellByKey(columnKey);
        return cell
            ? unresizedWidthsOf(columnsOf(state, cell))
            : kit.autoWidths();
    }

    /**
     * Fits columns to their content (A3, A4): each resizable column of each key (a column, or a
     * group's), or every rendered one without keys, measured on the view on screen in one
     * layout. One `column-widths.set` with the other widths as they are, none when no width
     * changes. A column fitted to the width it has without an override (`unresizedWidth`: its
     * flex share or automatic width as they are without it, else its own) needs none.
     */
    function fitColumns(columnKeys?: readonly string[]) {
        const shown = kit.committed();
        if (!kit.viewport() || !shown) return;
        const { columnDefs, header } = shown;
        const indexes = new Set<number>();
        const add = (columnIndex: number) => {
            const column = columnDefs[columnIndex];
            if (column && isResizable(column)) indexes.add(columnIndex);
        };
        if (columnKeys === undefined) {
            for (const columnIndex of shown.columns) add(columnIndex);
        } else {
            for (const key of columnKeys) {
                const cell = header.cellByKey(key);
                if (!cell) continue;
                const end = cell.columnIndex + cell.columnSpan;
                for (let index = cell.columnIndex; index < end; index++) {
                    add(index);
                }
            }
        }
        const fitted: [string, number][] = [];
        const keys: string[] = [];
        const measuredColumns = kit.measureColumns(shown, indexes);
        const from = unresizedWidthsOf(
            [...measuredColumns.keys()].flatMap((columnIndex) => {
                const column = columnDefs[columnIndex];
                return column ? [column] : [];
            }),
        );
        for (const [columnIndex, measured] of measuredColumns) {
            const column = columnDefs[columnIndex];
            if (!column) continue;
            const width = fittedWidth(column, measured);
            keys.push(column.key);
            if (width !== unresizedWidth(column, from)) {
                fitted.push([column.key, width]);
            }
        }
        const { columnWidths: held } = model.state;
        const columnWidths = {
            ...withoutWidths(held, keys),
            ...Object.fromEntries(fitted),
        };
        if (!sameWidths(columnWidths, held)) {
            model.run("column-widths.set", { columnWidths });
        }
    }

    /**
     * A primary press on a resizer starts a drag (W4): no focus (which would activate its header
     * cell and scroll it into view, away from the pointer), no text selection. With no resizable
     * column, there is none.
     */
    function pointerdown(event: PointerEvent): boolean {
        const viewport = kit.viewport();
        if (!viewport || !hasResizable(model.state.columns)) return false;
        const resizer = resizerOf(event.target);
        const span = resizer && resizeSpan(resizer.columnKey);
        if (!resizer || !span) return false;
        const { columnKey, element } = resizer;
        event.preventDefault();
        const drag: ResizeDrag = {
            kind: "feature",
            // it follows the pointer's x alone: a scroll during it resizes nothing
            axis: "x",
            fixed: true,
            columnKey,
            dragged: true,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startWidth: span.width,
            sign: resizeSign(columnKey),
            autoWidths: resizeFrom(columnKey),
            element,
            doc: viewport.ownerDocument,
            x: event.clientX,
            y: event.clientY,
            appliedX: event.clientX,
            frame: null,
            step: () => resizeTo(drag),
            // it ends at the pointer's last place (a move not resized yet resizes now), or on a
            // cancel back to the width it started from: a resize like the drag's own, only its
            // columns change (the others' widths stay as they are now), and what lets the drag
            // resize lets it restore
            end: (how) => {
                if (current === drag) current = null;
                if (how === "cancel") drag.x = drag.startX;
                if (drag.x !== drag.appliedX) resizeTo(drag);
                setResize(null);
            },
            // a double click on a resizer fits its column to its content (A4)
            click: (click) => {
                if (click.detail === 2) fitColumns([columnKey]);
            },
        };
        current = drag;
        kit.press(event, drag);
        setResize({ columnKey, width: span.width });
        return true;
    }

    /**
     * A key on a focused resizer (W6): its arrows (Shift: farther), Home and End resize its
     * column, through the column's limits; Enter fits it to its content (A4), once per press; the
     * other page keys and Space are no use to it (the container would page itself). Returns
     * whether the key was the resizer's.
     */
    function resizerKey(event: KeyboardEvent, target: Element): boolean {
        const key = event.key;
        const enter =
            key === "Enter" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey;
        if (!enter && !PAGE_KEYS.has(key) && key !== " ") return false;
        const resizer = resizerOf(target);
        if (!resizer) return false;
        event.preventDefault();
        if (enter) {
            if (!event.repeat) fitColumns([resizer.columnKey]);
            return true;
        }
        const span =
            RESIZE_KEYS.has(key) && !event.ctrlKey && !event.metaKey
                ? resizeSpan(resizer.columnKey)
                : null;
        if (!span) return true;
        const step = event.shiftKey ? RESIZE_SHIFT_STEP : RESIZE_STEP;
        // an arrow moves the handle its way: wider where the column grows that way (`resizeSign`)
        // End: the maximum it reports (`aria-valuemax`), the view's width without one
        const to =
            key === "ArrowLeft" || key === "ArrowRight"
                ? span.width +
                  (key === "ArrowRight" ? step : -step) *
                      resizeSign(resizer.columnKey)
                : key === "Home"
                  ? span.minWidth
                  : resizeMaximum(span, kit.viewportWidth());
        model.run("column-widths.resize", {
            columnKey: resizer.columnKey,
            width: to,
        });
        return true;
    }

    /**
     * A resize, the app's own too, starts from the widths on screen (A2): while the engine sizes
     * columns itself, it fills a resize's `autoWidths` when it names none (`resizeFrom`).
     */
    const unuse = model.use((ctx, next) => {
        if (
            ctx.command === "column-widths.resize" &&
            ctx.payload.autoWidths === undefined &&
            hasEngineSized(model.state.columns)
        ) {
            ctx.payload = {
                ...ctx.payload,
                autoWidths: resizeFrom(ctx.payload.columnKey),
            };
        }
        return next();
    });

    return {
        pointerdown,
        interactionKeydown: resizerKey,
        // after the widths or the columns changed during a drag: it follows its column or group,
        // reporting the width on screen, and ends when that is gone or can no longer be resized
        // (set, not refreshed: the change's view shows it)
        columnsFollowed: () => {
            const drag = current;
            if (!drag || kit.drag() !== drag) return;
            const span = resizeSpan(drag.columnKey);
            if (span) {
                if (resize?.width !== span.width) {
                    resize = { columnKey: drag.columnKey, width: span.width };
                }
                return;
            }
            current = null;
            kit.stopDrag();
            resize = null;
        },
        // and told once the engine laid out for the change
        followed: () => {
            if (resize === told) return;
            told = resize;
            kit.emit("column-resize", resize);
        },
        view: () => ({ columnResize: resize }),
        queries: { "column-resize": () => resize },
        actions: {
            "fit-columns": ({
                columnKeys,
            }: {
                readonly columnKeys?: readonly string[] | undefined;
            }) => fitColumns(columnKeys),
        },
        destroy: unuse,
    };
}

/** Resizing's definition: every grid installing it shares it. */
const RESIZE = defineFeature<ColumnResizeTypes>({
    name: "columnResize",
    initial: (_state, options) => ({
        columnWidths: keptWidths(options.columnWidths),
    }),
    commands: {
        "column-widths.set": (state, { columnWidths }) => {
            const kept = keptWidths(columnWidths);
            if (
                typeof columnWidths !== "object" ||
                columnWidths === null ||
                Array.isArray(columnWidths) ||
                Object.keys(kept).length !== Object.keys(columnWidths).length
            ) {
                return invalid(
                    "columnWidths must map column keys to widths (finite, not negative)",
                );
            }
            return withWidths(
                state,
                sameWidths(kept, state.columnWidths)
                    ? state.columnWidths
                    : kept,
            );
        },
        "column-widths.resize": (state, { columnKey, width, autoWidths }) => {
            if (!Number.isFinite(width)) {
                return invalid("width must be a finite number");
            }
            const span = state.header.cellByKey(columnKey);
            if (!span) {
                return fail("not_found", `no column or group "${columnKey}"`);
            }
            if (!spanResizable(state.columns, span)) {
                return fail("refused", `"${columnKey}" is not resizable`);
            }
            return withWidths(
                state,
                resizedWidths(
                    columnsOf(state, span),
                    state.columnWidths,
                    width,
                    autoWidths && keptWidthsOf(autoWidths),
                ),
            );
        },
        "column-widths.reset": (state, { columnKey }) => {
            if (columnKey === undefined) {
                return withWidths(
                    state,
                    Object.keys(state.columnWidths).length > 0
                        ? {}
                        : state.columnWidths,
                );
            }
            // a key that is no column (kept by a `set`) drops too
            const span = state.header.cellByKey(columnKey);
            const keys =
                span && columnsOf(state, span).map((column) => column.key);
            if (!keys && !Object.hasOwn(state.columnWidths, columnKey)) {
                return fail("not_found", `no column or group "${columnKey}"`);
            }
            return withWidths(
                state,
                withoutWidths(state.columnWidths, keys ?? [columnKey]),
            );
        },
    },
    queries: {
        "column-widths": (state) => state.columnWidths,
    },
    columnWidths: (state) => state.columnWidths,
    view: ["columnResize"],
    headerCell: headerCellPart,
    engine: resizeEngine,
    root: {
        props: ["columnWidths", "defaultColumnWidths", "onColumnWidthsChange"],
        options: (props) => ({
            columnWidths: props.columnWidths ?? props.defaultColumnWidths,
        }),
        controlled: (model) => [
            defineControlled<ColumnResizeProps, State, ColumnWidths>({
                prefix: "column-widths.",
                prop: (props) => props.columnWidths,
                onChange: (props) => props.onColumnWidthsChange,
                // uncontrolled widths to start with that were not all widths start without those:
                // the app is told the ones the grid holds
                start: (props) => props.defaultColumnWidths,
                read: (state) => state.columnWidths,
                same: sameWidths,
                // an entry that is not a width is left out, as at mount, and the parent is told
                // the widths as they settled
                apply: (columnWidths) => {
                    model.run("column-widths.set", {
                        columnWidths: keptWidths(columnWidths),
                    });
                },
                // a layout input: settled first, with the order and the collapsed groups
                first: "layout",
            }),
        ],
    },
});

/**
 * Column resizing (`@fragiola/data-grid/column-resize`): install it on a grid (`features:
 * [columnResize()]`) for its `resizable` columns to resize, by a resizer the app renders
 * (`useColumnResizer`), its keys and a fit to their content. Without it, nothing resizes.
 */
export function columnResize(): DataGridFeature<ColumnResizeTypes> {
    return RESIZE;
}
