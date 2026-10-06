import { Injectable, signal, computed } from '@angular/core';
import { Participant } from '../models/roulette.model';
import defaultParticipants from '../data/participants.json';

@Injectable({
  providedIn: 'root'
})
export class ParticipantsService {
  // Estado reactivo de participantes usando Angular Signals
  private participantsSignal = signal<Participant[]>(defaultParticipants);

  // Señal pública de solo lectura
  public readonly participants = this.participantsSignal.asReadonly();

  // Contador total de giros/victorias acumuladas
  public readonly totalWins = computed(() =>
    this.participantsSignal().reduce((sum, p) => sum + (p.wins || 0), 0)
  );

  /**
   * Carga o actualiza la lista de participantes (preparado para recibir datos de API)
   */
  public setParticipants(data: Participant[]): void {
    this.participantsSignal.set(data);
  }

  /**
   * Incrementa en 1 las victorias del participante ganador
   */
  public incrementWins(id: number): Participant | undefined {
    let winnerUpdated: Participant | undefined;

    this.participantsSignal.update(currentList =>
      currentList.map(participant => {
        if (participant.id === id) {
          const updated = {
            ...participant,
            wins: (participant.wins || 0) + 1
          };
          winnerUpdated = updated;
          return updated;
        }
        return participant;
      })
    );

    return winnerUpdated;
  }

  /**
   * Reinicia todos los contadores de victorias a 0
   */
  public resetWins(): void {
    this.participantsSignal.update(currentList =>
      currentList.map(p => ({ ...p, wins: 0 }))
    );
  }
}