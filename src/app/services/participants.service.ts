import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DailyWinnerRecord, Participant, SpinResultStatus, WinConflictError, WinSuccessResponse } from '../models/roulette.model';
import defaultParticipants from '../data/participants.json';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ParticipantsService {
  private platformId = inject(PLATFORM_ID);
  private readonly CACHE_KEY = 'ruleta_participants_cache';
  private readonly HISTORY_CACHE_KEY = 'ruleta_history_cache';

  // Paleta compartida para mantener el mismo color por participante en todas las vistas
  public readonly palette: string[] = [
    '#EF476F', // Rosa / Coral intenso
    '#F78C6B', // Naranja suave
    '#FFD166', // Amarillo dorado
    '#06D6A0', // Verde esmeralda
    '#118AB2', // Azul cerceta
    '#3A86FF', // Azul brillante
    '#8338EC', // Violeta eléctrico
    '#E056FD', // Lila neón
    '#20BF6B', // Verde jade
    '#FA8231', // Mandarina
    '#45AAF2', // Celeste vivo
    '#F43F5E'  // Carmesí
  ];

  // Estado reactivo de participantes e historial usando Angular Signals
  private participantsSignal = signal<Participant[]>([]);
  private historySignal = signal<DailyWinnerRecord[]>([]);

  // Estados de carga y error para las llamadas HTTP
  public readonly isLoading = signal<boolean>(false);
  public readonly isHistoryLoading = signal<boolean>(false);
  public readonly errorMessage = signal<string | null>(null);

  // Señales públicas de solo lectura
  public readonly participants = this.participantsSignal.asReadonly();
  public readonly history = this.historySignal.asReadonly();

  // Contador total de giros/victorias acumuladas
  public readonly totalWins = computed(() =>
    this.participantsSignal().reduce((sum, p) => sum + (p.wins || 0), 0)
  );

  constructor(private http: HttpClient) {
    if (isPlatformBrowser(this.platformId)) {
      this.initParticipants();
      this.initHistory();
    }
  }

  /**
   * Devuelve un color consistente para cualquier participante según su posición en la lista
   */
  public getColorForParticipantName(name: string): string {
    if (!name) return this.palette[0];
    const normalized = name.trim().toLowerCase();
    const list = this.participantsSignal();
    const index = list.findIndex(p => p.name.trim().toLowerCase() === normalized);
    if (index !== -1) {
      return list[index].color || this.palette[index % this.palette.length];
    }
    // Hash determinista de respaldo si el nombre no está en la lista actual
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
    }
    return this.palette[Math.abs(hash) % this.palette.length];
  }

  /**
   * Inicializa participantes aplicando el patrón Stale-While-Revalidate:
   * - Si hay caché local, lo muestra al instante (0 ms, sin pantalla de carga)
   *   y lanza una sincronización silenciosa en segundo plano para traer cambios recientes.
   * - Si no hay caché previo, muestra la pantalla de carga hasta que el API responda.
   */
  private initParticipants(): void {
    const cached = this.getCachedParticipants();
    if (cached && cached.length > 0) {
      this.participantsSignal.set(cached);
      this.isLoading.set(false);
      this.syncSilentFromApi();
    } else {
      this.fetchParticipants(true, false);
    }
  }

  /**
   * Inicializa el historial de ganadores diarios con Stale-While-Revalidate
   */
  private initHistory(): void {
    const cachedHistory = this.getCachedHistory();
    if (cachedHistory) {
      this.historySignal.set(cachedHistory);
      this.fetchHistory(true, true);
    } else {
      this.fetchHistory(true, false);
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
   * Lee el historial desde el almacenamiento local
   */
  private getCachedHistory(): DailyWinnerRecord[] | null {
    try {
      const data = localStorage.getItem(this.HISTORY_CACHE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error al leer caché de historial:', e);
    }
    return null;
  }

  /**
   * Guarda el historial en el almacenamiento local
   */
  private saveHistoryToCache(list: DailyWinnerRecord[]): void {
    try {
      localStorage.setItem(this.HISTORY_CACHE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Error al guardar caché de historial:', e);
    }
  }

  /**
   * Obtiene la lista de participantes desde el backend (Render).
   * @param force Si es true, ignora el caché y fuerza la llamada al API.
   * @param silent Si es true, actualiza los datos en segundo plano sin mostrar la pantalla de carga.
   */
  public fetchParticipants(force = false, silent = false): void {
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
   * Obtiene el historial de ganadores diarios desde GET /api/daily-winner
   */
  public fetchHistory(force = false, silent = false): void {
    if (!force && this.historySignal().length > 0) {
      this.isHistoryLoading.set(false);
      return;
    }

    if (!silent) {
      this.isHistoryLoading.set(true);
    }

    this.http.get<DailyWinnerRecord[]>(`${environment.apiUrl}/daily-winner`).subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          this.historySignal.set(data);
          this.saveHistoryToCache(data);
        }
        this.isHistoryLoading.set(false);
      },
      error: (err) => {
        console.warn('No se pudo obtener el historial desde /api/daily-winner:', err);
        this.isHistoryLoading.set(false);
      }
    });
  }

  /**
   * Forzar recarga desde el API (usado por el botón de refresh)
   */
  public refreshFromApi(): void {
    this.fetchParticipants(true, false);
    this.fetchHistory(true, true);
  }

  /**
   * Sincroniza silenciosamente en segundo plano con el servidor
   */
  public syncSilentFromApi(): void {
    this.fetchParticipants(true, true);
    this.fetchHistory(true, true);
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

        // Sincronizamos el historial para incluir el nuevo ganador del día
        this.fetchHistory(true, true);

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

          // Sincronizamos silenciosamente las victorias reales y el historial del servidor
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
        this.historySignal.set([]);
        this.saveHistoryToCache([]);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al reiniciar historial en el servidor:', err);
        this.isLoading.set(false);
      }
    });
  }
}
