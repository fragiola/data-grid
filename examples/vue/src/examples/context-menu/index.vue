<script setup lang="ts">
import {
    type CellPosition,
    type Column,
    typedDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { ArrowDownToLine, ArrowUpToLine, Trash2 } from "@lucide/vue";
import {
    type ComponentPublicInstance,
    nextTick,
    ref,
    shallowRef,
    type VNodeChild,
} from "vue";
import { ContextMenu } from "#/components/ui/context-menu";
import { type Task, task, tasks } from "../_kit/tasks";
import * as styles from "./styles";
import { useTouchHold } from "./use-touch-hold";

// The menu is the app's (Fragiola UI's context menu, over Reka UI): the grid renders none. A
// body cell's own listeners say which row the menu acts on: `@contextmenu` (a right click,
// Shift+F10 or the menu key on the focused cell, a long press where the browser fires it) and
// `@touchstart` (a long press, timed by Reka UI from the touch's pointer, or by the app from the
// touch itself: `use-touch-hold.ts`). The menu opens only for a body cell, never over the header,
// and makes that cell active. Closing it focuses the grid, which hands focus to its active cell.

// cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
const features = [navigation()] as const;

const DataGrid = typedDataGrid<Task, typeof features>();

const columns: Column<Task, VNodeChild>[] = [
    { key: "id", name: "#", width: 72 },
    { key: "name", name: "Task", width: 240 },
    { key: "project", name: "Project", width: 120 },
    { key: "status", name: "Status", width: 130 },
    { key: "assignee", name: "Assignee", width: 110 },
    { key: "due", name: "Due", width: 120 },
];

// the app's rows: the menu changes them, the grid shows them
const rows = shallowRef<readonly Task[]>(tasks(200));
let nextId = rows.value.length + 1;
const target = shallowRef<CellPosition | null>(null);
// the cell a context menu event came from, until the menu asks to open
let pressed: CellPosition | null = null;
const announcement = ref("");

const gridRef = useDataGridRef<Task, typeof features>();
const gridElement = ref<ComponentPublicInstance | null>(null);
const touch = useTouchHold();

const rowKey = (row: Task) => row.id;

/** Records the cell a context menu would open for. */
function press(cell: CellPosition) {
    pressed = { rowIndex: cell.rowIndex, columnIndex: cell.columnIndex };
}

/** A touch on a cell: the row a long press would act on, and the press timed. */
function touchCell(event: TouchEvent, cell: CellPosition) {
    press(cell);
    touch.hold(event);
}

// before a cell's own listener: a press outside the body's cells (the header) leaves no row from
// an earlier one
function forget() {
    pressed = null;
}

function openChange(open: boolean) {
    // the menu opens for a body cell only (`pressed`, set by its listener first), and makes it
    // the active cell
    const at = open ? pressed : null;
    if (at) gridRef.current?.model.run("active-position.set", at);
    target.value = at;
    pressed = null;
}

/**
 * Changes the rows, renders them (so the grid has them), then makes `active` the active cell;
 * `null` (no row left) clears it, and the menu's focus goes to the grid itself.
 */
async function change(
    next: readonly Task[],
    active: CellPosition | null,
    what: string,
) {
    rows.value = next;
    await nextTick();
    if (active) gridRef.current?.model.run("active-position.set", active);
    else gridRef.current?.model.run("active-position.clear", {});
    announcement.value = what;
}

function insert(at: number, columnIndex: number) {
    // a new task, its id the next one
    const row = task(nextId - 1);
    nextId += 1;
    void change(
        [...rows.value.slice(0, at), row, ...rows.value.slice(at)],
        { rowIndex: at, columnIndex },
        `Inserted task ${row.id} at row ${at + 1}.`,
    );
}

function remove(at: number, columnIndex: number) {
    const removed = rows.value[at];
    const next = [...rows.value.slice(0, at), ...rows.value.slice(at + 1)];
    void change(
        next,
        // the row now at its place, else the one above; none left, no active cell
        next.length === 0
            ? null
            : { rowIndex: Math.min(at, next.length - 1), columnIndex },
        `Deleted task ${removed?.id}.`,
    );
}

/** Closed, focus goes to the grid (React's `finalFocus`): the grid hands it to its active cell. */
function focusGrid(event: Event) {
    event.preventDefault();
    const element = gridElement.value?.$el;
    if (element instanceof HTMLElement) element.focus();
}
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span>
                Right-click a row, or press
                <kbd :class="styles.key">Shift</kbd>+<kbd :class="styles.key"
                    >F10</kbd
                >
                on a cell
            </span>
            <!-- the app's live region: what the last action did -->
            <span role="status" :class="styles.status">{{ announcement }}</span>
        </div>
        <ContextMenu.Root :open="target !== null" @update:open="openChange">
            <ContextMenu.Trigger
                as="div"
                :class="styles.trigger"
                @contextmenu.capture="forget"
                @touchstart.capture="forget"
                @touchmove="touch.release"
                @touchend="touch.release"
                @touchcancel="touch.release"
            >
                <DataGrid.Root
                    :features="features"
                    :grid-ref="gridRef"
                    :columns="columns"
                    :rows="rows"
                    :row-key="rowKey"
                    :row-height="36"
                    :class="styles.root"
                >
                    <DataGrid.Grid
                        ref="gridElement"
                        aria-label="Tasks"
                        :class="styles.grid"
                    >
                        <DataGrid.Header :class="styles.header">
                            <DataGrid.HeaderRow :class="styles.headerRow">
                                <DataGrid.HeaderCells v-slot="{ cell }">
                                    <DataGrid.HeaderCell
                                        :cell="cell"
                                        :class="styles.headerCell"
                                    />
                                </DataGrid.HeaderCells>
                            </DataGrid.HeaderRow>
                        </DataGrid.Header>
                        <DataGrid.Body>
                            <DataGrid.Rows v-slot="{ row }">
                                <DataGrid.Row
                                    :row="row"
                                    :class="styles.row(row)"
                                >
                                    <DataGrid.Cells v-slot="{ cell }">
                                        <!-- the row a menu would act on: a right click, the
                                             menu key, or a touch that may become a long press -->
                                        <DataGrid.Cell
                                            :cell="cell"
                                            :class="
                                                styles.cell(
                                                    target?.rowIndex ===
                                                        cell.rowIndex,
                                                )
                                            "
                                            @contextmenu="press(cell)"
                                            @touchstart="
                                                touchCell($event, cell)
                                            "
                                        />
                                    </DataGrid.Cells>
                                </DataGrid.Row>
                            </DataGrid.Rows>
                        </DataGrid.Body>
                    </DataGrid.Grid>
                </DataGrid.Root>
            </ContextMenu.Trigger>
            <!-- closed, focus goes to the grid: the grid hands it to its active cell -->
            <ContextMenu.Content @close-auto-focus="focusGrid">
                <template v-if="target">
                    <ContextMenu.Item
                        @select="insert(target.rowIndex, target.columnIndex)"
                    >
                        <ArrowUpToLine aria-hidden="true" />
                        Insert row above
                    </ContextMenu.Item>
                    <ContextMenu.Item
                        @select="
                            insert(target.rowIndex + 1, target.columnIndex)
                        "
                    >
                        <ArrowDownToLine aria-hidden="true" />
                        Insert row below
                    </ContextMenu.Item>
                    <ContextMenu.Separator />
                    <ContextMenu.Item
                        :class="styles.danger"
                        :disabled="rows.length === 1"
                        @select="remove(target.rowIndex, target.columnIndex)"
                    >
                        <Trash2 aria-hidden="true" />
                        Delete row
                    </ContextMenu.Item>
                </template>
            </ContextMenu.Content>
        </ContextMenu.Root>
    </div>
</template>
