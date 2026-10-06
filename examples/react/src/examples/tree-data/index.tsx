"use client";

import {
    type CellInfo,
    type Column,
    DataGrid,
    type RowKey,
    useGroupToggle,
} from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import { useSelectAll } from "@fragiola/data-grid-react/selection";
import { ChevronRight, FileText, Folder, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { Checkbox } from "#/components/ui/checkbox";
import { Switch } from "#/components/ui/switch";
import { createFakeApi } from "../_kit/fake-api";
import { type Entry, FILES, formatSize } from "./files";
import { useLazyTree } from "./lazy";
import * as styles from "./styles";

const columns: Column<Entry>[] = [
    { key: "select", width: 44, pinned: "start" },
    { key: "name", name: "Name", width: 300, pinned: "start", sortable: true },
    {
        key: "size",
        name: "Size",
        width: 110,
        sortable: true,
        renderCell: ({ row }) => formatSize(row.size),
    },
    { key: "modified", name: "Modified", width: 130, sortable: true },
    {
        key: "kind",
        name: "Kind",
        width: 100,
        getValue: (entry) => (entry.kind === "folder" ? "Folder" : "File"),
    },
];

/** A folder's entries, in memory. */
const getSubRows = (entry: Entry) => entry.children;

/** An entry's key: its path, unique at every depth. */
const rowKey = (entry: Entry) => entry.id;

/** The keys under a row (in memory: a folder's entries at every depth; none loaded lazily). */
type SubRowKeysOf = (rowIndex: number) => readonly RowKey[];

const NONE: SubRowKeysOf = () => [];

/**
 * An entry's checkbox: the entry and everything under it (a folder's at every depth, the
 * collapsed ones too), all of them, some (indeterminate) or none. The grid selects one row at a
 * time; the app adds a folder's entries, here with `useSelectAll` over their keys.
 */
function SelectEntry({
    cell,
    subRowKeysOf,
}: {
    cell: CellInfo<Entry>;
    subRowKeysOf: SubRowKeysOf;
}) {
    const id = cell.row?.id;
    const keys = useMemo(
        () => (id === undefined ? [] : [id, ...subRowKeysOf(cell.rowIndex)]),
        [id, subRowKeysOf, cell.rowIndex],
    );
    const all = useSelectAll(keys);
    if (id === undefined) return null;
    return (
        <Checkbox.Root
            aria-label={`Select ${cell.row?.name}`}
            checked={all.status === "all"}
            indeterminate={all.status === "some"}
            onCheckedChange={all.toggle}
        >
            <Checkbox.Indicator />
        </Checkbox.Root>
    );
}

/** An entry's name: indented by its depth, a folder's toggle (`useGroupToggle`) before it. */
function NameCell({ cell, depth }: { cell: CellInfo<Entry>; depth: number }) {
    const { state, props } = useGroupToggle(cell);
    const entry = cell.row;
    if (!entry) return <span className={styles.name(depth)} />;
    const Icon = entry.kind === "folder" ? Folder : FileText;
    return (
        <span className={styles.name(depth)}>
            {state.expandable ? (
                <button
                    type="button"
                    {...props}
                    aria-label={`${state.expanded ? "Collapse" : "Expand"} ${entry.name}`}
                    className={styles.toggle}
                >
                    <ChevronRight
                        aria-hidden
                        className={styles.chevron(state.expanded)}
                    />
                </button>
            ) : (
                <span className={styles.spacer} />
            )}
            <Icon aria-hidden className={styles.icon(entry.kind)} />
            <span className={styles.label}>{entry.name}</span>
        </span>
    );
}

/** The grid's parts, the same for both modes: a header row and the rows' cells. */
function FileGrid({ subRowKeysOf }: { subRowKeysOf: SubRowKeysOf }) {
    return (
        <DataGrid.Grid aria-label="Files" className={styles.grid}>
            <DataGrid.Header className={styles.header}>
                <DataGrid.HeaderRow className={styles.headerRow}>
                    <DataGrid.HeaderCells<Entry>>
                        {(cell) => (
                            <DataGrid.HeaderCell
                                cell={cell}
                                className={styles.headerCell}
                            />
                        )}
                    </DataGrid.HeaderCells>
                </DataGrid.HeaderRow>
            </DataGrid.Header>
            <DataGrid.Body>
                <DataGrid.Rows<Entry>>
                    {(row) => (
                        <DataGrid.Row row={row} className={styles.row}>
                            <DataGrid.Cells<Entry>>
                                {(cell) => (
                                    <DataGrid.Cell
                                        cell={cell}
                                        className={styles.cell}
                                    >
                                        {cell.column.key === "select" ? (
                                            <SelectEntry
                                                cell={cell}
                                                subRowKeysOf={subRowKeysOf}
                                            />
                                        ) : cell.column.key === "name" ? (
                                            <NameCell
                                                cell={cell}
                                                depth={row.depth}
                                            />
                                        ) : undefined}
                                    </DataGrid.Cell>
                                )}
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    )}
                </DataGrid.Rows>
            </DataGrid.Body>
        </DataGrid.Grid>
    );
}

/** The files in memory: one hook makes the tree, searches it (a match's folders stay) and sorts it. */
function InMemory() {
    const local = useLocalRows(FILES, columns, {
        getSubRows,
        rowKey,
        defaultExpandedGroupKeys: ["src"],
    });
    const { subRowKeysOf } = local.group;
    return (
        <>
            <div className={styles.toolbar}>
                <Input.Template.Simple
                    aria-label="Search files"
                    placeholder="Search"
                    value={local.filter.search}
                    onValueChange={local.filter.setSearch}
                    inset={{
                        start: (
                            <Search aria-hidden className={styles.searchIcon} />
                        ),
                    }}
                    className={styles.search}
                />
                <Clickable.Button
                    size="sm"
                    variant="ghost"
                    onClick={local.group.expandAll}
                >
                    Expand all
                </Clickable.Button>
                <Clickable.Button
                    size="sm"
                    variant="ghost"
                    onClick={local.group.collapseAll}
                >
                    Collapse all
                </Clickable.Button>
                <span className={styles.count}>
                    {local.filteredCount} of {local.total} entries
                </span>
            </div>
            <DataGrid.Root
                {...local.props}
                columns={columns}
                rowHeight={34}
                rowSelection="multiple"
                className={styles.root}
            >
                <FileGrid subRowKeysOf={subRowKeysOf} />
            </DataGrid.Root>
        </>
    );
}

/** The same files listed by a server, folder by folder, as they are expanded. */
function Lazy() {
    const [api] = useState(() => createFakeApi(600));
    const tree = useLazyTree(api);
    return (
        <DataGrid.Root
            {...tree}
            columns={columns}
            rowHeight={34}
            rowSelection="multiple"
            className={styles.root}
        >
            <FileGrid subRowKeysOf={NONE} />
        </DataGrid.Root>
    );
}

export default function TreeData() {
    const [lazy, setLazy] = useState(false);
    const lazyLabel = useId();
    return (
        <div className={styles.frame}>
            <div className={styles.modes}>
                <span className={styles.mode}>
                    <Switch.Root
                        aria-labelledby={lazyLabel}
                        checked={lazy}
                        onCheckedChange={setLazy}
                    >
                        <Switch.Thumb />
                    </Switch.Root>
                    <span id={lazyLabel}>Load folders from a server</span>
                </span>
                <span>
                    <kbd className={styles.key}>Space</kbd> opens a folder,{" "}
                    <kbd className={styles.key}>→</kbd>{" "}
                    <kbd className={styles.key}>←</kbd> on its name
                </span>
            </div>
            {lazy ? <Lazy /> : <InMemory />}
        </div>
    );
}
