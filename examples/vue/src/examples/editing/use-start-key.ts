import { watch } from "vue";

/** An edit typing started: the editor starts from the key typed, as a spreadsheet does. */
export function useStartKey(
    startKey: () => string | undefined,
    onChange: (value: unknown) => void,
) {
    // `flush: "sync"` and immediate: the draft is the key before the editor paints, as React's
    // layout effect does
    watch(
        startKey,
        (key) => {
            if (key !== undefined) onChange(key);
        },
        { immediate: true, flush: "sync" },
    );
}
