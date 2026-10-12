import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { StoreService } from '../data/store.service';
import { CategoryActions } from '../shared/category-actions.service';
import { CategoryChipComponent } from '../shared/category-chip.component';

@Component({
  selector: 'app-categories-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    RouterLink,
    CategoryChipComponent,
  ],
  template: `
    <div class="list-header">
      <h2>Categories ({{ store.categories().length }})</h2>
      <mat-form-field subscriptSizing="dynamic" class="filter">
        <mat-icon matPrefix>search</mat-icon>
        <mat-label>Filter</mat-label>
        <input
          #filterInput
          matInput
          [value]="filter()"
          (input)="filter.set($any($event.target).value)"
          (keydown.enter)="createFromFilter()"
        />
      </mat-form-field>
      <button matButton="filled" (click)="createFromFilter()">
        <mat-icon>add</mat-icon> New category
      </button>
    </div>

    @for (c of filtered(); track c.id) {
      <div class="row">
        <div class="grow"><app-category-chip [category]="c" /></div>
        <span class="usage">{{ usage(c.id) }} interaction(s)</span>
        <a
          matIconButton
          [routerLink]="[puzzlesPath()]"
          [queryParams]="{ c: c.id, m: 'any' }"
          matTooltip="Show interactions"
          aria-label="Show interactions"
        >
          <mat-icon>extension</mat-icon>
        </a>
        <button matIconButton aria-label="Edit" (click)="actions.edit(c)">
          <mat-icon>edit</mat-icon>
        </button>
        <button matIconButton aria-label="Delete" (click)="actions.delete(c)">
          <mat-icon>delete</mat-icon>
        </button>
      </div>
    } @empty {
      <p class="empty">
        @if (filter()) {
          No categories match the filter.
        } @else {
          No categories yet. Add things you discover in the game (items, places, characters…).
        }
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 900px;
      margin: 0 auto;
      padding-bottom: 16px;
    }
    .list-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      h2 {
        margin: 0 auto 0 0;
      }
    }
    .filter {
      width: min(320px, 100%);
    }
    .usage {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
      white-space: nowrap;
    }
  `,
})
export class CategoriesPageComponent {
  protected readonly store = inject(StoreService);
  protected readonly actions = inject(CategoryActions);
  /** Focus the filter input when the view opens. */
  readonly autofocus = input(true);
  /** Route whose Puzzles view "Show interactions" fills (via the `c` query param). */
  readonly puzzlesPath = input('/puzzles');
  protected readonly filter = signal('');
  private readonly filterInput = viewChild.required<ElementRef<HTMLInputElement>>('filterInput');

  constructor() {
    afterNextRender(() => {
      if (this.autofocus()) this.filterInput().nativeElement.focus();
    });
  }

  protected readonly filtered = computed(() => {
    const q = this.filter().trim().toLocaleLowerCase();
    return this.store.categories().filter((c) => c.name.toLocaleLowerCase().includes(q));
  });

  /** Opens the create dialog prefilled with the filter text; clears the filter on success. */
  protected async createFromFilter(): Promise<void> {
    const created = await this.actions.create(this.filter().trim());
    if (created) this.filter.set('');
    // Defer so we win over the dialog restoring focus to the element that opened it.
    setTimeout(() => this.filterInput().nativeElement.focus());
  }

  protected usage(id: string): number {
    return this.store.usageCount().get(id) ?? 0;
  }
}
