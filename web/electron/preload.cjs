const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pylottoDesktop", {
  authCurrentUser: () => ipcRenderer.invoke("auth-current-user"),
  authLogin: (payload) => ipcRenderer.invoke("auth-login", payload),
  authLogout: () => ipcRenderer.invoke("auth-logout"),
  authRegister: (payload) => ipcRenderer.invoke("auth-register", payload),
  loadLottoHistory: () => ipcRenderer.invoke("load-lotto-history"),
  loadNextPossibleDrawState: () => ipcRenderer.invoke("load-next-possible-draw-state"),
  saveNextPossibleDrawState: (state) =>
    ipcRenderer.invoke("save-next-possible-draw-state", state),
  saveRealDraw: (payload) => ipcRenderer.invoke("save-real-draw", payload),
  saveReportSvg: (payload) => ipcRenderer.invoke("save-report-svg", payload),
  windowControl: (action) => {
    ipcRenderer.send("window-control", action);
  },
  onMenuAction: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on("pylotto-menu-action", listener);
    return () => ipcRenderer.removeListener("pylotto-menu-action", listener);
  },
});
