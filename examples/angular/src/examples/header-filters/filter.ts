import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    output,
} from "@angular/core";
import type { HeaderCellInfo } from "@fragiola/data-grid-angular";
import { FIELDS } from "#/components/atoms/fields";
import { SELECT_PARTS } from "#/components/ui/select";
import type { Task } from "../_kit/tasks";
import { FILTERS } from "./filters";
import * as styles from "./styles";

// A column's filter, by its kind; none for a column without one.

@Component({
    selector: "example-filter",
    imports: [FIELDS, SELECT_PARTS],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { "[class]": "styles.filter" },
    template: `
        @let kind = filter();
        @if (kind?.kind === "text") {
            <input
                kitInput
                [attr.aria-label]="'Filter ' + name()"
                placeholder="Contains"
                [value]="text()"
                (input)="valueChange.emit($any($event.target).value)"
                [class]="styles.textFilter"
            />
        } @else if (kind?.kind === "select") {
            <button
                [kitSelectTrigger]="list"
                [items]="kind.items"
                [value]="choice()"
                (valueChange)="setChoice($event)"
                [attr.aria-label]="'Filter ' + name()"
                [class]="styles.selectFilter"
            >
                <span kitSelectValue></span>
            </button>
            <ng-template #list>
                <div kitSelectContent>
                    @for (item of kind.items; track item.value) {
                        <div [kitSelectItem]="item.value">{{ item.label }}</div>
                    }
                </div>
            </ng-template>
        }
    `,
})
export class Filter {
    protected readonly styles = styles;
    readonly cell = input.required<HeaderCellInfo<Task>>();
    readonly value = input<unknown>();
    /** The filter's new value: `undefined` filters nothing. */
    readonly valueChange = output<unknown>();

    protected readonly filter = computed(() => FILTERS[this.cell().key]);
    protected readonly name = computed(
        () => this.cell().column?.name ?? this.cell().key,
    );
    protected readonly text = computed(() => {
        const value = this.value();
        return typeof value === "string" ? value : "";
    });
    protected readonly choice = computed(() => {
        const value = this.value();
        return value === undefined ? "all" : String(value);
    });

    protected setChoice(choice: unknown) {
        const numeric = this.cell().key === "effectiveness";
        this.valueChange.emit(
            choice === "all" || choice === null
                ? undefined
                : numeric
                  ? Number(choice)
                  : choice,
        );
    }
}
