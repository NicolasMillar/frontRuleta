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
  private readonly CACHE_KEY = 'ruleta_participants_cache';

  // Estado reactivo de participantes usando Angular Signals
  private participantsSignal = signal<Participant[]>([]);

  // Estados de carga y error para la llamada HTTP
  public readonly isLoading = signal<boolean>(false);
  public readonly errorMessage = signal<string | null>(null);

  // Señal pública de solo lectura
  public readonly participants = this.participantsSignal.asReadonly();

  // Contador total de giros/victorias acumuladas
  public readonly totalWins = computed(() =>
    this.participantsSignal().reduce((sum, p) => sum + (p.wins || 0), 0)
  );

  constructor(private http: HttpClient) {
    if (isPlatformBrowser(this.platformId)) {
      this.initParticipants();
    }
  }

  /**
   * Inicializa participantes revisando primero el caché local.
   * Si hay caché, no consume el API; si está vacío, hace la petición inicial.
   */
  private initParticipants(): void {
    const cached = this.getCachedParticipants();
    if (cached && cached.length > 0) {
      // Usamos el caché en memoria inmediatamente (0 ms de espera)
      this.participantsSignal.set(cached);
      this.isLoading.set(false);
    } else {
      // Primera vez o sin caché previo: consultamos el API
      this.fetchParticipants(true);
    }
  }

  /**
   * Lee la lista de participantes desde el almacenamiento local
   */
  private getCachedParticipants(): Participant[] | null {
    try {
      const data = localStorage.getItem(this.CACHE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error al leer caché local:', e);
    }
    return null;
  }

  /**
   * Guarda la lista de participantes en el almacenamiento local
   */
  private saveToCache(list: Participant[]): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Error al guardar en caché local:', e);
    }
  }

  /**
   * Obtiene la lista de participantes desde el backend (Render).
   * @param force Si es true, ignora el caché y fuerza la llamada al API.
   */
  public fetchParticipants(force = false): void {
    // Si no es forzado y ya tenemos datos en memoria, evitamos la llamada HTTP
    if (!force && this.participantsSignal().length > 0) {
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http.get<Participant[]>(`${environment.apiUrl}/participants/`).subscribe({
      next: (data) => {
        if (Array.isArray(data) && data.length > 0) {
          const normalized = data.map((item) => ({
            ...item,
            id: item._id || item.id || String(Math.random()),
            wins: item.wins || 0
          }));
          this.participantsSignal.set(normalized);
          this.saveToCache(normalized);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn('No se pudo conectar al API de Render, usando datos disponibles:', err);
        const cached = this.getCachedParticipants();
        if (!cached || cached.length === 0) {
          const fallback = defaultParticipants.map(p => ({ ...p, id: String(p.id) }));
          this.participantsSignal.set(fallback);
          this.saveToCache(fallback);
        }
        this.errorMessage.set('No se pudo conectar al servidor');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Forzar recarga desde el API (usado por el botón de refresh)
   */
  public refreshFromApi(): void {
    this.fetchParticipants(true);
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
    this.saveToCache(normalized);
  }

  /**
   * Incrementa en 1 las victorias del participante ganador y actualiza caché
   */
  public incrementWins(id: string | number): Participant | undefined {
    let winnerUpdated: Participant | undefined;

    this.participantsSignal.update(currentList => {
      const updatedList = currentList.map(participant => {
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
      });
      this.saveToCache(updatedList);
      return updatedList;
    });

    return winnerUpdated;
  }

  /**
   * Reinicia todos los contadores de victorias a 0 y actualiza caché
   */
  public resetWins(): void {
    this.participantsSignal.update(currentList => {
      const updated = currentList.map(p => ({ ...p, wins: 0 }));
      this.saveToCache(updated);
      return updated;
    });
  }
}