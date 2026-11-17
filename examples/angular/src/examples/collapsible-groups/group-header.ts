import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from "@angular/core";
import {
    DATA_GRID,
    type DataGridFeature,
    DataGridHeaderCell,
    injectDataGrid,
} from "@fragiola/data-grid-angular";
import type { ColumnGroupCollapseTypes } from "@fragiola/data-grid-angular/column-group-collapse";
import { LucideChevronRight } from "@lucide/angular";
import type { Person } from "../_kit/data";
import * as styles from "./styles";

// A group's header: its label, which stays in view while the group scrolls (`[dataGridGroupLabel]`
// beside it on the same element), holding the toggle that opens and closes it (the app's own
// button, the grid's command). It goes on the label itself:
// `<span [dataGridGroupLabel]="cell" exampleGroupHeader>` inside the group's header cell (whose
// directive hands its cell and its state).

@Component({
    selector: "[exampleGroupHeader]",
    imports: [DATA_GRID, LucideChevronRight],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (state()?.collapsed !== undefined) {
            <button
                type="button"
                [attr.aria-label]="name()"
                [attr.aria-expanded]="!state()?.collapsed"
                [class]="styles.toggle"
                (click)="toggle()"
            >
                <svg lucideChevronRight aria-hidden="true"></svg>
            </button>
        }
        <ng-container *dataGridCellContent />
    `,
})
export class GroupHeader {
    protected readonly styles = styles;
    private readonly headerCell =
        inject<DataGridHeaderCell<Person>>(DataGridHeaderCell);
    // the grid collapses its groups (`columnGroupCollapse()`): its commands are typed by it
    private readonly grid = injectDataGrid<
        Person,
        readonly [DataGridFeature<ColumnGroupCollapseTypes>]
    >();
    protected readonly state = computed(() => this.headerCell.state());
    protected readonly name = computed(
        () => this.headerCell.dataGridHeaderCell().group?.name,
    );

    protected toggle() {
        this.grid.model.run("column-groups.toggle", {
            groupKey: this.headerCell.dataGridHeaderCell().key,
        });
    }
}
