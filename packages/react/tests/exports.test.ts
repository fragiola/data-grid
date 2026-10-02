import { describe, expect, it } from "vitest";
import * as DataGridReact from "../src";

describe("@fragiola/data-grid-react", () => {
    it("loads the core", () => {
        expect(DataGridReact.createAxis(3, 10).totalSize).toBe(30);
    });
});
