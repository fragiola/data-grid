import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    Directive,
    inject,
    input,
} from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import {
    type ColumnOrGroup,
    DATA_GRID,
    type DataGridFeatures,
    type DataGridNode,
    DataGridRoot,
    type GridRootProps,
} from "../src/public-api";
import { type Rendered, render, settled } from "./helpers";

// The grid most tests render (the React and Vue suites' `divGrid`/`tableGrid`): every part, as
// divs or as a table, its root's props given whole (the core's `GridRootProps`, handlers too)
// through a test directive on the root, as `[dataGridLocalRows]` gives its own.

/**
 * A test's root props: the core's root props and its features' (`features` among them), the
 * columns required.
 */
export type TestProps<
    TRow = unknown,
    TFeatures extends DataGridFeatures = DataGridFeatures,
> = Partial<GridRootProps<TRow, DataGridNode, TFeatures>> & {
    columns: readonly ColumnOrGroup<TRow, DataGridNode>[];
};

/** Gives the root the props a test passes, over its inputs. */
@Directive({ selector: "[dataGridRoot][testProps]" })
export class TestRootProps<TRow = unknown> {
    readonly testProps = input.required<TestProps<TRow>>();

    constructor() {
        const root = inject<DataGridRoot<TRow>>(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource(() => this.testProps()),
        );
    }
}

/** What the test grid renders besides the props. */
export interface TestGridOptions {
    /** a `<table>`, its parts table elements; else divs */
    readonly table?: boolean;
    /** the empty state's text (an `*dataGridEmpty` after the header) */
    readonly empty?: string;
    /** the summary rows' positions to render (`*dataGridSummary`) */
    readonly summary?: boolean;
    /** the grid's `aria-label` */
    readonly label?: string;
}

@Component({
    selector: "test-grid",
    imports: [DATA_GRID, TestRootProps],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [columns]="props().columns" [testProps]="props()">
            @if (options().table) {
                <table dataGridGrid [attr.aria-label]="options().label ?? null">
                    <thead *dataGridHeader>
                        <ng-template dataGridHeaderRows let-row>
                            <tr [dataGridHeaderRow]="row">
                                <ng-template dataGridHeaderCells let-cell>
                                    <th [dataGridHeaderCell]="cell"><ng-container *dataGridCellContent /></th>
                                </ng-template>
                            </tr>
                        </ng-template>
                    </thead>
                    @if (options().summary) {
                        <tbody *dataGridSummary="'top'">
                            <ng-template dataGridSummaryRows let-row>
                                <tr [dataGridSummaryRow]="row">
                                    <ng-template dataGridSummaryCells let-cell>
                                        <td [dataGridSummaryCell]="cell"><ng-container *dataGridCellContent /></td>
                                    </ng-template>
                                </tr>
                            </ng-template>
                        </tbody>
                    }
                    @if (options().empty !== undefined) {
                        <td *dataGridEmpty>{{ options().empty }}</td>
                    }
                    <tbody dataGridBody>
                        <ng-template dataGridRows let-row>
                            <tr [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <td [dataGridCell]="cell"><ng-container *dataGridCellContent /></td>
                                </ng-template>
                            </tr>
                        </ng-template>
                    </tbody>
                    @if (options().summary) {
                        <tfoot *dataGridSummary="'bottom'">
                            <ng-template dataGridSummaryRows let-row>
                                <tr [dataGridSummaryRow]="row">
                                    <ng-template dataGridSummaryCells let-cell>
                                        <td [dataGridSummaryCell]="cell"><ng-container *dataGridCellContent /></td>
                                    </ng-template>
                                </tr>
                            </ng-template>
                        </tfoot>
                    }
                </table>
            } @else {
                <div dataGridGrid [attr.aria-label]="options().label ?? null">
                    <div *dataGridHeader>
                        <ng-template dataGridHeaderRows let-row>
                            <div [dataGridHeaderRow]="row">
                                <ng-template dataGridHeaderCells let-cell>
                                    <div [dataGridHeaderCell]="cell"><ng-container *dataGridCellContent /></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    @if (options().summary) {
                        <div *dataGridSummary="'top'">
                            <ng-template dataGridSummaryRows let-row>
                                <div [dataGridSummaryRow]="row">
                                    <ng-template dataGridSummaryCells let-cell>
                                        <div [dataGridSummaryCell]="cell"><ng-container *dataGridCellContent /></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    }
                    @if (options().empty !== undefined) {
                        <div *dataGridEmpty>{{ options().empty }}</div>
                    }
                    <div dataGridBody>
                        <ng-template dataGridRows let-row>
                            <div [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <div [dataGridCell]="cell"><ng-container *dataGridCellContent /></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    @if (options().summary) {
                        <div *dataGridSummary="'bottom'">
                            <ng-template dataGridSummaryRows let-row>
                                <div [dataGridSummaryRow]="row">
                                    <ng-template dataGridSummaryCells let-cell>
                                        <div [dataGridSummaryCell]="cell"><ng-container *dataGridCellContent /></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                    }
                </div>
            }
        </div>
    `,
})
export class TestGrid {
    readonly props = input.required<TestProps<unknown>>();
    readonly options = input<TestGridOptions>({});
}

/** The test grid rendered, and how to give it new props. */
export interface RenderedGrid extends Rendered<TestGrid> {
    /** new props (the whole set), then the grid settled */
    setProps<TRow>(props: TestProps<TRow>): Promise<void>;
}

/** Renders the test grid with `props` (handlers included) and `options`, settled. */
export async function renderTestGrid<TRow>(
    props: TestProps<TRow>,
    options: TestGridOptions = {},
): Promise<RenderedGrid> {
    let fixture: ComponentFixture<TestGrid> | undefined;
    const rendered = await render(TestGrid, (created) => {
        fixture = created;
        created.componentRef.setInput("props", props);
        created.componentRef.setInput("options", options);
    });
    return {
        ...rendered,
        async setProps(next) {
            fixture?.componentRef.setInput("props", next);
            await settled(fixture);
        },
    };
}
