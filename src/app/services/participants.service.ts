import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Participant, SpinResultStatus, WinConflictError, WinSuccessResponse } from '../models/roulette.model';
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
   * @param silent Si es true, actualiza los datos en segundo plano sin mostrar la pantalla de carga.
   */
  public fetchParticipants(force = false, silent = false): void {
    // Si no es forzado y ya tenemos datos en memoria, evitamos la llamada HTTP
    if (!force && this.participantsSignal().length > 0) {
      this.isLoading.set(false);
      return;
    }

    if (!silent) {
      this.isLoading.set(true);
    }
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
    this.fetchParticipants(true, false);
  }

  /**
   * Sincroniza silenciosamente en segundo plano con el servidor
   */
  public syncSilentFromApi(): void {
    this.fetchParticipants(true, true);
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
   * Registra una victoria en el backend (POST /participants/win).
   * Maneja tanto el caso exitoso (200 OK) como el conflicto de ganador diario ya existente (409 Conflict).
   */
  public registerWin(name: string, onComplete?: (status: SpinResultStatus) => void): void {
    const url = `${environment.apiUrl}/participants/win`;

    this.http.post<WinSuccessResponse>(url, { name }).subscribe({
      next: (response) => {
        console.log(`Victoria para "${name}" guardada en el backend:`, response);
        if (response?.participant?.wins !== undefined) {
          this.syncWinsFromServer(name, response.participant.wins);
        } else {
          this.incrementWinsByName(name);
        }

        if (onComplete) {
          onComplete({
            loading: false,
            isOfficialWin: true,
            message: response?.message || '¡Victoria oficial del día registrada exitosamente!'
          });
        }
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          const conflictBody = err.error as WinConflictError;
          console.warn('Ya existe un ganador hoy:', conflictBody);

          // Sincronizamos silenciosamente las victorias reales del servidor
          this.syncSilentFromApi();

          if (onComplete) {
            onComplete({
              loading: false,
              isOfficialWin: false,
              message: conflictBody?.error || 'Ya existe un ganador registrado para el día de hoy',
              dailyWinnerName: conflictBody?.winner?.name,
              dailyWinnerDate: conflictBody?.winner?.date
            });
          }
        } else {
          console.error(`Error al persistir la victoria de "${name}" en el backend:`, err);
          if (onComplete) {
            onComplete({
              loading: false,
              isOfficialWin: false,
              message: 'No se pudo conectar con el servidor para validar la victoria del día.'
            });
          }
        }
      }
    });
  }

  /**
   * Incrementa las victorias buscando por nombre
   */
  public incrementWinsByName(name: string): Participant | undefined {
    let winnerUpdated: Participant | undefined;

    this.participantsSignal.update(currentList => {
      const updatedList = currentList.map(participant => {
        if (participant.name.trim().toLowerCase() === name.trim().toLowerCase()) {
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
   * Sincroniza el contador exacto devuelto por el servidor
   */
  private syncWinsFromServer(name: string, exactWins: number): void {
    this.participantsSignal.update(currentList => {
      const updatedList = currentList.map(participant => {
        if (participant.name.trim().toLowerCase() === name.trim().toLowerCase()) {
          return {
            ...participant,
            wins: exactWins
          };
        }
        return participant;
      });
      this.saveToCache(updatedList);
      return updatedList;
    });
  }

  /**
   * Reinicia todos los contadores de victorias a 0 y limpia el historial diario en el backend (POST /participants/reset)
   */
  public resetWins(): void {
    this.isLoading.set(true);
    const url = `${environment.apiUrl}/participants/reset`;

    this.http.post<{ message: string }>(url, {}).subscribe({
      next: (res) => {
        console.log('Historial reiniciado en el servidor:', res);
        this.participantsSignal.update(currentList => {
          const updated = currentList.map(p => ({ ...p, wins: 0 }));
          this.saveToCache(updated);
          return updated;
        });
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al reiniciar historial en el servidor:', err);
        this.isLoading.set(false);
      }
    });
  }
}