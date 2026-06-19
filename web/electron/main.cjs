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

function normalizeDrawDate(value) {
  const date = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Draw date must use YYYY-MM-DD format.");
  }

  return date;
}

function nextPossibleDrawStatePath() {
  return path.join(app.getPath("userData"), nextPossibleDrawStateFileName);
}

function lottoYamlPath() {
  if (isDev) {
    return path.resolve(__dirname, "../../data/lotto_results.yaml");
  }

  const executableDirectory = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath("exe"));
  return path.join(executableDirectory, "data", "lotto_results.yaml");
}

async function ensureLottoYamlPath() {
  const candidatePaths = [
    lottoYamlPath(),
    path.join(path.dirname(app.getPath("exe")), "data", "lotto_results.yaml"),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      await fs.access(candidatePath);
      return candidatePath;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error(`Could not find lotto_results.yaml. Checked: ${candidatePaths.join(", ")}`);
}

function reportsPath() {
  if (isDev) {
    return path.resolve(__dirname, "../../reports");
  }

  return path.join(path.dirname(app.getPath("exe")), "reports");
}

async function loadLottoHistory() {
  const sourcePath = await ensureLottoYamlPath();
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

async function saveRealDraw(payload) {
  const drawDate = normalizeDrawDate(payload?.date);
  const numbers = normalizeDrawNumbers(payload?.numbers, 6);
  const plannedNumbers = normalizeDrawNumbers(payload?.plannedNumbers, 6);

  if (numbers.length !== 6) {
    throw new Error("Real draw must contain exactly 6 unique numbers.");
  }

  const sourcePath = await ensureLottoYamlPath();
  const fileContent = await fs.readFile(sourcePath, "utf8");
  const parsedYaml = yaml.load(fileContent) ?? {};
  const payloadRoot = typeof parsedYaml === "object" && parsedYaml !== null ? parsedYaml : {};
  const lottoResults = payloadRoot.lotto_results ?? {};
  const draws = Array.isArray(lottoResults.draws) ? lottoResults.draws : [];
  const existingDrawIndex = draws.findIndex((draw) => draw?.date === drawDate);
  const nextDraw = { date: drawDate, numbers };

  if (existingDrawIndex >= 0) {
    draws[existingDrawIndex] = nextDraw;
  } else {
    draws.push(nextDraw);
  }

  draws.sort((left, right) => String(left.date).localeCompare(String(right.date)));
  lottoResults.draws = draws;
  lottoResults.total_draws = draws.length;
  lottoResults.first_draw = draws[0]?.date ?? drawDate;
  lottoResults.last_draw = draws[draws.length - 1]?.date ?? drawDate;
  payloadRoot.lotto_results = lottoResults;

  await fs.writeFile(
    sourcePath,
    yaml.dump(payloadRoot, {
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    }),
    "utf8",
  );

  const realDrawSet = new Set(numbers);
  const matchedNumbers = plannedNumbers.filter((number) => realDrawSet.has(number));

  return {
    date: drawDate,
    numbers,
    matchedNumbers,
    matchCount: matchedNumbers.length,
    totalDraws: draws.length,
    yamlPath: sourcePath,
  };
}

function sanitizeReportFileName(fileName) {
  const safeFileName = String(fileName ?? "")
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  if (safeFileName.toLowerCase().endsWith(".svg")) {
    return safeFileName;
  }

  return `${safeFileName || "last-seen-highlight-last-50"}.svg`;
}

async function saveReportSvg({ fileName, svg }) {
  if (typeof svg !== "string" || !svg.trimStart().startsWith("<svg")) {
    throw new Error("Invalid SVG payload.");
  }

  const reportDirectory = reportsPath();
  const reportFileName = sanitizeReportFileName(fileName);
  const reportPath = path.join(reportDirectory, reportFileName);

  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(reportPath, svg, "utf8");

  return { path: reportPath };
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
              {
                label: "Freshness Report",
                click: () => sendMenuAction("openFreshnessReport"),
              },
              {
                label: "Proximity Report",
                click: () => sendMenuAction("openProximityReport"),
              },
              {
                label: "100 Markov Score",
                click: () => sendMenuAction("openMarkovScoreReport"),
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
ipcMain.handle("save-real-draw", async (_event, payload) => saveRealDraw(payload));
ipcMain.handle("save-report-svg", async (_event, payload) => saveReportSvg(payload));

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
