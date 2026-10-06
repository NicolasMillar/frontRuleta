import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Participant, WheelSlice } from '../../models/roulette.model';
import defaultParticipants from '../../data/participants.json';

@Component({
  selector: 'app-roulette',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roulette.component.html',
  styleUrl: './roulette.component.css'
})
export class RouletteComponent implements OnInit {
  // Lista de participantes (actualmente cargada del JSON local, lista para conectarse a un API)
  participants: Participant[] = [];

  // Sectores geométricos de la ruleta moldeados a partir de los participantes
  slices: WheelSlice[] = [];

  // Parámetros de la ruleta SVG
  readonly center = 250;
  readonly radius = 230;

  // Paleta de colores atractiva y contrastante
  readonly defaultPalette: string[] = [
    '#EF476F', // Rosa / Coral intenso
    '#F78C6B', // Naranja suave
    '#FFD166', // Amarillo dorado
    '#06D6A0', // Verde esmeralda
    '#118AB2', // Azul cerceta
    '#073B4C', // Azul marino profundo
    '#8338EC', // Violeta eléctrico
    '#3A86FF'  // Azul brillante
  ];

  ngOnInit(): void {
    // Inicializamos con el JSON por defecto
    this.loadParticipants(defaultParticipants);
  }

  /**
   * Recibe el JSON de participantes (desde archivo local o API)
   * y ejecuta el moldeado de la ruleta.
   */
  public loadParticipants(data: Participant[]): void {
    this.participants = data;
    this.slices = this.moldWheel(this.participants);
  }

  /**
   * Función encargada de tomar la lista/JSON de participantes y moldear
   * las porciones (slices) matemáticas de la ruleta: ángulos, caminos SVG (path) y posición del texto.
   */
  public moldWheel(data: Participant[]): WheelSlice[] {
    if (!data || data.length === 0) {
      return [];
    }

    const total = data.length;
    const sliceAngle = 360 / total;

    return data.map((item, index) => {
      const startAngle = index * sliceAngle;
      const endAngle = (index + 1) * sliceAngle;
      const midAngle = startAngle + sliceAngle / 2;

      // Color asignado o provisto en el JSON
      const color = item.color || this.defaultPalette[index % this.defaultPalette.length];

      // Cálculo del Path SVG (arco circular desde el centro)
      // Ajustamos 0° para que comience en las 12 en punto (-90° en coordenadas estándar)
      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 = this.center + this.radius * Math.cos(startRad);
      const y1 = this.center + this.radius * Math.sin(startRad);
      const x2 = this.center + this.radius * Math.cos(endRad);
      const y2 = this.center + this.radius * Math.sin(endRad);

      const largeArcFlag = sliceAngle > 180 ? 1 : 0;

      // Comando SVG Path: Mueve al centro, dibuja línea al inicio del arco, arco hasta el final, cierra al centro
      const pathD = `M ${this.center} ${this.center} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;

      return {
        id: item.id,
        name: item.name,
        color,
        startAngle,
        endAngle,
        midAngle,
        pathD,
        textAngle: midAngle,
        textRadius: this.radius * 0.65
      };
    });
  }
}

