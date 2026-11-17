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

// What the app asked its server for: the last requests, newest first.

@Component({
    selector: "example-request-log",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <aside [class]="styles.log" aria-label="Requests">
            <p [class]="styles.logTitle" data-testid="request-count">
                {{ formatNumber(log().length) }}
                {{ log().length === 1 ? "request" : "requests" }},
                {{ formatNumber(log().length * block()) }} of
                {{ formatNumber(total()) }} rows
            </p>
            <ol [class]="styles.logList" data-testid="request-log">
                @for (request of latest(); track request.id) {
                    <li
                        [class]="styles.logItem"
                        [attr.data-start]="request.start"
                        [attr.data-end]="request.end"
                    >
                        {{ request.description }}
                    </li>
                }
            </ol>
        </aside>
    `,
})
export class RequestLog {
    protected readonly styles = styles;
    protected readonly formatNumber = formatNumber;

    readonly api = input.required<FakeApi>();
    readonly block = input.required<number>();
    readonly total = input.required<number>();

    protected readonly log = signal<readonly Request[]>([]);

    constructor() {
        // the api's log, followed while the log is shown
        effect((onCleanup) => {
            const api = this.api();
            this.log.set(api.log);
            onCleanup(api.subscribe(() => this.log.set(api.log)));
        });
    }

    protected latest(): Request[] {
        return this.log().slice(-12).reverse();
    }
}
