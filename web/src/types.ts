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

export interface PredictiveScoreNumber {
  number: number;
  score: number;
  rank: number;
  isTopPick: boolean;
  markovScore: number;
  transitionScore: number;
  frequencyScore: number;
  recencyScore: number;
  gapScore: number;
  pairAffinityScore: number;
  gapStateBucket: number;
  gapStateProbability: number;
  recentHits: number;
  currentGap: number;
}

export interface PredictiveScoreGrid {
  name: string;
  totalDraws: number;
  firstDraw: string;
  lastDraw: string;
  recentDrawWindow: number;
  markovModel: string;
  gapStateMaxGap: number;
  topNumbers: number[];
  numbers: PredictiveScoreNumber[];
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
