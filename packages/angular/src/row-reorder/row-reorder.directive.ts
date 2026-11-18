import {
    booleanAttribute,
    DestroyRef,
    Directive,
    inject,
    input,
    output,
} from "@angular/core";
import type { DataGridFeature, RowMove } from "@fragiola/data-grid";
import type {
    RowReorderProps,
    RowReorderTypes,
} from "@fragiola/data-grid/row-reorder";
import { DataGridRoot } from "@fragiola/data-grid-angular";

/**
 * The root's row moves (React's `onRowMove` on `Root`, typed by `rowReorder()`): on the root's
 * element, with `rowReorder()` in its features (`<div dataGridRoot [features]="features"
 * dataGridRowReorder (rowMove)="move($event)">`). The rows move while it is on (its presence,
 * or `[dataGridRowReorder]="false"` to stop them: React's `onRowMove` given or not), each move
 * told by `rowMove`. Without `rowReorder()` installed, the core reads none of it.
 */
@Directive({
    selector: "[dataGridRoot][dataGridRowReorder]",
    exportAs: "dataGridRowReorder",
})
export class DataGridRowReorder {
    /** the rows move by their drag handles and the keys (on by its presence) */
    readonly dataGridRowReorder = input(true, {
        transform: (value: unknown) =>
            value === "" || value === undefined || booleanAttribute(value),
    });
    /**
     * a row was moved (Epic #86): dropped elsewhere by its drag handle, or by Ctrl/⌘+Shift+↑/↓ on
     * one of its cells. The app moves the row in its own rows, from `fromIndex` to `toIndex` (its
     * index once moved: `moveRow` in `@fragiola/data-grid/local`), and the active cell follows it
     */
    readonly rowMove = output<RowMove>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly moved = (move: RowMove) => this.rowMove.emit(move);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<RowReorderTypes>]>(
                (): RowReorderProps => ({
                    onRowMove: this.dataGridRowReorder()
                        ? this.moved
                        : undefined,
                }),
                { inputs: true },
            ),
        );
    }
}
