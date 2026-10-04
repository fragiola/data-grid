import {
    type CommandName,
    type DataGridModel,
    type DataGridState,
    veto,
} from "@fragiola/data-grid";
import type { ReactNode, RefObject } from "react";

// A piece of the model's state a root prop can control (D3): the active position, the sort. One
// way for all of them: controlled, a change is asked for (`on…Change`) and applied only when the
// prop follows; uncontrolled, the grid applies it and tells.

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
    readonly vetoed?: (command: CommandName, value: unknown) => void;
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
): void {
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
    model.subscribe(({ before, after }) => {
        if (
            flags.syncing.current ||
            spec.same(spec.read(before), spec.read(after)) ||
            // controlled: decided once every prop is applied (settleControlled)
            (flags.applying.current && spec.prop() !== undefined)
        ) {
            return;
        }
        spec.report(spec.read(after));
    });
}

/** Moves the model to the controlled value, when it is not there. */
export function followControlled<TRow, V>(
    model: DataGridModel<TRow, ReactNode>,
    flags: ControlledFlags,
    spec: ControlledState<TRow, V>,
): void {
    const value = spec.prop();
    if (value === undefined || spec.same(value, spec.read(model.state))) {
        return;
    }
    flags.syncing.current = true;
    try {
        spec.apply(value);
    } finally {
        flags.syncing.current = false;
    }
}

/**
 * After the data props: the controlled value follows, and one the model could not take (a cell
 * the rows no longer have, a column no longer sortable) is told to the parent as it settled.
 */
export function settleControlled<TRow, V>(
    model: DataGridModel<TRow, ReactNode>,
    flags: ControlledFlags,
    spec: ControlledState<TRow, V>,
): void {
    followControlled(model, flags, spec);
    const value = spec.prop();
    const settled = spec.read(model.state);
    if (value !== undefined && !spec.same(value, settled)) spec.report(settled);
}
