import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Category } from '../data/models';
import { StoreService } from '../data/store.service';

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
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
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
        </div>
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
  `,
})
export class CategoryDialogComponent {
  protected readonly data = inject<CategoryDialogData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<CategoryDialogComponent, CategoryDialogResult>>(MatDialogRef);
  private readonly store = inject(StoreService);
  protected readonly presets = PRESETS;

  private readonly initialPreset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
  protected readonly name = signal(this.data.category?.name ?? this.data.initialName ?? '');
  protected readonly textColor = signal(this.data.category?.textColor ?? this.initialPreset[0]);
  protected readonly bgColor = signal(this.data.category?.bgColor ?? this.initialPreset[1]);

  protected readonly error = computed(() => {
    const name = this.name().trim();
    if (!name) return 'Name is required.';
    const existing = this.store.findCategoryByName(name);
    if (existing && existing.id !== this.data.category?.id)
      return 'A category with this name exists.';
    return null;
  });

  protected submit(): void {
    if (this.error()) return;
    this.ref.close({
      name: this.name().trim(),
      textColor: this.textColor(),
      bgColor: this.bgColor(),
    });
  }
}
