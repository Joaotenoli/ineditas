// Depois de empacotar o app do Mac: assinatura "ad-hoc" (sem conta de desenvolvedor da Apple).
// Sem ela o macOS diz que o app está danificado e o manda para o Lixo; com ela, dá para liberar em Ajustes.
const { execFileSync } = require("node:child_process");
const path = require("node:path");
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== "darwin") return;
  const app = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + ".app");
  const codex = path.join(app, "Contents", "Resources", "codex", "bin", "codex");
  if (require("node:fs").existsSync(codex)) execFileSync("codesign", ["--force", "--sign", "-", codex], { stdio: "inherit" });
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "inherit" });
};
