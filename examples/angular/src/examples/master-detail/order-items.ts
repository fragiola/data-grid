import {
    ChangeDetectionStrategy,
    Component,
    input,
    type TemplateRef,
    ViewChild,
} from "@angular/core";
import {
    type CellTemplateProps,
    type Column,
    contextOf,
    DATA_GRID,
    type DataGridNode,
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import { formatMoney } from "../_kit/data";
import {
    ITEM_HEADER,
    ITEM_ROW,
    type Item,
    itemsHeight,
    type Order,
} from "./orders";
import * as styles from "./styles";

// An order's items: a grid of its own in the detail (its own active cell, keys and focus). A grid
// nested in another is in the tab order only while the orders grid's active cell is in its row:
// Tab goes from that row into its items, and Shift+Tab comes back.

type ItemCell = TemplateRef<TemplateContext<CellTemplateProps<Item>>>;

@Component({
    selector: "example-order-items",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div
            dataGridRoot
            [columns]="columns"
            [rows]="order().items"
            [rowHeight]="ITEM_ROW"
            [headerRowHeight]="ITEM_HEADER"
            [class]="styles.innerRoot"
            [style.width.px]="ITEMS_WIDTH"
            [style.height.px]="itemsHeight(order())"
        >
            <ng-template #priceCell [dataGridTemplate]="cellContext" let-row="row">
                <span [class]="styles.money">{{ formatMoney(row.price) }}</span>
            </ng-template>
            <ng-template #subtotalCell [dataGridTemplate]="cellContext" let-row="row">
                <span [class]="styles.money">{{ formatMoney(row.quantity * row.price) }}</span>
            </ng-template>
            <div dataGridGrid [attr.aria-label]="'Items of order ' + order().id">
                <div *dataGridHeader [class]="styles.innerHeader">
                    <div dataGridHeaderRow [class]="styles.innerHeaderRow">
                        <ng-template [dataGridHeaderCells]="columns" let-cell>
                            <div [dataGridHeaderCell]="cell" [class]="styles.innerHeaderCell">
                                <ng-container *dataGridCellContent />
                            </div>
                        </ng-template>
                    </div>
                </div>
                <div dataGridBody>
                    <ng-template [dataGridRows]="columns" let-row>
                        <div [dataGridRow]="row" [class]="styles.innerRow">
                            <ng-template [dataGridCells]="columns" let-cell>
                                <div [dataGridCell]="cell" [class]="styles.innerCell">
                                    <ng-container *dataGridCellContent />
                                </div>
                            </ng-template>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export class OrderItems {
    protected readonly styles = styles;
    protected readonly formatMoney = formatMoney;
    protected readonly itemsHeight = itemsHeight;
    protected readonly ITEM_ROW = ITEM_ROW;
    protected readonly ITEM_HEADER = ITEM_HEADER;
    protected readonly cellContext = contextOf<CellTemplateProps<Item>>();

    readonly order = input.required<Order>();

    @ViewChild("priceCell", { static: true })
    private readonly priceCell!: ItemCell;
    @ViewChild("subtotalCell", { static: true })
    private readonly subtotalCell!: ItemCell;

    readonly columns: Column<Item, DataGridNode>[] = [
        { key: "product", name: "Product", width: 150 },
        { key: "quantity", name: "Qty", width: 56 },
        {
            key: "price",
            name: "Price",
            width: 90,
            renderCell: (props) => templateContent(this.priceCell, props),
        },
        {
            key: "subtotal",
            name: "Subtotal",
            width: 100,
            renderCell: (props) => templateContent(this.subtotalCell, props),
        },
    ];
    protected readonly ITEMS_WIDTH = this.columns.reduce(
        (sum, column) => sum + column.width,
        2,
    );
}
