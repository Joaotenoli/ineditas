// Baixa o Codex (código aberto, licença Apache-2.0) para ir dentro do app: assim quem usa só entra com a conta do ChatGPT.
// Fica em vendor/codex/<so>-<arq>/ com a mesma estrutura do pacote oficial (bin/codex e o codex-package.json).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSAO = "0.164.0";
const ALVOS = [["mac-arm64", "darwin-arm64", "aarch64-apple-darwin"], ["mac-x64", "darwin-x64", "x86_64-apple-darwin"], ["win-x64", "win32-x64", "x86_64-pc-windows-msvc"]];
const raiz = fileURLToPath(new URL("../vendor/codex/", import.meta.url));

for (const [pasta, npm, alvo] of ALVOS) {
  const destino = path.join(raiz, pasta);
  if (existsSync(path.join(destino, "codex-package.json"))) { console.log(pasta, "já baixado"); continue; }
  const tmp = mkdtempSync(path.join(tmpdir(), "codex-"));
  const url = execFileSync("npm", ["view", `@openai/codex@${VERSAO}-${npm}`, "dist.tarball"], { encoding: "utf8" }).trim();
  execFileSync("sh", ["-c", `curl -sL "${url}" | tar xz -C "${tmp}"`]);
  const v = path.join(tmp, "package", "vendor", alvo);
  mkdirSync(path.join(destino, "bin"), { recursive: true });
  const exe = npm.startsWith("win") ? "codex.exe" : "codex";
  cpSync(path.join(v, "bin", exe), path.join(destino, "bin", exe));
  cpSync(path.join(v, "codex-package.json"), path.join(destino, "codex-package.json"));
  if (npm.startsWith("win")) for (const f of ["codex-command-runner.exe", "codex-windows-sandbox-setup.exe"]) {
    const o = path.join(v, "codex-resources", f);
    if (existsSync(o)) { mkdirSync(path.join(destino, "codex-resources"), { recursive: true }); cpSync(o, path.join(destino, "codex-resources", f)); }
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log(pasta, "pronto");
}
