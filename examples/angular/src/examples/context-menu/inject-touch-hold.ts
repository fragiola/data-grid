import { DestroyRef, inject } from "@angular/core";

/** How long a touch is held before it opens the menu: Base UI's. */
const HOLD_MS = 700;

/**
 * A long press timed from `touchstart`, as Base UI times it: held still, it calls `open` with the
 * touch's point (the kit's context menu opens on a right click and the menu keys only: the app
 * times a long press, and opens the menu there with `openAt`). Moving, lifting or cancelling the
 * touch drops it. Call in an injection context.
 */
export function injectTouchHold(
    open: (point: { x: number; y: number }) => void,
) {
    let timer: number | undefined;

    function release() {
        window.clearTimeout(timer);
        timer = undefined;
    }

    function hold(event: TouchEvent) {
        release();
        const touch = event.touches[0];
        if (!touch) return;
        const point = { x: touch.clientX, y: touch.clientY };
        timer = window.setTimeout(() => {
            timer = undefined;
            open(point);
        }, HOLD_MS);
    }

    inject(DestroyRef).onDestroy(release);
    return { hold, release };
}
