import { describe, expect, it } from "vitest";
import {
    COMPLETE_FRAMEWORKS,
    embedBase,
    frameworkOf,
    skipOrFail,
    skipReason,
} from "../e2e/available.ts";

// The shared e2e suite runs against every framework's embed; a spec that opens an example the
// framework does not have is skipped with this reason, unless the framework ships every example
// (e2e/helpers.ts).
describe("the e2e suite's framework", () => {
    it("comes from EXAMPLES_FRAMEWORK, and a missing or unknown one throws", () => {
        expect(frameworkOf("vue")).toBe("vue");
        expect(() => frameworkOf(undefined)).toThrow(/EXAMPLES_FRAMEWORK/);
        expect(() => frameworkOf("svelte")).toThrow(/react, vue, angular/);
    });

    it("mounts each framework's embed under its own base", () => {
        expect(embedBase("react")).toBe("/data-grid/embed/react/");
        expect(embedBase("angular")).toBe("/data-grid/embed/angular/");
    });
});

describe("a spec's examples", () => {
    const available = ["hello-grid", "large-dataset"];

    it("run when the framework has every one", () => {
        expect(
            skipReason("angular", available, ["hello-grid"]),
        ).toBeUndefined();
        expect(skipReason("angular", available, [])).toBeUndefined();
        expect(
            skipOrFail("angular", available, ["hello-grid"]),
        ).toBeUndefined();
    });

    it("skip, naming the missing ones, when it lacks some", () => {
        expect(
            skipReason("angular", available, ["large-dataset", "fill", "rtl"]),
        ).toBe("angular has no fill, rtl example");
        // every framework is complete now: a lacking one fails instead (below)
        expect(() => skipOrFail("angular", available, ["fill"])).toThrow(
            /angular has no fill example, but every angular example is required/,
        );
    });
});

describe("a complete framework", () => {
    const available = ["hello-grid"];

    it("is every framework: React, Vue and Angular each have every example", () => {
        expect(COMPLETE_FRAMEWORKS).toEqual(["react", "vue", "angular"]);
    });

    it("fails a spec whose example it lacks, instead of skipping it", () => {
        expect(() => skipOrFail("react", available, ["fill"])).toThrow(
            /react has no fill example, but every react example is required/,
        );
        expect(skipOrFail("react", available, ["hello-grid"])).toBeUndefined();
        expect(() => skipOrFail("vue", available, ["fill"])).toThrow(
            /vue has no fill example, but every vue example is required/,
        );
    });
});
