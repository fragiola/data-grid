import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from "@angular/core";
import { injectGridView } from "@fragiola/data-grid-angular";
import { sortColumnsOf } from "@fragiola/data-grid-angular/sorting";
import { LucideArrowDown, LucideArrowUp } from "@lucide/angular";
import type { SortKey } from "./state";
import * as styles from "./styles";

// A sortable column's header: its icon and its name (what it contains) and, while it is sorted,
// the direction. The grid sorts on a click, Enter or Space on the header cell; the arrow is the
// app's. It goes on the label's element: `<span exampleSortLabel columnKey="name">`.

@Component({
    selector: "[exampleSortLabel]",
    imports: [LucideArrowUp, LucideArrowDown],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { "[class]": "styles.headerLabel" },
    template: `
        <ng-content />
        @if (sorted(); as sorted) {
            @if (sorted.direction === "ascending") {
                <svg lucideArrowUp aria-hidden="true" [class]="styles.sortIcon"></svg>
            } @else {
                <svg lucideArrowDown aria-hidden="true" [class]="styles.sortIcon"></svg>
            }
        }
    `,
})
export class SortLabel {
    protected readonly styles = styles;
    readonly columnKey = input.required<SortKey>();

    private readonly view = injectGridView();
    protected readonly sorted = computed(() =>
        sortColumnsOf(this.view()).find(
            (entry) => entry.columnKey === this.columnKey(),
        ),
    );
}
