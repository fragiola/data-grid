import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import {
    type CellInfo,
    DATA_GRID,
    injectGroupToggle,
} from "@fragiola/data-grid-angular";
import {
    LucideChevronRight,
    LucideFileText,
    LucideFolder,
} from "@lucide/angular";
import type { Entry } from "./files";
import * as styles from "./styles";

// An entry's name: indented by its depth, a folder's toggle (`injectGroupToggle`) before it. It
// goes on the app's own element in the cell: `<span exampleNameCell [cell]="cell" [depth]="…">`.

@Component({
    selector: "[exampleNameCell]",
    imports: [DATA_GRID, LucideChevronRight, LucideFileText, LucideFolder],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { "[class]": "styles.name(depth())" },
    template: `
        @if (cell().row; as entry) {
            @if (toggle.state().expandable) {
                <button
                    type="button"
                    [dataGridBind]="toggle.props()"
                    [attr.aria-label]="(toggle.state().expanded ? 'Collapse ' : 'Expand ') + entry.name"
                    [class]="styles.toggle"
                >
                    <svg
                        lucideChevronRight
                        aria-hidden="true"
                        [class]="styles.chevron(toggle.state().expanded)"
                    ></svg>
                </button>
            } @else {
                <span [class]="styles.spacer"></span>
            }
            @if (entry.kind === "folder") {
                <svg lucideFolder aria-hidden="true" [class]="styles.icon(entry.kind)"></svg>
            } @else {
                <svg lucideFileText aria-hidden="true" [class]="styles.icon(entry.kind)"></svg>
            }
            <span [class]="styles.label">{{ entry.name }}</span>
        }
    `,
})
export class NameCell {
    protected readonly styles = styles;
    readonly cell = input.required<CellInfo<Entry>>();
    readonly depth = input.required<number>();

    protected readonly toggle = injectGroupToggle(this.cell);
}
