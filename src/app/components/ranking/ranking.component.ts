import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ParticipantsService } from '../../services/participants.service';
import { Participant } from '../../models/roulette.model';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ranking.component.html',
  styleUrl: './ranking.component.css'
})
export class RankingComponent {
  // Lista ordenada por victorias descendente
  readonly rankedParticipants = computed(() => {
    const list = [...this.participantsService.participants()];
    return list.sort((a, b) => (b.wins || 0) - (a.wins || 0));
  });

  // Paleta de colores para los avatares
  readonly palette: string[] = [
    '#EF476F', '#F78C6B', '#FFD166', '#06D6A0',
    '#118AB2', '#073B4C', '#8338EC', '#3A86FF'
  ];

  constructor(public participantsService: ParticipantsService) {}

  public getParticipantColor(index: number, participant: Participant): string {
    return participant.color || this.palette[participant.id % this.palette.length];
  }

  public getWinPercentage(wins: number): number {
    const total = this.participantsService.totalWins();
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  }

  public resetScores(): void {
    if (confirm('¿Estás seguro de que deseas reiniciar todos los contadores de victorias a 0?')) {
      this.participantsService.resetWins();
    }
  }
}

