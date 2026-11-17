import { DataGridBind } from "./directives/bind.directive";
import { DataGridBody } from "./directives/body.directive";
import { DataGridCell } from "./directives/cell.directive";
import { DataGridCellContent } from "./directives/cell-content.directive";
import { DataGridCellEdit } from "./directives/cell-edit.directive";
import { DataGridCells } from "./directives/cells.directive";
import { DataGridColumnResizer } from "./directives/column-resizer.directive";
import { DataGridEmpty } from "./directives/empty.directive";
import { DataGridFillHandle } from "./directives/fill-handle.directive";
import { DataGridGrid } from "./directives/grid.directive";
import { DataGridGroupLabel } from "./directives/group-label.directive";
import { DataGridGroupToggle } from "./directives/group-toggle.directive";
import { DataGridHeader } from "./directives/header.directive";
import { DataGridHeaderCell } from "./directives/header-cell.directive";
import { DataGridHeaderCells } from "./directives/header-cells.directive";
import { DataGridHeaderRow } from "./directives/header-row.directive";
import { DataGridHeaderRows } from "./directives/header-rows.directive";
import { DataGridRoot } from "./directives/root.directive";
import { DataGridRow } from "./directives/row.directive";
import { DataGridRowDetail } from "./directives/row-detail.directive";
import { DataGridRowDragHandle } from "./directives/row-drag-handle.directive";
import { DataGridRows } from "./directives/rows.directive";
import { DataGridSummary } from "./directives/summary.directive";
import { DataGridSummaryCell } from "./directives/summary-cell.directive";
import { DataGridSummaryCells } from "./directives/summary-cells.directive";
import { DataGridSummaryRow } from "./directives/summary-row.directive";
import { DataGridSummaryRows } from "./directives/summary-rows.directive";
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
    DataGridRowDetail,
    DataGridSummary,
    DataGridSummaryRows,
    DataGridSummaryRow,
    DataGridSummaryCells,
    DataGridSummaryCell,
    DataGridColumnResizer,
    DataGridRowDragHandle,
    DataGridFillHandle,
    DataGridGroupToggle,
    DataGridGroupLabel,
    DataGridCellEdit,
    DataGridTemplate,
    DataGridBind,
] as const;
