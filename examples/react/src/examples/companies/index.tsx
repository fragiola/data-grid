"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import {
    AtSign,
    Building2,
    DollarSign,
    FileText,
    Globe,
    MapPin,
    Tags,
    Trash2,
    Users,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Avatar } from "#/components/ui/avatar";
import { Select } from "#/components/ui/select";
import {
    ARR_RANGES,
    type Company,
    companies,
    EMPLOYEE_RANGES,
    initials,
} from "../_kit/companies";
import { hash } from "../_kit/data";
import {
    CellLink,
    isSortKey,
    SelectAllHeader,
    SelectCell,
    type SortKey,
    SortLabel,
    TableProvider,
} from "./state";
import * as styles from "./styles";

const SORT_LABELS: Record<SortKey, string> = {
    name: "Company",
    domain: "Domain",
    employees: "Employee range",
    arr: "Estimated ARR",
    country: "Primary location",
};

/** A range's place in its scale; not estimated (no range) sorts first. */
function rank(
    ranges: readonly string[],
    range: string | null | undefined,
): number {
    return range ? ranges.indexOf(range) : -1;
}

const columns: Column<Company>[] = [
    {
        key: "select",
        width: 48,
        renderHeaderCell: ({ columnIndex }) => (
            <SelectAllHeader at={{ rowIndex: -1, columnIndex }} />
        ),
        renderCell: ({ row, rowIndex, columnIndex }) => (
            <SelectCell
                id={row.id}
                name={row.name}
                at={{ rowIndex, columnIndex }}
            />
        ),
    },
    {
        key: "name",
        width: 220,
        sortable: true,
        renderHeaderCell: () => (
            <SortLabel
                columnKey="name"
                icon={<Building2 aria-hidden className={styles.icon} />}
            >
                Company
            </SortLabel>
        ),
        renderCell: ({ row }) => (
            <span className={styles.company}>
                <Avatar.Root className={styles.logo}>
                    <Avatar.Fallback
                        className={styles.logoTone(hash(row.id, 6))}
                    >
                        {initials(row.name)}
                    </Avatar.Fallback>
                </Avatar.Root>
                <span className={styles.truncate}>{row.name}</span>
            </span>
        ),
    },
    {
        key: "domain",
        width: 170,
        sortable: true,
        renderHeaderCell: () => (
            <SortLabel
                columnKey="domain"
                icon={<Globe aria-hidden className={styles.icon} />}
            >
                Domain
            </SortLabel>
        ),
        renderCell: ({ row }) => (
            <span className={styles.outlineChip}>{row.domain}</span>
        ),
    },
    {
        key: "categories",
        width: 360,
        renderHeaderCell: () => (
            <span className={styles.headerLabel}>
                <Tags aria-hidden className={styles.icon} />
                Categories
            </span>
        ),
        renderCell: ({ row }) => (
            <span className={styles.chips}>
                {row.categories.map((category) => (
                    <span
                        key={category}
                        className={styles.categoryChip(category)}
                    >
                        {category}
                    </span>
                ))}
            </span>
        ),
    },
    {
        key: "description",
        width: 300,
        renderHeaderCell: () => (
            <span className={styles.headerLabel}>
                <FileText aria-hidden className={styles.icon} />
                Description
            </span>
        ),
        renderCell: ({ row }) => (
            <span className={styles.truncate} title={row.description}>
                {row.description}
            </span>
        ),
    },
    {
        key: "linkedin",
        width: 170,
        renderHeaderCell: () => (
            <span className={styles.headerLabel}>
                <AtSign aria-hidden className={styles.icon} />
                LinkedIn
            </span>
        ),
        renderCell: ({ row }) => (
            <span className={styles.outlineChip}>{row.linkedin}</span>
        ),
    },
    {
        key: "employees",
        width: 150,
        sortable: true,
        // ranges sort by their scale, not as text
        compare: (a, b) =>
            rank(EMPLOYEE_RANGES, a.employees) -
            rank(EMPLOYEE_RANGES, b.employees),
        renderHeaderCell: () => (
            <SortLabel
                columnKey="employees"
                icon={<Users aria-hidden className={styles.icon} />}
            >
                Employees
            </SortLabel>
        ),
        renderCell: ({ row }) => (
            <span
                className={styles.rangeBadge(
                    EMPLOYEE_RANGES.indexOf(row.employees),
                )}
            >
                {row.employees}
            </span>
        ),
    },
    {
        key: "arr",
        width: 160,
        sortable: true,
        compare: (a, b) => rank(ARR_RANGES, a.arr) - rank(ARR_RANGES, b.arr),
        renderHeaderCell: () => (
            <SortLabel
                columnKey="arr"
                icon={<DollarSign aria-hidden className={styles.icon} />}
            >
                Estimated ARR
            </SortLabel>
        ),
        renderCell: ({ row }) =>
            row.arr ? (
                <span className={styles.arrBadge(ARR_RANGES.indexOf(row.arr))}>
                    {row.arr}
                </span>
            ) : null,
    },
    {
        key: "country",
        width: 210,
        sortable: true,
        renderHeaderCell: () => (
            <SortLabel
                columnKey="country"
                icon={<MapPin aria-hidden className={styles.icon} />}
            >
                Primary location
            </SortLabel>
        ),
        renderCell: ({ row, rowIndex, columnIndex }) => (
            <CellLink
                href={`https://en.wikipedia.org/wiki/${encodeURIComponent(row.country)}`}
                at={{ rowIndex, columnIndex }}
            >
                {row.country}
            </CellLink>
        ),
    },
];

export default function Companies() {
    const [all, setAll] = useState(() => companies(500));
    const [selected, setSelected] = useState<ReadonlySet<number>>(
        () => new Set(),
    );
    // the rows in memory sorted by one hook: the header and the toolbar's select both set its
    // sort (the first column first, the next ones breaking ties)
    const local = useLocalRows(all, columns, {
        defaultSortColumns: [{ columnKey: "name", direction: "ascending" }],
    });
    const { rows } = local;
    const visibleIds = useMemo(() => rows.map((row) => row.id), [rows]);

    const toggle = useCallback((id: number) => {
        setSelected((current) => {
            const next = new Set(current);
            if (!next.delete(id)) next.add(id);
            return next;
        });
    }, []);
    const toggleAll = useCallback(() => {
        setSelected((current) =>
            visibleIds.every((id) => current.has(id))
                ? new Set()
                : new Set(visibleIds),
        );
    }, [visibleIds]);
    const deleteSelected = () => {
        setAll((current) => current.filter((row) => !selected.has(row.id)));
        setSelected(new Set());
    };

    const table = useMemo(
        () => ({ selected, visibleIds, toggle, toggleAll }),
        [selected, visibleIds, toggle, toggleAll],
    );

    return (
        <TableProvider value={table}>
            <div className={styles.frame}>
                <div className={styles.toolbar}>
                    <Select.Root
                        items={SORT_LABELS}
                        value={local.sort.columns[0]?.columnKey ?? null}
                        onValueChange={(key) => {
                            if (isSortKey(key)) {
                                local.sort.set([
                                    { columnKey: key, direction: "ascending" },
                                ]);
                            }
                        }}
                    >
                        <Select.Trigger
                            className={styles.sortSelect}
                            aria-label="Sorted by"
                        >
                            <span className={styles.sortLabel}>Sorted by</span>
                            <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                            {Object.entries(SORT_LABELS).map(([key, label]) => (
                                <Select.Item key={key} value={key}>
                                    {label}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select.Root>
                    <Clickable.Button
                        size="sm"
                        variant="outline"
                        disabled={selected.size === 0}
                        onClick={deleteSelected}
                    >
                        <Trash2 aria-hidden />
                        Delete selected
                    </Clickable.Button>
                    <span className={styles.count} data-testid="selected-count">
                        {selected.size} selected · {rows.length} companies
                    </span>
                </div>
                <DataGrid.Root
                    columns={columns}
                    rowKey={(row) => row.id}
                    rowHeight={44}
                    headerRowHeight={40}
                    className={styles.root}
                    {...local.props}
                >
                    <DataGrid.Grid
                        aria-label="Companies"
                        className={styles.grid}
                    >
                        <DataGrid.Header className={styles.header}>
                            <DataGrid.HeaderRow className={styles.headerRow}>
                                <DataGrid.HeaderCells<Company>>
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
                            <DataGrid.Rows<Company>>
                                {(row) => (
                                    <DataGrid.Row
                                        row={row}
                                        className={styles.row(
                                            row.row !== undefined &&
                                                selected.has(row.row.id),
                                        )}
                                    >
                                        <DataGrid.Cells<Company>>
                                            {(cell) => (
                                                <DataGrid.Cell
                                                    cell={cell}
                                                    className={styles.cell}
                                                />
                                            )}
                                        </DataGrid.Cells>
                                    </DataGrid.Row>
                                )}
                            </DataGrid.Rows>
                        </DataGrid.Body>
                    </DataGrid.Grid>
                </DataGrid.Root>
            </div>
        </TableProvider>
    );
}
