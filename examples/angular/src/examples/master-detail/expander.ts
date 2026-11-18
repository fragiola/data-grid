import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from "@angular/core";
import {
    type DataGridFeature,
    injectDataGrid,
    injectGridView,
} from "@fragiola/data-grid-angular";
import type { RowExpansionTypes } from "@fragiola/data-grid-angular/row-expansion";
import { LucideChevronRight } from "@lucide/angular";
import type { Order } from "./orders";
import * as styles from "./styles";

// The expander in an order's first cell. The cell is the tab stop (the grid's roving tabindex),
// so the button never is: a click toggles, and Enter or Space on the cell does (`onExpanderKey`).
// It goes on the app's own button: `<button exampleExpander [order]="…" [rowIndex]="…">`.

@Component({
    selector: "button[exampleExpander]",
    imports: [LucideChevronRight],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        type: "button",
        tabindex: "-1",
        "[attr.aria-expanded]": "expanded()",
        "[attr.aria-label]":
            "(expanded() ? 'Hide' : 'Show') + ' the items of order ' + order().id",
        "[class]": "styles.expander",
        "(click)": "toggle()",
    },
    template: `<svg lucideChevronRight [size]="14" aria-hidden="true"></svg>`,
})
export class Expander {
    protected readonly styles = styles;
    readonly order = input.required<Order>();
    readonly rowIndex = input.required<number>();

    // expands or collapses an order: the app's control, the grid's state (M1); the model typed by
    // the feature this part reads (row expansion, installed by the grid)
    private readonly grid = injectDataGrid<
        Order,
        [DataGridFeature<RowExpansionTypes>]
    >();
    private readonly view = injectGridView();
    protected readonly expanded = computed(() => {
        this.view();
        return this.grid.model.is("row-expanded", {
            rowIndex: this.rowIndex(),
        });
    });

    protected toggle() {
        this.grid.model.run("expanded-rows.toggle", {
            rowIndex: this.rowIndex(),
        });
    }
}
