import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Participant } from '../models/roulette.model';
import defaultParticipants from '../data/participants.json';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ParticipantsService {
  private platformId = inject(PLATFORM_ID);

  // Estado reactivo de participantes usando Angular Signals
  private participantsSignal = signal<Participant[]>(
    defaultParticipants.map(p => ({ ...p, id: String(p.id) }))
  );

  // Estados de carga y error para la llamada HTTP
  public readonly isLoading = signal<boolean>(true);
  public readonly errorMessage = signal<string | null>(null);

  // Señal pública de solo lectura
  public readonly participants = this.participantsSignal.asReadonly();

  // Contador total de giros/victorias acumuladas
  public readonly totalWins = computed(() =>
    this.participantsSignal().reduce((sum, p) => sum + (p.wins || 0), 0)
  );

  constructor(private http: HttpClient) {
    // Solo ejecutamos la llamada en el navegador para no congelar el SSR mientras Render despierta
    if (isPlatformBrowser(this.platformId)) {
      this.fetchParticipants();
    } else {
      this.isLoading.set(false);
    }
  }

  /**
   * Obtiene la lista de participantes desde el backend (Render)
   */
  public fetchParticipants(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http.get<Participant[]>(`${environment.apiUrl}/participants/`).subscribe({
      next: (data) => {
        if (Array.isArray(data) && data.length > 0) {
          // Normalizamos el ID para aceptar tanto _id de MongoDB como id numérico
          const normalized = data.map((item) => ({
            ...item,
            id: item._id || item.id || String(Math.random()),
            wins: item.wins || 0
          }));
          this.participantsSignal.set(normalized);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn('No se pudo conectar al API de Render (posiblemente iniciando suspensión gratuita), usando datos locales:', err);
        this.errorMessage.set('Conectando con el servidor...');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Carga o actualiza manualmente la lista de participantes
   */
  public setParticipants(data: Participant[]): void {
    const normalized = data.map(item => ({
      ...item,
      id: item._id || item.id || String(Math.random()),
      wins: item.wins || 0
    }));
    this.participantsSignal.set(normalized);
  }

  /**
   * Incrementa en 1 las victorias del participante ganador
   */
  public incrementWins(id: string | number): Participant | undefined {
    let winnerUpdated: Participant | undefined;

    this.participantsSignal.update(currentList =>
      currentList.map(participant => {
        const participantId = participant._id || participant.id;
        if (participantId === id || String(participantId) === String(id)) {
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