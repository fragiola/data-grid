import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    input,
    signal,
} from "@angular/core";
import { formatNumber } from "../_kit/data";
import type { FakeApi, Request } from "../_kit/fake-api";
import * as styles from "./styles";

// What the app asked the server, newest first.

@Component({
    selector: "example-request-log",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <aside [class]="styles.log" aria-label="Requests">
            <p [class]="styles.logTitle">
                {{ formatNumber(log().length) }} {{ log().length === 1 ? "request" : "requests" }}
            </p>
            <ol [class]="styles.logList" data-testid="request-log">
                @for (request of latest(); track request.id) {
                    <li [class]="styles.logItem">{{ request.description }}</li>
                }
            </ol>
        </aside>
    `,
})
export class RequestLog {
    protected readonly styles = styles;
    protected readonly formatNumber = formatNumber;
    readonly api = input.required<FakeApi>();

    protected readonly log = signal<readonly Request[]>([]);
    protected readonly latest = computed(() => this.log().slice(-12).reverse());

    constructor() {
        effect((onCleanup) => {
            const api = this.api();
            this.log.set(api.log);
            onCleanup(api.subscribe(() => this.log.set(api.log)));
        });
    }
}
