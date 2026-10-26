import { Component, computed, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ParticipantsService } from '../../services/participants.service';
import { DailyWinnerRecord } from '../../models/roulette.model';
import { LoadingComponent } from '../loading/loading.component';

export interface CalendarDayCell {
  dayNumber: number | null;
  dateKey: string;
  isToday: boolean;
  winnerName: string | null;
  winnerColor: string | null;
  winnerBg: string | null;
  formattedDate: string;
}

export interface RaceStep {
  dateKey: string;
  label: string;
  winnerName: string;
  scores: Record<string, number>;
}

export interface RaceBarItem {
  name: string;
  color: string;
  wins: number;
  percentage: number;
  isStepWinner: boolean;
}

export interface RaceLineSeries {
  name: string;
  color: string;
  points: string;
  dots: { x: number; y: number; value: number; dateLabel: string; wonThisDay: boolean }[];
  lastX: number;
  lastY: number;
  totalWins: number;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent implements OnDestroy {
  readonly weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Mes y año seleccionados en el calendario
  readonly viewYear = signal<number>(new Date().getFullYear());
  readonly viewMonth = signal<number>(new Date().getMonth());

  // Control de reproducción del gráfico de carrera (null = mostrar estado final completo)
  readonly activeStepIndex = signal<number | null>(null);
  readonly isPlayingRace = signal<boolean>(false);
  private raceTimer: ReturnType<typeof setInterval> | null = null;

  // Mapa de ganadores por fecha YYYY-MM-DD
  readonly winnersByDate = computed(() => {
    const map = new Map<string, DailyWinnerRecord>();
    for (const rec of this.participantsService.history()) {
      const key = this.extractDateKey(rec.date || rec.createdAt || '');
      if (key) {
        map.set(key, rec);
      }
    }
    return map;
  });

  // Etiqueta del mes actual en vista
  readonly currentMonthLabel = computed(() => {
    return `${this.monthNames[this.viewMonth()]} ${this.viewYear()}`;
  });

  // Leyenda de participantes con sus victorias en el mes seleccionado
  readonly monthLegend = computed(() => {
    const year = this.viewYear();
    const month = String(this.viewMonth() + 1).padStart(2, '0');
    const prefix = `${year}-${month}-`;
    const dateMap = this.winnersByDate();

    const counts = new Map<string, number>();
    dateMap.forEach((rec, key) => {
      if (key.startsWith(prefix)) {
        const cleanName = rec.name.trim();
        counts.set(cleanName, (counts.get(cleanName) || 0) + 1);
      }
    });

    const participants = this.participantsService.participants();
    return participants.map(p => ({
      name: p.name,
      color: this.participantsService.getColorForParticipantName(p.name),
      monthWins: counts.get(p.name.trim()) || 0
    }));
  });

  // Celdas del calendario para el mes seleccionado (Lunes a Domingo)
  readonly calendarCells = computed<CalendarDayCell[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const dateMap = this.winnersByDate();

    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Ajustar para que Lunes sea 0 y Domingo sea 6
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const cells: CalendarDayCell[] = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({
        dayNumber: null,
        dateKey: '',
        isToday: false,
        winnerName: null,
        winnerColor: null,
        winnerBg: null,
        formattedDate: ''
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const record = dateMap.get(dateKey);
      const winnerName = record ? record.name : null;
      const winnerColor = winnerName ? this.participantsService.getColorForParticipantName(winnerName) : null;

      cells.push({
        dayNumber: day,
        dateKey,
        isToday: dateKey === todayKey,
        winnerName,
        winnerColor,
        winnerBg: winnerColor ? `${winnerColor}24` : null,
        formattedDate: `${day} de ${this.monthNames[month]} de ${year}`
      });
    }

    return cells;
  });

  // Pasos cronológicos de la carrera a partir del historial
  readonly raceSteps = computed<RaceStep[]>(() => {
    const dateMap = this.winnersByDate();
    const sortedKeys = Array.from(dateMap.keys()).sort();
    const runningScores: Record<string, number> = {};

    // Inicializar todos los participantes en 0
    for (const p of this.participantsService.participants()) {
      runningScores[p.name] = 0;
    }

    const steps: RaceStep[] = [];
    for (const key of sortedKeys) {
      const rec = dateMap.get(key)!;
      const cleanName = rec.name.trim();
      runningScores[cleanName] = (runningScores[cleanName] || 0) + 1;

      steps.push({
        dateKey: key,
        label: this.formatShortDate(key),
        winnerName: cleanName,
        scores: { ...runningScores }
      });
    }

    return steps;
  });

  // Paso actualmente visible en la carrera
  readonly currentRaceStep = computed<RaceStep | null>(() => {
    const steps = this.raceSteps();
    if (steps.length === 0) return null;
    const idx = this.activeStepIndex();
    if (idx === null || idx >= steps.length) {
      return steps[steps.length - 1];
    }
    if (idx < 0) return null;
    return steps[idx];
  });

  // Barras horizontales ordenadas para la pista de carrera
  readonly raceBars = computed<RaceBarItem[]>(() => {
    const step = this.currentRaceStep();
    const participants = this.participantsService.participants();

    // Si hay historial, usamos el acumulado hasta el paso actual; si no, usamos las victorias generales
    const list = participants.map(p => {
      const wins = step ? (step.scores[p.name.trim()] ?? 0) : (p.wins || 0);
      return {
        name: p.name,
        color: this.participantsService.getColorForParticipantName(p.name),
        wins,
        percentage: 0,
        isStepWinner: step ? step.winnerName.toLowerCase() === p.name.trim().toLowerCase() : false
      };
    });

    list.sort((a, b) => b.wins - a.wins);
    const maxWins = Math.max(1, ...list.map(i => i.wins));

    return list.map(item => ({
      ...item,
      percentage: item.wins > 0 ? Math.max(12, Math.round((item.wins / maxWins) * 100)) : 0
    }));
  });

  // Dimensiones del gráfico SVG de líneas de carrera
  readonly svgWidth = 780;
  readonly svgHeight = 280;
  readonly padLeft = 48;
  readonly padRight = 115;
  readonly padTop = 26;
  readonly padBottom = 42;

  // Datos calculados para el gráfico SVG de líneas acumuladas
  readonly raceChartData = computed(() => {
    const allSteps = this.raceSteps();
    const activeIdx = this.activeStepIndex();
    const visibleSteps = activeIdx === null ? allSteps : allSteps.slice(0, activeIdx + 1);

    const plotW = this.svgWidth - this.padLeft - this.padRight;
    const plotH = this.svgHeight - this.padTop - this.padBottom;

    // Puntos del eje X: Punto 0 ("Inicio") + cada fecha registrada
    const totalPoints = visibleSteps.length + 1;
    const getX = (i: number) =>
      totalPoints === 1
        ? this.padLeft
        : this.padLeft + (i / (totalPoints - 1)) * plotW;

    // Determinar el máximo de victorias en el eje Y
    let maxWins = 1;
    for (const s of visibleSteps) {
      for (const val of Object.values(s.scores)) {
        if (val > maxWins) maxWins = val;
      }
    }

    const getY = (val: number) =>
      this.padTop + plotH - (val / maxWins) * plotH;

    // Líneas guía horizontales (Eje Y)
    const yTicks: { value: number; y: number }[] = [];
    for (let v = 0; v <= maxWins; v++) {
      yTicks.push({ value: v, y: getY(v) });
    }

    // Etiquetas del eje X
    const xLabels: { label: string; x: number }[] = [
      { label: 'Inicio', x: getX(0) },
      ...visibleSteps.map((s, idx) => ({ label: s.label, x: getX(idx + 1) }))
    ];

    // Participantes que tienen al menos 1 victoria en el historial (o todos si nadie ha ganado aún)
    const finalScores = visibleSteps.length > 0 ? visibleSteps[visibleSteps.length - 1].scores : {};
    let activeParticipants = this.participantsService.participants().filter(
      p => (finalScores[p.name.trim()] || 0) > 0
    );
    if (activeParticipants.length === 0) {
      activeParticipants = this.participantsService.participants().slice(0, 5);
    }

    const series: RaceLineSeries[] = activeParticipants.map(p => {
      const cleanName = p.name.trim();
      const color = this.participantsService.getColorForParticipantName(p.name);
      const dots = [
        { x: getX(0), y: getY(0), value: 0, dateLabel: 'Inicio', wonThisDay: false }
      ];

      visibleSteps.forEach((step, idx) => {
        const val = step.scores[cleanName] || 0;
        dots.push({
          x: getX(idx + 1),
          y: getY(val),
          value: val,
          dateLabel: step.label,
          wonThisDay: step.winnerName.toLowerCase() === cleanName.toLowerCase()
        });
      });

      const points = dots.map(d => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ');
      const lastDot = dots[dots.length - 1];

      return {
        name: p.name,
        color,
        points,
        dots,
        lastX: lastDot.x,
        lastY: lastDot.y,
        totalWins: lastDot.value
      };
    });

    return { yTicks, xLabels, series };
  });

  constructor(public participantsService: ParticipantsService) { }

  ngOnDestroy(): void {
    this.stopRace();
  }

  public prevMonth(): void {
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update(y => y - 1);
    } else {
      this.viewMonth.update(m => m - 1);
    }
  }

  public nextMonth(): void {
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update(y => y + 1);
    } else {
      this.viewMonth.update(m => m + 1);
    }
  }

  public goToCurrentMonth(): void {
    const now = new Date();
    this.viewYear.set(now.getFullYear());
    this.viewMonth.set(now.getMonth());
  }

  public scrollToRace(): void {
    const el = document.getElementById('race-chart-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  public togglePlayRace(): void {
    if (this.isPlayingRace()) {
      this.stopRace();
      return;
    }

    const steps = this.raceSteps();
    if (steps.length === 0) return;

    this.isPlayingRace.set(true);
    this.activeStepIndex.set(0);

    this.raceTimer = setInterval(() => {
      const current = this.activeStepIndex() ?? 0;
      const total = this.raceSteps().length;
      if (current + 1 < total) {
        this.activeStepIndex.set(current + 1);
      } else {
        this.stopRace();
        this.activeStepIndex.set(null);
      }
    }, 1100);
  }

  public stopRace(): void {
    if (this.raceTimer) {
      clearInterval(this.raceTimer);
      this.raceTimer = null;
    }
    this.isPlayingRace.set(false);
  }

  public selectStep(index: number | null): void {
    this.stopRace();
    this.activeStepIndex.set(index);
  }

  private extractDateKey(raw: string): string {
    if (!raw) return '';
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private formatShortDate(dateKey: string): string {
    const parts = dateKey.split('-');
    if (parts.length !== 3) return dateKey;
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const shortMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${day} ${shortMonths[monthIdx] || ''}`;
  }
}

