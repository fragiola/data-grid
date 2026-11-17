import { computed, nextTick, onMounted, type Ref, ref } from "vue";

// Where a kit popup (a select's list, a menu, a tooltip, a dialog) teleports to: the body of the
// document its trigger is in. A Reka UI portal targets the page's `body` by default; a tab moved
// into a popout window keeps its content (the moveable element is adopted by the window's
// document), so its menus must open in that window, not behind it in the main one.
//
// Read again each time the popup opens (the trigger may have moved to another window since), and
// once after mount (a popup open from the start renders before its trigger registers).

/** The trigger's `ownerDocument.body`, or `"body"` before the trigger is known. */
export function useOwnerBody(
    trigger: () => HTMLElement | undefined,
    open: Readonly<Ref<boolean>>,
) {
    const registered = ref(false);
    onMounted(() => nextTick(() => (registered.value = true)));
    return computed<HTMLElement | string>(() => {
        // dependencies on purpose: re-read the trigger's document on every open, and after mount
        void open.value;
        void registered.value;
        return trigger()?.ownerDocument.body ?? "body";
    });
}
