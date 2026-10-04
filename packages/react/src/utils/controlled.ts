import {
    type CommandName,
    type DataGridModel,
    type DataGridState,
    veto,
} from "@fragiola/data-grid";
import type { ReactNode, RefObject } from "react";

// A piece of the model's state a root prop can control (D3): the column widths and order, the
// active position, the selection, the sort, the expanded rows. One way for all of them:
// controlled, a change is asked for (`on…Change`) and applied only when the prop follows;
// uncontrolled, the grid applies it and tells.
//
// One piece can move another: following a controlled order moves the active cell with its
// column. Uncontrolled, the moved piece is told at once. Controlled, the moved value stands
// (its prop, unchanged, never pulls it back to a stale place) and the parent is told it once
// the root settles, as when the data props move it; a prop that changes wins again.

export interface ControlledState<TRow, V> {
    /** the commands that change it: their names start with this */
    readonly prefix: string;
    /** the prop: `undefined` when uncontrolled */
    readonly prop: () => V | undefined;
    /** where it is in the model's state */
    readonly read: (state: DataGridState<TRow, ReactNode>) => V;
    readonly same: (a: V, b: V) => boolean;
    /** what a command that changes it makes it, from the command's value */
    readonly valueOf: (command: CommandName, value: unknown) => V;
    /** asks the parent for it (controlled), or tells it (uncontrolled) */
    readonly report: (value: V) => void;
    /** makes the model hold the prop's value (the root's own sync: never reported back) */
    readonly apply: (value: V) => void;
    /**
     * a command the parent was asked about, vetoed meanwhile, with the value it would have
     * returned: what of it is the grid's own (a toggle's anchor) still happens
     */
    readonly vetoed?:
        | ((command: CommandName, value: unknown) => void)
        | undefined;
    /** the value to start with, uncontrolled (`default…`): the grid may not take all of it */
    readonly start?: (() => V | undefined) | undefined;
}

/** A piece of state bound to the model: what the root runs on it, whatever its value's type. */
export interface Controlled {
    /** moves the model to the controlled value, when it is not there */
    readonly follow: () => void;
    /** after the data props: follows, and tells the parent a value the model could not take */
    readonly settle: () => void;
    /** at mount, uncontrolled: tells the app a value to start with the model did not take as given */
    readonly start: () => void;
}

/** What the root's guards share: whether it is syncing a prop, or applying the data props. */
export interface ControlledFlags {
    /** a command the root runs to follow a controlled prop: the guard lets it through */
    readonly syncing: RefObject<boolean>;
    /** the root is applying the data props: a controlled value they move is settled after */
    readonly applying: RefObject<boolean>;
}

/**
 * Guards a controlled piece of state: a command that would change it asks the parent and is
 * vetoed; a change the guard let through (uncontrolled, or the grid's shape moved it) is told.
 */
export function bindControlled<TRow, V>(
    model: DataGridModel<TRow, ReactNode>,
    flags: ControlledFlags,
    spec: ControlledState<TRow, V>,
): Controlled {
    model.use((ctx, next) => {
        if (!ctx.command.startsWith(spec.prefix)) return next();
        const result = next();
        if (
            ctx.dryRun ||
            flags.syncing.current ||
            spec.prop() === undefined ||
            !result.ok
        ) {
            return result;
        }
        const value = spec.valueOf(ctx.command, result.value);
        if (!spec.same(value, spec.read(model.state))) spec.report(value);
        spec.vetoed?.(ctx.command, result.value);
        return veto(`${spec.prefix}* is controlled`);
    });
    const sync: Sync<V> = { following: false, carried: null, prop: undefined };
    model.subscribe(({ before, after }) => {
        if (sync.following || spec.same(spec.read(before), spec.read(after))) {
            return;
        }
        if (spec.prop() !== undefined) {
            // controlled, moved by another piece's prop: its value stands (followControlled)
            if (flags.syncing.current) sync.carried = "moved";
            // controlled: decided once every prop is applied (settleControlled)
            if (flags.syncing.current || flags.applying.current) return;
        }
        spec.report(spec.read(after));
    });
    return {
        follow: () => followControlled(model, flags, spec, sync),
        settle: () => settleControlled(model, flags, spec, sync),
        start: () => startControlled(model, spec),
    };
}

/** A piece's own following: its sync running, a value another piece's moved, its prop then. */
interface Sync<V> {
    /** its own prop is being applied: not told back */
    following: boolean;
    /**
     * another piece's prop moved it (an order, the active cell) while its own prop stayed, and
     * whether the parent was told so (once)
     */
    carried: "moved" | "told" | null;
    /** its prop when the root last settled */
    prop: V | undefined;
}

/**
 * Moves the model to the controlled value, when it is not there; not when another piece moved it
 * and its prop is the one it settled with (the moved value stands, told at the settle).
 */
function followControlled<TRow, V>(
    model: DataGridModel<TRow, ReactNode>,
    flags: ControlledFlags,
    spec: ControlledState<TRow, V>,
    sync: Sync<V>,
): void {
    const value = spec.prop();
    if (value === undefined) return;
    if (sync.carried) {
        if (sync.prop !== undefined && spec.same(value, sync.prop)) return;
        sync.carried = null;
    }
    if (spec.same(value, spec.read(model.state))) return;
    flags.syncing.current = true;
    sync.following = true;
    try {
        spec.apply(value);
    } finally {
        flags.syncing.current = false;
        sync.following = false;
    }
}

/**
 * After the data props: the controlled value follows, and one the model could not take (a cell
 * the rows no longer have, a column no longer sortable) or another piece moved is told to the
 * parent as it settled.
 */
function settleControlled<TRow, V>(
    model: DataGridModel<TRow, ReactNode>,
    flags: ControlledFlags,
    spec: ControlledState<TRow, V>,
    sync: Sync<V>,
): void {
    followControlled(model, flags, spec, sync);
    const value = spec.prop();
    sync.prop = value;
    const settled = spec.read(model.state);
    if (value === undefined) return;
    if (spec.same(value, settled)) {
        sync.carried = null;
    } else if (sync.carried !== "told") {
        if (sync.carried) sync.carried = "told";
        spec.report(settled);
    }
}

/**
 * At mount, uncontrolled: a value to start with that the model could not take as given (a column
 * not sortable, single mode keeping one key) is told to the app as the grid holds it.
 */
function startControlled<TRow, V>(
    model: DataGridModel<TRow, ReactNode>,
    spec: ControlledState<TRow, V>,
): void {
    const start = spec.start?.();
    if (start === undefined || spec.prop() !== undefined) return;
    const held = spec.read(model.state);
    if (!spec.same(start, held)) spec.report(held);
}
