// CraneGo desktop shell. Loads the CraneGo web app from your server so the
// office always runs the latest version; the server URL is set on first launch.
const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const configFile = () => path.join(app.getPath("userData"), "config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile(), "utf8"));
  } catch {
    return { serverUrl: process.env.CRANEGO_SERVER_URL || "" };
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(cfg, null, 2));
}

function normaliseUrl(raw) {
  const u = new URL(String(raw).trim());
  const local = ["localhost", "127.0.0.1"].includes(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) {
    throw new Error("Use an https:// address (http is only allowed for localhost)");
  }
  return u.origin;
}

let win;

function loadApp() {
  const { serverUrl } = readConfig();
  if (!serverUrl) return win.loadFile(path.join(__dirname, "settings.html"));
  win.loadURL(`${serverUrl}/`).catch(() => win.loadFile(path.join(__dirname, "offline.html"), { query: { url: serverUrl } }));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 380,
    title: "CraneGo",
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#17181C",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Keep navigation inside the configured server; open everything else in the browser.
  const isAppUrl = (url) => {
    const { serverUrl } = readConfig();
    return url.startsWith("file://") || (serverUrl && url.startsWith(serverUrl));
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto|tel|upi):/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!isAppUrl(url)) {
      e.preventDefault();
      if (/^(https?|mailto|tel):/.test(url)) shell.openExternal(url);
    }
  });
  win.webContents.session.setPermissionRequestHandler((wc, permission, cb) => {
    cb(permission === "geolocation" && isAppUrl(wc.getURL()));
  });

  loadApp();
}

ipcMain.handle("cranego:get-config", () => readConfig());
ipcMain.handle("cranego:save-config", (_e, cfg) => {
  const serverUrl = normaliseUrl(cfg.serverUrl);
  writeConfig({ serverUrl });
  loadApp();
  return { serverUrl };
});
ipcMain.handle("cranego:retry", () => loadApp());

const menu = Menu.buildFromTemplate([
  {
    label: "CraneGo",
    submenu: [
      { label: "Server settings…", click: () => win.loadFile(path.join(__dirname, "settings.html")) },
      { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => loadApp() },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  { role: "editMenu" },
  { role: "viewMenu" },
  { role: "windowMenu" },
]);

app.whenReady().then(() => {
  Menu.setApplicationMenu(menu);
  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
