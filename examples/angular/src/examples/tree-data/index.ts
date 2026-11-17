import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { DATA_GRID, type RowKey } from "@fragiola/data-grid-angular";
import { DataGridLocalRows } from "@fragiola/data-grid-angular/local";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import {
    DataGridRowSelection,
    rowSelection,
} from "@fragiola/data-grid-angular/row-selection";
import { sorting } from "@fragiola/data-grid-angular/sorting";
import { LucideSearch } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { FIELDS } from "#/components/atoms/fields";
import { SWITCH } from "#/components/ui/switch";
import { columns } from "./columns";
import { FileGrid } from "./file-grid";
import { MemoryTree } from "./memory-tree";
import { ServerTree } from "./server-tree";
import * as styles from "./styles";

// A project's files as a tree: in memory (`injectLocalRows` with `getSubRows`: searched, sorted,
// a folder's checkbox selecting what it holds), or listed by a server folder by folder as they
// open (`lazy.ts`). Each mode starts from scratch (`memory-tree.ts`, `server-tree.ts`); both
// render the same grid (`file-grid.ts`).

/** Loaded lazily, no keys under a row: a folder's entries are not all here. */
const NONE = (): readonly RowKey[] => [];

let ids = 0;

@Component({
    selector: "example-tree-data",
    imports: [
        DATA_GRID,
        DataGridLocalRows,
        ClickableButton,
        FIELDS,
        SWITCH,
        LucideSearch,
        FileGrid,
        MemoryTree,
        ServerTree,
        DataGridRowSelection,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.modes">
                <span [class]="styles.mode">
                    <button kitSwitch [attr.aria-labelledby]="lazyLabel" [(checked)]="lazy">
                        <span kitSwitchThumb></span>
                    </button>
                    <span [id]="lazyLabel">Load folders from a server</span>
                </span>
                <span>
                    <kbd [class]="styles.key">Space</kbd> opens a folder,
                    <kbd [class]="styles.key">→</kbd>&ngsp;<kbd [class]="styles.key">←</kbd>
                    on its name
                </span>
            </div>
            @if (lazy()) {
                <!-- the same files listed by a server, folder by folder, as they are expanded -->
                <ng-container *exampleServerTree="let tree">
                    <div
                        dataGridRoot
                        [features]="lazyFeatures"
                        [columns]="columns"
                        [rowCount]="tree().rowCount"
                        [getRow]="tree().getRow"
                        [getRowMeta]="tree().getRowMeta"
                        [rowKey]="tree().rowKey"
                        [expandedGroupKeys]="tree().expandedGroupKeys"
                        (expandedGroupKeysChange)="tree().onExpandedGroupKeysChange($event)"
                        [rowHeight]="34"
                        dataGridRowSelection
                        rowSelection="multiple"
                        [class]="styles.root"
                    >
                        <div dataGridGrid exampleFileGrid aria-label="Files" [subRowKeysOf]="NONE" [class]="styles.grid"></div>
                    </div>
                </ng-container>
            } @else {
                <!-- the files in memory, searched and sorted -->
                <ng-container *exampleMemoryTree="let local">
                    <div [class]="styles.toolbar">
                        <kit-input-simple
                            ariaLabel="Search files"
                            placeholder="Search"
                            [value]="local.filter.search"
                            (valueChange)="local.filter.setSearch($event)"
                            [class]="styles.search"
                        >
                            <svg kitInset="start" lucideSearch aria-hidden="true" [class]="styles.searchIcon"></svg>
                        </kit-input-simple>
                        <button kitClickable size="sm" variant="ghost" (click)="local.group.expandAll()">
                            Expand all
                        </button>
                        <button kitClickable size="sm" variant="ghost" (click)="local.group.collapseAll()">
                            Collapse all
                        </button>
                        <span [class]="styles.count">
                            {{ local.filteredCount }} of {{ local.total }} entries
                        </span>
                    </div>
                    <div
                        dataGridRoot
                        [features]="features"
                        [dataGridLocalRows]="local"
                        [columns]="columns"
                        [rowHeight]="34"
                        dataGridRowSelection
                        rowSelection="multiple"
                        [class]="styles.root"
                    >
                        <div
                            dataGridGrid
                            exampleFileGrid
                            aria-label="Files"
                            [subRowKeysOf]="local.group.subRowKeysOf"
                            [class]="styles.grid"
                        ></div>
                    </div>
                </ng-container>
            }
        </div>
    `,
})
export default class TreeData {
    protected readonly styles = styles;
    protected readonly columns = columns;
    protected readonly NONE = NONE;
    // the features the grid installs: sorting (the local rows' sort needs it, or no column sorts),
    // cell navigation (the keys, the active cell, the tab stop), row selection
    readonly features = [sorting(), navigation(), rowSelection()];
    // the server's tree sorts nothing: navigation and row selection only
    readonly lazyFeatures = [navigation(), rowSelection()];

    readonly lazy = signal(false);
    readonly lazyLabel = `tree-data-lazy-${++ids}`;
}
