/// <reference types="vite/client" />

interface PylottoDesktopApi {
  authCurrentUser: () => Promise<AuthUser | null>;
  authLogin: (payload: AuthCredentials) => Promise<AuthUser>;
  authLogout: () => Promise<null>;
  authRegister: (payload: AuthCredentials) => Promise<AuthUser>;
  loadLottoHistory: () => Promise<{
    totalDraws: number;
    firstDraw: string;
    lastDraw: string;
    draws: { date: string; numbers: number[] }[];
  }>;
  loadSettings: () => Promise<AppSettings>;
  loadNextPossibleDrawState: () => Promise<NextPossibleDrawState>;
  saveSettings: (settings: AppSettings) => Promise<AppSettings>;
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

interface AuthCredentials {
  email: string;
  password: string;
}

interface AuthUser {
  email: string;
}

interface AppSettings {
  implementLawOfLargeNumbers: boolean;
}

interface NextPossibleDrawState {
  activePlanId: string;
  plans: PossibleDrawPlan[];
  selectedNumbers?: number[];
  droppedNumbers?: number[];
  uncertainNumbers?: number[];
}

interface PossibleDrawPlan {
  id: string;
  name: string;
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
  mirroredYamlPaths?: string[];
}

declare global {
  interface Window {
    pylottoDesktop?: PylottoDesktopApi;
  }
}

export {};
