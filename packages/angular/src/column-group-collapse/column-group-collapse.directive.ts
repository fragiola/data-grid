import { DestroyRef, Directive, inject, input, output } from "@angular/core";
import type { DataGridFeature } from "@fragiola/data-grid";
import type {
    ColumnGroupCollapseProps,
    ColumnGroupCollapseTypes,
} from "@fragiola/data-grid/column-group-collapse";
import { DataGridRoot } from "@fragiola/data-grid-angular";

/**
 * The root's collapsed groups (React's `collapsedGroupKeys`, `defaultCollapsedGroupKeys` and
 * `onCollapsedGroupKeysChange` on `Root`, typed by `columnGroupCollapse()`): on the root's
 * element, with `columnGroupCollapse()` in its features (`<div dataGridRoot [features]="features"
 * dataGridColumnGroupCollapse [(collapsedGroupKeys)]="collapsed">`). Its inputs are the root's.
 * Without `columnGroupCollapse()` installed, the core reads none of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridColumnGroupCollapse]",
    exportAs: "dataGridColumnGroupCollapse",
})
export class DataGridColumnGroupCollapse {
    /**
     * the collapsed groups' keys (groups with `collapsible`), controlled; pair it with
     * `collapsedGroupKeysChange` (`[(collapsedGroupKeys)]`)
     */
    readonly collapsedGroupKeys = input<readonly string[] | undefined>(
        undefined,
    );
    /** the collapsed groups' keys to start with, uncontrolled */
    readonly defaultCollapsedGroupKeys = input<readonly string[] | undefined>(
        undefined,
    );
    /** the collapsed groups changed (or, controlled, ask to): a group was toggled, or a command ran */
    readonly collapsedGroupKeysChange = output<readonly string[]>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly changed = (collapsedGroupKeys: readonly string[]) =>
        this.collapsedGroupKeysChange.emit(collapsedGroupKeys);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<
                readonly [DataGridFeature<ColumnGroupCollapseTypes>]
            >(
                (): ColumnGroupCollapseProps => ({
                    collapsedGroupKeys: this.collapsedGroupKeys(),
                    defaultCollapsedGroupKeys: this.defaultCollapsedGroupKeys(),
                    onCollapsedGroupKeysChange: this.changed,
                }),
                { inputs: true },
            ),
        );
    }
}
