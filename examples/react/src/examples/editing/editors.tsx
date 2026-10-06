import type { EditCellRenderProps } from "@fragiola/data-grid-react";
import { type ReactNode, useLayoutEffect } from "react";
import { Input, Numeric } from "#/components/atoms/fields";
import { Select } from "#/components/ui/select";
import { amountOf, isStatus } from "../_kit/budgeted-tasks";
import { STATUSES } from "../_kit/tasks";

// The app's editors: what an edited cell shows (a column's `renderEditCell`), each given the
// draft and the ways to change, commit and cancel it, and its look by its caller (`className`).

type EditorProps<TRow> = EditCellRenderProps<TRow, ReactNode> & {
    className?: string;
};

const STATUS_ITEMS = Object.fromEntries(
    STATUSES.map((status) => [status, status]),
);

/** An edit typing started: the editor starts from the key typed, as a spreadsheet does. */
function useStartKey(
    startKey: string | undefined,
    onChange: (value: unknown) => void,
) {
    useLayoutEffect(() => {
        if (startKey !== undefined) onChange(startKey);
    }, [startKey, onChange]);
}

/** A text field. */
export function TextEditor<TRow>({
    value,
    startKey,
    onChange,
    column,
    className,
}: EditorProps<TRow>) {
    useStartKey(startKey, onChange);
    return (
        <Input
            aria-label={column.name}
            value={String(value ?? "")}
            onValueChange={(text) => onChange(text)}
            className={className}
        />
    );
}

/**
 * An amount: a number. A value that is no amount keeps the edit open: the editor prevents Enter
 * and Tab (its own handler runs before the grid's), and says so.
 */
export function AmountEditor<TRow>({
    value,
    startKey,
    onChange,
    column,
    className,
}: EditorProps<TRow>) {
    useStartKey(
        startKey !== undefined && /\d/.test(startKey) ? startKey : undefined,
        onChange,
    );
    const valid = amountOf(value) !== undefined;
    return (
        <Numeric
            aria-label={column.name}
            aria-invalid={!valid}
            min={0}
            step={100}
            value={String(value ?? "")}
            onValueChange={(text) => onChange(text)}
            onKeyDown={(event) => {
                if (!valid && (event.key === "Enter" || event.key === "Tab")) {
                    event.preventDefault();
                }
            }}
            className={className}
        />
    );
}

/**
 * A status: a select, open as the edit starts; choosing one commits it. Its list is portalled out
 * of the grid: marked as the edit's (`editorProps`), a press or focus there keeps it open.
 */
export function StatusEditor<TRow>({
    value,
    onCommit,
    column,
    editorProps,
    className,
}: EditorProps<TRow>) {
    return (
        <Select.Root
            items={STATUS_ITEMS}
            value={String(value)}
            defaultOpen
            onValueChange={(status) => {
                if (isStatus(status)) onCommit(status);
            }}
        >
            <Select.Trigger aria-label={column.name} className={className}>
                <Select.Value />
            </Select.Trigger>
            <Select.Content {...editorProps}>
                {STATUSES.map((status) => (
                    <Select.Item key={status} value={status}>
                        {status}
                    </Select.Item>
                ))}
            </Select.Content>
        </Select.Root>
    );
}

/** A date: the browser's date field. */
export function DateEditor<TRow>({
    value,
    onChange,
    column,
    className,
}: EditorProps<TRow>) {
    return (
        <Input
            type="date"
            aria-label={column.name}
            value={String(value ?? "")}
            onValueChange={(date) => onChange(date)}
            className={className}
        />
    );
}
