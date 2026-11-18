import { DataGridBind } from "./directives/bind.directive";
import { DataGridBody } from "./directives/body.directive";
import { DataGridCell } from "./directives/cell.directive";
import { DataGridCellContent } from "./directives/cell-content.directive";
import { DataGridCells } from "./directives/cells.directive";
import { DataGridEmpty } from "./directives/empty.directive";
import { DataGridGrid } from "./directives/grid.directive";
import { DataGridGroupLabel } from "./directives/group-label.directive";
import { DataGridHeader } from "./directives/header.directive";
import { DataGridHeaderCell } from "./directives/header-cell.directive";
import { DataGridHeaderCells } from "./directives/header-cells.directive";
import { DataGridHeaderRow } from "./directives/header-row.directive";
import { DataGridHeaderRows } from "./directives/header-rows.directive";
import { DataGridRoot } from "./directives/root.directive";
import { DataGridRow } from "./directives/row.directive";
import { DataGridRows } from "./directives/rows.directive";
import { DataGridTemplate } from "./directives/template.directive";

/**
 * Every data grid directive, for a standalone component's `imports`:
 * `@Component({ imports: [DATA_GRID], … })` (React's `DataGrid` namespace).
 */
export const DATA_GRID = [
    DataGridRoot,
    DataGridGrid,
    DataGridHeader,
    DataGridHeaderRows,
    DataGridHeaderRow,
    DataGridHeaderCells,
    DataGridHeaderCell,
    DataGridEmpty,
    DataGridBody,
    DataGridRows,
    DataGridRow,
    DataGridCells,
    DataGridCell,
    DataGridCellContent,
    DataGridGroupLabel,
    DataGridTemplate,
    DataGridBind,
] as const;
