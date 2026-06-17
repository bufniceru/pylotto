export interface RawDraw {
  date: string;
  numbers: number[];
}

export interface RawHistory {
  totalDraws: number;
  firstDraw: string;
  lastDraw: string;
  draws: RawDraw[];
}

export interface EnrichedNumber {
  value: number;
  gap: number;
  lastSeenOffset: number;
}

export interface EnrichedDraw {
  date: string;
  numbers: EnrichedNumber[];
}

export interface EnrichedHistory {
  draws: EnrichedDraw[];
}

export type HighlightView = "number" | "gap" | "difference";
export type WorkspaceView = "draws" | "nextPossibleDraw" | "highlights";

export interface WorkspaceTab {
  id: WorkspaceView;
  label: string;
}

export interface LastSeenHighlightPoint {
  number: number;
  drawIndex: number;
  gap: number;
  highlighted: boolean;
}

export interface LastSeenHighlightModel {
  points: LastSeenHighlightPoint[];
  drawCount: number;
  maxReferenceOffset: number;
  referenceDrawIndex: number | null;
  referenceDrawDate: string | null;
}

export interface LastSeenGapHighlightPoint {
  gap: number;
  gapGap: number;
  drawIndex: number;
  highlighted: boolean;
}

export interface LastSeenGapHighlightModel {
  points: LastSeenGapHighlightPoint[];
  drawCount: number;
  maxGap: number;
  maxReferenceOffset: number;
  referenceDrawIndex: number | null;
  referenceDrawDate: string | null;
}

export interface LastSeenDifferenceHighlightPoint {
  difference: number;
  drawIndex: number;
  highlighted: boolean;
}

export interface LastSeenDifferenceHighlightModel {
  points: LastSeenDifferenceHighlightPoint[];
  drawCount: number;
  maxDifference: number;
  maxReferenceOffset: number;
  referenceDrawIndex: number | null;
  referenceDrawDate: string | null;
}
