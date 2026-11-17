import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from "@angular/core";
import { DATA_GRID, DataGridHeaderCell } from "@fragiola/data-grid-angular";
import { DataGridColumnResizer } from "@fragiola/data-grid-angular/column-resize";
import {
    LucideArrowDown,
    LucideArrowUp,
    LucideGripVertical,
} from "@lucide/angular";
import type { Person } from "../_kit/data";
import * as styles from "./styles";

// A header cell's content: a grip where it can be dragged, its label, the sort's arrow and the
// resize handle. The drop indicator and the dimmed dragged cell are the cell's classes, from its
// `data-*`. It goes on the header cell itself: `<div [dataGridHeaderCell]="cell"
// exampleReorderHeader>` (the cell's directive is beside it on the same element, and hands its
// state and its cell).

@Component({
    selector: "[exampleReorderHeader]",
    imports: [
        DATA_GRID,
        DataGridColumnResizer,
        LucideGripVertical,
        LucideArrowUp,
        LucideArrowDown,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (state()?.reorderable) {
            <svg lucideGripVertical aria-hidden="true" [class]="styles.grip"></svg>
        }
        <span [class]="styles.label"><ng-container *dataGridCellContent /></span>
        @switch (state()?.sortDirection) {
            @case ("ascending") {
                <svg lucideArrowUp aria-hidden="true" [class]="styles.sortIcon"></svg>
            }
            @case ("descending") {
                <svg lucideArrowDown aria-hidden="true" [class]="styles.sortIcon"></svg>
            }
        }
        <!-- a column's resize handle, where it resizes: it works beside the drag that reorders -->
        <div
            *dataGridColumnResizer="info()"
            [attr.aria-label]="resizeLabel()"
            [class]="styles.resizer"
        ></div>
    `,
})
export class ReorderHeader {
    protected readonly styles = styles;
    private readonly cell =
        inject<DataGridHeaderCell<Person>>(DataGridHeaderCell);
    protected readonly info = computed(() => this.cell.dataGridHeaderCell());
    protected readonly state = computed(() => this.cell.state());
    protected readonly resizeLabel = computed(() => {
        const cell = this.info();
        return `Resize ${(cell.group ?? cell.column).name ?? cell.key}`;
    });
}
