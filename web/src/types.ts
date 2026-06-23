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
export type WorkspaceView =
  | "draws"
  | "drawScores"
  | "allDraws"
  | "nextPossibleDrawPossible"
  | "nextPossibleDrawScoreGrid"
  | "nextPossibleDrawReal"
  | "lastSeenHighlight"
  | "lastSeenGapHighlight"
  | "lastSeenDifferenceHighlight"
  | "entropy"
  | "freshness"
  | "proximity"
  | "chiSquare"
  | "autocorrelation"
  | "coOccurrence"
  | "markovScore"
  | "bayesianMarkov"
  | "mixedPrediction"
  | "scoreGraphs";

export interface WorkspaceTab {
  id: WorkspaceView;
  label: string;
}

export interface AppSettings {
  implementLawOfLargeNumbers: boolean;
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
  referenceGaps: number[];
  referenceGapNumbers: Record<number, number[]>;
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

export interface FreshnessBucket {
  id: string;
  label: string;
  description: string;
  color: string;
}

export interface FreshnessSituation {
  signature: string;
  count: number;
  percent: number;
  latestDate: string;
  examples: string[];
}

export interface FreshnessBucketSummary {
  bucketId: string;
  label: string;
  drawnCount: number;
  exposureCount: number;
  hitRate: number;
  drawShare: number;
}

export interface FreshnessPrediction {
  number: number;
  bucketId: string;
  label: string;
  currentGap: number | null;
  hitRate: number;
  rank: number;
}

export interface FreshnessDrawProfile {
  date: string;
  signature: string;
  labels: string[];
  numbers: {
    number: number;
    gap: number | null;
    bucketId: string;
    label: string;
  }[];
}

export interface FreshnessDoubletSummary {
  pair: string;
  numbers: [number, number];
  gap: number | null;
  bucketId: string;
  label: string;
  hitRate: number;
  rank: number;
}

export interface FreshnessDoubletBucketSummary {
  bucketId: string;
  label: string;
  drawnCount: number;
  exposureCount: number;
  hitRate: number;
  drawShare: number;
}

export interface FreshnessDoubletProfile {
  date: string;
  signature: string;
  doublets: FreshnessDoubletSummary[];
}

export interface FreshnessTripletSummary {
  triplet: string;
  numbers: [number, number, number];
  gap: number | null;
  bucketId: string;
  label: string;
  hitRate: number;
  rank: number;
}

export interface FreshnessTripletBucketSummary {
  bucketId: string;
  label: string;
  drawnCount: number;
  exposureCount: number;
  hitRate: number;
  drawShare: number;
}

export interface FreshnessTripletProfile {
  date: string;
  signature: string;
  triplets: FreshnessTripletSummary[];
}

export interface FreshnessModel {
  buckets: FreshnessBucket[];
  drawCount: number;
  situationCount: number;
  situations: FreshnessSituation[];
  bucketSummaries: FreshnessBucketSummary[];
  predictions: FreshnessPrediction[];
  latestProfile: FreshnessDrawProfile | null;
  doubletBucketSummaries: FreshnessDoubletBucketSummary[];
  doubletPredictions: FreshnessDoubletSummary[];
  latestDoubletProfile: FreshnessDoubletProfile | null;
  tripletBucketSummaries: FreshnessTripletBucketSummary[];
  tripletPredictions: FreshnessTripletSummary[];
  latestTripletProfile: FreshnessTripletProfile | null;
}

export interface ProximityBucket {
  id: string;
  label: string;
  description: string;
  color: string;
}

export interface ProximitySituation {
  signature: string;
  count: number;
  percent: number;
  latestDate: string;
  examples: string[];
}

export interface ProximityBucketSummary {
  bucketId: string;
  label: string;
  count: number;
  share: number;
  averageNearestDistance: number;
}

export interface ProximityPrediction {
  number: number;
  bucketId: string;
  label: string;
  appearances: number;
  score: number;
  rank: number;
}

export interface ProximityDrawProfile {
  date: string;
  signature: string;
  numbers: {
    number: number;
    nearestDistance: number;
    leftDistance: number | null;
    rightDistance: number | null;
    bucketId: string;
    label: string;
  }[];
}

export interface ProximityModel {
  buckets: ProximityBucket[];
  drawCount: number;
  situationCount: number;
  situations: ProximitySituation[];
  bucketSummaries: ProximityBucketSummary[];
  predictions: ProximityPrediction[];
  latestProfile: ProximityDrawProfile | null;
}

export interface ChiSquareBand {
  id: string;
  label: string;
  description: string;
  color: string;
}

export interface ChiSquareNumberSummary {
  number: number;
  observed: number;
  expected: number;
  difference: number;
  residual: number;
  contribution: number;
  share: number;
  rank: number;
  bandId: string;
  label: string;
}

export interface ChiSquareModel {
  bands: ChiSquareBand[];
  drawCount: number;
  totalObserved: number;
  expectedPerNumber: number;
  statistic: number;
  degreesOfFreedom: number;
  pValue: number;
  critical95: number;
  critical99: number;
  maxContribution: number;
  interpretation: string;
  numberSummaries: ChiSquareNumberSummary[];
  latestProfile: {
    date: string | null;
    signature: string;
    numbers: ChiSquareNumberSummary[];
  };
}

export interface AutocorrelationBand {
  id: string;
  label: string;
  description: string;
  color: string;
}

export interface AutocorrelationLagSummary {
  lag: number;
  pairCount: number;
  averageOverlap: number;
  expectedOverlap: number;
  overlapDelta: number;
  overlapRate: number;
  averageDoublets: number;
  expectedDoublets: number;
  doubletDelta: number;
  averageTriplets: number;
  expectedTriplets: number;
  tripletDelta: number;
  numberPresenceCorrelation: number;
  sumCorrelation: number;
  oddCountCorrelation: number;
  lowCountCorrelation: number;
  score: number;
  bandId: string;
  label: string;
}

export interface AutocorrelationNumberSummary {
  number: number;
  appearances: number;
  strongestLag: number;
  strongestCorrelation: number;
  score: number;
  bandId: string;
  label: string;
  rank: number;
}

export interface AutocorrelationModel {
  bands: AutocorrelationBand[];
  drawCount: number;
  maxLag: number;
  expectedOverlap: number;
  expectedDoublets: number;
  expectedTriplets: number;
  lagSummaries: AutocorrelationLagSummary[];
  numberSummaries: AutocorrelationNumberSummary[];
  strongestLag: AutocorrelationLagSummary | null;
  strongestPositiveLag: AutocorrelationLagSummary | null;
  strongestNegativeLag: AutocorrelationLagSummary | null;
  latestProfile: {
    date: string | null;
    signature: string;
    numbers: AutocorrelationNumberSummary[];
  };
  interpretation: string;
}

export interface CoOccurrenceBand {
  id: string;
  label: string;
  description: string;
  color: string;
}

export interface CoOccurrenceEdge {
  pair: string;
  numbers: [number, number];
  count: number;
  expected: number;
  lift: number;
  residual: number;
  share: number;
  rank: number;
  bandId: string;
  label: string;
}

export interface CoOccurrenceNode {
  number: number;
  appearances: number;
  weightedDegree: number;
  averagePartnerCount: number;
  strongestPartner: number | null;
  strongestPartnerCount: number;
  strongestPartnerLift: number;
  rank: number;
}

export interface CoOccurrencePrediction {
  number: number;
  rank: number;
  score: number;
  averageLift: number;
  totalCount: number;
  strongestPartner: number | null;
  strongestPartnerCount: number;
  strongestPartnerLift: number;
  bandId: string;
  label: string;
}

export interface CoOccurrenceModel {
  bands: CoOccurrenceBand[];
  drawCount: number;
  totalPairEvents: number;
  expectedPairCount: number;
  pairUniverseSize: number;
  maxEdgeCount: number;
  maxWeightedDegree: number;
  edges: CoOccurrenceEdge[];
  nodes: CoOccurrenceNode[];
  predictions: CoOccurrencePrediction[];
  networkEdges: CoOccurrenceEdge[];
  latestProfile: {
    date: string | null;
    signature: string;
    edges: CoOccurrenceEdge[];
  };
  interpretation: string;
}

export interface MarkovScoreBand {
  id: string;
  label: string;
  description: string;
  color: string;
}

export interface MarkovScoreSituation {
  signature: string;
  count: number;
  percent: number;
  latestDate: string;
  examples: string[];
}

export interface MarkovScoreBucketSummary {
  bucket: number;
  weightedOpportunities: number;
  weightedHits: number;
  probability: number;
  score: number;
  bandId: string;
  label: string;
}

export interface MarkovScorePrediction {
  number: number;
  rank: number;
  score: number;
  probability: number;
  currentGap: number;
  bucket: number;
  bandId: string;
  label: string;
}

export interface MarkovScoreDrawProfile {
  date: string;
  signature: string;
  numbers: {
    number: number;
    gap: number;
    bucket: number;
    probability: number;
    score: number;
    bandId: string;
    label: string;
  }[];
}

export interface MarkovScoreModel {
  bands: MarkovScoreBand[];
  drawCount: number;
  situationCount: number;
  halfLife: number;
  priorStrength: number;
  maxGapBucket: number;
  situations: MarkovScoreSituation[];
  bucketSummaries: MarkovScoreBucketSummary[];
  predictions: MarkovScorePrediction[];
  latestProfile: MarkovScoreDrawProfile | null;
}

export interface BayesianMarkovBucketSummary {
  bucket: number;
  opportunities: number;
  hits: number;
  observedRate: number;
  posteriorMean: number;
  posteriorMedian: number;
  credibleLow90: number;
  credibleHigh90: number;
  score: number;
  bandId: string;
  label: string;
}

export interface BayesianMarkovPrediction {
  number: number;
  rank: number;
  score: number;
  currentGap: number;
  bucket: number;
  posteriorMean: number;
  posteriorMedian: number;
  credibleLow90: number;
  credibleHigh90: number;
  bandId: string;
  label: string;
}

export interface BayesianMarkovProfileNumber {
  number: number;
  gap: number;
  bucket: number;
  score: number;
  posteriorMean: number;
  credibleLow90: number;
  credibleHigh90: number;
  bandId: string;
  label: string;
}

export interface BayesianMarkovModel {
  name: string;
  model: string;
  totalDraws: number;
  firstDraw: string;
  lastDraw: string;
  maxGapBucket: number;
  numbersPerDraw: number;
  numberCount: number;
  priorStrength: number;
  posteriorDraws: number;
  tuneDraws: number;
  chains: number;
  randomSeed: number;
  topNumbers: number[];
  bucketSummaries: BayesianMarkovBucketSummary[];
  predictions: BayesianMarkovPrediction[];
  latestProfile: {
    date: string;
    signature: string;
    numbers: BayesianMarkovProfileNumber[];
  };
}
