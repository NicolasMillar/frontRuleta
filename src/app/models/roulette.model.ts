export interface Participant {
  id: number;
  name: string;
  wins: number;
  color?: string;
}

export interface WheelSlice {
  id: number;
  name: string;
  wins: number;
  color: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  pathD: string;
  textAngle: number;
  textRadius: number;
}