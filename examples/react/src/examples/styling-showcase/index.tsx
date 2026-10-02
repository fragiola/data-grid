"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { useMemo, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { type Project, projects, STATUS_LABELS } from "../_kit/portfolio";
import * as styles from "./styles";

const rows = projects(300);

/** The columns, rendered through the preset in use: the markup never changes, only classes. */
function columnsFor(preset: styles.Preset): Column<Project>[] {
    return [
        { key: "id", name: "#", width: 64 },
        { key: "name", name: "Project", width: 160 },
        { key: "owner", name: "Owner", width: 170 },
        {
            key: "status",
            name: "Status",
            width: 120,
            renderCell: ({ row }) => (
                <span className={preset.status(row.status)}>
                    {STATUS_LABELS[row.status]}
                </span>
            ),
        },
        { key: "score", name: "Health", width: 100 },
        {
            key: "delta",
            name: "Change",
            width: 96,
            renderCell: ({ row }) => (
                <span className={preset.delta(row.delta)}>
                    {row.delta > 0 ? `+${row.delta}` : row.delta}
                </span>
            ),
        },
        {
            key: "shipped",
            name: "Shipped",
            width: 90,
            renderCell: ({ row }) => (
                <span className={preset.shipped(row.shipped)}>
                    {row.shipped ? "✓" : "✗"}
                </span>
            ),
        },
        {
            key: "tag",
            name: "Area",
            width: 120,
            renderCell: ({ row }) => (
                <span className={preset.tag(row.tag)}>{row.tag}</span>
            ),
        },
    ];
}

export default function StylingShowcase() {
    const [name, setName] = useState<styles.PresetName>("spreadsheet");
    const preset = styles.PRESETS[name];
    const columns = useMemo(() => columnsFor(preset), [preset]);
    return (
        <div className={styles.frame}>
            <fieldset className={styles.toolbar}>
                <legend className={styles.legend}>Style</legend>
                {styles.PRESET_NAMES.map((key) => (
                    <Clickable.Button
                        key={key}
                        size="sm"
                        variant="ghost"
                        aria-pressed={key === name}
                        className={styles.presetButton}
                        onClick={() => setName(key)}
                    >
                        {styles.PRESETS[key].title}
                    </Clickable.Button>
                ))}
            </fieldset>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={preset.rowHeight}
                defaultActivePosition={{ rowIndex: 0, columnIndex: 1 }}
                className={preset.root}
                data-preset={name}
            >
                <DataGrid.Grid aria-label="Projects">
                    <DataGrid.Header className={preset.header}>
                        <DataGrid.HeaderRow className={preset.headerRow}>
                            <DataGrid.HeaderCells<Project>>
                                {(cell) => (
                                    <DataGrid.HeaderCell
                                        cell={cell}
                                        className={(state) =>
                                            preset.headerCell(
                                                state,
                                                styles.columnKey(cell.key),
                                            )
                                        }
                                    />
                                )}
                            </DataGrid.HeaderCells>
                        </DataGrid.HeaderRow>
                    </DataGrid.Header>
                    <DataGrid.Body>
                        <DataGrid.Rows<Project>>
                            {(row) => (
                                <DataGrid.Row
                                    row={row}
                                    className={(state) =>
                                        preset.row(state, row.row?.status)
                                    }
                                >
                                    <DataGrid.Cells<Project>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                className={styles.cellClass(
                                                    preset,
                                                    styles.columnKey(
                                                        cell.column.key,
                                                    ),
                                                    cell.row?.score,
                                                )}
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
    );
}
