import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ParticipantsService } from '../../services/participants.service';
import { Participant } from '../../models/roulette.model';
import { LoadingComponent } from '../loading/loading.component';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingComponent],
  templateUrl: './ranking.component.html',
  styleUrl: './ranking.component.css'
})
export class RankingComponent {
  // Lista ordenada por victorias descendente
  readonly rankedParticipants = computed(() => {
    const list = [...this.participantsService.participants()];
    return list.sort((a, b) => (b.wins || 0) - (a.wins || 0));
  });

  /**
   * El botón de reinicio solo está habilitado el 1 de enero (día 1 del mes 0),
   * independientemente del año.
   */
  public get isNewYearDay(): boolean {
    const today = new Date();
    return today.getMonth() === 0 && today.getDate() === 1;
  }

  constructor(public participantsService: ParticipantsService) { }

  public getParticipantColor(_index: number, participant: Participant): string {
    return participant.color || this.participantsService.getColorForParticipantName(participant.name);
  }

  public getWinPercentage(wins: number): number {
    const total = this.participantsService.totalWins();
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  }

  public resetScores(): void {
    if (!this.isNewYearDay) return;

    if (confirm('¿Estás seguro de que deseas limpiar el historial del día y reiniciar todos los contadores de victorias a 0 en el servidor?')) {
      this.participantsService.resetWins();
    }
  }
}
