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
import { toSignal } from '@angular/core/rxjs-interop';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { Category } from '../data/models';
import { categoryIds, StoreService } from '../data/store.service';
import { CategoryChipComponent } from '../shared/category-chip.component';
import { InteractionViewComponent } from '../shared/interaction-view.component';

type Mode = 'any' | 'all' | 'only';

@Component({
  selector: 'app-puzzles-page',
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    CategoryChipComponent,
    InteractionViewComponent,
  ],
  template: `
    <h2>Puzzle</h2>
    <mat-form-field class="picker">
      <mat-label>Categories in this puzzle</mat-label>
      <mat-chip-grid #grid aria-label="Selected categories">
        @for (c of selected(); track c.id) {
          <mat-chip-row
            class="removable"
            matTooltip="Click to remove"
            (click)="remove(c)"
            (removed)="remove(c)"
            [style.--mat-chip-elevated-container-color]="c.bgColor"
            [style.--mat-chip-label-text-color]="c.textColor"
            [style.--mat-chip-with-trailing-icon-trailing-icon-color]="c.textColor"
          >
            {{ c.name }}
            <button matChipRemove [attr.aria-label]="'Remove ' + c.name">
              <mat-icon>cancel</mat-icon>
            </button>
          </mat-chip-row>
        }
        <input
          #input
          placeholder="Search categories…"
          [value]="query()"
          (input)="query.set(input.value)"
          [matChipInputFor]="grid"
          [matAutocomplete]="auto"
        />
      </mat-chip-grid>
      <mat-autocomplete
        #auto="matAutocomplete"
        autoActiveFirstOption
        (optionSelected)="add($event); input.value = ''"
      >
        @for (c of options(); track c.id) {
          <mat-option [value]="c.id"
            ><app-category-chip [category]="c" [plain]="true"
          /></mat-option>
        }
      </mat-autocomplete>
    </mat-form-field>

    <div class="controls">
      <mat-button-toggle-group
        [value]="mode()"
        (change)="setMode($event.value)"
        hideSingleSelectionIndicator
        aria-label="Match mode"
      >
        <mat-button-toggle
          value="only"
          matTooltip="Every category it mentions is selected (nothing else needed)"
        >
          Only these
        </mat-button-toggle>
        <mat-button-toggle value="any" matTooltip="Mentions at least one selected category">
          Any category
        </mat-button-toggle>
        <mat-button-toggle value="all" matTooltip="Mentions every selected category">
          All categories
        </mat-button-toggle>
      </mat-button-toggle-group>
      @if (selected().length) {
        <button matButton (click)="setSelection([])">Clear</button>
      }
    </div>

    @if (!selected().length) {
      <p class="empty">Select the categories involved in a puzzle to see known interactions.</p>
    } @else {
      <h3>Interactions ({{ results().length }})</h3>
      @for (r of results(); track r.interaction.id) {
        <div class="row">
          <app-interaction-view class="grow" [segments]="r.interaction.segments" />
          @if (selected().length > 1) {
            <span class="badge" title="Matched categories"
              >{{ r.hits }}/{{ selected().length }}</span
            >
          }
        </div>
      } @empty {
        <p class="empty">No interactions found for this selection.</p>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 900px;
      margin: 0 auto;
      padding-bottom: 16px;
    }
    .picker {
      width: 100%;
    }
    .removable {
      cursor: pointer;
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .badge {
      padding: 2px 8px;
      border-radius: 10px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-label-medium);
    }
  `,
})
export class PuzzlesPageComponent {
  private readonly store = inject(StoreService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Focus the category picker when the view opens. */
  readonly autofocus = input(true);
  protected readonly query = signal('');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  constructor() {
    afterNextRender(() => {
      if (this.autofocus()) this.input().nativeElement.focus();
    });
  }

  /** Selection lives in the URL (?c=id1,id2) so it survives reloads and can be bookmarked. */
  /** Match mode lives in the URL too (?m=any|all; default "only"), so links can preset it. */
  private readonly modeParam = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('m'))), {
    initialValue: null,
  });
  protected readonly mode = computed<Mode>(() => {
    const m = this.modeParam();
    return m === 'any' || m === 'all' ? m : 'only';
  });

  private readonly selectedIds = toSignal(
    this.route.queryParamMap.pipe(map((p) => (p.get('c') ?? '').split(',').filter(Boolean))),
    { initialValue: [] as string[] },
  );

  protected readonly selected = computed(() => {
    const byId = this.store.categoryById();
    return this.selectedIds().flatMap((id) => byId.get(id) ?? []);
  });

  protected readonly options = computed(() => {
    const q = this.query().trim().toLocaleLowerCase();
    const chosen = new Set(this.selectedIds());
    return this.store
      .categories()
      .filter((c) => !chosen.has(c.id) && c.name.toLocaleLowerCase().includes(q));
  });

  protected readonly results = computed(() => {
    const ids = new Set(this.selected().map((c) => c.id));
    const mode = this.mode();
    return this.store
      .interactions()
      .map((interaction) => {
        const cats = new Set(categoryIds(interaction));
        const hits = [...cats].filter((id) => ids.has(id)).length;
        const match =
          mode === 'any' ? hits > 0 : mode === 'all' ? hits === ids.size : hits === cats.size;
        return { interaction, hits, match: match && hits > 0 };
      })
      .filter((r) => r.match)
      .sort((a, b) => b.hits - a.hits);
  });

  protected add(e: MatAutocompleteSelectedEvent): void {
    this.setSelection([...this.selectedIds(), e.option.value as string]);
    this.query.set('');
  }

  protected remove(c: Category): void {
    this.setSelection(this.selectedIds().filter((id) => id !== c.id));
  }

  protected setSelection(ids: string[]): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { c: ids.length ? ids.join(',') : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected setMode(mode: Mode): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { m: mode === 'only' ? null : mode },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
