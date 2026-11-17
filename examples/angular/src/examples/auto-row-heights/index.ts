import {
    ChangeDetectionStrategy,
    Component,
    type TemplateRef,
    ViewChild,
} from "@angular/core";
import {
    type CellTemplateProps,
    type Column,
    contextOf,
    DATA_GRID,
    type DataGridNode,
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import {
    DataGridLocalRows,
    injectLocalRows,
} from "@fragiola/data-grid-angular/local";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { sorting } from "@fragiola/data-grid-angular/sorting";
import { hash, type Person, people } from "../_kit/data";
import * as styles from "./styles";

/** A person with notes of their own: one to four sentences, and a few skills. */
interface Profile extends Person {
    notes: string;
    skills: string[];
}

const SENTENCES = [
    "Prefers asynchronous reviews and writes the longest pull request descriptions on the team.",
    "Owns the release checklist this quarter.",
    "Mentoring two new hires through their first on-call rotation, with a weekly pairing session.",
    "On call next week.",
    "Moved from the data team in the spring; still the person to ask about the old pipelines.",
    "Out on Fridays.",
    "Leads the accessibility guild, and runs its monthly audit of every public page.",
    "Speaks at two conferences this year.",
];

const SKILLS = [
    "TypeScript",
    "Rust",
    "SQL",
    "Design systems",
    "Accessibility",
    "Kubernetes",
    "Writing",
    "Mentoring",
    "Testing",
    "Go",
];

/** A row's notes and skills, from its id: the same every time, of every length. */
const rows: Profile[] = people(100_000).map((person) => ({
    ...person,
    notes: Array.from(
        { length: 1 + hash(person.id + 31, 4) },
        (_, sentence) =>
            SENTENCES[hash(person.id * 7 + sentence, SENTENCES.length)],
    ).join(" "),
    // each once
    skills: [
        ...new Set(
            Array.from(
                { length: 1 + hash(person.id + 57, 5) },
                (_, skill) =>
                    SKILLS[hash(person.id * 3 + skill, SKILLS.length)] ?? "",
            ),
        ),
    ],
}));

@Component({
    selector: "example-auto-row-heights",
    imports: [DATA_GRID, DataGridLocalRows],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <!-- as tall as their content, measured once rendered; until then, about this tall -->
            <div
                dataGridRoot
                [features]="features"
                [dataGridLocalRows]="local"
                [columns]="columns"
                [rowKey]="rowKey"
                rowHeight="auto"
                [estimatedRowHeight]="64"
                [class]="styles.root"
            >
                <ng-template #skillsCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.skills">
                        @for (skill of row.skills; track skill) {
                            <span [class]="styles.skill">{{ skill }}</span>
                        }
                    </span>
                </ng-template>
                <div dataGridGrid aria-label="People and their notes" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div [dataGridHeaderCell]="cell" [class]="styles.headerCell">
                                    <ng-container *dataGridCellContent />
                                </div>
                            </ng-template>
                        </div>
                    </div>
                    <div dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <div [dataGridRow]="row" [class]="styles.row(row)">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <div [dataGridCell]="cell" [class]="styles.cell(cell)">
                                        <ng-container *dataGridCellContent />
                                    </div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            </div>
        </div>
    `,
})
export default class AutoRowHeights {
    protected readonly styles = styles;
    protected readonly cellContext = contextOf<CellTemplateProps<Profile>>();
    @ViewChild("skillsCell", { static: true })
    private readonly skillsCell!: TemplateRef<
        TemplateContext<CellTemplateProps<Profile>>
    >;

    readonly columns: Column<Profile, DataGridNode>[] = [
        {
            key: "name",
            name: "Name",
            width: 180,
            pinned: "start",
            sortable: true,
        },
        { key: "team", name: "Team", width: 120, sortable: true },
        // the notes wrap: a row is as tall as its longest cell
        { key: "notes", name: "Notes", width: 360 },
        {
            key: "skills",
            name: "Skills",
            width: 240,
            renderCell: (props) => templateContent(this.skillsCell, props),
        },
        { key: "city", name: "City", width: 130, sortable: true },
    ];

    // a sort moves the rows: the ones on screen keep their heights, the others are measured
    // again when they render (counted at the estimate until then)
    // the features the grid installs: sorting (the local rows' sort needs it, or no column sorts),
    // cell navigation (the keys, the active cell, the tab stop)
    readonly features = [sorting(), navigation()];
    readonly local = injectLocalRows(rows, this.columns);

    readonly rowKey = (row: Profile) => row.id;
}
