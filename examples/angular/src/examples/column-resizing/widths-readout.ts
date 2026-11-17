import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from "@angular/core";
import type { ColumnResize, ColumnWidths } from "@fragiola/data-grid-angular";

// What changed: the column being dragged, else the widths the app keeps. It goes on the app's
// own element: `<span exampleWidthsReadout [dragged]="dragged()" [widths]="widths()" [names]="names">`.

@Component({
    selector: "[exampleWidthsReadout]",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: "{{ text() }}",
})
export class WidthsReadout {
    /** the column being dragged (`inject-dragged.ts`), `null` between drags */
    readonly dragged = input.required<ColumnResize | null>();
    readonly widths = input.required<ColumnWidths>();
    /** every column's and group's name, by key */
    readonly names = input.required<ReadonlyMap<string, string>>();

    protected readonly text = computed(() => {
        const dragged = this.dragged();
        const names = this.names();
        const resized = Object.entries(this.widths());
        return dragged
            ? `Resizing ${names.get(dragged.columnKey)} to ${dragged.width}px`
            : resized.length === 0
              ? "Every column at its own width"
              : resized
                    .map(([key, width]) => `${names.get(key)} ${width}px`)
                    .join(" · ");
    });
}
