import type { ReactNode } from "react";
import type { HeaderCellInfo } from "../context";

/**
 * What a header cell shows by default (`DataGrid.HeaderCell` without children): its group's or
 * its column's `renderHeaderCell`, else its `name`. An app that adds its own content to a header
 * cell (a resizer) writes it first: `{headerCellContent(cell)}<Resizer cell={cell} />`.
 */
export function headerCellContent<TRow>(cell: HeaderCellInfo<TRow>): ReactNode {
    if (cell.group) {
        return cell.group.renderHeaderCell
            ? cell.group.renderHeaderCell({
                  group: cell.group,
                  columnIndex: cell.columnIndex,
                  columnSpan: cell.columnSpan,
              })
            : cell.group.name;
    }
    return cell.column.renderHeaderCell
        ? cell.column.renderHeaderCell({
              column: cell.column,
              columnIndex: cell.columnIndex,
          })
        : cell.column.name;
}
