import "@angular/compiler";
import { setupTestBed } from "@analogjs/vitest-angular/setup-testbed";

// The kit's render tests (jsdom, per file) run zoneless, as the app does; the contract tests
// (node) only read files, and get no test bed.
if (typeof window !== "undefined") {
    setupTestBed({ zoneless: true, errorOnUnknownElements: true });
}
