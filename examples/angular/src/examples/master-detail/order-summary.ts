import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { formatMoney } from "../_kit/data";
import { type Order, total } from "./orders";
import * as styles from "./styles";

// An order at a glance: the detail's first part, any component of the app's.

@Component({
    selector: "example-order-summary",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.summary">
            <span [class]="styles.summaryTitle">{{ order().customer }}</span>
            <span [class]="styles.summaryLine">
                Order <span [class]="styles.summaryValue">#{{ order().id }}</span>
            </span>
            <span [class]="styles.summaryLine">
                Items
                <span [class]="styles.summaryValue">{{ order().items.length }}</span>
            </span>
            <span [class]="styles.summaryLine">
                Total
                <span [class]="styles.summaryValue">{{ formatMoney(total(order())) }}</span>
            </span>
            <span [class]="styles.summaryLine">
                Status
                <span [class]="styles.summaryValue">{{ order().status }}</span>
            </span>
        </div>
    `,
})
export class OrderSummary {
    protected readonly styles = styles;
    protected readonly formatMoney = formatMoney;
    protected readonly total = total;
    readonly order = input.required<Order>();
}
