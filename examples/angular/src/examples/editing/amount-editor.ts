import { computed, Directive, input } from "@angular/core";
import type {
    DataGridNode,
    EditCellRenderProps,
} from "@fragiola/data-grid-angular";
import { amountOf } from "../_kit/budgeted-tasks";
import { injectStartKey } from "./inject-start-key";

// An amount: a number, on the app's own field (`<input kitNumeric exampleAmountEditor
// [edit]="edit">`). A value that is no amount keeps the edit open: the editor prevents Enter and
// Tab (its own listener runs before the grid's), and says so. Its look is its caller's.

@Directive({
    selector: "input[exampleAmountEditor]",
    host: {
        "[attr.aria-label]": "edit().column.name ?? null",
        "[attr.aria-invalid]": "!valid()",
        "[value]": "text()",
        "(input)": "onInput($event)",
        "(keydown)": "onKeydown($event)",
    },
})
export class AmountEditor<TRow> {
    readonly edit = input.required<EditCellRenderProps<TRow, DataGridNode>>();

    protected readonly text = computed(() => String(this.edit().value ?? ""));
    protected readonly valid = computed(
        () => amountOf(this.edit().value) !== undefined,
    );

    constructor() {
        injectStartKey(
            () => {
                const key = this.edit().startKey;
                return key !== undefined && /\d/.test(key) ? key : undefined;
            },
            (value) => this.edit().onChange(value),
        );
    }

    protected onInput(event: Event) {
        if (event.target instanceof HTMLInputElement) {
            this.edit().onChange(event.target.value);
        }
    }

    protected onKeydown(event: KeyboardEvent) {
        if (!this.valid() && (event.key === "Enter" || event.key === "Tab")) {
            event.preventDefault();
        }
    }
}
