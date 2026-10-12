import { Component, inject, input } from '@angular/core';
import { Category } from '../data/models';
import { CategoryActions } from './category-actions.service';

/** A colored category label; clicking it opens the edit dialog (unless `plain`). */
@Component({
  selector: 'app-category-chip',
  template: `
    @if (plain()) {
      <span
        class="cat-chip"
        [style.color]="category().textColor"
        [style.background]="category().bgColor"
      >
        {{ category().name }}
      </span>
    } @else {
      <button
        type="button"
        class="cat-chip"
        [style.color]="category().textColor"
        [style.background]="category().bgColor"
        [attr.title]="'Edit ' + category().name"
        (click)="$event.stopPropagation(); actions.edit(category())"
      >
        {{ category().name }}
      </button>
    }
  `,
})
export class CategoryChipComponent {
  readonly category = input.required<Category>();
  readonly plain = input(false);
  protected readonly actions = inject(CategoryActions);
}
