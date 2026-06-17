const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const yaml = require("js-yaml");

const isDev = !app.isPackaged;
const nextPossibleDrawStateFileName = "next-possible-draw.json";

function normalizeDrawNumbers(values, maximumCount = Infinity) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 49),
    ),
  ]
    .sort((left, right) => left - right)
    .slice(0, maximumCount);
}

function normalizeNextPossibleDrawState(state) {
  return {
    selectedNumbers: normalizeDrawNumbers(state?.selectedNumbers, 6),
    droppedNumbers: normalizeDrawNumbers(state?.droppedNumbers),
    uncertainNumbers: normalizeDrawNumbers(state?.uncertainNumbers),
  };
}

function nextPossibleDrawStatePath() {
  return path.join(app.getPath("userData"), nextPossibleDrawStateFileName);
}

function lottoYamlPath() {
  if (isDev) {
    return path.resolve(__dirname, "../../src/pylotto/lotto_results.yaml");
  }

  return path.join(process.resourcesPath, "data", "lotto_results.yaml");
}

async function loadLottoHistory() {
  const sourcePath = lottoYamlPath();
  const fileContent = await fs.readFile(sourcePath, "utf8");
  const payload = yaml.load(fileContent) ?? {};
  const lottoResults = payload.lotto_results ?? {};
  const draws = Array.isArray(lottoResults.draws)
    ? lottoResults.draws
        .filter(
          (draw) =>
            typeof draw?.date === "string" &&
            Array.isArray(draw?.numbers) &&
            draw.numbers.length === 6,
        )
        .map((draw) => ({
          date: draw.date,
          numbers: draw.numbers.map((value) => Number(value)),
        }))
    : [];
  const firstDraw = draws[0]?.date ?? "";
  const lastDraw = draws[draws.length - 1]?.date ?? "";

  return {
    totalDraws: draws.length,
    firstDraw,
    lastDraw,
    draws,
  };
}

async function loadNextPossibleDrawState() {
  try {
    const fileContent = await fs.readFile(nextPossibleDrawStatePath(), "utf8");
    return normalizeNextPossibleDrawState(JSON.parse(fileContent));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return normalizeNextPossibleDrawState({});
    }

    throw error;
  }
}

async function saveNextPossibleDrawState(state) {
  const normalizedState = normalizeNextPossibleDrawState(state);
  await fs.mkdir(path.dirname(nextPossibleDrawStatePath()), { recursive: true });
  await fs.writeFile(
    nextPossibleDrawStatePath(),
    JSON.stringify(normalizedState, null, 2),
    "utf8",
  );
  return normalizedState;
}

function sendMenuAction(action, payload = undefined) {
  const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  focusedWindow?.webContents.send("pylotto-menu-action", { action, payload });
}

function buildApplicationMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "File",
        submenu: [
          {
            label: "Draws",
            submenu: [
              {
                label: "Browse Draws",
                click: () => sendMenuAction("openDraws"),
              },
            ],
          },
          {
            label: "Planning",
            submenu: [
              {
                label: "Next Possible Draw",
                click: () => sendMenuAction("openNextPossibleDraw"),
              },
            ],
          },
        ],
      },
      {
        label: "Statistics",
        submenu: [
          {
            label: "Views",
            submenu: [
              {
                label: "Last Seen Highlight",
                click: () => sendMenuAction("openLastSeenHighlight"),
              },
              {
                label: "Last Seen Gap Highlight",
                click: () => sendMenuAction("openLastSeenGapHighlight"),
              },
              {
                label: "Last Seen Difference Highlight",
                click: () => sendMenuAction("openLastSeenDifferenceHighlight"),
              },
            ],
          },
        ],
      },
    ]),
  );
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    title: "PyLotto",
    icon: path.join(__dirname, "icon.png"),
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.on("window-control", (event, action) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window === null) {
    return;
  }

  if (action === "close") {
    window.close();
  }
});

ipcMain.handle("load-lotto-history", async () => loadLottoHistory());
ipcMain.handle("load-next-possible-draw-state", async () => loadNextPossibleDrawState());
ipcMain.handle("save-next-possible-draw-state", async (_event, state) =>
  saveNextPossibleDrawState(state),
);

app.whenReady().then(() => {
  buildApplicationMenu();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
