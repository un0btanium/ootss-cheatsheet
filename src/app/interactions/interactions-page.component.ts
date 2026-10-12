import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Interaction, Segment, segmentsToPlainText } from '../data/models';
import { StoreService } from '../data/store.service';
import { confirm } from '../shared/category-actions.service';
import { InteractionViewComponent } from '../shared/interaction-view.component';
import { InteractionEditorComponent } from './interaction-editor.component';

@Component({
  selector: 'app-interactions-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    InteractionEditorComponent,
    InteractionViewComponent,
  ],
  template: `
    <mat-card appearance="outlined" class="new">
      <mat-card-header><mat-card-title>New interaction</mat-card-title></mat-card-header>
      <mat-card-content>
        <app-interaction-editor
          saveLabel="Add"
          [clearOnSave]="true"
          [autofocus]="true"
          (save)="store.addInteraction($event)"
        />
      </mat-card-content>
    </mat-card>

    <div class="list-header">
      <h2>Interactions ({{ store.interactions().length }})</h2>
      <mat-form-field subscriptSizing="dynamic" class="filter">
        <mat-icon matPrefix>search</mat-icon>
        <mat-label>Filter</mat-label>
        <input matInput [value]="filter()" (input)="filter.set($any($event.target).value)" />
      </mat-form-field>
    </div>

    @for (i of filtered(); track i.id) {
      <div class="row">
        @if (editingId() === i.id) {
          <app-interaction-editor
            class="grow"
            [segments]="i.segments"
            [showCancel]="true"
            [autofocus]="true"
            (save)="update(i, $event)"
            (cancel)="editingId.set(null)"
          />
        } @else {
          <app-interaction-view class="grow" [segments]="i.segments" />
          <button matIconButton aria-label="Edit" (click)="editingId.set(i.id)">
            <mat-icon>edit</mat-icon>
          </button>
          <button matIconButton aria-label="Delete" (click)="remove(i)">
            <mat-icon>delete</mat-icon>
          </button>
        }
      </div>
    } @empty {
      <p class="empty">
        @if (filter()) {
          No interactions match the filter.
        } @else {
          No interactions yet. Create some categories first, then type their names above to link
          them.
        }
      </p>
    }
  `,
  styles: `
    .new {
      margin-bottom: 24px;
    }
    .list-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      h2 {
        margin: 0;
      }
    }
    .filter {
      width: min(320px, 100%);
    }
  `,
})
export class InteractionsPageComponent {
  protected readonly store = inject(StoreService);
  private readonly dialog = inject(MatDialog);
  protected readonly filter = signal('');
  protected readonly editingId = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const q = this.filter().trim().toLocaleLowerCase();
    const all = this.store.interactions();
    if (!q) return all;
    const byId = this.store.categoryById();
    return all.filter((i) => segmentsToPlainText(i.segments, byId).toLocaleLowerCase().includes(q));
  });

  protected update(i: Interaction, segments: Segment[]): void {
    this.store.updateInteraction(i.id, segments);
    this.editingId.set(null);
  }

  protected async remove(i: Interaction): Promise<void> {
    const ok = await confirm(this.dialog, {
      title: 'Delete interaction?',
      message: segmentsToPlainText(i.segments, this.store.categoryById()),
      confirmLabel: 'Delete',
    });
    if (ok) this.store.deleteInteraction(i.id);
  }
}
