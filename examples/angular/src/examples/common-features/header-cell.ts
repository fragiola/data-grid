import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from "@angular/core";
import { DATA_GRID, DataGridHeaderCell } from "@fragiola/data-grid-angular";
import { DataGridColumnResizer } from "@fragiola/data-grid-angular/column-resize";
import { LucideArrowDown, LucideArrowUp } from "@lucide/angular";
import * as styles from "./styles";

// A header cell: its content, the app's sort arrow and a resize handle, its look by its state. It
// goes on the header cell itself: `<div [dataGridHeaderCell]="cell" exampleHeaderCell>` (the
// cell's directive is beside it on the same element, and hands its state and its cell).

@Component({
    selector: "[exampleHeaderCell]",
    imports: [DATA_GRID, DataGridColumnResizer, LucideArrowUp, LucideArrowDown],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { "[class]": "styles.headerCell(state())" },
    template: `
        <ng-container *dataGridCellContent />
        @switch (state()?.sortDirection) {
            @case ("ascending") {
                <svg lucideArrowUp aria-hidden="true" [class]="styles.sortIcon"></svg>
            }
            @case ("descending") {
                <svg lucideArrowDown aria-hidden="true" [class]="styles.sortIcon"></svg>
            }
        }
        <!--
            a resize handle where the column resizes: the directive's props make it a separator, a
            focusable one (the APG's splitter), which an <hr> cannot be
        -->
        <div
            *dataGridColumnResizer="info()"
            [attr.aria-label]="resizeLabel()"
            [class]="styles.resizer"
        ></div>
    `,
})
export class HeaderCell {
    protected readonly styles = styles;
    private readonly cell = inject(DataGridHeaderCell);
    protected readonly info = computed(() => this.cell.dataGridHeaderCell());
    protected readonly state = computed(() => this.cell.state());
    protected readonly resizeLabel = computed(() => {
        const cell = this.info();
        return `Resize ${cell.column?.name ?? cell.key}`;
    });
}
