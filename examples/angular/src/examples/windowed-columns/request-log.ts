import {
    ChangeDetectionStrategy,
    Component,
    effect,
    input,
    signal,
} from "@angular/core";
import { formatNumber } from "../_kit/data";
import type { FakeApi, Request } from "../_kit/fake-api";
import * as styles from "./styles";

// What the app asked its server for: the request count and the last twelve, newest first.

@Component({
    selector: "example-request-log",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <aside [class]="styles.log" aria-label="Requests">
            <p [class]="styles.logTitle" data-testid="request-count">{{ count() }}</p>
            <ol [class]="styles.logList" data-testid="request-log">
                @for (request of latest(); track request.id) {
                    <li
                        [class]="styles.logItem"
                        [attr.data-start]="request.start"
                        [attr.data-end]="request.end"
                    >{{ request.description }}</li>
                }
            </ol>
        </aside>
    `,
})
export class RequestLog {
    protected readonly styles = styles;

    readonly api = input.required<FakeApi>();

    protected readonly log = signal<readonly Request[]>([]);

    constructor() {
        // the api's log, followed while the log is shown
        effect((onCleanup) => {
            const api = this.api();
            this.log.set(api.log);
            onCleanup(api.subscribe(() => this.log.set(api.log)));
        });
    }

    protected count(): string {
        const { length } = this.log();
        return `${formatNumber(length)} ${length === 1 ? "tile request" : "tile requests"}`;
    }

    protected latest(): Request[] {
        return this.log().slice(-12).reverse();
    }
}
