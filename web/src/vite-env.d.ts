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

declare global {
  interface Window {
    pylottoDesktop?: PylottoDesktopApi;
  }
}

export {};
