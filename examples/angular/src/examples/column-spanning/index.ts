import {
    ChangeDetectionStrategy,
    Component,
    type TemplateRef,
    ViewChild,
} from "@angular/core";
import {
    type Column,
    contextOf,
    DATA_GRID,
    type DataGridNode,
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import { columnPinning } from "@fragiola/data-grid-angular/column-pinning";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { cellSpans } from "@fragiola/data-grid-angular/spans";
import {
    bookingAt,
    FIRST_HOUR,
    HOURS,
    type Room,
    rooms,
    time,
} from "./bookings";
import * as styles from "./styles";

/** What a booking's cell shows: its title and its range of hours. */
interface BookingContext {
    title: string;
    range: string;
}

@Component({
    selector: "example-column-spanning",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div
                dataGridRoot
                [features]="features"
                [columns]="columns"
                [rows]="rooms"
                [rowKey]="rowKey"
                [rowHeight]="44"
                [class]="styles.root"
            >
                <ng-template
                    #bookingCell
                    [dataGridTemplate]="bookingContext"
                    let-title="title"
                    let-range="range"
                >
                    <span [class]="styles.booking">
                        <span [class]="styles.title">{{ title }}</span>
                        <span [class]="styles.time">{{ range }}</span>
                    </span>
                </ng-template>
                <div dataGridGrid aria-label="Room bookings" [class]="styles.grid">
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
                                        [class]="cell.column.meta?.numeric ? styles.numeric : styles.cell"
                                    >
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
export default class ColumnSpanning {
    // the features the grid installs: cell navigation (the keys, the active cell, the tab stop),
    // pinned columns (without it, every column scrolls), column spans (a column's `colSpan`)
    readonly features = [navigation(), columnPinning(), cellSpans()];
    protected readonly styles = styles;

    protected readonly bookingContext = contextOf<BookingContext>();
    @ViewChild("bookingCell", { static: true })
    private readonly bookingCell!: TemplateRef<TemplateContext<BookingContext>>;

    /**
     * An hour of the day: a booking starting at it spans the hours it takes (the grid renders no
     * cell for the hours it covers), and the header groups the hours two by two.
     */
    private hourColumn(hour: number): Column<Room, DataGridNode> {
        return {
            key: `h${hour}`,
            name: `${time(hour)}–${time(hour + 2)}`,
            width: 96,
            colSpan: (args) => {
                if (args.type === "header") {
                    return (hour - FIRST_HOUR) % 2 === 0 ? 2 : undefined;
                }
                return args.type === "row"
                    ? bookingAt(args.row, hour)?.hours
                    : undefined;
            },
            renderCell: ({ row }) => {
                const booking = bookingAt(row, hour);
                return booking
                    ? templateContent(this.bookingCell, {
                          title: booking.title,
                          range: `${time(booking.start)}–${time(booking.start + booking.hours)}`,
                      })
                    : null;
            },
        };
    }

    // the room pinned at the start, the hours booked at the end; a booking never reaches into
    // them: a span stays inside its part
    readonly columns: Column<Room, DataGridNode>[] = [
        { key: "name", name: "Room", width: 120, pinned: "start" },
        ...Array.from({ length: HOURS }, (_, index) =>
            this.hourColumn(FIRST_HOUR + index),
        ),
        {
            key: "booked",
            name: "Booked",
            width: 96,
            pinned: "end",
            renderCell: ({ row }) => `${row.booked} h`,
            meta: { numeric: true },
        },
    ];

    readonly rooms = rooms;

    readonly rowKey = (row: Room) => row.id;
}
