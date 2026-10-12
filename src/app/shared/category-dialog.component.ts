import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Category, descendantIds } from '../data/models';
import { StoreService } from '../data/store.service';
import { contrastRatio, MIN_CONTRAST, randomColorPair } from './colors';

export interface CategoryDialogData {
  category?: Category;
  initialName?: string;
}

export type CategoryDialogResult = Omit<Category, 'id'>;

/** [text, background] presets. */
const PRESETS: [string, string][] = [
  ['#ffffff', '#c62828'],
  ['#ffffff', '#ad1457'],
  ['#ffffff', '#6a1b9a'],
  ['#ffffff', '#283593'],
  ['#ffffff', '#1565c0'],
  ['#000000', '#4dd0e1'],
  ['#ffffff', '#00695c'],
  ['#000000', '#81c784'],
  ['#000000', '#fff176'],
  ['#000000', '#ffb74d'],
  ['#ffffff', '#4e342e'],
  ['#ffffff', '#424242'],
  ['#000000', '#e0e0e0'],
];

@Component({
  selector: 'app-category-dialog',
  imports: [
    FormsModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.category ? 'Edit category' : 'New category' }}</h2>
    <mat-dialog-content>
      <form id="category-form" (ngSubmit)="submit()">
        <mat-form-field class="full">
          <mat-label>Name</mat-label>
          <input
            matInput
            name="name"
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
            required
            cdkFocusInitial
            autocomplete="off"
          />
        </mat-form-field>
        @if (error() && name().trim()) {
          <p class="error">{{ error() }}</p>
        }

        <div class="colors">
          <label>
            Text
            <input
              type="color"
              name="textColor"
              [ngModel]="textColor()"
              (ngModelChange)="textColor.set($event)"
            />
          </label>
          <label>
            Background
            <input
              type="color"
              name="bgColor"
              [ngModel]="bgColor()"
              (ngModelChange)="bgColor.set($event)"
            />
          </label>
          <button
            matIconButton
            type="button"
            matTooltip="Random readable colors"
            aria-label="Randomize colors"
            (click)="randomize()"
          >
            <mat-icon>casino</mat-icon>
          </button>
        </div>

        <div class="presets" aria-label="Color presets">
          @for (p of presets; track $index) {
            <button
              type="button"
              class="swatch"
              [style.color]="p[0]"
              [style.background]="p[1]"
              (click)="textColor.set(p[0]); bgColor.set(p[1])"
              [attr.aria-label]="'Preset ' + ($index + 1)"
            >
              A
            </button>
          }
        </div>

        <div class="preview">
          Preview:
          <span class="cat-chip" [style.color]="textColor()" [style.background]="bgColor()">
            {{ name().trim() || 'Category' }}
          </span>
          <span class="contrast" [class.low]="contrast() < minContrast">
            Contrast {{ contrast().toFixed(1) }}:1
          </span>
        </div>

        <mat-form-field class="full sub-categories">
          <mat-label>Sub-categories</mat-label>
          <mat-chip-grid #childGrid aria-label="Sub-categories">
            @for (c of children(); track c.id) {
              <mat-chip-row
                (removed)="removeChild(c.id)"
                [style.--mat-chip-elevated-container-color]="c.bgColor"
                [style.--mat-chip-label-text-color]="c.textColor"
                [style.--mat-chip-with-trailing-icon-trailing-icon-color]="c.textColor"
              >
                {{ c.name }}
                <button matChipRemove type="button" [attr.aria-label]="'Remove ' + c.name">
                  <mat-icon>cancel</mat-icon>
                </button>
              </mat-chip-row>
            }
            <input
              #childInput
              placeholder="Add existing category…"
              [value]="childQuery()"
              (input)="childQuery.set(childInput.value)"
              [matChipInputFor]="childGrid"
              [matAutocomplete]="childAuto"
            />
          </mat-chip-grid>
          <mat-autocomplete
            #childAuto="matAutocomplete"
            autoActiveFirstOption
            (optionSelected)="addChild($event); childInput.value = ''"
          >
            @for (c of childOptions(); track c.id) {
              <mat-option [value]="c.id">
                <span class="cat-chip" [style.color]="c.textColor" [style.background]="c.bgColor">{{
                  c.name
                }}</span>
              </mat-option>
            }
          </mat-autocomplete>
          <mat-hint>Added to a puzzle together with this category.</mat-hint>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close type="button">Cancel</button>
      <button matButton="filled" type="submit" form="category-form" [disabled]="!!error()">
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .full {
      width: 100%;
    }
    .error {
      color: var(--mat-sys-error);
      margin: -12px 0 8px;
      font: var(--mat-sys-body-small);
    }
    .colors {
      display: flex;
      gap: 24px;
      margin-bottom: 12px;
      label {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      input[type='color'] {
        width: 40px;
        height: 32px;
        border: none;
        padding: 0;
        background: none;
        cursor: pointer;
      }
    }
    .presets {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 16px;
    }
    .swatch {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 1px solid var(--mat-sys-outline-variant);
      font-weight: 600;
      cursor: pointer;
    }
    .preview {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sub-categories {
      margin-top: 16px;
    }
    .contrast {
      margin-left: auto;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
      &.low {
        color: var(--mat-sys-error);
      }
    }
  `,
})
export class CategoryDialogComponent {
  protected readonly data = inject<CategoryDialogData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<CategoryDialogComponent, CategoryDialogResult>>(MatDialogRef);
  private readonly store = inject(StoreService);
  protected readonly presets = PRESETS;

  protected readonly minContrast = MIN_CONTRAST;

  private readonly initialColors = randomColorPair();
  protected readonly name = signal(this.data.category?.name ?? this.data.initialName ?? '');
  protected readonly textColor = signal(this.data.category?.textColor ?? this.initialColors[0]);
  protected readonly bgColor = signal(this.data.category?.bgColor ?? this.initialColors[1]);
  private readonly childIds = signal<string[]>(this.data.category?.childIds ?? []);
  protected readonly childQuery = signal('');
  protected readonly children = computed(() => {
    const byId = this.store.categoryById();
    return this.childIds().flatMap((id) => byId.get(id) ?? []);
  });
  /** Candidates: not itself, not already chosen, and not an ancestor (would form a cycle). */
  protected readonly childOptions = computed(() => {
    const selfId = this.data.category?.id;
    const byId = this.store.categoryById();
    const chosen = new Set(this.childIds());
    const q = this.childQuery().trim().toLocaleLowerCase();
    return this.store
      .categories()
      .filter(
        (c) =>
          c.id !== selfId &&
          !chosen.has(c.id) &&
          c.name.toLocaleLowerCase().includes(q) &&
          !(selfId && descendantIds(c.id, byId).includes(selfId)),
      );
  });
  protected readonly contrast = computed(() => contrastRatio(this.textColor(), this.bgColor()));

  protected readonly error = computed(() => {
    const name = this.name().trim();
    if (!name) return 'Name is required.';
    const existing = this.store.findCategoryByName(name);
    if (existing && existing.id !== this.data.category?.id)
      return 'A category with this name exists.';
    return null;
  });

  protected randomize(): void {
    const [text, bg] = randomColorPair();
    this.textColor.set(text);
    this.bgColor.set(bg);
  }

  protected addChild(e: MatAutocompleteSelectedEvent): void {
    this.childIds.update((ids) => [...ids, e.option.value as string]);
    this.childQuery.set('');
  }

  protected removeChild(id: string): void {
    this.childIds.update((ids) => ids.filter((x) => x !== id));
  }

  protected submit(): void {
    if (this.error()) return;
    this.ref.close({
      name: this.name().trim(),
      textColor: this.textColor(),
      bgColor: this.bgColor(),
      childIds: this.childIds(),
    });
  }
}
