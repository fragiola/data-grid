import type { CommandErrorCode, CommandFailure } from "./types";

// What commands return: a failure and a success each have one shape, built in one place.

/** A command's failure: `code`, and a message saying why. */
export function fail(code: CommandErrorCode, message: string): CommandFailure {
    return { ok: false, error: { code, message } };
}

/** The vetoed result a middleware returns to stop a command. */
export function veto(message = "vetoed by a middleware"): CommandFailure {
    return fail("vetoed", message);
}

/** A success: its value. */
export function ok<R>(value: R): { readonly ok: true; readonly value: R } {
    return { ok: true, value };
}

/** A handler's success: the state it leaves, and the command's value. */
export function done<S, R>(
    state: S,
    value: R,
): { readonly ok: true; readonly value: { state: S; value: R } } {
    return ok({ state, value });
}
