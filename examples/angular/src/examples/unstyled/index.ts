import { ChangeDetectionStrategy, Component } from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { type Person, people } from "../_kit/data";
import * as styles from "./styles";

// No class on any part: the cells render the header names and the values (their default
// content). The only class sizes the frame, because a scroll container needs a size.

@Component({
    selector: "example-unstyled",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div dataGridRoot [columns]="columns" [rows]="rows" [class]="styles.root">
                <div dataGridGrid aria-label="People">
                    <div *dataGridHeader>
                        <div dataGridHeaderRow>
                            <ng-template dataGridHeaderCells let-cell>
                                <div [dataGridHeaderCell]="cell"><ng-container *dataGridCellContent /></div>
                            </ng-template>
                        </div>
                    </div>
                    <div dataGridBody>
                        <ng-template dataGridRows let-row>
                            <div [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <div [dataGridCell]="cell"><ng-container *dataGridCellContent /></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            </div>
        </div>
    `,
})
export default class Unstyled {
    protected readonly styles = styles;

    readonly rows = people(1_000);

    readonly columns: Column<Person, DataGridNode>[] = [
        { key: "id", name: "#", width: 60 },
        { key: "name", name: "Name", width: 180 },
        { key: "email", name: "Email", width: 260 },
        { key: "city", name: "City", width: 140 },
    ];
}
