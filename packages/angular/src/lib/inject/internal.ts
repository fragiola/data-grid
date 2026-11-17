import { computed, inject, isSignal, type Signal, signal } from "@angular/core";
import {
    type AxisWindow,
    EMPTY_WINDOW,
    type PartProps,
    type PartResult,
} from "@fragiola/data-grid";
import {
    type DataGridContextValue,
    type DataGridRef,
    GRID_CONTEXT,
    type GridContext,
} from "../context";
import { engineValue, onDestroy } from "../utils/helpers";

/**
 * What a part's injection function returns: its state, and the props for its element
 * (`[dataGridBind]="part.props()"`; the structural style in `props.style`, lengths in pixels).
 */
export interface PartInjectResult<S> {
    readonly state: Signal<S>;
    readonly props: Signal<PartProps>;
}

/** A value an injection function takes: a signal (an input), a getter, or the value itself. */
export type ValueOrSignal<T> = T | Signal<T> | (() => T);

/** The value now, read in a reactive context (a signal or a getter is followed). */
export function valueNow<T>(value: ValueOrSignal<T>): T {
    return isSignal(value) || typeof value === "function"
        ? (value as () => T)()
        : value;
}

/** A part's state and props from its core helper, as signals. */
export function partResult<S>(part: () => PartResult<S>): PartInjectResult<S> {
    const result = computed(part);
    return {
        state: computed(() => result().state),
        props: computed(() => result().props),
    };
}

/** The root around the caller; throws outside one (`outside`). */
export function injectRootGrid(outside: string): GridContext {
    const grid = inject(GRID_CONTEXT, { optional: true });
    if (!grid) throw new Error(outside);
    return grid;
}

/** The grid a ref holds, as a signal following it as roots take and release it. */
export function gridRefCurrent<TRow>(
    gridRef: DataGridRef<TRow>,
): Signal<DataGridContextValue<TRow> | null> {
    const current = signal(gridRef.current);
    onDestroy(
        gridRef.subscribe(() => {
            current.set(gridRef.current);
        }),
    );
    return current.asReadonly();
}

/**
 * The grid an injection function reads: the one a `gridRef` holds when it is given one (`null`
 * until a root takes it), else the root around the caller; throws `outside` without either.
 */
export function injectGridOrRef<TRow>(
    gridRef: DataGridRef<TRow> | undefined,
    outside: string,
): Signal<DataGridContextValue<TRow> | null> {
    if (gridRef) return gridRefCurrent(gridRef);
    const grid = injectRootGrid(outside);
    // the root that provides it was given the row type the caller states
    return computed(() => grid as unknown as DataGridContextValue<TRow>);
}

/** The rows' or the columns' window of the root around, or of a `gridRef`'s. */
export function injectWindow<TRow>(
    event: "row-window" | "column-window",
    gridRef: DataGridRef<TRow> | undefined,
): Signal<AxisWindow> {
    const grid = injectGridOrRef(
        gridRef,
        "a window injection function must be used inside [dataGridRoot], or be given a gridRef",
    );
    return engineValue(
        () => grid()?.engine as DataGridContextValue["engine"] | undefined,
        event,
        EMPTY_WINDOW,
    );
}
