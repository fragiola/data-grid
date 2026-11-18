// @fragiola/data-grid-angular/search: the search feature (Epic #153), for an app that installs
// only this package: the core's (`@fragiola/data-grid/search`), and the root's search inputs. An
// opt-in entry point: the directives never import it, and an app that never installs search
// never ships it.

import { DestroyRef, Directive, inject, input, output } from "@angular/core";
import type { DataGridFeature } from "@fragiola/data-grid";
import type { SearchProps, SearchTypes } from "@fragiola/data-grid/search";
import { DataGridRoot } from "@fragiola/data-grid-angular";

export {
    type SearchProps,
    type SearchState,
    type SearchTypes,
    search,
} from "@fragiola/data-grid/search";

/**
 * The root's search text (React's `searchText`, `defaultSearchText` and `onSearchTextChange` on
 * `Root`, typed by `search()`): on the root's element, with `search()` in its features (`<div
 * dataGridRoot [features]="features" dataGridSearch [(searchText)]="text">`). Its inputs are the
 * root's: `[dataGridLocalRows]` wins over them. Without `search()` installed, the core reads none
 * of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridSearch]",
    exportAs: "dataGridSearch",
})
export class DataGridSearch {
    /** the search text, controlled; pair it with `searchTextChange` (`[(searchText)]`) */
    readonly searchText = input<string | undefined>(undefined);
    /** the search text to start with, uncontrolled */
    readonly defaultSearchText = input<string | undefined>(undefined);
    /** the search text changed (or, controlled, asks to): a command ran */
    readonly searchTextChange = output<string>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly changed = (searchText: string) =>
        this.searchTextChange.emit(searchText);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<SearchTypes>]>(
                (): SearchProps => ({
                    searchText: this.searchText(),
                    defaultSearchText: this.defaultSearchText(),
                    onSearchTextChange: this.changed,
                }),
                { inputs: true },
            ),
        );
    }
}
