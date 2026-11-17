import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from "@angular/core";
import { DATA_GRID, DataGridHeaderCell } from "@fragiola/data-grid-angular";
import { LucideArrowDown, LucideArrowUp } from "@lucide/angular";
import * as styles from "./styles";

// A header cell: its name and sort arrow on top, its filter (what it contains) below. It goes on
// the header cell itself: `<div [dataGridHeaderCell]="cell" exampleFilterHeader>` (the cell's
// directive is beside it on the same element, and hands its state).

@Component({
    selector: "[exampleFilterHeader]",
    imports: [DATA_GRID, LucideArrowUp, LucideArrowDown],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <span [class]="styles.title">
            <!-- the column's name -->
            <ng-container *dataGridCellContent />
            @switch (sortDirection()) {
                @case ("ascending") {
                    <svg lucideArrowUp aria-hidden="true" [class]="styles.sortIcon"></svg>
                }
                @case ("descending") {
                    <svg lucideArrowDown aria-hidden="true" [class]="styles.sortIcon"></svg>
                }
            }
        </span>
        <ng-content />
    `,
})
export class FilterHeader {
    protected readonly styles = styles;
    private readonly cell = inject(DataGridHeaderCell);
    protected readonly sortDirection = computed(
        () => this.cell.state()?.sortDirection,
    );
}
