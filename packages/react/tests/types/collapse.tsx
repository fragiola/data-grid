// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import {
    type ColumnGroup,
    DataGrid,
    type GroupShow,
    type HeaderCellInfo,
    useGroupLabel,
    useHeaderCell,
} from "../../src";

interface Person {
    id: string;
    age: number;
}

const show: GroupShow = "collapsed";

export const group: ColumnGroup<Person> = {
    key: "g",
    collapsible: true,
    children: [
        { key: "id", width: 60 },
        { key: "age", width: 60, groupShow: show },
    ],
};
declare const people: Person[];

export function People({ keys }: { keys: readonly string[] }) {
    return (
        <DataGrid.Root
            columns={[group]}
            rows={people}
            collapsedGroupKeys={keys}
            onCollapsedGroupKeysChange={(next) => {
                const first: string | undefined = next[0];
                void first;
                // @ts-expect-error: the keys the grid gives are read, never written
                next.push("g");
            }}
        />
    );
}

export function Wrong() {
    return (
        <DataGrid.Root
            columns={[group]}
            rows={people}
            // @ts-expect-error: collapsed groups are keys
            defaultCollapsedGroupKeys={[0]}
        />
    );
}

export function Label({ cell }: { cell: HeaderCellInfo<Person> }) {
    const { state } = useHeaderCell(cell);
    const collapsed: boolean | undefined = state.collapsed;
    // @ts-expect-error: undefined for a cell that does not collapse
    const always: boolean = state.collapsed;
    const label = useGroupLabel(cell);
    const key: string = label.state.groupKey;
    void [collapsed, always, key];
    return <span {...label.props} />;
}
