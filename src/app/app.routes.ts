import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'interactions',
    title: 'Interactions · OotSS',
    loadComponent: () =>
      import('./interactions/interactions-page.component').then((m) => m.InteractionsPageComponent),
  },
  {
    path: 'categories',
    title: 'Categories · OotSS',
    loadComponent: () =>
      import('./categories/categories-page.component').then((m) => m.CategoriesPageComponent),
  },
  {
    path: 'puzzles',
    title: 'Puzzles · OotSS',
    loadComponent: () =>
      import('./puzzles/puzzles-page.component').then((m) => m.PuzzlesPageComponent),
  },
  { path: '**', redirectTo: 'categories' },
];
