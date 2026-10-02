import { describe, expect, it } from "vitest";
import * as DataGridReact from "../src";

describe("@fragiola/data-grid-react", () => {
    it("loads", () => {
        expect(DataGridReact.VERSION).toBe("0.0.0");
    });
});
