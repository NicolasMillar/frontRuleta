export interface Participant {
  id: number;
  name: string;
  color?: string;
}

export interface WheelSlice {
  id: number;
  name: string;
  color: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  pathD: string;
  textAngle: number;
  textRadius: number;
}