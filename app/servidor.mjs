// Inéditas no Mac: servidor local (só 127.0.0.1) que abre o app no navegador ou dentro da janela do Mac.
// - Cadernos: ~/Documents/Inéditas/dados/<id>.json (um arquivo por documento)
// - IA: o Claude Code ou o Codex com o login do PLANO da pessoa (Claude Pro/Max ou ChatGPT), numa pasta de
//   configuração só deste app. Não usa chave de API: as variáveis de API do ambiente são removidas desses processos.
// Baseado no servidor do Simulador de Copy. Uso: node servidor.mjs [--porta 5199] [--sem-navegador]
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFile, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const WIN = process.platform === "win32", MAC = process.platform === "darwin";
// a página: ao lado do servidor (programa instalado) ou a do repositório (app do Mac em desenvolvimento)
const PAGINA = process.env.INEDITAS_PAGINA || [path.join(RAIZ, "index.html"), path.join(RAIZ, "..", "gerador-ineditas", "index.html")].find(f => fs.existsSync(f));
// abre um endereço ou uma pasta no programa padrão do sistema
function abrirNoSistema(alvo, mostrar) {
  if (MAC) execFile("open", mostrar ? ["-R", alvo] : [alvo]);
  else if (WIN) execFile("explorer.exe", mostrar ? ["/select,", alvo] : [alvo]);
  else execFile("xdg-open", [mostrar ? path.dirname(alvo) : alvo]);
}
const args = process.argv.slice(2);
const PORTA = Number(args[args.indexOf("--porta") + 1]) || Number(process.env.INEDITAS_PORTA) || 5199;
const ABRIR = !args.includes("--sem-navegador");
const HOME = os.homedir();
// o app se chamava "Inédita": leva as pastas antigas para o nome novo, sem perder cadernos nem logins
for (const [velho, novo] of [
  [path.join(HOME, "Documents", "Inédita"), path.join(HOME, "Documents", "Inéditas")],
  MAC ? [path.join(HOME, "Library", "Application Support", "Inédita"), path.join(HOME, "Library", "Application Support", "Inéditas")]
    : WIN ? [path.join(process.env.APPDATA || path.join(HOME, "AppData", "Roaming"), "Inédita"), path.join(process.env.APPDATA || path.join(HOME, "AppData", "Roaming"), "Inéditas")] : null
].filter(Boolean)) {
  try { if (fs.existsSync(velho) && !fs.existsSync(novo)) fs.renameSync(velho, novo); } catch {}
}
const DADOS = process.env.INEDITAS_DADOS || path.join(HOME, "Documents", "Inéditas");
const DOCS = path.join(DADOS, "dados");
const LOCAL = MAC ? path.join(HOME, "Library", "Application Support", "Inéditas") : WIN ? path.join(process.env.APPDATA || path.join(HOME, "AppData", "Roaming"), "Inéditas") : path.join(HOME, ".config", "ineditas");
const CLAUDE_HOME = path.join(LOCAL, "claude");
const CODEX_HOME = path.join(LOCAL, "codex");
const TRABALHO = path.join(LOCAL, "trabalho");          // pasta vazia: a IA não lê arquivo de projeto nenhum
const AJUSTES = path.join(LOCAL, "ajustes.json");

for (const d of [DOCS, CLAUDE_HOME, CODEX_HOME, TRABALHO]) fs.mkdirSync(d, { recursive: true });
try { fs.chmodSync(LOCAL, 0o700); fs.chmodSync(CLAUDE_HOME, 0o700); fs.chmodSync(CODEX_HOME, 0o700); } catch {}
// o Codex desta pasta só aceita login com a conta do ChatGPT
fs.writeFileSync(path.join(CODEX_HOME, "config.toml"), 'forced_login_method = "chatgpt"\n', { mode: 0o600 });

/* ---------- ajustes ---------- */
function lerAjustes() { try { return JSON.parse(fs.readFileSync(AJUSTES, "utf8")); } catch { return { modelo: "opus" }; } }
function gravarAjustes(a) { fs.writeFileSync(AJUSTES, JSON.stringify(a, null, 2), { mode: 0o600 }); }

/* ---------- documentos (cadernos e preferências) ---------- */
const idOk = id => /^[A-Za-z0-9_-]{1,100}$/.test(id);
function todosDocs() {
  const out = {};
  for (const f of fs.readdirSync(DOCS)) {
    if (!f.endsWith(".json")) continue;
    try { out[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(DOCS, f), "utf8")); } catch {}
  }
  return out;
}
function gravarDoc(id, data) {                  // grava num arquivo temporário e troca: nunca deixa um caderno pela metade
  const alvo = path.join(DOCS, id + ".json"), tmp = alvo + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, alvo);
}
/* ---------- conta deste Mac (nome, e-mail e senha; a senha fica só como hash) ---------- */
// várias contas no mesmo computador: uma por e-mail. Entrar com um e-mail novo já cria a conta.
const PERFIS = path.join(LOCAL, "perfis"), ULTIMO = path.join(LOCAL, "perfil.json");
fs.mkdirSync(PERFIS, { recursive: true });
const arqPerfil = email => path.join(PERFIS, crypto.createHash("sha256").update(email).digest("hex").slice(0, 32) + ".json");
function lerJson(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } }
// conta antiga (uma só, em perfil.json com senha): passa para a pasta de contas
(() => { const v = lerJson(ULTIMO); if (v && v.hash && v.email && !fs.existsSync(arqPerfil(v.email))) fs.writeFileSync(arqPerfil(v.email), JSON.stringify(v), { mode: 0o600 }); })();
function lerPerfil() { const u = lerJson(ULTIMO); return u && u.nome ? { nome: u.nome, email: u.email } : null; }
const hashSenha = (senha, sal) => crypto.scryptSync(senha, Buffer.from(sal, "hex"), 64).toString("hex");
function novaConta(nome, email, senha) {
  const sal = crypto.randomBytes(16).toString("hex");
  const c = { nome, email, sal, hash: hashSenha(senha, sal), criada: Date.now() };
  fs.writeFileSync(arqPerfil(email), JSON.stringify(c), { mode: 0o600 });
  return c;
}
function usar(c) { fs.writeFileSync(ULTIMO, JSON.stringify({ nome: c.nome, email: c.email }), { mode: 0o600 }); return [200, { nome: c.nome, id: "mac" }]; }
function perfil(d) {
  const acao = d.acao, email = String(d.email || "").trim().toLowerCase(), senha = String(d.senha || "");
  if (acao === "visitante") return usar({ nome: "Visitante", email: "" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return [400, { erro: "Digite um e-mail válido." }];
  if (!senha) return [400, { erro: "Digite uma senha." }];
  const atual = lerJson(arqPerfil(email));
  if (!atual) {
    const nome = String(d.nome || "").trim().slice(0, 60) || email.split("@")[0];
    return usar(novaConta(nome, email, senha));
  }
  const a = Buffer.from(hashSenha(senha, atual.sal), "hex"), b = Buffer.from(atual.hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return [401, { erro: "Já existe uma conta com este e-mail neste computador, e a senha não confere." }];
  return usar(atual);
}
function nomeDoMac() { if (MAC) { try { return execFileSync("id", ["-F"], { encoding: "utf8" }).trim(); } catch {} } return os.userInfo().username; }

/* ---------- eventos ao vivo ---------- */
const ouvintes = new Set();
function avisar(msg) { const s = "data: " + JSON.stringify(msg) + "\n\n"; for (const r of ouvintes) r.write(s); }

/* ---------- contas de IA: só pelo PLANO (Claude Pro/Max ou ChatGPT). Nunca chave de API. ---------- */
const HOSTS_CLAUDE = ["claude.com", "claude.ai", "platform.claude.com", "console.anthropic.com", "anthropic.com"];
const HOSTS_OPENAI = ["auth.openai.com", "openai.com", "chatgpt.com"];
function acharClaude() {
  return achar(["claude"], [process.env.INEDITAS_CLAUDE_BIN, path.join(HOME, ".local", "bin", WIN ? "claude.exe" : "claude"), "/opt/homebrew/bin/claude", "/usr/local/bin/claude", path.join(HOME, ".claude", "local", "claude")]);
}
// sem o Claude Code no computador: instala com o instalador oficial da Anthropic (só quando a pessoa clica em Entrar com Claude)
function instalarClaude() {
  const P = PROV.claude;
  if (P.instalando) return P.instalando;
  P.erro = null;
  const [c, a] = WIN ? ["powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "irm https://claude.ai/install.ps1 | iex"]]
                     : ["/bin/bash", ["-c", "curl -fsSL https://claude.ai/install.sh | bash"]];
  P.instalando = new Promise(ok => execFile(c, a, { env: envLimpo({}), timeout: 5 * 60 * 1000, windowsHide: true }, () => {
    P.bin = acharClaude(); P.instalando = null;
    if (!P.bin) P.erro = "Não consegui instalar o Claude. Confira sua conexão com a internet e tente de novo.";
    avisar({ type: "conta" }); ok();
  }));
  return P.instalando;
}
function achar(nomes, extra) {
  for (const p of extra) if (p && fs.existsSync(p)) return p;
  const exts = WIN ? [".exe", ".cmd", ""] : [""];
  for (const d of (process.env.PATH || "").split(path.delimiter)) for (const n of nomes) for (const x of exts) { const p = path.join(d, n + x); if (d && fs.existsSync(p)) return p; }
  return null;
}
const SEM_API = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT",
  "OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_ORG_ID", "OPENAI_ORGANIZATION", "OPENAI_PROJECT", "CODEX_API_KEY", "CODEX_ACCESS_TOKEN", "AZURE_OPENAI_API_KEY"];
function envLimpo(extra) { const env = { ...process.env, ...extra }; for (const k of SEM_API) delete env[k]; return env; }

const PROV = {
  claude: {
    nome: "Claude", bin: acharClaude(),
    faltando: "O Claude Code não está instalado neste computador.",
    env: () => envLimpo({ CLAUDE_CONFIG_DIR: CLAUDE_HOME }),
    hosts: HOSTS_CLAUDE, abrir: true,
    argsLogin: ["auth", "login", "--claudeai"], argsSair: ["auth", "logout"], argsStatus: ["auth", "status", "--json"],
    async status(out) {
      try {
        const d = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
        if (!d.loggedIn) return null;
        if (d.authMethod && d.authMethod !== "claude.ai") return { recusado: "Este login não é do plano do Claude. Saia e entre com a conta do Claude." };
        return { email: d.email || d.emailAddress || "", plano: String(d.subscriptionType || d.plan || "Claude") };
      } catch { return null; }
    },
  },
  openai: {
    nome: "ChatGPT", bin: achar(["codex"], [process.env.INEDITAS_CODEX_BIN, "/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex", "/Applications/Codex.app/Contents/Resources/codex",
      path.join(HOME, ".local/bin/codex"), "/opt/homebrew/bin/codex", "/usr/local/bin/codex"]),
    faltando: "O Codex não foi encontrado. Feche o app e abra de novo.",
    env: () => envLimpo({ CODEX_HOME }),
    hosts: HOSTS_OPENAI, abrir: false,                     // o próprio Codex abre o navegador
    argsLogin: ["login"], argsSair: ["logout"], argsStatus: ["login", "status"],
    async status(out) {
      if (/not logged in/i.test(out)) return null;
      if (/chatgpt/i.test(out)) return { email: "", plano: "ChatGPT" };
      if (/api key|access token/i.test(out)) return { recusado: "Este login usa chave de API. Saia e entre com a conta do ChatGPT." };
      return null;
    },
  },
};
for (const k in PROV) Object.assign(PROV[k], { conta: null, lida: 0, login: null, erro: null });
const MODELOS = [
  { id: "opus", prov: "claude", nome: "Claude Opus", descricao: "O mais capaz. Melhor para cadernos difíceis." },
  { id: "sonnet", prov: "claude", nome: "Claude Sonnet", descricao: "Rápido e forte. Bom para o dia a dia." },
  { id: "haiku", prov: "claude", nome: "Claude Haiku", descricao: "O mais rápido. Bom para cadernos curtos." },
  { id: "chatgpt", prov: "openai", nome: "ChatGPT", descricao: "O modelo padrão do Codex no seu plano do ChatGPT." },
];
const modeloAtual = () => { const m = lerAjustes().modelo; return MODELOS.find(x => x.id === m) || MODELOS[0]; };
const provDe = q => PROV[q] ? q : modeloAtual().prov;

function comando(bin, argv) {
  if (WIN && /\.cmd$/i.test(bin)) {
    const pastas = path.join(path.dirname(bin), "node_modules");
    const js = [path.join(pastas, "@anthropic-ai", "claude-code", "cli.js"), path.join(pastas, "@openai", "codex", "bin", "codex.js")].find(f => fs.existsSync(f) && f.includes(path.basename(bin, ".cmd") === "claude" ? "claude-code" : "codex"));
    if (js) return [process.execPath, [js, ...argv], { ELECTRON_RUN_AS_NODE: "1" }];
  }
  return [bin, argv, {}];
}
function spawnBin(P, argv, opts) { const [c, a, e] = comando(P.bin, argv); return spawn(c, a, { ...opts, env: { ...opts.env, ...e }, windowsHide: true }); }
function rodar(k, argv, tempo = 20000) {
  const P = PROV[k];
  const [c, a, e] = comando(P.bin, argv);
  return new Promise(ok => execFile(c, a, { env: { ...P.env(), ...e }, cwd: TRABALHO, timeout: tempo, windowsHide: true }, (err, so, se) => ok((so || "") + (se || ""))));
}
async function lerConta(k, forcar) {
  const P = PROV[k];
  if (!P.bin) { P.conta = null; return; }
  if (!forcar && Date.now() - P.lida < 5000) return;
  P.lida = Date.now();
  const c = await P.status(await rodar(k, P.argsStatus));
  if (c && c.recusado) { P.conta = null; P.erro = c.recusado; } else P.conta = c;
}
async function estadoUm(k) {
  const P = PROV[k];
  if (P.login && Date.now() > P.login.expira) { cancelarLogin(k); P.erro = "O tempo para entrar terminou. Comece de novo."; }
  await lerConta(k);
  const instalavel = k === "claude" && !P.bin;
  return { nome: P.nome, disponivel: !!P.bin || instalavel, instalavel, instalando: !!P.instalando, conectado: !!P.conta, conta: P.conta, pendente: P.login && P.login.url ? { url: P.login.url, codigo: k === "claude" } : null, erro: P.bin || instalavel ? P.erro : P.faltando };
}
async function estadoConta() {
  const contas = { claude: await estadoUm("claude"), openai: await estadoUm("openai") };
  let m = modeloAtual();
  if (!contas[m.prov].conectado) { const outro = MODELOS.find(x => contas[x.prov].conectado); if (outro) m = outro; }   // usa a conta que estiver conectada
  return { provedor: m.prov, contas, modelos: MODELOS, modelo: m.id, nome: (lerPerfil() || {}).nome || nomeDoMac() };
}
function cancelarLogin(k) { for (const q of k ? [k] : Object.keys(PROV)) { const P = PROV[q]; if (P.login) { P.login.cancelado = true; try { P.login.proc.kill(); } catch {} P.login = null; } } }
async function entrar(k) {
  const P = PROV[k];
  if (k === "claude" && !P.bin) { await instalarClaude(); if (!P.bin) return estadoConta(); }
  await lerConta(k, true);
  if (P.conta || P.login || !P.bin) return estadoConta();
  P.erro = null;
  const p = spawnBin(P, P.argsLogin, { env: P.env(), cwd: TRABALHO });
  P.login = { proc: p, url: null, expira: Date.now() + 10 * 60 * 1000, cancelado: false };
  p.stdin.on("error", () => {});
  const url = await new Promise(ok => {
    let buf = "", feito = false;
    const fim = v => { if (!feito) { feito = true; ok(v); } };
    const ler = c => { buf += c; const m = buf.match(/https:\/\/\S+/); if (m) fim(m[0].replace(/[.,)]+$/, "")); };
    p.stdout.on("data", ler); p.stderr.on("data", ler);
    p.on("error", () => { fim(null); });
    p.on("exit", () => { fim(null); const meu = P.login && P.login.proc === p, cancel = meu && P.login.cancelado; if (meu) P.login = null;
      lerConta(k, true).then(() => { if (!P.conta && meu && !cancel) P.erro = P.erro || "O login não foi concluído. Tente de novo."; avisar({ type: "conta" }); }); });
    setTimeout(() => fim(null), 20000);
  });
  let host = ""; try { host = new URL(url).hostname; } catch {}
  if (!url || !P.hosts.some(h => host === h || host.endsWith("." + h))) { if (P.login && P.login.proc === p) P.login = null; try { p.kill(); } catch {} P.erro = "O " + P.nome + " não devolveu o endereço de login."; return estadoConta(); }
  if (P.login && P.login.proc === p) P.login.url = url;
  if (P.abrir) abrirNoSistema(url);
  return estadoConta();
}
async function colarCodigo(k, codigo) {
  const P = PROV[k]; codigo = String(codigo || "").trim();
  if (P.login && codigo) { try { P.login.proc.stdin.write(codigo + "\n"); } catch {} }
  for (let i = 0; i < 40 && P.login; i++) await new Promise(r => setTimeout(r, 250));
  return estadoConta();
}
async function sair(k) { cancelarLogin(k); if (PROV[k].bin) await rodar(k, PROV[k].argsSair); PROV[k].erro = null; await lerConta(k, true); return estadoConta(); }

const SISTEMA = "Você é um elaborador sênior de questões inéditas para concursos públicos brasileiros, dentro de um app de estudo. Siga exatamente o formato de resposta pedido na mensagem. Não use ferramentas, não faça perguntas e não comente o que fez: entregue só o que foi pedido.";
const tipoErro = m => /authenticat|log ?in|oauth|not logged|unauthorized|401/i.test(m) ? "not_logged" : /limit|rate|usage|quota|overload|429/i.test(m) ? "rate_limited" : "upstream_error";
// Uma geração: manda o pedido pelo stdin e devolve o texto em pedaços (NDJSON) conforme a IA escreve.
async function gerar(req, res, corpo) {
  res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" });
  const env = m => res.write(JSON.stringify(m) + "\n");
  const est = await estadoConta();
  const m = MODELOS.find(x => x.id === est.modelo) || MODELOS[0];
  const k = m.prov, P = PROV[k];
  if (!P.bin) { env({ error: { code: "not_configured", message: P.faltando } }); return res.end(); }
  if (!P.conta) { env({ error: { code: "not_logged", message: "Entre com a sua conta do Claude ou do ChatGPT em Preferências." } }); return res.end(); }
  const entrada = Array.isArray(corpo.input) ? corpo.input.map(t => (t.role === "assistant" ? "Resposta anterior:\n" : "") + t.content).join("\n\n") : String(corpo.input || "");
  const p = k === "claude"
    ? spawnBin(P, ["-p", "--output-format", "stream-json", "--include-partial-messages", "--verbose", "--model", m.id,
        "--tools", "", "--strict-mcp-config", "--no-session-persistence", "--effort", "medium", "--system-prompt", SISTEMA], { env: P.env(), cwd: TRABALHO })
    : spawnBin(P, ["exec", "--json", "--ephemeral", "--skip-git-repo-check", "--ignore-rules", "-s", "read-only", "-C", TRABALHO,
        "-c", 'forced_login_method="chatgpt"', "-"], { env: P.env(), cwd: TRABALHO });
  let buf = "", texto = "", final = null, erro = null, fechado = false;
  const parar = () => { if (!fechado) { fechado = true; try { p.kill(); } catch {} } };
  res.on("close", parar);
  p.stdin.on("error", () => {});
  p.on("error", e => { if (!res.writableEnded) { env({ error: { code: "upstream_error", message: "Não deu para abrir o " + P.nome + " (" + (e.code || e.message) + ")." } }); res.end(); } fechado = true; });
  p.stdout.on("data", c => {
    buf += c; const ls = buf.split("\n"); buf = ls.pop();
    for (const l of ls) {
      let o; try { o = JSON.parse(l); } catch { continue; }
      if (k === "claude") {
        if (o.type === "stream_event" && o.event && o.event.type === "content_block_delta" && o.event.delta && o.event.delta.type === "text_delta") {
          texto += o.event.delta.text; env({ d: o.event.delta.text });
        } else if (o.type === "result") { final = o; if (o.is_error) erro = String(o.result || o.error || "erro"); }
      } else {
        if (o.type === "item.completed" && o.item && o.item.type === "agent_message" && o.item.text) { const t = (texto ? "\n" : "") + o.item.text; texto += t; env({ d: t }); }
        else if (o.type === "turn.completed") final = o;
        else if (o.type === "turn.failed" || o.type === "error") erro = String((o.error && o.error.message) || o.message || "erro");
      }
    }
  });
  let errTxt = ""; p.stderr.on("data", c => { errTxt += c; if (errTxt.length > 4000) errTxt = errTxt.slice(-4000); });
  p.on("exit", () => {
    fechado = true;
    if (res.writableEnded) return;
    if (k === "claude" && !erro && final && !texto && final.result) { texto = String(final.result); env({ d: texto }); }
    if (erro || (!texto && !final)) {
      const msg = erro || errTxt.split("\n").filter(l => !/ERROR codex_core::session|failed to load skill/.test(l)).join("\n").trim() || "O " + P.nome + " não respondeu.";
      const code = tipoErro(msg);
      if (code === "not_logged") { P.conta = null; P.lida = 0; }
      env({ error: { code, message: msg.slice(0, 400) }, text: texto || undefined });
    } else env({ done: true, truncated: !!(final && /max_tokens/.test(String(final.stop_reason || ""))) });
    res.end();
  });
  p.stdin.end(k === "claude" ? entrada : SISTEMA + "\n\n" + entrada);
}

/* ---------- arquivos exportados: vão para Downloads e o Finder mostra ---------- */
function salvarArquivo(nome, b64) {
  nome = path.basename(String(nome || "arquivo")).replace(/[^\p{L}\p{N} ._()-]/gu, "-").slice(0, 120) || "arquivo";
  const pasta = path.join(HOME, "Downloads");
  let alvo = path.join(pasta, nome); const ext = path.extname(nome), base = path.basename(nome, ext);
  for (let i = 2; fs.existsSync(alvo); i++) alvo = path.join(pasta, `${base} (${i})${ext}`);
  fs.writeFileSync(alvo, Buffer.from(String(b64 || ""), "base64"));
  abrirNoSistema(alvo, true);
  return alvo;
}

/* ---------- página ---------- */
function paginaHTML() {
  const corpo = fs.readFileSync(PAGINA, "utf8");
  const shim = fs.readFileSync(path.join(RAIZ, "local.js"), "utf8");
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="icon" href="data:,">' +
    "<script>" + shim + "</script><style>body{margin:0}</style></head><body>" + corpo + "</body></html>";
}

/* ---------- servidor ---------- */
const MAX = 8 * 1024 * 1024;
function lerCorpo(req) {
  return new Promise((ok, no) => { let n = 0; const ch = []; req.on("data", c => { n += c.length; if (n > MAX) { no(new Error("grande")); req.destroy(); } else ch.push(c); }); req.on("end", () => { try { ok(JSON.parse(Buffer.concat(ch).toString("utf8") || "{}")); } catch (e) { no(e); } }); });
}
const json = (res, code, o) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(o)); };
const HOSTS = new Set([`127.0.0.1:${PORTA}`, `localhost:${PORTA}`]);
// o site público do Inéditas pode usar o plano de IA deste Mac (só contas e geração; cadernos e arquivos ficam fechados)
const SITES = new Set(["https://ineditas-questoes.vercel.app"]);
const ROTAS_SITE = new Set(["/api/ok", "/api/conta", "/api/conta/entrar", "/api/conta/codigo", "/api/conta/cancelar", "/api/conta/sair", "/api/ajustes", "/api/ia"]);

const srv = http.createServer(async (req, res) => {
  // só atende o próprio Mac: outro site aberto no navegador não consegue falar com este servidor
  if (!HOSTS.has(req.headers.host || "")) { res.writeHead(403); return res.end(); }
  const u = new URL(req.url, "http://x"); const p = u.pathname;
  const origem = req.headers.origin;
  if (origem && origem !== `http://127.0.0.1:${PORTA}` && origem !== `http://localhost:${PORTA}`) {
    if (!SITES.has(origem) || !ROTAS_SITE.has(p)) { res.writeHead(403); return res.end(); }
    res.setHeader("Access-Control-Allow-Origin", origem);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-ineditas");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  }
  // leituras sem efeito podem ser GET; todo o resto exige POST/PUT/DELETE com o cabeçalho X-Ineditas
  const leitura = req.method === "GET" && (p === "/" || p === "/api/ok" || p === "/api/docs" || p === "/api/eventos" || p === "/api/conta" || p === "/api/perfil");
  if (!leitura) {
    if (req.method === "GET" || req.method === "HEAD") { res.writeHead(405); return res.end(); }
    if (req.headers["x-ineditas"] !== "1") { res.writeHead(403); return res.end(); }
  }
  try {
    if (p === "/" && req.method === "GET") { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "frame-ancestors 'none'" }); return res.end(paginaHTML()); }
    if (p === "/api/ok") return json(res, 200, { ok: true });
    if (p === "/api/docs" && req.method === "GET") return json(res, 200, todosDocs());
    const md = p.match(/^\/api\/docs\/([^/]+)$/);
    if (md) {
      const id = decodeURIComponent(md[1]); if (!idOk(id)) return json(res, 400, { erro: "nome inválido" });
      if (req.method === "PUT") { const d = await lerCorpo(req); gravarDoc(id, d); avisar({ type: "set", id, data: d }); return json(res, 200, { ok: true }); }
      if (req.method === "DELETE") { try { fs.unlinkSync(path.join(DOCS, id + ".json")); } catch {} avisar({ type: "removed", id }); return json(res, 200, { ok: true }); }
    }
    if (p === "/api/eventos") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write(": ok\n\n"); ouvintes.add(res); const t = setInterval(() => res.write(": .\n\n"), 25000);
      return req.on("close", () => { clearInterval(t); ouvintes.delete(res); });
    }
    if (p === "/api/perfil" && req.method === "GET") { const f = lerPerfil(); return json(res, 200, { existe: !!f, nome: f ? f.nome : "" }); }
    if (p === "/api/perfil" && req.method === "POST") { const [code, o] = perfil(await lerCorpo(req)); return json(res, code, o); }
    if (p === "/api/conta" && req.method === "GET") return json(res, 200, await estadoConta());
    if (p === "/api/conta/entrar") return json(res, 200, await entrar(provDe((await lerCorpo(req)).provedor)));
    if (p === "/api/conta/codigo") { const d = await lerCorpo(req); return json(res, 200, await colarCodigo(provDe(d.provedor), d.codigo)); }
    if (p === "/api/conta/cancelar") { cancelarLogin(provDe((await lerCorpo(req)).provedor)); return json(res, 200, await estadoConta()); }
    if (p === "/api/conta/sair") return json(res, 200, await sair(provDe((await lerCorpo(req)).provedor)));
    if (p === "/api/ajustes") { const d = await lerCorpo(req); const a = lerAjustes(); if (MODELOS.some(m => m.id === d.modelo)) a.modelo = d.modelo; gravarAjustes(a); return json(res, 200, await estadoConta()); }
    if (p === "/api/ia") return gerar(req, res, await lerCorpo(req));
    if (p === "/api/arquivo") { const d = await lerCorpo(req); return json(res, 200, { ok: true, caminho: salvarArquivo(d.filename, d.base64) }); }
    if (p === "/api/abrir-pasta") { abrirNoSistema(DADOS); return json(res, 200, { ok: true }); }
    if (p === "/api/desligar") { json(res, 200, { ok: true }); cancelarLogin(); setTimeout(() => process.exit(0), 100); return; }
    res.writeHead(404); res.end();
  } catch (e) { json(res, 500, { erro: String(e && e.message || e) }); }
});

process.on("uncaughtException", e => console.error("erro:", e && e.message));
// liga o servidor; se a porta já estiver com um Inéditas aberto, usa esse mesmo
export function iniciar({ abrir = false } = {}) {
  return new Promise((ok, falha) => {
    srv.once("error", async e => {
      if (e.code === "EADDRINUSE") {
        try { const r = await fetch(`http://127.0.0.1:${PORTA}/api/ok`); if (r.ok) return ok(PORTA); } catch {}
        return falha(new Error(`A porta ${PORTA} já está em uso por outro programa.`));
      }
      falha(e);
    });
    srv.listen(PORTA, "127.0.0.1", () => {
      console.log(`Inéditas em http://127.0.0.1:${PORTA}  ·  cadernos em ${DOCS}`);
      lerConta("claude", true); lerConta("openai", true);
      if (abrir) abrirNoSistema(`http://127.0.0.1:${PORTA}/`);
      ok(PORTA);
    });
  });
}
export const desligar = () => { cancelarLogin(); srv.close(); };
// rodando direto pelo terminal: node servidor.mjs [--porta 5199] [--sem-navegador]
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  iniciar({ abrir: ABRIR }).catch(e => { console.error(e.message); process.exit(1); });
}
