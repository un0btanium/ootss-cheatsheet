import { CdkScrollable } from '@angular/cdk/scrolling';
import { Component } from '@angular/core';
import { CategoriesPageComponent } from '../categories/categories-page.component';
import { InteractionsPageComponent } from '../interactions/interactions-page.component';
import { PuzzlesPageComponent } from '../puzzles/puzzles-page.component';

/** Categories, Interactions and Puzzles side by side, each column scrolling on its own. */
@Component({
  selector: 'app-all-in-one-page',
  imports: [
    CdkScrollable,
    CategoriesPageComponent,
    InteractionsPageComponent,
    PuzzlesPageComponent,
  ],
  template: `
    <section cdkScrollable aria-label="Categories">
      <app-categories-page [autofocus]="true" puzzlesPath="/all" />
    </section>
    <section cdkScrollable aria-label="Interactions">
      <app-interactions-page [autofocus]="false" />
    </section>
    <section cdkScrollable aria-label="Puzzles">
      <app-puzzles-page [autofocus]="false" />
    </section>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      height: 100%;
    }
    section {
      min-height: 0;
      overflow-y: auto;
      padding: 0 12px;
    }
    section + section {
      border-left: 1px solid var(--mat-sys-outline-variant);
    }
    @media (max-width: 1100px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        height: auto;
      }
      section {
        overflow: visible;
        padding: 0;
      }
      section + section {
        border-left: none;
        border-top: 1px solid var(--mat-sys-outline-variant);
        padding-top: 16px;
      }
    }
  `,
})
export class AllInOnePageComponent {}
