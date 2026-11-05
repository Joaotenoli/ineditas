// Copia para app/ a página e o servidor do Inéditas (as mesmas peças do app do Mac).
import { copyFileSync, mkdirSync } from "node:fs";
const raiz = new URL("../../", import.meta.url), app = new URL("../app/", import.meta.url);
mkdirSync(app, { recursive: true });
// fora da pasta de trabalho do JV (no GitHub) as peças já estão em app/
import { existsSync } from "node:fs";
if (!existsSync(new URL("gerador-ineditas/index.html", raiz))) { console.log("app/ já está pronto"); process.exit(0); }
copyFileSync(new URL("gerador-ineditas/index.html", raiz), new URL("index.html", app));
copyFileSync(new URL("ineditas-mac/servidor.mjs", raiz), new URL("servidor.mjs", app));
copyFileSync(new URL("ineditas-mac/local.js", raiz), new URL("local.js", app));
console.log("app/ atualizado");
