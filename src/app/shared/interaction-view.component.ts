import { Component, inject, input } from '@angular/core';
import { Segment } from '../data/models';
import { StoreService } from '../data/store.service';
import { CategoryChipComponent } from './category-chip.component';

/** Read-only rendering of interaction segments with clickable category chips. */
@Component({
  selector: 'app-interaction-view',
  imports: [CategoryChipComponent],
  template: `
    @for (s of segments(); track $index) {
      @if (s.t === 'text') {
        <span>{{ s.text }}</span>
      } @else {
        @let cat = store.categoryById().get(s.id);
        @if (cat) {
          <app-category-chip [category]="cat" />
        }
      }
    }
  `,
  styles: `
    :host {
      display: block;
      white-space: pre-wrap;
      line-height: 1.8;
      overflow-wrap: anywhere;
    }
  `,
})
export class InteractionViewComponent {
  readonly segments = input.required<Segment[]>();
  protected readonly store = inject(StoreService);
}
