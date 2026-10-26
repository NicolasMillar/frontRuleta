import { Routes } from '@angular/router';
import { RouletteComponent } from './components/roulette/roulette.component';
import { RankingComponent } from './components/ranking/ranking.component';
import { HistoryComponent } from './components/history/history.component';

export const routes: Routes = [
  { path: '', redirectTo: 'ruleta', pathMatch: 'full' },
  { path: 'ruleta', component: RouletteComponent, title: 'Ruleta de la Suerte' },
  { path: 'ranking', component: RankingComponent, title: 'Tabla de Victorias' },
  { path: 'historial', component: HistoryComponent, title: 'Historial y Carrera' },
  { path: '**', redirectTo: 'ruleta' }
];
