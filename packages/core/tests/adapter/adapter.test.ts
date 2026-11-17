import { describe, expect, it, vi } from "vitest";
import {
    attachGridHandle,
    bindGridRoot,
    createGridHandle,
    dataAttributes,
    GRID_ROOT_PROPS,
    type GridRootProps,
    withoutRootProps,
} from "../../src";
import { moveShownRowAt } from "../../src/local";
import { navigation } from "../../src/navigation";
import { selectAllState, selectAllToggled } from "../../src/row-selection";

// The adapters' shared decisions (Epic #123): what each framework's root and parts call. The
// adapters' own tests drive them through the primitives; these pin the rules alone.

describe("bindGridRoot", () => {
    const columns = [{ key: "a", width: 100 }];

    it("creates the model from the props, and follows them only when they change", () => {
        let props: GridRootProps<{ a: number }, unknown> = {
            columns,
            rows: [{ a: 1 }],
        };
        const root = bindGridRoot(() => props);
        expect(root.model.state.rowCount).toBe(1);
        const run = vi.spyOn(root.model, "run");
        root.sync();
        expect(run).not.toHaveBeenCalledWith("data.set", expect.anything());
        props = { ...props, rows: [{ a: 1 }, { a: 2 }] };
        root.sync();
        expect(run).toHaveBeenCalledWith("data.set", expect.anything());
        expect(root.model.state.rowCount).toBe(2);
    });

    it("asks a controlled value's parent and keeps the prop's value", () => {
        const onActivePositionChange = vi.fn();
        const root = bindGridRoot(() => ({
            columns,
            rows: [{ a: 1 }, { a: 2 }],
            features: [navigation()],
            activePosition: { rowIndex: 0, columnIndex: 0 },
            onActivePositionChange,
        }));
        root.sync();
        root.model.run("active-position.set", { rowIndex: 1, columnIndex: 0 });
        expect(onActivePositionChange).toHaveBeenCalledWith({
            rowIndex: 1,
            columnIndex: 0,
        });
        expect(root.model.state.activePosition).toEqual({
            rowIndex: 0,
            columnIndex: 0,
        });
    });

    it("leaves the root's own props off the element's", () => {
        expect(GRID_ROOT_PROPS).toContain("columns");
        expect(
            withoutRootProps({ columns, rows: [], id: "grid", title: "t" }),
        ).toEqual({ id: "grid", title: "t" });
    });
});

describe("a grid handle", () => {
    it("is written by one root at a time, and tells its listeners", () => {
        const handle = createGridHandle<{ name: string }>();
        const listener = vi.fn();
        handle.subscribe(listener);
        const first = { name: "first" };
        const release = attachGridHandle(handle, first);
        expect(handle.current).toBe(first);
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        attachGridHandle(handle, { name: "second" });
        expect(error).toHaveBeenCalledOnce();
        expect(handle.current).toBe(first);
        release();
        expect(handle.current).toBeNull();
        expect(listener).toHaveBeenCalledTimes(2);
        error.mockRestore();
    });
});

describe("the parts' props", () => {
    it("write data attributes present or absent, never false", () => {
        expect(
            dataAttributes({ a: true, b: false, c: 2, d: undefined }),
        ).toEqual({ "data-a": "", "data-c": "2" });
    });
});

describe("select all", () => {
    it("selects every row, clears them all, and only clears in single mode", () => {
        expect(selectAllState(undefined, [], [1, 2])).toEqual({
            status: "none",
            count: 0,
            canToggle: false,
        });
        expect(selectAllState("multiple", [1], [1, 2])).toEqual({
            status: "some",
            count: 1,
            canToggle: true,
        });
        expect(selectAllToggled("multiple", [1], [1, 2])).toEqual([1, 2]);
        expect(selectAllToggled("multiple", [1, 2], [1, 2])).toEqual([]);
        expect(selectAllToggled("single", [], [1, 2])).toBeUndefined();
        expect(selectAllToggled("single", [2], [1, 2])).toEqual([]);
    });
});

describe("moving a shown row", () => {
    it("moves it among every row, and keeps where the shown ones are", () => {
        // rows 0..3, the shown ones are 1 and 3
        const moved = moveShownRowAt(["a", "b", "c", "d"], [1, 3], 0, 1);
        expect(moved?.rows).toEqual(["a", "c", "d", "b"]);
        expect(moved?.rowIndexes).toEqual([2, 3]);
        expect(moveShownRowAt(["a"], [0], 0, 0)).toBeNull();
    });
});
