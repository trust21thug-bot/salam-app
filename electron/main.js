const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const http = require("http");


let mainWindow;
let server;

const isDev = !app.isPackaged;
const APP_ROOT = isDev ? process.cwd() : path.join(process.resourcesPath, "app");

function waitForURL(url, retries = 30) {
  return new Promise((resolve, reject) => {
    const check = (n) => {
      http.get(url, () => resolve()).on("error", () => {
        if (n <= 0) reject(new Error("Server did not start"));
        else setTimeout(() => check(n - 1), 1000);
      });
    };
    check(retries);
  });
}

async function startDev() {
  // In dev mode, `npm run dev` is started by concurrently
  await waitForURL("http://localhost:3000");
  return 3000;
}

async function startProd() {
  const next = require("next");

  const nextApp = next({ dev: false, dir: APP_ROOT });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      handle(req, res, new URL(req.url, `http://${req.headers.host}`));
    });
    srv.on("error", reject);
    const PORT = parseInt(process.env.PORT || "0", 10);
    srv.listen(PORT, () => {
      server = srv;
      resolve(srv.address().port);
    });
  });
}

async function createWindow() {
  const dbPath = path.join(app.getPath("userData"), "school-data.json");
  process.env.LOCAL_DB_PATH = dbPath;

  const port = isDev ? await startDev() : await startProd();
  console.log(`Server started on http://localhost:${port}`);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "مدرسة السلام",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Page loaded successfully");
  });

  mainWindow.webContents.on("did-fail-load", (_e, errCode, errDesc) => {
    console.log(`Page failed to load: ${errCode} ${errDesc}`);
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (err) {
    dialog.showErrorBox("خطأ في بدء التشغيل", err?.stack || String(err));
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (server) server.close();
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

ipcMain.handle("dialog:openFile", async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle("get-app-version", () => app.getVersion());
