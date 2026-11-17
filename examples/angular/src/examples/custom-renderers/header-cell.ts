import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from "@angular/core";
import {
    DATA_GRID,
    DataGridHeaderCell,
    injectGridView,
} from "@fragiola/data-grid-angular";
import { sortColumnsOf } from "@fragiola/data-grid-angular/sorting";
import * as styles from "./styles";

// A header cell with the app's own sort status: a triangle, and the column's place in the sort.
// It goes on the header cell itself: `<div [dataGridHeaderCell]="cell" exampleSortStatus>` (the
// cell's directive is beside it on the same element, and hands its state); the cell's content
// (the column's name, or its renderer) comes first.

@Component({
    selector: "[exampleSortStatus]",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <ng-container *dataGridCellContent />
        @if (state()?.sortDirection; as direction) {
            <span aria-hidden="true" [class]="styles.sortStatus">{{ direction === "ascending" ? "▲" : "▼" }}@if (sortedColumns() > 1) {<span [class]="styles.priority">{{ state()?.sortPriority }}</span>}</span>
        }
    `,
})
export class SortStatus {
    protected readonly styles = styles;
    private readonly cell = inject(DataGridHeaderCell);
    private readonly view = injectGridView();
    protected readonly state = computed(() => this.cell.state());
    protected readonly sortedColumns = computed(
        () => sortColumnsOf(this.view()).length,
    );
}
