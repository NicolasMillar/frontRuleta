export interface Participant {
  id?: string | number;
  _id?: string;
  name: string;
  wins: number;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WheelSlice {
  id: string | number;
  name: string;
  wins: number;
  color: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  pathD: string;
  textAngle: number;
  textRadius: number;
  fontSize: number;
}