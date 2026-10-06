import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import confetti from 'canvas-confetti';
import { Participant, WheelSlice } from '../../models/roulette.model';
import { ParticipantsService } from '../../services/participants.service';

@Component({
  selector: 'app-roulette',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roulette.component.html',
  styleUrl: './roulette.component.css'
})
export class RouletteComponent implements OnInit {
  // Lista de participantes activa sincronizada con el servicio
  participants: Participant[] = [];

  // Sectores geométricos de la ruleta moldeados dinámicamente según la cantidad N de participantes
  slices: WheelSlice[] = [];

  // Estado del giro
  isSpinning = false;
  currentRotation = 0;
  readonly spinDurationMs = 5000;

  // Participante ganador
  winner: Participant | null = null;

  // Parámetros de la ruleta SVG
  readonly center = 250;
  readonly radius = 230;

  // Paleta de colores atractiva y contrastante (ampliada para más variedad)
  readonly defaultPalette: string[] = [
    '#EF476F', // Rosa / Coral intenso
    '#F78C6B', // Naranja suave
    '#FFD166', // Amarillo dorado
    '#06D6A0', // Verde esmeralda
    '#118AB2', // Azul cerceta
    '#073B4C', // Azul marino profundo
    '#8338EC', // Violeta eléctrico
    '#3A86FF', // Azul brillante
    '#E056FD', // Lila neón
    '#20BF6B', // Verde jade
    '#FA8231', // Mandarina
    '#45AAF2'  // Celeste vivo
  ];

  constructor(public participantsService: ParticipantsService) {}

  ngOnInit(): void {
    // Sincronizamos con el servicio global de participantes
    this.refreshWheel();
  }

  /**
   * Refresca los datos y el moldeado de la ruleta dinámicamente
   */
  public refreshWheel(): void {
    this.participants = this.participantsService.participants();
    this.slices = this.moldWheel(this.participants);
  }

  /**
   * Recibe datos de participantes y ejecuta el moldeado de la ruleta.
   * Funciona para cualquier cantidad N de participantes (aumente o disminuya).
   */
  public loadParticipants(data: Participant[]): void {
    this.participantsService.setParticipants(data);
    this.refreshWheel();
  }

  /**
   * Función que toma CUALQUIER lista de participantes y moldea matemáticamente
   * la ruleta en partes iguales: 360 / N grados.
   */
  public moldWheel(data: Participant[]): WheelSlice[] {
    if (!data || data.length === 0) {
      return [];
    }

    const total = data.length;
    const sliceAngle = 360 / total;
    const fontSize = this.calculateFontSize(total);

    return data.map((item, index) => {
      const startAngle = index * sliceAngle;
      const endAngle = (index + 1) * sliceAngle;
      const midAngle = startAngle + sliceAngle / 2;

      // Color garantizado sin colisiones adyacentes
      const color = item.color || this.assignColor(index, total);

      let pathD: string;

      // Caso especial si solo hay 1 participante (círculo completo)
      if (total === 1) {
        pathD = `M ${this.center} ${this.center - this.radius} A ${this.radius} ${this.radius} 0 1 1 ${this.center - 0.01} ${this.center - this.radius} Z`;
      } else {
        // Ajustamos 0° para que comience en las 12 en punto (-90° en coordenadas estándar)
        const startRad = ((startAngle - 90) * Math.PI) / 180;
        const endRad = ((endAngle - 90) * Math.PI) / 180;

        const x1 = this.center + this.radius * Math.cos(startRad);
        const y1 = this.center + this.radius * Math.sin(startRad);
        const x2 = this.center + this.radius * Math.cos(endRad);
        const y2 = this.center + this.radius * Math.sin(endRad);

        const largeArcFlag = sliceAngle > 180 ? 1 : 0;
        pathD = `M ${this.center} ${this.center} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
      }

      return {
        id: item.id,
        name: item.name,
        wins: item.wins || 0,
        color,
        startAngle,
        endAngle,
        midAngle,
        pathD,
        textAngle: midAngle,
        textRadius: this.radius * 0.65,
        fontSize
      };
    });
  }

  /**
   * Asigna colores dinámicos evitando que sectores adyacentes repitan color.
   */
  private assignColor(index: number, total: number): string {
    if (total <= this.defaultPalette.length) {
      let colorIndex = index % this.defaultPalette.length;
      // Si el último coincide con el primero (por vuelta completa), elegimos otro tono de la paleta
      if (index === total - 1 && colorIndex === 0 && total > 1) {
        colorIndex = 1;
      }
      return this.defaultPalette[colorIndex];
    }
    // Si hay más participantes que colores en la paleta, generamos tonos armónicos continuos en HSL
    const hue = Math.round((index * 360) / total);
    return `hsl(${hue}, 75%, 52%)`;
  }

  /**
   * Adapta el tamaño del texto dinámicamente según la cantidad de participantes
   */
  private calculateFontSize(total: number): number {
    if (total <= 6) return 16;
    if (total <= 10) return 14;
    if (total <= 16) return 12;
    if (total <= 24) return 10;
    return 8;
  }

  /**
   * Ejecuta el giro lógico adaptado a cualquier cantidad N de sectores.
   */
  public spin(): void {
    if (this.isSpinning || this.slices.length === 0) {
      return;
    }

    this.isSpinning = true;
    this.winner = null;

    // 1. Seleccionar ganador al azar entre los N participantes actuales
    const winnerIndex = Math.floor(Math.random() * this.slices.length);
    const selectedWinner = this.participants[winnerIndex];
    const winningSlice = this.slices[winnerIndex];

    // 2. Calcular ángulo exacto para que el sector ganador quede bajo el puntero superior (12 en punto)
    const sliceAngle = 360 / this.slices.length;
    // Variación aleatoria natural dentro del sector (±30%)
    const randomOffsetInSlice = (Math.random() - 0.5) * (sliceAngle * 0.6);
    const targetSliceAngle = winningSlice.midAngle + randomOffsetInSlice;

    // El ángulo que debe rotar para que `targetSliceAngle` coincida con la aguja superior (0°)
    const baseAngle = (360 - (targetSliceAngle % 360)) % 360;

    // Vueltas completas de giro (entre 5 y 8 vueltas completas)
    const fullTurns = 5 + Math.floor(Math.random() * 3);

    // Calculamos el delta acumulativo para que siempre gire en sentido horario sin retrocesos
    const currentNormalized = this.currentRotation % 360;
    const delta = ((baseAngle - currentNormalized + 360) % 360) + (fullTurns * 360);

    this.currentRotation += delta;

    // 3. Al concluir la animación CSS (5 segundos), actualizamos contador y anunciamos
    setTimeout(() => {
      this.isSpinning = false;
      const updatedWinner = this.participantsService.incrementWins(selectedWinner.id);
      this.winner = updatedWinner || selectedWinner;
      this.refreshWheel();
      this.celebrate();
    }, this.spinDurationMs);
  }

  /**
   * Efecto festivo de confeti al anunciarse el ganador.
   */
  private celebrate(): void {
    if (typeof window !== 'undefined') {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });

      // Segunda ráfaga lateral
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0.05, y: 0.65 }
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 0.95, y: 0.65 }
        });
      }, 300);
    }
  }

  /**
   * Retorna el color asignado al ganador
   */
  public getWinnerColor(winner: Participant | null): string {
    if (!winner) return '#FFD166';
    const slice = this.slices.find(s => s.id === winner.id);
    return slice?.color || '#FFD166';
  }

  /**
   * Cierra el modal del ganador
   */
  public closeWinnerModal(): void {
    this.winner = null;
  }
}