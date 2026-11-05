// Ponte do Inéditas no Mac: o mesmo app do link do Claude, rodando com o servidor local.
// Dá ao app as peças que o Claude dá no link (db, user, downloads e sample), só que salvando em ~/Documents/Inéditas
// e gerando as questões com o Claude Code ou o Codex no login do PLANO da pessoa.
(function () {
  "use strict";
  const H = { "X-Ineditas": "1", "Content-Type": "application/json" };
  const post = (u, b) => fetch(u, { method: "POST", headers: H, body: JSON.stringify(b || {}) });

  /* ---------- documentos (uma coleção só: os cadernos e as preferências desta pessoa) ---------- */
  let cache = null; const ouvintes = new Set();
  const snap = changes => {
    const ids = Object.keys(cache || {});
    return { size: ids.length, empty: !ids.length, metadata: { fromCache: false }, docChanges: () => changes,
      docs: ids.map(id => ({ id, exists: true, data: () => JSON.parse(JSON.stringify(cache[id])) })) };
  };
  const emitir = ch => ouvintes.forEach(fn => { try { fn(snap(ch)); } catch (e) { console.error(e); } });
  function ligarEventos() {
    const es = new EventSource("/api/eventos");
    es.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === "conta") { window.dispatchEvent(new Event("ineditas-conta")); return; }
      if (!cache) return;
      if (m.type === "set") { cache[m.id] = m.data; emitir([]); }
      if (m.type === "removed") { delete cache[m.id]; emitir([{ type: "removed", doc: { id: m.id } }]); }
    };
  }
  const gravar = async (id, data) => {
    const r = await fetch("/api/docs/" + encodeURIComponent(id), { method: "PUT", headers: H, body: JSON.stringify(data) });
    if (!r.ok) throw { code: "write_failed", message: "não salvou" };
    if (cache) cache[id] = JSON.parse(JSON.stringify(data));
  };
  const db = {
    collection() {
      return {
        doc(id) {
          return {
            set: data => gravar(id, data),
            async update(patch) { await gravar(id, { ...((cache && cache[id]) || {}), ...patch }); },
            async delete() { await fetch("/api/docs/" + encodeURIComponent(id), { method: "DELETE", headers: H }); if (cache) delete cache[id]; }
          };
        },
        onSnapshot(cb, err) {
          ouvintes.add(cb);
          if (cache) setTimeout(() => cb(snap([])), 0);
          else fetch("/api/docs").then(r => r.json()).then(all => { cache = all; emitir([]); ligarEventos(); })
            .catch(() => { ouvintes.delete(cb); err && err({ code: "offline" }); });
          return () => ouvintes.delete(cb);
        }
      };
    }
  };

  /* ---------- quem está usando: a pessoa deste Mac ---------- */
  const user = {
    id: async () => "mac",
    me: async () => { try { const c = await fetch("/api/conta").then(r => r.json()); return { id: "mac", name: c.nome || "" }; } catch { return { id: "mac", name: "" }; } },
    isOwner: async () => true, canEdit: async () => true
  };

  /* ---------- arquivos: vão para a pasta Downloads ---------- */
  const b64 = async data => {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const downloads = { async save({ filename, data }) { const r = await post("/api/arquivo", { filename, base64: await b64(data) }); if (!r.ok) throw { code: "failed" }; return { status: "saved" }; } };

  /* ---------- IA: Claude ou ChatGPT com a conta do plano ---------- */
  function sample(input, opts) {
    opts = opts || {};
    return (async () => {
      const ctl = new AbortController();
      if (opts.signal) { if (opts.signal.aborted) throw { code: "cancelled" }; opts.signal.addEventListener("abort", () => ctl.abort(), { once: true }); }
      let text = "", r;
      try { r = await fetch("/api/ia", { method: "POST", headers: H, body: JSON.stringify({ input }), signal: ctl.signal }); }
      catch (e) { throw { code: ctl.signal.aborted ? "cancelled" : "upstream_error", message: "sem conexão com o app" }; }
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "", fim = null;
      try {
        for (;;) {
          const { value, done } = await rd.read(); if (done) break;
          buf += dec.decode(value, { stream: true }); const ls = buf.split("\n"); buf = ls.pop();
          for (const l of ls) {
            if (!l.trim()) continue; let m; try { m = JSON.parse(l); } catch { continue; }
            if (m.d) { text += m.d; if (opts.onText) try { opts.onText({ text, delta: m.d }); } catch (e) { console.error(e); } }
            if (m.error) fim = { error: m.error }; if (m.done) fim = { done: true, truncated: !!m.truncated };
          }
        }
      } catch (e) { throw { code: ctl.signal.aborted ? "cancelled" : "upstream_error", message: "a conexão caiu", text: text || undefined }; }
      if (!fim || fim.error) throw { code: (fim && fim.error.code) || "upstream_error", message: (fim && fim.error.message) || "sem resposta", text: text || undefined };
      if (!text.trim()) throw { code: "empty_completion", message: "resposta vazia" };
      return { text, truncated: fim.truncated, modelTierApplied: "default" };
    })();
  }

  /* ---------- contas (Claude e ChatGPT, só pelo plano) ---------- */
  window.ineditasLocal = {
    conta: () => fetch("/api/conta").then(r => r.json()),
    entrar: q => post("/api/conta/entrar", { provedor: q }).then(r => r.json()),
    codigo: (c, q) => post("/api/conta/codigo", { codigo: c, provedor: q }).then(r => r.json()),
    cancelar: q => post("/api/conta/cancelar", { provedor: q }).then(r => r.json()),
    sair: q => post("/api/conta/sair", { provedor: q }).then(r => r.json()),
    modelo: m => post("/api/ajustes", { modelo: m }).then(r => r.json()),
    abrirPasta: () => post("/api/abrir-pasta"),
    perfilInfo: () => fetch("/api/perfil").then(r => r.json()).catch(() => null),
    perfil: async (acao, d) => { const r = await post("/api/perfil", { acao, ...d }); const j = await r.json().catch(() => ({})); return r.ok ? { ok: true, ...j } : { ok: false, status: r.status, erro: j.erro }; }
  };

  const caps = { db, user, downloads, sample };
  window.claude = { use: async n => caps[n] || null };
})();
