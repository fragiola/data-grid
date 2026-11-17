// @fragiola/data-grid-angular/navigation: cell navigation (D11; a feature since Epic #144), for an
// app that installs only this package: the core's (`@fragiola/data-grid/navigation`), and the
// root's active cell inputs. An opt-in entry point: the directives never import it, and an app
// that never installs navigation never ships it (its grid takes the table roles, no tab stop).

import { DestroyRef, Directive, inject, input, output } from "@angular/core";
import type { CellPosition, DataGridFeature } from "@fragiola/data-grid";
import type {
    NavigationProps,
    NavigationTypes,
} from "@fragiola/data-grid/navigation";
import { DataGridRoot } from "@fragiola/data-grid-angular";

export {
    type NavigationProps,
    type NavigationTypes,
    navigation,
    samePosition,
} from "@fragiola/data-grid/navigation";

/**
 * The root's active cell (React's `activePosition`, `defaultActivePosition` and
 * `onActivePositionChange` on `Root`, typed by `navigation()`): on the root's element, with
 * `navigation()` in its features (`<div dataGridRoot [features]="features" dataGridNavigation
 * [(activePosition)]="active">`). Its inputs are the root's. Without `navigation()` installed, the
 * core reads none of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridNavigation]",
    exportAs: "dataGridNavigation",
})
export class DataGridNavigation {
    /** the active cell, controlled (`null` for none); pair it with `activePositionChange` */
    readonly activePosition = input<CellPosition | null | undefined>(undefined);
    /** the active cell to start with, uncontrolled */
    readonly defaultActivePosition = input<CellPosition | null | undefined>(
        undefined,
    );
    /** the active cell changed (or, controlled, asks to) */
    readonly activePositionChange = output<CellPosition | null>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly changed = (position: CellPosition | null) =>
        this.activePositionChange.emit(position);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<NavigationTypes>]>(
                (): NavigationProps => ({
                    activePosition: this.activePosition(),
                    defaultActivePosition: this.defaultActivePosition(),
                    onActivePositionChange: this.changed,
                }),
                { inputs: true },
            ),
        );
    }
}
