import type { Direction } from "../navigation/navigation";

// The shortcuts the features' keys read (Epic #144): Ctrl/⌘ with Home and End, a shortcut's
// letter, select all. The grid's own entry never imports them.

/** A key with Ctrl (or ⌘) held: Ctrl+Home and Ctrl+End reach the grid's ends. */
export const CTRL_KEYS: Record<string, Direction> = {
    Home: "grid-start",
    End: "grid-end",
};

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
