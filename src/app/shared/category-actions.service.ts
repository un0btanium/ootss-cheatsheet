import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Category } from '../data/models';
import { StoreService } from '../data/store.service';
import {
  CategoryDialogComponent,
  CategoryDialogData,
  CategoryDialogResult,
} from './category-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

/** Dialog-driven category operations shared by all views. */
@Injectable({ providedIn: 'root' })
export class CategoryActions {
  private readonly dialog = inject(MatDialog);
  private readonly store = inject(StoreService);

  async create(initialName?: string): Promise<Category | undefined> {
    const result = await this.openDialog({ initialName });
    return result ? this.store.addCategory(result) : undefined;
  }

  async edit(category: Category): Promise<void> {
    const result = await this.openDialog({ category });
    if (result) this.store.updateCategory(category.id, result);
  }

  async delete(category: Category): Promise<void> {
    const uses = this.store.usageCount().get(category.id) ?? 0;
    const ok = await confirm(this.dialog, {
      title: `Delete "${category.name}"?`,
      message: uses
        ? `It is used in ${uses} interaction(s); those references will become plain text.`
        : 'It is not used in any interaction.',
      confirmLabel: 'Delete',
    });
    if (ok) this.store.deleteCategory(category.id);
  }

  private openDialog(data: CategoryDialogData): Promise<CategoryDialogResult | undefined> {
    const ref = this.dialog.open<CategoryDialogComponent, CategoryDialogData, CategoryDialogResult>(
      CategoryDialogComponent,
      { data, width: '420px', maxWidth: '95vw' },
    );
    return firstValueFrom(ref.afterClosed());
  }
}

export async function confirm(dialog: MatDialog, data: ConfirmDialogData): Promise<boolean> {
  const ref = dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
    ConfirmDialogComponent,
    { data, maxWidth: '95vw' },
  );
  return (await firstValueFrom(ref.afterClosed())) === true;
}
