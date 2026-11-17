import type { DataGridRef } from "@fragiola/data-grid-vue";
import { onScopeDispose } from "vue";
import { activeHeaderKey, describeMove } from "./announce";

/**
 * Says what a move asked by the person (`moving`) did, once the grid shows it: from the grid's
 * own header before and after the change, whatever the order's rules made of it. Follows the
 * root the ref holds (a remount included). Call it in `setup`.
 */
export function useMoveAnnouncements<TRow>(
    gridRef: DataGridRef<TRow>,
    moving: { current: boolean },
    announce: (message: string) => void,
) {
    let unsubscribe = () => {};
    const follow = () => {
        unsubscribe();
        unsubscribe =
            gridRef.current?.model.subscribe(({ before, after }) => {
                if (!moving.current || after.header === before.header) {
                    return;
                }
                moving.current = false;
                const moved = describeMove(
                    before.header.rows,
                    after.header.rows,
                    activeHeaderKey(after),
                );
                if (moved) announce(moved);
            }) ?? (() => {});
    };
    follow();
    const stop = gridRef.subscribe(follow);
    onScopeDispose(() => {
        stop();
        unsubscribe();
    });
}
