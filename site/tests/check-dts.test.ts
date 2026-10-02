import { describe, expect, it } from "vitest";
import { anyUses, codeOnly } from "../../scripts/check-dts.ts";

// `pnpm build` runs scripts/check-dts.ts over the packages' emitted declarations.
describe("the built declarations check", () => {
    it("finds `any` in a type", () => {
        expect(anyUses("export declare function f(x: any): void;")).toEqual([
            "export declare function f(x: any): void;",
        ]);
        expect(anyUses("type A = Record<string, any>[];")).toHaveLength(1);
    });

    it("ignores `any` in comments, strings and longer words", () => {
        expect(
            anyUses(
                '/** any comment */\n// any\nexport type Company = "any";\ntype Anything = 1;',
            ),
        ).toEqual([]);
        expect(codeOnly('type A = "any"; // any')).not.toMatch(/\bany\b/);
    });
});
