import {
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from "@angular/core";
import * as styles from "./styles";

// A native checkbox: checked, or neither checked nor not (`indeterminate`, set on the element).

@Component({
    selector: "example-checkbox",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <!-- a checkbox's change comes from its click: Shift+click selects a range -->
        <input
            type="checkbox"
            [attr.aria-label]="label()"
            [checked]="checked()"
            [indeterminate]="indeterminate()"
            [class]="styles.checkbox"
            (click)="toggle.emit($event.shiftKey)"
        />
    `,
})
export class Checkbox {
    protected readonly styles = styles;
    readonly label = input.required<string>();
    readonly checked = input.required<boolean>();
    readonly indeterminate = input(false, { transform: booleanAttribute });
    readonly toggle = output<boolean>();
}
