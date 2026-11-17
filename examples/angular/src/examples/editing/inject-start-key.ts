import { computed, effect, untracked } from "@angular/core";

/**
 * An edit typing started: the editor starts from the key typed, as a spreadsheet does. Called in
 * the editor's injection context; the effect runs as the editor is first checked, before it paints
 * (React's layout effect), and once for a key (a new draft is no new key).
 */
export function injectStartKey(
    startKey: () => string | undefined,
    onChange: (value: unknown) => void,
) {
    const key = computed(startKey);
    effect(() => {
        const typed = key();
        if (typed !== undefined) untracked(() => onChange(typed));
    });
}
