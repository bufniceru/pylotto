/// <reference types="vite/client" />

interface PylottoDesktopApi {
  loadLottoHistory: () => Promise<{
    totalDraws: number;
    firstDraw: string;
    lastDraw: string;
    draws: { date: string; numbers: number[] }[];
  }>;
  loadNextPossibleDrawState: () => Promise<NextPossibleDrawState>;
  saveNextPossibleDrawState: (
    state: NextPossibleDrawState,
  ) => Promise<NextPossibleDrawState>;
  saveRealDraw: (payload: {
    date: string;
    numbers: number[];
    plannedNumbers: number[];
  }) => Promise<RealDrawSaveResult>;
  saveReportSvg: (payload: {
    fileName: string;
    svg: string;
  }) => Promise<{ path: string }>;
  windowControl: (action: "close") => void;
  onMenuAction: (
    callback: (message: { action: string; payload?: unknown }) => void,
  ) => () => void;
}

interface NextPossibleDrawState {
  selectedNumbers: number[];
  droppedNumbers: number[];
  uncertainNumbers: number[];
}

interface RealDrawSaveResult {
  date: string;
  numbers: number[];
  matchedNumbers: number[];
  matchCount: number;
  totalDraws: number;
  yamlPath: string;
}

declare global {
  interface Window {
    pylottoDesktop?: PylottoDesktopApi;
  }
}

export {};
