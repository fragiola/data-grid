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
import {
    LucideArrowDown,
    LucideArrowUp,
    LucideArrowUpDown,
} from "@lucide/angular";
import * as styles from "./styles";

// A header cell's content and the app's own indicator, drawn from the cell's state: an arrow for
// the direction and, with more than one sorted column, its priority. It goes on the header cell
// itself: `<div [dataGridHeaderCell]="cell" exampleSortHeader>` (the cell's directive is beside
// it on the same element, and hands its state).

@Component({
    selector: "[exampleSortHeader]",
    imports: [DATA_GRID, LucideArrowUp, LucideArrowDown, LucideArrowUpDown],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <span [class]="styles.headerLabel"><ng-container *dataGridCellContent /></span>
        @switch (state()?.sortDirection) {
            @case ("ascending") {
                <svg lucideArrowUp aria-hidden="true" [class]="styles.sortIcon"></svg>
            }
            @case ("descending") {
                <svg lucideArrowDown aria-hidden="true" [class]="styles.sortIcon"></svg>
            }
            @default {
                @if (state()?.sortable) {
                    <svg lucideArrowUpDown aria-hidden="true" [class]="styles.unsorted"></svg>
                }
            }
        }
        @if (sortedColumns() > 1 && state()?.sortPriority !== undefined) {
            <span [class]="styles.priority">{{ state()?.sortPriority }}</span>
        }
    `,
})
export class SortHeader {
    protected readonly styles = styles;
    private readonly cell = inject(DataGridHeaderCell);
    private readonly view = injectGridView();
    protected readonly state = computed(() => this.cell.state());
    protected readonly sortedColumns = computed(
        () => sortColumnsOf(this.view()).length,
    );
}
