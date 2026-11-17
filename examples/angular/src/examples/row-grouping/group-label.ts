import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import {
    type CellInfo,
    DATA_GRID,
    type GroupRow,
} from "@fragiola/data-grid-angular";
import { LucideChevronRight } from "@lucide/angular";
import { formatNumber, type Person } from "../_kit/data";
import * as styles from "./styles";

// A group row's label: its toggle, its value and how many people it holds.

@Component({
    selector: "example-group-label",
    imports: [DATA_GRID, LucideChevronRight],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <span [class]="styles.groupLabel(group().depth)">
            <button
                *dataGridGroupToggle="cell(); let state"
                type="button"
                [attr.aria-label]="(state.expanded ? 'Collapse ' : 'Expand ') + value()"
                [class]="styles.toggle"
            >
                <svg
                    lucideChevronRight
                    aria-hidden="true"
                    [class]="styles.chevron(state.expanded)"
                ></svg>
            </button>
            <span [class]="styles.groupValue">{{ value() }}</span>
            <span [class]="styles.groupCount">
                {{ formatNumber(group().childCount) }}
            </span>
        </span>
    `,
})
export class GroupLabel {
    protected readonly styles = styles;
    protected readonly formatNumber = formatNumber;
    readonly cell = input.required<CellInfo<Person>>();
    readonly group = input.required<GroupRow>();

    protected value() {
        return String(this.group().value);
    }
}
