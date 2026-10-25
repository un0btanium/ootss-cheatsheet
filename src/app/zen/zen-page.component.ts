import { Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { descendantIds, Segment } from '../data/models';
import { categoryIds, StoreService } from '../data/store.service';
import { CategoryActions } from '../shared/category-actions.service';
import { CategoryChipComponent } from '../shared/category-chip.component';
import { InteractionViewComponent } from '../shared/interaction-view.component';
import { ZenInputComponent } from './zen-input.component';
import { classifyZenInput } from './zen-intent';

/**
 * One input for everything: select a category, create a category, or create an
 * interaction. Shows the selection and the interactions that use only those categories.
 */
@Component({
  selector: 'app-zen-page',
  imports: [MatTooltipModule, CategoryChipComponent, InteractionViewComponent, ZenInputComponent],
  template: `
    <app-zen-input [excludeIds]="selectedIds()" (entered)="onSubmit($event)" />

    @if (selected().length) {
      <div class="selected" aria-label="Selected categories">
        @for (c of selected(); track c.id) {
          <button
            type="button"
            class="pick"
            matTooltip="Click to remove"
            [attr.aria-label]="'Remove ' + c.name"
            (click)="remove(c.id)"
          >
            <app-category-chip [category]="c" [plain]="true" />
          </button>
        }
      </div>

      @for (i of results(); track i.id) {
        <div class="row">
          <app-interaction-view class="grow" [segments]="i.segments" />
        </div>
      } @empty {
        <p class="empty">No interactions for this selection.</p>
      }
    } @else {
      <p class="empty">
        Type a category to start, a new name to create one, or mix both to add an interaction.
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 900px;
      margin: 0 auto;
      padding: 24px 0 16px;
    }
    .selected {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 16px 0;
    }
    .pick {
      padding: 0;
      border: none;
      background: none;
      font: inherit;
      line-height: 1.8;
      cursor: pointer;

      &:hover {
        filter: brightness(1.12);
        text-decoration: line-through;
      }
      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 1px;
        border-radius: 12px;
      }
    }
  `,
})
export class ZenPageComponent {
  private readonly store = inject(StoreService);
  private readonly categoryActions = inject(CategoryActions);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly input = viewChild.required(ZenInputComponent);

  /** Selection lives in the URL (?c=id1,id2) so it survives reloads. */
  protected readonly selectedIds = toSignal(
    this.route.queryParamMap.pipe(map((p) => (p.get('c') ?? '').split(',').filter(Boolean))),
    { initialValue: [] as string[] },
  );

  protected readonly selected = computed(() => {
    const byId = this.store.categoryById();
    return this.selectedIds().flatMap((id) => byId.get(id) ?? []);
  });

  /** Interactions whose categories are all selected. */
  protected readonly results = computed(() => {
    const ids = new Set(this.selected().map((c) => c.id));
    return this.store.interactions().filter((i) => {
      const cats = categoryIds(i);
      return cats.length > 0 && cats.every((id) => ids.has(id));
    });
  });

  protected async onSubmit(segments: Segment[]): Promise<void> {
    const intent = classifyZenInput(segments, (name) => this.store.findCategoryByName(name));
    switch (intent.kind) {
      case 'select':
        this.select(intent.categoryId);
        this.input().clear();
        break;
      case 'create-category': {
        const category = await this.categoryActions.create(intent.name);
        if (category) {
          this.select(category.id);
          this.input().clear();
        }
        this.input().focus();
        break;
      }
      case 'create-interaction':
        this.store.addInteraction(intent.segments);
        this.input().clear();
        this.snackBar.open('Interaction added.', undefined, { duration: 2000 });
        break;
    }
  }

  /** A category brings all its sub-categories (recursively) along. */
  private select(id: string): void {
    const added = [id, ...descendantIds(id, this.store.categoryById())];
    this.setSelection([...new Set([...this.selectedIds(), ...added])]);
  }

  protected remove(id: string): void {
    this.setSelection(this.selectedIds().filter((x) => x !== id));
  }

  private setSelection(ids: string[]): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { c: ids.length ? ids.join(',') : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
