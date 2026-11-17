import {
    ChangeDetectionStrategy,
    Component,
    computed,
    signal,
    type TemplateRef,
    viewChild,
} from "@angular/core";
import {
    type CellRange,
    type CellTemplateProps,
    type Column,
    contextOf,
    DATA_GRID,
    type DataGridNode,
    type RangePaste,
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import { formatMoney, hash, person } from "../_kit/data";
import * as styles from "./styles";

// A year's budget, a line per row: the grid selects ranges of cells, copies them as TSV and tells
// each paste; the app sums what is selected and writes what is pasted into its own rows.

interface Line {
    id: number;
    item: string;
    owner: { readonly name: string };
    /** the amount of each month, January first */
    amounts: readonly number[];
}

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

const ITEMS = [
    "Cloud hosting",
    "Office rent",
    "Laptops",
    "Travel",
    "Training",
    "Software licences",
    "Marketing",
    "Events",
    "Contractors",
    "Recruiting",
];

function line(index: number): Line {
    return {
        id: index + 1,
        item: `${ITEMS[index % ITEMS.length]} ${Math.floor(index / ITEMS.length) + 1}`,
        owner: { name: person(index).name },
        amounts: MONTHS.map(
            (_, month) => 100 * (5 + hash(index * 13 + month, 120)),
        ),
    };
}

const budget = Array.from({ length: 60 }, (_, index) => line(index));

const totalOf = (row: Line) =>
    row.amounts.reduce((total, amount) => total + amount, 0);

type LineColumn = Column<Line, DataGridNode>;

/** A range's rows and columns, first to last, whichever corner it was started from. */
function boundsOf({ anchor, focus }: CellRange) {
    return {
        top: Math.min(anchor.rowIndex, focus.rowIndex),
        bottom: Math.max(anchor.rowIndex, focus.rowIndex),
        start: Math.min(anchor.columnIndex, focus.columnIndex),
        end: Math.max(anchor.columnIndex, focus.columnIndex),
    };
}

/** What the app says of a range: its size and the sum of its amounts (the totals included). */
function describeRange(
    columns: readonly LineColumn[],
    rows: readonly Line[],
    range: CellRange,
): string {
    const { top, bottom, start, end } = boundsOf(range);
    let sum = 0;
    for (let rowIndex = top; rowIndex <= bottom; rowIndex++) {
        const row = rows[rowIndex];
        for (let index = start; index <= end; index++) {
            const value = row && columns[index]?.getValue?.(row, rowIndex);
            if (typeof value === "number") sum += value;
        }
    }
    return `${bottom - top + 1} × ${end - start + 1} cells · Sum ${formatMoney(sum)}`;
}

/** A pasted text as an amount: digits, a sign and decimals ($ and commas dropped), else none. */
function amountOf(text: string): number | undefined {
    const cleaned = text.replace(/[$,\s]/g, "");
    return /^-?\d+(\.\d+)?$/.test(cleaned)
        ? Math.round(Number(cleaned))
        : undefined;
}

/**
 * The rows with a paste written into them, as the app's rules say: a line's name and its owner as
 * text, a month's amount when the text is one (else left as it was, counted).
 */
function withPaste(
    columns: readonly LineColumn[],
    rows: readonly Line[],
    { range, values }: RangePaste,
): { rows: Line[]; skipped: number } {
    const next = [...rows];
    let skipped = 0;
    values.forEach((texts, offset) => {
        const rowIndex = range.anchor.rowIndex + offset;
        const current = next[rowIndex];
        if (!current) return;
        let item = current.item;
        let owner = current.owner;
        const amounts = [...current.amounts];
        texts.forEach((text, at) => {
            const key = columns[range.anchor.columnIndex + at]?.key ?? "";
            if (key === "item") item = text;
            else if (key === "owner") owner = { name: text };
            else if (key.startsWith("m")) {
                const amount = amountOf(text);
                if (amount === undefined) skipped += 1;
                else amounts[Number(key.slice(1))] = amount;
            }
        });
        next[rowIndex] = { ...current, item, owner, amounts };
    });
    return { rows: next, skipped };
}

type LineCell = TemplateRef<TemplateContext<CellTemplateProps<Line>>>;

@Component({
    selector: "example-cell-selection",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span>
                    <kbd [class]="styles.key">Shift</kbd> + arrows or a drag select;
                    <kbd [class]="styles.key">Ctrl/⌘</kbd>
                    <kbd [class]="styles.key">C</kbd> copies,
                    <kbd [class]="styles.key">Ctrl/⌘</kbd>
                    <kbd [class]="styles.key">V</kbd> pastes
                </span>
                <span [class]="styles.summary">{{ summary() }}</span>
                <!-- the app's live region: a polite status, its text the app's own -->
                <span role="status" [class]="styles.status">{{ announcement() }}</span>
            </div>
            <div
                dataGridRoot
                [columns]="columns"
                [rows]="rows()"
                [rowKey]="rowKey"
                [rowHeight]="36"
                cellSelection="range"
                [(selectedRange)]="range"
                [beforeRangePaste]="beforePaste"
                (rangePaste)="writePaste($event)"
                [class]="styles.root"
            >
                <ng-template #ownerCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.owner">{{ row.owner.name }}</span>
                </ng-template>
                <ng-template #totalCell [dataGridTemplate]="cellContext" let-value="value">
                    <span [class]="styles.total">{{ money(value) }}</span>
                </ng-template>
                <div dataGridGrid aria-label="Budget" [class]="styles.grid">
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
                                    <div [dataGridCell]="cell" [class]="styles.cell(cell)">
                                        <ng-container *dataGridCellContent />
                                    </div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            </div>
        </div>
    `,
})
export default class CellSelection {
    protected readonly styles = styles;
    protected readonly cellContext = contextOf<CellTemplateProps<Line>>();
    private readonly ownerCell = viewChild.required<LineCell>("ownerCell");
    private readonly totalCell = viewChild.required<LineCell>("totalCell");

    readonly columns: LineColumn[] = [
        { key: "item", name: "Line", width: 180, pinned: "start" },
        {
            key: "owner",
            name: "Owner",
            width: 150,
            getValue: (row) => row.owner,
            renderCell: (props) => templateContent(this.ownerCell(), props),
            // the value is an object: the clipboard gets its name (without it, nothing)
            getCopyText: ({ row }) => row.owner.name,
        },
        ...MONTHS.map(
            (name, month): LineColumn => ({
                key: `m${month}`,
                name,
                width: 96,
                getValue: (row) => row.amounts[month] ?? 0,
                // shown as money, copied as the number it is (its value as text)
                renderCell: ({ value }) => formatMoney(Number(value)),
            }),
        ),
        {
            key: "total",
            name: "Total",
            width: 120,
            pinned: "end",
            getValue: totalOf,
            renderCell: (props) => templateContent(this.totalCell(), props),
        },
    ];

    private readonly TOTAL = this.columns.length - 1;

    // the app's rows: the grid never writes them, a paste is told
    readonly rows = signal<readonly Line[]>(budget);
    // the range, controlled: the app sums it as it changes
    readonly range = signal<CellRange | null>(null);
    readonly announcement = signal("");

    protected readonly summary = computed(() => {
        const range = this.range();
        return range
            ? describeRange(this.columns, this.rows(), range)
            : "No range selected";
    });

    readonly rowKey = (row: Line) => row.id;

    protected money(value: unknown): string {
        return formatMoney(Number(value));
    }

    // the totals are worked out: a paste reaching them is refused whole
    readonly beforePaste = (paste: RangePaste) => {
        if (boundsOf(paste.range).end < this.TOTAL) return true;
        this.announcement.set(
            "Totals are worked out from the months: paste into the lines, owners or months.",
        );
        return false;
    };

    protected writePaste(paste: RangePaste) {
        const { rows: next, skipped } = withPaste(
            this.columns,
            this.rows(),
            paste,
        );
        this.rows.set(next);
        const count = paste.values.length * (paste.values[0]?.length ?? 0);
        this.announcement.set(
            `Pasted ${count} ${count === 1 ? "cell" : "cells"}${
                skipped > 0
                    ? `; ${skipped} not an amount, left as ${skipped === 1 ? "it was" : "they were"}`
                    : ""
            }.`,
        );
    }
}
