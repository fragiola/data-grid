import { effect } from "@angular/core";
import { type DataGridRef, injectDataGrid } from "@fragiola/data-grid-angular";
import { activeHeaderKey, describeMove } from "./announce";

/**
 * Says what a move asked by the person (`moving`) did, once the grid shows it: from the grid's
 * own header before and after the change, whatever the order's rules made of it. Follows the
 * root the ref holds (a remount included). Call it in an injection context.
 */
export function injectMoveAnnouncements<TRow>(
    gridRef: DataGridRef<TRow>,
    moving: { current: boolean },
    announce: (message: string) => void,
): void {
    const grid = injectDataGrid(gridRef);
    effect((onCleanup) => {
        const model = grid()?.model;
        if (!model) return;
        onCleanup(
            model.subscribe(({ before, after }) => {
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
            }),
        );
    });
}
