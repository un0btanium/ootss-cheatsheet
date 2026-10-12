import { Component, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { downloadJson, readJsonFile } from './data/import-export';
import { StoreService } from './data/store.service';
import { confirm } from './shared/category-actions.service';

@Component({
  selector: 'app-root',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTabsModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  template: `
    <mat-toolbar>
      <span class="title">OotSS Cheatsheet</span>
      <span class="spacer"></span>
      <button matIconButton [matMenuTriggerFor]="menu" aria-label="Data menu">
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        <button mat-menu-item (click)="export()"><mat-icon>download</mat-icon> Export JSON</button>
        <button mat-menu-item (click)="fileInput.click()">
          <mat-icon>upload</mat-icon> Import JSON
        </button>
      </mat-menu>
      <input
        #fileInput
        type="file"
        accept="application/json,.json"
        hidden
        (change)="import(fileInput)"
      />
    </mat-toolbar>

    <nav mat-tab-nav-bar [tabPanel]="panel" mat-stretch-tabs="false">
      @for (link of links; track link.path) {
        <a
          mat-tab-link
          [routerLink]="link.path"
          routerLinkActive
          #rla="routerLinkActive"
          [active]="rla.isActive"
        >
          <mat-icon class="tab-icon">{{ link.icon }}</mat-icon> {{ link.label }}
        </a>
      }
    </nav>

    <mat-tab-nav-panel #panel>
      <main>
        <router-outlet />
      </main>
    </mat-tab-nav-panel>
  `,
  styles: `
    .title {
      font: var(--mat-sys-title-large);
    }
    .spacer {
      flex: 1;
    }
    .tab-icon {
      margin-right: 6px;
    }
    main {
      max-width: 900px;
      margin: 0 auto;
      padding: 16px;
    }
  `,
})
export class App {
  private readonly store = inject(StoreService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly links = [
    { path: '/interactions', label: 'Interactions', icon: 'notes' },
    { path: '/categories', label: 'Categories', icon: 'label' },
    { path: '/puzzles', label: 'Puzzles', icon: 'extension' },
  ];

  constructor() {
    effect(() => {
      const error = this.store.saveError();
      if (error) this.snackBar.open(`Could not save locally: ${error}`, 'OK');
    });
  }

  protected export(): void {
    downloadJson(this.store.snapshot());
  }

  protected async import(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const data = await readJsonFile(file);
      const ok = await confirm(this.dialog, {
        title: 'Replace all data?',
        message:
          `The file contains ${data.categories.length} categories and ` +
          `${data.interactions.length} interactions. Your current data will be replaced ` +
          `(export it first if you want to keep it).`,
        confirmLabel: 'Replace',
      });
      if (!ok) return;
      this.store.replaceAll(data);
      this.snackBar.open('Data imported.', undefined, { duration: 3000 });
    } catch (e) {
      this.snackBar.open(`Import failed: ${e instanceof Error ? e.message : e}`, 'OK');
    }
  }
}
