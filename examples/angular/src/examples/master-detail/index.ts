import {
    ChangeDetectionStrategy,
    Component,
    signal,
    type TemplateRef,
    ViewChild,
} from "@angular/core";
import {
    type CellInfo,
    type CellTemplateProps,
    type Column,
    contextOf,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import { columnPinning } from "@fragiola/data-grid-angular/column-pinning";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { SWITCH } from "#/components/ui/switch";
import { formatMoney } from "../_kit/data";
import { Expander } from "./expander";
import { OrderItems } from "./order-items";
import { OrderSummary } from "./order-summary";
import { detailHeight, type Order, orders, total } from "./orders";
import * as styles from "./styles";

// Orders that expand into a detail below their cells (`*dataGridRowDetail` in each row): a summary
// and a grid of the order's items (`order-items.ts`), each grid with its own keys and focus.

type OrderCell = TemplateRef<TemplateContext<CellTemplateProps<Order>>>;

const EXPANDED = [1001];

let ids = 0;

/** Enter or Space on an order's expander cell toggles it (and is not the browser's scroll). */
function onExpanderKey(event: KeyboardEvent, toggle: () => void) {
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
        event.preventDefault();
        toggle();
    }
}

@Component({
    selector: "example-master-detail",
    imports: [DATA_GRID, SWITCH, Expander, OrderItems, OrderSummary],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span [class]="styles.option">
                    <button kitSwitch [attr.aria-labelledby]="measuredLabel" [(checked)]="measured">
                        <span kitSwitchThumb></span>
                    </button>
                    <span [id]="measuredLabel">Measure the details</span>
                </span>
            </div>
            <!--
                each order's detail is as tall as its items need: computed from the order, or
                measured once rendered ("auto", about 160px until then)
            -->
            <div
                dataGridRoot
                [features]="features"
                [gridRef]="gridRef"
                [columns]="columns"
                [rows]="orders"
                [rowKey]="rowKey"
                [rowHeight]="40"
                [detailHeight]="measured() ? 'auto' : detailHeight"
                [estimatedDetailHeight]="160"
                [defaultExpandedRowKeys]="EXPANDED"
                [class]="styles.root"
            >
                <ng-template #expanderCell [dataGridTemplate]="cellContext" let-row="row" let-rowIndex="rowIndex">
                    <button exampleExpander [order]="row" [rowIndex]="rowIndex"></button>
                </ng-template>
                <ng-template #statusCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.status(row.status)">{{ row.status }}</span>
                </ng-template>
                <ng-template #totalCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.money">{{ formatMoney(total(row)) }}</span>
                </ng-template>
                <div dataGridGrid aria-label="Orders" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div [dataGridHeaderCell]="cell" [class]="styles.headerCell(cell)">
                                    <ng-container *dataGridCellContent />
                                </div>
                            </ng-template>
                        </div>
                    </div>
                    <div dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <div [dataGridRow]="row" [class]="styles.row(row)">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <div
                                        [dataGridCell]="cell"
                                        [class]="styles.cell(cell)"
                                        (keydown)="onCellKey($event, cell)"
                                    >
                                        <ng-container *dataGridCellContent />
                                    </div>
                                </ng-template>
                                <div
                                    *dataGridRowDetail
                                    [class]="styles.detail"
                                    (keydown)="backToOrder($event, 0)"
                                >
                                    <!-- the part is a block: the layout inside it is the app's -->
                                    @if (row.row; as order) {
                                        <div [class]="styles.detailContent">
                                            <example-order-summary [order]="order" />
                                            <example-order-items [order]="order" />
                                        </div>
                                    }
                                </div>
                            </div>
                        </ng-template>
                    </div>
                </div>
            </div>
        </div>
    `,
})
export default class MasterDetail {
    // the features the grid installs: cell navigation (the keys, the active cell, the tab stop),
    // pinned columns (without it, every column scrolls)
    readonly features = [navigation(), columnPinning()];
    protected readonly styles = styles;
    protected readonly formatMoney = formatMoney;
    protected readonly total = total;
    protected readonly detailHeight = detailHeight;
    protected readonly EXPANDED = EXPANDED;
    protected readonly cellContext = contextOf<CellTemplateProps<Order>>();

    readonly orders = orders;
    readonly gridRef = createDataGridRef<Order>();

    // the details' heights: computed from each order, or measured from what they render
    readonly measured = signal(false);
    readonly measuredLabel = `master-detail-measured-${++ids}`;

    @ViewChild("expanderCell", { static: true })
    private readonly expanderCell!: OrderCell;
    @ViewChild("statusCell", { static: true })
    private readonly statusCell!: OrderCell;
    @ViewChild("totalCell", { static: true })
    private readonly totalCell!: OrderCell;

    readonly columns: Column<Order, DataGridNode>[] = [
        {
            key: "expand",
            width: 44,
            pinned: "start",
            renderCell: (props) => templateContent(this.expanderCell, props),
        },
        { key: "id", name: "Order", width: 84, pinned: "start" },
        { key: "customer", name: "Customer", width: 170 },
        {
            key: "status",
            name: "Status",
            width: 110,
            renderCell: (props) => templateContent(this.statusCell, props),
        },
        {
            key: "count",
            name: "Items",
            width: 70,
            getValue: (row) => row.items.length,
        },
        {
            key: "total",
            name: "Total",
            width: 110,
            renderCell: (props) => templateContent(this.totalCell, props),
        },
        { key: "placed", name: "Placed", width: 110 },
        { key: "city", name: "Ship to", width: 130 },
        { key: "carrier", name: "Carrier", width: 100 },
        { key: "payment", name: "Payment", width: 100 },
        { key: "email", name: "Email", width: 260 },
    ];

    readonly rowKey = (row: Order) => row.id;

    /** A cell's keys: only the expander's toggle its order. */
    protected onCellKey(event: KeyboardEvent, cell: CellInfo<Order>) {
        if (cell.column.key !== "expand") return;
        onExpanderKey(event, () =>
            this.gridRef.current?.model.run("expanded-rows.toggle", {
                rowIndex: cell.rowIndex,
            }),
        );
    }

    /** Escape in a detail returns to its order: the cell of `columnIndex` in its row takes focus. */
    protected backToOrder(event: KeyboardEvent, columnIndex: number) {
        if (event.key !== "Escape") return;
        if (!(event.currentTarget instanceof HTMLElement)) return;
        const cell = event.currentTarget
            .closest('[data-grid-part="row"]')
            ?.querySelector<HTMLElement>(
                `[data-grid-part="cell"][data-column-index="${columnIndex}"]`,
            );
        if (cell) {
            event.preventDefault();
            cell.focus();
        }
    }
}
