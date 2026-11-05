// Inéditas para Mac e Windows: janela do app + servidor local (o mesmo do app do Mac).
// A IA entra pelo PLANO da pessoa (Claude Code ou Codex), nunca por chave de API.
const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let janela = null, base = null;
const ehMac = process.platform === "darwin";

// aberto pelo Finder, o app recebe um PATH curto: inclui as pastas onde o Claude Code, o Codex e o Node costumam ficar
if (ehMac) {
  const home = require("node:os").homedir();
  process.env.PATH = [path.join(home, ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH || "/usr/bin:/bin"].join(":");
}

async function abrir() {
  process.env.INEDITAS_PAGINA = path.join(__dirname, "app", "index.html");
  // o Codex vai dentro do app: quem usa só entra com a conta do ChatGPT
  const codex = path.join(process.resourcesPath, "codex", "bin", process.platform === "win32" ? "codex.exe" : "codex");
  if (require("node:fs").existsSync(codex)) process.env.INEDITAS_CODEX_BIN = codex;
  try {
    const { iniciar } = await import(pathToFileURL(path.join(__dirname, "app", "servidor.mjs")).href);
    base = `http://127.0.0.1:${await iniciar({ abrir: false })}`;
  } catch (e) {
    dialog.showErrorBox("O Inéditas não conseguiu abrir", String((e && e.message) || e));
    return app.quit();
  }
  janela = new BrowserWindow({
    width: 1360, height: 880, minWidth: 980, minHeight: 640, title: "Inéditas",
    titleBarStyle: ehMac ? "hiddenInset" : "default", backgroundColor: "#f2f2f7", autoHideMenuBar: !ehMac,
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  janela.webContents.on("dom-ready", () => { if (ehMac) janela.webContents.executeJavaScript("document.documentElement.classList.add('app-mac')"); });
  // links de fora (login do Claude e do ChatGPT, leis) abrem no navegador padrão
  janela.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  janela.webContents.on("will-navigate", (e, url) => { if (!url.startsWith(base)) { e.preventDefault(); shell.openExternal(url); } });
  janela.loadURL(base + "/");
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); } });
  app.whenReady().then(() => {
    if (ehMac) Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" }]));
    abrir();
  });
  app.on("window-all-closed", () => app.quit());
}
