import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    inject,
    signal,
} from "@angular/core";
import { formatNumber } from "../_kit/data";
import { api } from "./server";
import * as styles from "./styles";

// What the app asked the server, newest first.

@Component({
    selector: "example-request-log",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <aside [class]="styles.log" aria-label="Requests">
            <p [class]="styles.logTitle">
                {{ formatNumber(log().length) }}
                {{ log().length === 1 ? "request" : "requests" }}
            </p>
            <ol [class]="styles.logList" data-testid="request-log">
                @for (request of newest(); track request.id) {
                    <li [class]="styles.logItem">{{ request.description }}</li>
                }
            </ol>
        </aside>
    `,
})
export class RequestLog {
    protected readonly styles = styles;
    protected readonly formatNumber = formatNumber;
    protected readonly log = signal(api.log);
    protected readonly newest = computed(() => this.log().slice(-12).reverse());

    constructor() {
        inject(DestroyRef).onDestroy(
            api.subscribe(() => this.log.set(api.log)),
        );
    }
}
