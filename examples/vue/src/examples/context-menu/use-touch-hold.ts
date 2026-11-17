import { onBeforeUnmount } from "vue";

/** How long a touch is held before it opens the menu: Reka UI's and Base UI's. */
const HOLD_MS = 700;

/**
 * A long press timed from `touchstart`, as Base UI times it: held still, it fires a
 * `contextmenu` event at the touch's point, on the element touched, which opens the menu there.
 * Reka UI times its own long press from a touch's `pointerdown`; this covers a browser that tells
 * the touch alone (no pointer events). Moving, lifting or cancelling the touch drops it.
 */
export function useTouchHold() {
    let timer: number | undefined;

    function release() {
        window.clearTimeout(timer);
        timer = undefined;
    }

    function hold(event: TouchEvent) {
        release();
        const touch = event.touches[0];
        const target = event.target;
        if (!touch || !(target instanceof Element)) return;
        const { clientX, clientY } = touch;
        timer = window.setTimeout(() => {
            timer = undefined;
            target.dispatchEvent(
                new MouseEvent("contextmenu", {
                    bubbles: true,
                    cancelable: true,
                    clientX,
                    clientY,
                }),
            );
        }, HOLD_MS);
    }

    onBeforeUnmount(release);
    return { hold, release };
}
