import {
    booleanAttribute,
    DestroyRef,
    Directive,
    inject,
    input,
    output,
} from "@angular/core";
import type { DataGridFeature, RangeFill } from "@fragiola/data-grid";
import type {
    FillHandleProps,
    FillHandleTypes,
} from "@fragiola/data-grid/fill";
import { DataGridRoot } from "@fragiola/data-grid-angular";

/**
 * The root's fill (React's `onFill` on `Root`, typed by `fillHandle()`): on the root's element,
 * with `fillHandle()` in its features (`<div dataGridRoot [features]="features" dataGridFill
 * (fill)="filled($event)">`). Cells fill while it is on the element (React: `onFill` given):
 * `[dataGridFill]="false"` turns them off. Its selector is `dataGridFill`, not the fill handle's
 * own `dataGridFillHandle` (the element a fill drags, `*dataGridFillHandle`).
 */
@Directive({
    selector: "[dataGridRoot][dataGridFill]",
    exportAs: "dataGridFill",
})
export class DataGridFill {
    /** cells fill (the attribute alone: on); `false` turns them off */
    readonly dataGridFill = input(true, { transform: booleanAttribute });
    /** a fill handle was dropped: the range and the cells it fills. The app writes the values */
    readonly fill = output<RangeFill>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly filled = (fill: RangeFill) => this.fill.emit(fill);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<FillHandleTypes>]>(
                (): FillHandleProps => ({
                    onFill: this.dataGridFill() ? this.filled : undefined,
                }),
                { inputs: true },
            ),
        );
    }
}
