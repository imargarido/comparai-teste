import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* ================= CONFIG ================= */
const SUPABASE_URL = "https://glhcernvddfvjphijjcu.supabase.co";
const SUPABASE_KEY = "sb_publishable_lHKIPvMal3o4HF7DrJLnPg_cbefVhCy";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
// código de convite pelo link (?c=...)
const qs = new URLSearchParams(location.search);
if (qs.get("c")) { ls.set("convite", qs.get("c")); history.replaceState(null, "", location.pathname); }

/* ================= UTIL ================= */
const CATS = [
  { id: "horti", nm: "Hortifrúti", em: "🥬" }, { id: "acougue", nm: "Açougue", em: "🥩" },
  { id: "lat", nm: "Frios e laticínios", short: "Laticínios", em: "🧀" }, { id: "merc", nm: "Mercearia", em: "🍚" },
  { id: "bebidas", nm: "Bebidas", em: "🥤" }, { id: "limpeza", nm: "Limpeza", em: "🧽" },
  { id: "higiene", nm: "Higiene", em: "🧼" }, { id: "padaria", nm: "Padaria", em: "🥖" },
  { id: "congelados", nm: "Congelados", em: "🧊" }, { id: "pet", nm: "Pet", em: "🐾" },
  { id: "utilidades", nm: "Utilidades", em: "🏠" }, { id: "outros", nm: "Outros", em: "🛒" },
];
const cat = (id) => CATS.find((c) => c.id === id) || CATS.at(-1);
const fmt = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nice = (s) => esc(String(s || "").toLowerCase().replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase()));
const unid = (u) => /^(KG|KGS|QUILO)$/i.test(u) ? "/kg" : /^(L|LT|LTS)$/i.test(u) ? "/L" : "/un";
const days = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));
const ago = (d) => (d === 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`);
const dlbl = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const fresh = (iso) => { const d = days(iso); return `<span class="fresh ${d <= 2 ? "f-new" : d <= 7 ? "f-mid" : "f-old"}"><i></i>${ago(d)} · ${dlbl(iso)}</span>`; };
const initials = (n) => String(n).split(" ").filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "M";
const COLORS = ["#DC3220", "#F08A00", "#178A4C", "#1F5FBF", "#7A3FB0", "#C2185B", "#00838F"];
const color = (s) => COLORS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const I = {
  search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  pin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  filter: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  scan: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><rect x="8" y="8" width="3" height="3"/><rect x="13" y="8" width="3" height="3"/><rect x="8" y="13" width="3" height="3"/><path d="M13 13h3v3"/></svg>',
};

/* ================= ESTADO ================= */
const S = {
  tab: "home", cidade: ls.get("cidade", null), q: "",
  f: { bairros: [], cats: [], mks: [], dias: 0, sort: "price" },
  list: ls.get("lista", {}), // { descricao_norm: qtd }
  mercados: [], stats: null, recentes: [], resumo: [],
  envio: { step: "inicio", url: null, texto: "", nota: null, erro: null, salvo: null },
  sheet: null, prodOpen: null, reqId: 0,
};
const saveList = () => ls.set("lista", S.list);

/* ================= DADOS ================= */
async function loadMeta() {
  const [m, st, rc, rs, sg] = await Promise.all([
    sb.from("mercados").select("cnpj,nome,razao_social,endereco,bairro,cidade").order("nome"),
    sb.rpc("estatisticas"),
    sb.from("notas_recentes").select("*"),
    sb.from("resumo_mercados").select("*"),
    sb.from("sugestoes").select("id,a,b,nome").eq("status", "pendente").order("id").limit(30),
  ]);
  S.sugestoes = sg.data || [];
  S.mercados = m.data || []; S.stats = st.data || { notas: 0, produtos: 0, mercados: 0 };
  S.recentes = rc.data || []; S.resumo = rs.data || [];
}
const cidades = () => [...new Set(S.mercados.map((m) => m.cidade).filter(Boolean))].sort();
const bairrosDa = (c) => [...new Set(S.mercados.filter((m) => !c || m.cidade === c).map((m) => m.bairro).filter(Boolean))].sort();

async function buscar() {
  const { data, error } = await sb.rpc("buscar_precos", {
    q: S.q.trim(), p_cidade: S.cidade, p_bairros: S.f.bairros, p_mercados: S.f.mks,
    p_categorias: S.f.cats, p_dias: S.f.dias || null,
  });
  if (error) throw error;
  const g = new Map();
  (data || []).forEach((r) => { if (!g.has(r.descricao_norm)) g.set(r.descricao_norm, []); g.get(r.descricao_norm).push(r); });
  const res = [...g.entries()].map(([k, o]) => ({ k, o: o.sort((a, b) => a.preco_unit - b.preco_unit) }));
  const s = S.f.sort;
  res.sort((a, b) => s === "price" ? a.o[0].preco_unit - b.o[0].preco_unit
    : s === "save" ? (b.o.at(-1).preco_unit - b.o[0].preco_unit) - (a.o.at(-1).preco_unit - a.o[0].preco_unit) || b.o.length - a.o.length
    : s === "recent" ? new Date(b.o[0].emitida_em) - new Date(a.o[0].emitida_em)
    : a.k.localeCompare(b.k));
  return res;
}

/* ================= COMPONENTES ================= */
const logo = () => `<div class="logo"><span class="wm">comparAI</span><span class="beta">TESTE</span></div>`;
const locChip = () => `<button class="loc" data-act="openCity">${I.pin} ${esc(S.cidade || "Todas as cidades")} ▾</button>`;
const skel = (n = 4) => `<div class="list">${Array.from({ length: n }, () => '<div class="skel"></div>').join("")}</div>`;

function pcard(r) {
  const b = r.o[0], w = r.o.at(-1), sv = w.preco_unit - b.preco_unit;
  return `<button class="pcard fade" data-act="openProd" data-v="${esc(r.k)}">
    <div class="em">${cat(b.categoria).em}</div>
    <div class="info">
      <div class="nm">${nice(b.descricao)}</div>
      <div class="best"><span class="price">${fmt(b.preco_unit)}</span><span class="unit-s">${unid(b.unidade)}</span><span class="where">no ${esc(b.mercado)}</span></div>
      <div class="range">${r.o.length > 1 ? `${r.o.length} mercados · até ${fmt(w.preco_unit)}` : "1 mercado por enquanto"} ${sv >= 0.1 ? `<span class="save">economize ${fmt(sv)}</span>` : ""}</div>
      <div class="range">${fresh(b.emitida_em)}</div>
    </div><span class="chev">›</span></button>`;
}
const emptyBase = (titulo, txt) => `<div class="empty"><div class="em">🧾</div><h3>${titulo}</h3><p>${txt}</p>
  <div style="margin-top:16px"><button class="btn btn-red" data-act="tab" data-v="send">Enviar uma nota</button></div></div>`;

/* ================= TELAS ================= */
function vHome() {
  const st = S.stats || { notas: "…", produtos: "…", mercados: "…" };
  const nmerc = S.resumo.filter((m) => !S.cidade || m.cidade === S.cidade).sort((a, b) => b.produtos - a.produtos).slice(0, 6);
  return `
  <header class="top home">
    <div class="brand">${logo()}</div>
    <p class="tagline">Preço de supermercado, comparado de verdade</p>
    <h1 class="hello">Onde está mais barato<br>perto de <span>você</span>?</h1>
    <button class="searchbox" data-act="goSearch" style="width:100%;text-align:left">${I.search}<span style="color:#A4978E;font-size:16px">Busque arroz, café, leite…</span></button>
    <div class="stats-top two"><div><b>${st.produtos}</b>produtos</div><div><b>${st.mercados}</b>mercados cadastrados</div></div>
  </header>
  <button class="scan-cta" data-act="tab" data-v="send">
    <div class="ic">${I.scan}</div>
    <div><h3>Envie sua nota fiscal</h3><p>Cada nota alimenta a base e ajuda todo mundo a economizar.</p></div>
    <span class="arrow">›</span>
  </button>
  <section class="sec"><div class="sec-h"><h2>Categorias</h2></div>
    <div class="cats">${CATS.filter((c) => c.id !== "outros").map((c) => `<button class="cat" data-act="goCat" data-v="${c.id}"><span class="em">${c.em}</span>${c.short || c.nm}</button>`).join("")}</div>
  </section>
  ${S.recentes.length ? `<section class="sec"><div class="sec-h"><h2>Notas que acabaram de chegar</h2></div>
    <div class="feed">${S.recentes.slice(0, 6).map((r) => `<div class="feed-row"><span class="pulse"></span><div><b>${esc(r.mercado)}</b> · ${r.qtd_itens} produtos${r.bairro ? `<br><span style="color:var(--muted);font-size:12px">${esc(r.bairro)}, ${esc(r.cidade || "")}</span>` : ""}</div><span class="t">${ago(days(r.enviada_em))}</span></div>`).join("")}</div>
  </section>` : `<section class="sec"><div class="howto" style="padding:18px;text-align:center"><div style="font-size:40px">🌱</div><h3 style="font-family:var(--head);margin:6px 0 4px">A base está começando</h3><p style="color:var(--muted);font-size:13.5px">Você está entre os primeiros testadores. Envie as notas das suas compras e veja os preços aparecerem aqui.</p></div></section>`}
  ${S.sugestoes?.length ? `<section class="sec"><div class="sec-h"><h2>Ajude a organizar 🔎</h2><span style="font-size:12px;color:var(--muted)">${S.sugestoes.length} sugest${S.sugestoes.length > 1 ? "ões" : "ão"}</span></div>
    <p class="uni-sub" style="margin-top:-6px">A IA achou produtos que parecem ser o mesmo com nomes diferentes.</p>
    <div class="list" style="padding:0">${S.sugestoes.slice(0, S.verTodasSug ? 30 : 3).map(sugCard).join("")}</div>
    ${S.sugestoes.length > 3 && !S.verTodasSug ? `<button class="link" style="display:block;margin:10px auto 0" data-act="verSug">Ver todas</button>` : ""}
  </section>` : ""}
  ${nmerc.length ? `<section class="sec"><div class="sec-h"><h2>Mercados com mais preços</h2><button class="link" data-act="tab" data-v="markets">Ver todos</button></div>
    <div class="hscroll">${nmerc.map((m) => `<button class="mk-mini" data-act="goMarket" data-v="${m.cnpj}">
      <div class="av" style="background:${color(m.cnpj)}">${initials(m.nome)}</div><div class="nm">${esc(m.nome)}</div>
      <div class="meta">${esc(m.bairro || m.cidade || "")} · ${m.produtos} produtos</div></button>`).join("")}</div></section>` : ""}
  <section class="sec"><div class="share-card">
    <div style="font-size:38px">📣</div>
    <h3>Chame amigos e parentes</h3>
    <p>Quanto mais gente enviando notas, mais mercados e preços na sua região, e melhor a comparação pra todo mundo.</p>
    <a class="btn btn-wa btn-block" href="https://wa.me/?text=${encodeURIComponent("Estou usando o comparAI pra comparar preços de supermercado perto de casa. Entra aí e envia as notas das suas compras também: " + location.origin + location.pathname + (ls.get("convite", "") ? "?c=" + ls.get("convite", "") : ""))}" target="_blank" rel="noopener">Compartilhar no WhatsApp</a>
  </div></section>
  <p class="proto">Versão de teste. Os preços vêm das notas fiscais enviadas pelos testadores.</p>`;
}

function vSearch() {
  const n = S.f.bairros.length + S.f.cats.length + S.f.mks.length + (S.f.dias ? 1 : 0);
  const chips = [];
  S.f.cats.forEach((c) => chips.push(`<button class="chip filter" data-act="rmF" data-k="cats" data-v="${c}">${cat(c).em} ${cat(c).short || cat(c).nm}<span class="x">×</span></button>`));
  S.f.bairros.forEach((b) => chips.push(`<button class="chip filter" data-act="rmF" data-k="bairros" data-v="${esc(b)}">${esc(b)}<span class="x">×</span></button>`));
  S.f.mks.forEach((m) => chips.push(`<button class="chip filter" data-act="rmF" data-k="mks" data-v="${m}">${esc(S.mercados.find((x) => x.cnpj === m)?.nome || "Mercado")}<span class="x">×</span></button>`));
  if (S.f.dias) chips.push(`<button class="chip filter" data-act="rmF" data-k="dias">Até ${S.f.dias} dias<span class="x">×</span></button>`);
  return `
  <header class="top slim">
    <div class="brand"><div class="page-title">Buscar preços</div>${locChip()}</div>
    <div class="page-sub">Consulte um produto e selecione sua região para conferir o menor preço.</div>
    <div class="searchbox" style="margin-top:10px">${I.search}<input id="q" type="search" enterkeyhint="search" placeholder="Produto ou marca" value="${esc(S.q)}" autocomplete="off">${S.q ? '<button class="clear-q" data-act="clearQ">×</button>' : ""}</div>
  </header>
  <div class="chipbar">
    <button class="chip ${n ? "on" : ""}" data-act="openFilters">${I.filter} Filtros ${n ? `<span class="n">${n}</span>` : ""}</button>
    ${chips.join("")}
    ${!n ? CATS.map((c) => `<button class="chip" data-act="goCat" data-v="${c.id}">${c.em} ${c.short || c.nm}</button>`).join("") : ""}
  </div>
  <div id="results">${skel()}</div>`;
}
let debounce;
async function renderResults() {
  const box = document.getElementById("results"); if (!box) return;
  const id = ++S.reqId;
  try {
    const res = await buscar();
    if (id !== S.reqId || !document.getElementById("results")) return;
    const sortLbl = { price: "Menor preço", save: "Maior economia", recent: "Mais recentes", az: "A–Z" }[S.f.sort];
    box.innerHTML = `<div class="result-meta"><span><b>${res.length}</b> produto${res.length !== 1 ? "s" : ""}${S.cidade ? ` em ${esc(S.cidade)}` : ""}</span><button class="sort-btn" data-act="openSort">${sortLbl} ▾</button></div>
      ${res.length ? `<div class="list">${res.map(pcard).join("")}</div>` :
        (S.q || S.f.cats.length || S.f.bairros.length || S.f.mks.length || S.f.dias)
          ? `<div class="empty"><div class="em">🔎</div><h3>Nada encontrado</h3><p>Tente uma palavra mais curta (ex.: "arroz" em vez de "arroz tipo 1") ou tire alguns filtros.</p><div style="margin-top:14px"><button class="btn btn-ghost" data-act="clearAll">Limpar filtros</button></div></div>`
          : emptyBase("Ainda não há preços", "Assim que alguém enviar uma nota, os preços aparecem aqui.")}
      <p class="proto">Mostrando o preço mais recente de cada produto em cada mercado. Por enquanto, o mesmo produto pode aparecer com nomes diferentes em mercados diferentes.</p>`;
  } catch (e) {
    if (id === S.reqId) box.innerHTML = `<div class="err">Não consegui buscar agora. Confira sua internet e tente de novo.</div>`;
  }
}

function vSend() {
  const E = S.envio, convite = ls.get("convite", "");
  const err = E.erro ? `<div class="err">${esc(E.erro)}</div>` : "";
  if (E.step === "scan") return `
    <header class="top slim"><div class="page-title">Ler QR Code</div><div class="page-sub">Aponte para o QR Code no rodapé da nota</div></header>
    <div style="padding:16px"><div id="reader"></div>
    <button class="btn btn-ghost btn-block" style="margin-top:12px" data-act="scanStop">Cancelar</button></div>`;
  if (E.step === "revisao") { const n = E.nota; const tot = n.itens.reduce((s, i) => s + (+i.total || 0), 0); return `
    <header class="top slim"><div class="page-title">Confira a nota</div><div class="page-sub">A IA leu ${n.itens.length} produto${n.itens.length > 1 ? "s" : ""}. Toque para corrigir o que estiver errado.</div></header>
    <div class="receipt">
      <div class="mk-form">
        ${n.mercado.conhecido ? `<div class="known" style="margin:0 0 8px">✓ Mercado já cadastrado</div>` : ""}
        <label class="mkf">Nome fantasia <small>é o nome que aparece no app</small><input class="ed mk" data-ed="mercado.nome" value="${esc(n.mercado.nome)}" placeholder="Ex.: Assaí Atacadista"></label>
        <label class="mkf">Razão social <small>como vem na nota</small><input class="ed" data-ed="mercado.razao_social" value="${esc(n.mercado.razao_social || "")}" placeholder="Ex.: Sendas Distribuidora S/A"></label>
        <label class="mkf">Endereço<input class="ed" data-ed="mercado.endereco" value="${esc(n.mercado.endereco || "")}" placeholder="Rua e número"></label>
        <div class="ed-row"><label class="mkf">Bairro<input class="ed" data-ed="mercado.bairro" value="${esc(n.mercado.bairro || "")}" placeholder="Bairro"></label><label class="mkf">Cidade<input class="ed" data-ed="mercado.cidade" value="${esc(n.mercado.cidade || "")}" placeholder="Cidade"></label></div>
        ${!n.mercado.conhecido ? `<div class="mk-hint">💡 Mercado novo: confira o nome fantasia (o nome que todo mundo conhece), o bairro e a cidade.</div>` : ""}
        <div class="c" style="margin-top:6px">${n.mercado.cnpj?.length === 14 ? `CNPJ ${n.mercado.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}` : `<span style="color:var(--red)">CNPJ não lido</span>`}</div>
      </div>
      <hr><div class="c">${n.emitida_em ? "Nota de " + new Date(n.emitida_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Data não lida (vamos usar hoje)"}</div><hr>
      ${n.itens.map((it, i) => `<div class="ritem"><div style="flex:1;min-width:0">
          <div class="raw">${it.descricao_original ? esc(it.descricao_original) + " · " : ""}${String(it.qtd).replace(".", ",")} ${esc(it.unidade)} x ${fmt(it.preco_unit)}</div>
          <input class="ed match" data-ed="itens.${i}.descricao" value="${nice(it.descricao)}">${it.conhecido ? `<span class="known">✓ já na base</span>` : ""}
          <select class="ed-cat" data-ed="itens.${i}.categoria">${CATS.map((c) => `<option value="${c.id}" ${c.id === it.categoria ? "selected" : ""}>${c.em} ${c.nm}</option>`).join("")}</select>
          <span class="unit">Vai para a base: R$ <input class="ed ed-num" inputmode="decimal" data-ed="itens.${i}.preco_unit" value="${String(it.preco_unit.toFixed(2)).replace(".", ",")}">${unid(it.unidade)}</span></div>
        <div style="text-align:right"><div class="v">${fmt(it.total)}</div><button class="rm" data-act="rmItem" data-v="${i}" aria-label="Remover">✕</button></div></div>`).join("")}
      <hr><div class="ritem"><b>TOTAL</b><b>${fmt(tot)}</b></div>
      <div class="privacy" style="background:var(--yellow-soft);color:#6B4D00">🏷️ Só o preço unitário entra na comparação. Quantidade e total da sua compra ficam de fora.</div>
      <div class="privacy">🔒 Seus dados pessoais (como CPF) não são salvos.</div>
    </div>
    ${err}
    <div style="padding:20px 16px 0;display:flex;gap:10px">
      <button class="btn btn-ghost" data-act="sendReset">Voltar</button>
      <button class="btn btn-red" style="flex:1" data-act="sendSave" ${E.loading ? "disabled" : ""}>${E.loading ? "Enviando…" : "Confirmar e enviar"}</button>
    </div>`; }
  if (E.step === "feito") return `
    <div class="done-hero"><div class="burst">🎉</div><h2>Valeu! Preços na base</h2>
    <p>${E.salvo.salvos} preços do ${esc(E.salvo.mercado.nome)} já estão disponíveis pra todo mundo.</p></div>
    <div class="stats"><div><b>${E.salvo.salvos}</b>preços novos</div><div><b>${ls.get("enviadas", 0)}</b>notas suas</div><div><b>${S.stats?.notas ?? "–"}</b>notas na base</div></div>
    <div style="padding:22px 16px 0;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-yellow btn-block" data-act="goMarket" data-v="${E.salvo.mercado.cnpj}">Ver preços do ${esc(E.salvo.mercado.nome)}</button>
      <button class="btn btn-ghost btn-block" data-act="sendReset">Enviar outra nota</button>
    </div>`;
  // início
  const fotos = E.fotos || [];
  if (E.loading && E.modo !== "texto") return `
    <header class="top slim"><div class="page-title">Lendo sua nota…</div><div class="page-sub">A IA está identificando o mercado e os produtos</div></header>
    <div class="steps">${["Foto recebida", "Encontrando o mercado", "Lendo os produtos e preços", "Removendo dados pessoais"].map((t, i) => `<div class="step ${i === 0 ? "done" : i === 1 ? "doing" : ""}" data-i="${i}"><span class="dot">✓</span>${t}</div>`).join("")}</div>
    <p class="proto">Pode levar até 20 segundos.</p>`;
  return `
    <header class="top slim"><div class="page-title">Enviar nota fiscal</div><div class="page-sub">Tire uma foto do cupom e a gente faz o resto</div></header>
    ${err}
    <section class="sec">
      ${fotos.length ? `<div class="thumbs">${fotos.map((f, i) => `<div class="th"><img src="${f}" alt="Parte ${i + 1} da nota"><button data-act="rmFoto" data-v="${i}" aria-label="Remover foto">✕</button><span>${i + 1}</span></div>`).join("")}
          ${fotos.length < 4 ? `<label class="th add"><input type="file" accept="image/*" capture="environment" class="fotoIn" hidden><b>📸</b>Tirar outra</label>
            <label class="th add"><input type="file" accept="image/*" multiple class="fotoIn" hidden><b>🖼️</b>Da galeria</label>` : ""}</div>
        <p class="proto" style="margin:8px 0 0">Nota comprida? Use mais de uma foto, de cima para baixo (até 4).</p>
        <button class="btn btn-red btn-block" style="margin-top:14px" data-act="lerFoto">Ler a nota</button>`
      : `<label class="photo-cta"><input type="file" accept="image/*" capture="environment" class="fotoIn" hidden>
          <span class="ic">📸</span><b>Tirar foto da nota</b><small>abre a câmera</small></label>
        <label class="gal-cta"><input type="file" accept="image/*" multiple class="fotoIn" hidden>🖼️ Escolher da galeria</label>
        <div class="tips"><div>💡 Boa luz</div><div>📄 Nota esticada</div><div>📱 Celular reto</div></div>`}
    </section>
    <section class="sec"><div class="howto" style="padding:13px 15px"><h4 style="font-size:13.5px">📝 Depois da leitura, confira o mercado</h4>
      <p style="font-size:12.5px;color:var(--muted);margin-top:3px">A nota traz a razão social (ex.: "Sendas Distribuidora S/A"). Confira o <b>nome fantasia</b>, que é o nome que todo mundo conhece e o que aparece no app (ex.: "Assaí"), e confirme bairro e cidade: é isso que coloca o mercado certinho na busca por região.</p></div></section>
    ${!convite ? `<section class="sec"><div class="howto" style="padding:14px"><h4 style="font-size:14px">Falta o código de convite</h4><p style="font-size:12.5px;color:var(--muted)">É só uma vez. Digite o código que veio junto com o link do app (ex.: feira-abc123).</p>
      <div class="code-in"><input id="convite" placeholder="ex.: feira-abc123" autocapitalize="off"><button class="btn btn-ghost btn-sm" data-act="saveCode">Salvar</button></div></div></section>` : ""}
    <section class="sec"><details class="alt" ${E.modo === "texto" ? "open" : ""}><summary>Prefere colar o texto da nota da Sefaz?</summary>
      <div class="howto" style="margin-top:10px">
        <div class="st"><b class="n">1</b><div style="flex:1"><h4>Abra a nota</h4><p>Leia o QR Code com a câmera do celular. A página da nota abre no navegador.</p>
          <div class="act">${E.url ? `<a class="btn btn-red btn-sm" href="${esc(E.url)}" target="_blank" rel="noopener">Abrir nota na Sefaz ↗</a>` : `<button class="btn btn-ghost btn-sm" data-act="scanStart">Ler QR Code aqui</button>`}</div></div></div>
        <div class="st"><b class="n">2</b><div><h4>Copie a página inteira</h4><p>Toque e segure no texto, <b>Selecionar tudo</b> e <b>Copiar</b>.</p></div></div>
        <div class="st"><b class="n">3</b><div style="flex:1"><h4>Cole aqui</h4>
          <div class="act" style="margin-bottom:8px"><button class="btn btn-yellow btn-sm" data-act="pasteClip">📋 Colar</button></div>
          <textarea class="paste" id="paste" placeholder="Ou toque aqui e cole o texto">${esc(E.texto || "")}</textarea>
          <button class="btn btn-red btn-block btn-sm" style="margin-top:10px" data-act="sendPreview" ${E.loading ? "disabled" : ""}>${E.loading ? "Lendo…" : "Ler o texto"}</button></div></div>
      </div></details></section>
    <p class="proto">🔒 O app guarda só o mercado, os produtos, o preço unitário e a data. Nada de CPF ou dados pessoais. A foto não fica salva.</p>`;
}

async function vListHtml() {
  const ks = Object.keys(S.list);
  if (!ks.length) return `
    <header class="top slim"><div class="page-title">Minha lista</div><div class="page-sub">Descubra onde a compra inteira sai mais barata</div></header>
    <div class="empty"><div class="em">📝</div><h3>Sua lista está vazia</h3><p>Na busca, abra um produto e toque em "Adicionar à lista". O app soma tudo e compara os mercados.</p>
    <div style="margin-top:16px"><button class="btn btn-red" data-act="goSearch">Buscar produtos</button></div></div>`;
  let q = sb.from("ultimos_precos").select("*").in("descricao_norm", ks);
  if (S.cidade) q = q.eq("cidade", S.cidade);
  const { data = [] } = await q;
  const byM = new Map();
  (data || []).forEach((r) => { if (!byM.has(r.cnpj)) byM.set(r.cnpj, { nome: r.mercado, itens: {} }); byM.get(r.cnpj).itens[r.descricao_norm] = r; });
  const ms = [...byM.entries()].map(([cnpj, m]) => {
    let tot = 0; const miss = [];
    ks.forEach((k) => { const r = m.itens[k]; if (r) tot += r.preco_unit * S.list[k]; else miss.push(k); });
    return { cnpj, nome: m.nome, tot, miss };
  }).sort((a, b) => a.miss.length - b.miss.length || a.tot - b.tot);
  const full = ms.filter((x) => !x.miss.length), best = full[0], worst = full.at(-1);
  const maxT = Math.max(1, ...ms.map((x) => x.tot));
  const info = Object.fromEntries((data || []).map((r) => [r.descricao_norm, r]));
  const minOf = (k) => Math.min(...(data || []).filter((r) => r.descricao_norm === k).map((r) => r.preco_unit));
  return `
  <header class="top slim"><div class="page-title">Minha lista</div><div class="page-sub">${ks.length} produto${ks.length > 1 ? "s" : ""} · ${ms.length} mercado${ms.length !== 1 ? "s" : ""} com preço</div></header>
  <section class="sec"><div class="compare">
    ${best ? `<div class="winner"><div class="lbl">🏆 Mais barato para a sua lista</div><div class="nm">${esc(best.nome)}</div><div class="tot">${fmt(best.tot)}</div>
      ${worst && worst !== best ? `<p>Você economiza ${fmt(worst.tot - best.tot)} em relação ao mais caro.</p>` : ""}</div>`
      : `<div class="winner" style="background:var(--yellow-soft)"><div class="lbl" style="color:#6B4D00">Nenhum mercado tem todos os itens ainda</div><p>Com mais notas enviadas, a comparação fica completa.</p></div>`}
    ${ms.slice(0, 6).map((x) => `<div class="bar-row ${x === best ? "best" : ""}"><div class="l"><span>${esc(x.nome)}</span><span>${x.miss.length === ks.length ? "—" : fmt(x.tot) + (x.miss.length ? " *" : "")}</span></div>
      <div class="bar"><i style="width:${Math.max(6, (x.tot / maxT) * 100)}%;${x.miss.length ? "background:#E3D7CA" : ""}"></i></div>
      ${x.miss.length ? `<div class="miss">* Parcial: falta${x.miss.length > 1 ? "m" : ""} ${x.miss.length} ite${x.miss.length > 1 ? "ns" : "m"}</div>` : ""}</div>`).join("")}
  </div></section>
  <section class="sec"><div class="sec-h"><h2>Itens</h2><button class="link" data-act="clearList">Limpar lista</button></div>
    <div class="list" style="padding:0">${ks.map((k) => { const r = info[k]; return `
      <div class="litem"><div class="em">${cat(r?.categoria).em}</div><div style="min-width:0"><div class="nm">${nice(r?.descricao || k)}</div><div class="sub">${r ? `a partir de ${fmt(minOf(k))}${unid(r.unidade)}` : "sem preço nessa cidade"}</div></div>
      <div class="stepper"><button data-act="dec" data-v="${esc(k)}">−</button><span>${S.list[k]}</span><button data-act="inc" data-v="${esc(k)}">+</button></div></div>`; }).join("")}
    </div></section>`;
}

function vMarkets() {
  const ms = S.resumo.filter((m) => !S.cidade || m.cidade === S.cidade).sort((a, b) => new Date(b.ultima_nota || 0) - new Date(a.ultima_nota || 0));
  return `
  <header class="top slim"><div class="brand"><div class="page-title">Mercados</div>${locChip()}</div><div class="page-sub">${ms.length} mercado${ms.length !== 1 ? "s" : ""} com preços enviados</div></header>
  ${ms.length ? `<div class="list" style="padding-top:16px">${ms.map((m) => `
    <button class="mcard fade" data-act="goMarket" data-v="${m.cnpj}">
      <div class="av" style="background:${color(m.cnpj)}">${initials(m.nome)}</div>
      <div style="flex:1;min-width:0"><div class="nm">${esc(m.nome)}</div><div class="meta">${esc([m.bairro, m.cidade].filter(Boolean).join(", "))}</div>
        <div class="tags"><span class="tag">${m.produtos} produtos</span>${m.ultima_nota ? `<span class="tag ${days(m.ultima_nota) <= 3 ? "g" : ""}">última nota ${ago(days(m.ultima_nota))}</span>` : ""}</div>
      </div><span class="chev">›</span></button>
    <button class="edit-mk" data-act="editMk" data-v="${m.cnpj}">✏️ Editar dados do mercado</button>`).join("")}</div>` : emptyBase("Nenhum mercado ainda", "Os mercados aparecem aqui quando alguém envia a primeira nota de cada um.")}`;
}

/* ================= PRODUTO ================= */
async function openProd(k) {
  const el = document.getElementById("over");
  S.prodOpen = k; el.innerHTML = `<div class="over-top"><button class="icon-btn" data-act="closeProd">‹</button></div><div style="padding:16px">${skel(3)}</div>`;
  el.scrollTop = 0; requestAnimationFrame(() => el.classList.add("show"));
  let q = sb.from("ultimos_precos").select("*").eq("descricao_norm", k).order("preco_unit");
  if (S.cidade) q = q.eq("cidade", S.cidade);
  const [{ data: o = [] }, { data: h = [] }] = await Promise.all([
    q, sb.from("precos").select("preco_unit,emitida_em").eq("descricao_norm", k).order("emitida_em").limit(60),
  ]);
  if (S.prodOpen !== k) return;
  const b = (o || [])[0], w = (o || []).at(-1); const qn = S.list[k] || 0;
  if (!b) { el.innerHTML = `<div class="over-top"><button class="icon-btn" data-act="closeProd">‹</button></div><div class="empty"><h3>Sem preço nessa cidade</h3></div>`; return; }
  let chart = "";
  if ((h || []).length >= 2) {
    const vals = h.map((x) => +x.preco_unit), mn = Math.min(...vals) * 0.97, mx = Math.max(...vals) * 1.03 || 1;
    const t0 = new Date(h[0].emitida_em).getTime(), t1 = Math.max(t0 + 1, new Date(h.at(-1).emitida_em).getTime());
    const pts = h.map((x) => [((new Date(x.emitida_em).getTime() - t0) / (t1 - t0)) * 300, 90 - ((x.preco_unit - mn) / (mx - mn || 1)) * 80]);
    chart = `<section class="sec"><div class="sec-h"><h2>Preços informados</h2><span style="font-size:12px;color:var(--muted)">${h.length} registros</span></div>
      <div class="chart"><svg viewBox="-8 -8 316 108" width="100%" height="110" preserveAspectRatio="none">${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#E8A900"/>`).join("")}</svg>
      <div class="cap"><span>${dlbl(h[0].emitida_em)}</span><span>${dlbl(h.at(-1).emitida_em)}</span></div></div></section>`;
  }
  el.innerHTML = `
    <div class="over-top">
      <div style="display:flex;justify-content:space-between"><button class="icon-btn" data-act="closeProd">‹</button><span class="loc" style="background:rgba(255,255,255,.7);color:var(--ink)">${cat(b.categoria).em} ${cat(b.categoria).nm}</span></div>
      <div class="prod-hero"><div class="em">${cat(b.categoria).em}</div><div><h1>${nice(b.descricao)}</h1><p>Preço por ${unid(b.unidade).slice(1)}${b.descricao_original && b.descricao_original !== b.descricao ? ` · na nota: ${esc(b.descricao_original)}` : ""}</p></div></div>
    </div>
    <div class="bestcard"><div class="lbl">Menor preço${S.cidade ? ` em ${esc(S.cidade)}` : ""}</div><div class="big">${fmt(b.preco_unit)}<span style="font-size:16px;opacity:.8">${unid(b.unidade)}</span></div><div class="at">no ${esc(b.mercado)}${b.bairro ? ` · ${esc(b.bairro)}` : ""}</div>
      <div class="row2"><div>Mais caro<b>${fmt(w.preco_unit)}</b></div><div>Diferença<b>${fmt(w.preco_unit - b.preco_unit)}</b></div><div>Nota de<b>${dlbl(b.emitida_em)}</b></div></div></div>
    ${chart}
    <section class="sec"><div class="sec-h"><h2>Preço por mercado</h2><span style="font-size:12px;color:var(--muted)">${o.length} mercado${o.length > 1 ? "s" : ""}</span></div>
      <div class="list" style="padding:0">${o.map((x, i) => `
        <div class="offer ${i === 0 ? "top1" : ""}"><span class="rank">${i + 1}</span>
          <div style="min-width:0"><div class="nm">${esc(x.mercado)}</div><div class="meta">${esc([x.bairro, x.cidade].filter(Boolean).join(", "))}</div><div>${fresh(x.emitida_em)}</div></div>
          <div class="pr"><b>${fmt(x.preco_unit)}</b><small>${i === 0 ? "mais barato" : "+ " + fmt(x.preco_unit - b.preco_unit)}</small></div></div>`).join("")}
      </div>
      <p class="proto">Só aparecem mercados onde o produto veio com esse mesmo nome na nota.</p>
      ${(S.sugestoes || []).filter((s) => s.a === k || s.b === k).map((s) => `<div class="sug" style="margin-top:14px"><div class="sug-nome">🔎 A IA acha que este pode ser o mesmo produto que <b>${nice(s.a === k ? s.b : s.a)}</b></div>
        <div class="sug-act"><button class="btn btn-ghost btn-sm" data-act="sugNao" data-v="${s.id}">Não são iguais</button><button class="btn btn-red btn-sm" data-act="sugSim" data-v="${s.id}">Unificar</button></div></div>`).join("")}
      <div class="uni-row"><button class="uni-btn" data-act="renOpen" data-v="${esc(k)}">✏️ Nome errado ou incompleto? <b>Corrigir</b></button>
      <button class="uni-btn" data-act="uniOpen" data-v="${esc(k)}">🔗 Viu com outro nome? <b>Unificar</b></button></div>
    </section>
    <div class="addbar">${qn ? `<div class="stepper"><button data-act="dec" data-v="${esc(k)}">−</button><span>${qn}</span><button data-act="inc" data-v="${esc(k)}">+</button></div><button class="btn btn-yellow" style="flex:1" data-act="tab" data-v="list">Ver minha lista</button>`
      : `<button class="btn btn-red btn-block" data-act="inc" data-v="${esc(k)}">+ Adicionar à lista</button>`}</div>`;
}
function closeProd() { document.getElementById("over").classList.remove("show"); S.prodOpen = null; }

/* ================= UNIFICAR ================= */
const sugCard = (s) => `<div class="sug fade">
  <div class="sug-par"><span>${nice(s.a)}</span><i>≈</i><span>${nice(s.b)}</span></div>
  ${s.nome ? `<div class="sug-nome">Nome sugerido: <b>${nice(s.nome)}</b></div>` : ""}
  <div class="sug-act"><button class="btn btn-ghost btn-sm" data-act="sugNao" data-v="${s.id}">Não são iguais</button><button class="btn btn-red btn-sm" data-act="sugSim" data-v="${s.id}">São o mesmo</button></div>
</div>`;
let uniTimer;
async function renderUniRes() {
  const box = document.getElementById("uniRes"); if (!box) return;
  const U = S.uni; const q = U.q.trim();
  if (q.length < 2) { box.innerHTML = `<p class="proto" style="margin:14px 0">Digite pelo menos 2 letras.</p>`; return; }
  box.innerHTML = skel(2);
  const { data } = await sb.rpc("buscar_precos", { q, p_cidade: null, p_bairros: null, p_mercados: null, p_categorias: null, p_dias: null });
  if (S.uni !== U || U.q.trim() !== q) return;
  const g = new Map();
  (data || []).forEach((r) => { if (r.descricao_norm === U.de) return; const x = g.get(r.descricao_norm) || { k: r.descricao_norm, nome: r.descricao, cat: r.categoria, mks: new Set(), min: Infinity }; x.mks.add(r.mercado); x.min = Math.min(x.min, r.preco_unit); g.set(r.descricao_norm, x); });
  const lst = [...g.values()].slice(0, 20);
  box.innerHTML = lst.length ? `<div class="uni-list">${lst.map((x) => `<button class="mrow" data-act="uniPick" data-v="${esc(x.k)}" data-n="${esc(x.nome)}"><span style="font-size:22px">${cat(x.cat).em}</span><div style="min-width:0"><div class="nm">${nice(x.nome)}</div><div class="meta">${[...x.mks].slice(0, 2).map(esc).join(", ")}${x.mks.size > 2 ? ` e mais ${x.mks.size - 2}` : ""} · a partir de ${fmt(x.min)}</div></div><span class="chev" style="margin-left:auto">›</span></button>`).join("")}</div>`
    : `<p class="proto" style="margin:14px 0">Nenhum produto encontrado com esse nome.</p>`;
}
async function uniConfirmar() {
  const U = S.uni; const outro = document.getElementById("uniOutro")?.value.trim();
  const nome = outro || U.nome;
  U.loading = true; U.erro = null; renderSheet();
  const { data, error } = await sb.rpc("unificar_produtos", { p_convite: ls.get("convite", ""), p_de: U.de, p_para: U.alvo.k, p_nome: nome });
  U.loading = false;
  if (error) { U.erro = /convite/i.test(error.message) ? "Falta o código de convite. Abra o app pelo link que você recebeu." : "Não consegui unificar agora. Tente de novo."; renderSheet(); return; }
  const final = data.nome;
  [U.de, U.alvo.k].forEach((k) => { if (S.list[k]) { S.list[final] = (S.list[final] || 0) + S.list[k]; if (k !== final) delete S.list[k]; } });
  S.sugestoes = (S.sugestoes || []).filter((s) => ![s.a, s.b].some((x) => x === U.de || x === U.alvo.k));
  saveList(); closeSheet(); toast("✓ Produtos unificados"); if (S.tab === "home") render(); openProd(final); if (S.tab === "search") renderResults();
}
document.addEventListener("input", (e) => {
  if (e.target.id !== "uniQ") return;
  S.uni.q = e.target.value; clearTimeout(uniTimer); uniTimer = setTimeout(renderUniRes, 300);
});

/* ================= SHEETS ================= */
function openSheet(k) { S.sheet = k; renderSheet(); document.getElementById("backdrop").classList.add("show"); requestAnimationFrame(() => document.getElementById("sheet").classList.add("show")); }
function closeSheet() { S.sheet = null; document.getElementById("backdrop").classList.remove("show"); document.getElementById("sheet").classList.remove("show"); }
function renderSheet() {
  const el = document.getElementById("sheet"), k = S.sheet; if (!k) return;
  if (k === "filters") {
    const bs = bairrosDa(S.cidade);
    const mks = S.mercados.filter((m) => (!S.cidade || m.cidade === S.cidade) && (!S.f.bairros.length || S.f.bairros.includes(m.bairro)));
    el.innerHTML = `<div class="grab"></div><div class="sheet-h"><h3>Filtros</h3><button class="link" data-act="clearAll">Limpar tudo</button></div>
    <div class="sheet-body">
      <div class="fgroup"><h4>Cidade</h4><div class="wrap"><button class="opt ${!S.cidade ? "on" : ""}" data-act="setCity" data-v="">Todas</button>${cidades().map((c) => `<button class="opt ${c === S.cidade ? "on" : ""}" data-act="setCity" data-v="${esc(c)}">📍 ${esc(c)}</button>`).join("")}</div></div>
      ${bs.length ? `<div class="fgroup"><h4>Bairro ${S.f.bairros.length ? `<small>${S.f.bairros.length} selecionado${S.f.bairros.length > 1 ? "s" : ""}</small>` : ""}</h4><div class="wrap">${bs.map((b) => `<button class="opt ${S.f.bairros.includes(b) ? "on" : ""}" data-act="tgl" data-k="bairros" data-v="${esc(b)}">${esc(b)}</button>`).join("")}</div></div>` : ""}
      <div class="fgroup"><h4>Tipo de produto</h4><div class="wrap">${CATS.map((c) => `<button class="opt ${S.f.cats.includes(c.id) ? "on" : ""}" data-act="tgl" data-k="cats" data-v="${c.id}">${c.em} ${c.nm}</button>`).join("")}</div></div>
      ${mks.length ? `<div class="fgroup"><h4>Mercados ${S.f.mks.length ? `<small>${S.f.mks.length} selecionado${S.f.mks.length > 1 ? "s" : ""}</small>` : ""}</h4>
        ${mks.map((m) => `<button class="mrow ${S.f.mks.includes(m.cnpj) ? "on" : ""}" data-act="tgl" data-k="mks" data-v="${m.cnpj}"><span class="box">✓</span><div><div class="nm">${esc(m.nome)}</div><div class="meta">${esc([m.bairro, m.cidade].filter(Boolean).join(", "))}</div></div></button>`).join("")}</div>` : ""}
      <div class="fgroup"><h4>Preço informado nos últimos</h4><div class="seg">${[[0, "Qualquer"], [3, "3 dias"], [7, "7 dias"], [30, "30 dias"]].map(([v, l]) => `<button class="${S.f.dias === v ? "on" : ""}" data-act="setDias" data-v="${v}">${l}</button>`).join("")}</div></div>
    </div>
    <div class="sheet-foot"><button class="btn btn-red btn-block" data-act="applyFilters">Ver resultados</button></div>`;
  }
  if (k === "uni") {
    const U = S.uni;
    if (!U.alvo) {
      el.innerHTML = `<div class="grab"></div><div class="sheet-h"><h3>Unificar produto</h3></div>
      <div class="sheet-body">
        <p class="uni-sub">Procure o mesmo produto com outro nome. Os preços dos dois passam a aparecer juntos, e as próximas notas já entram unificadas.</p>
        <div class="uni-atual"><small>Este produto</small><b>${nice(U.deNome)}</b></div>
        <div class="searchbox uni-q">${I.search}<input id="uniQ" type="search" placeholder="Ex.: leite italac" value="${esc(U.q)}" autocomplete="off"></div>
        <div id="uniRes"></div>
      </div><div style="height:12px"></div>`;
      renderUniRes();
      setTimeout(() => document.getElementById("uniQ")?.focus(), 250);
    } else {
      const ops = [U.alvo.nome, U.deNome];
      el.innerHTML = `<div class="grab"></div><div class="sheet-h"><h3>Confirmar unificação</h3></div>
      <div class="sheet-body">
        <div class="uni-par"><div>${nice(U.deNome)}</div><span>+</span><div>${nice(U.alvo.nome)}</div></div>
        <div class="fgroup"><h4>Qual nome fica?</h4>
          ${ops.map((o, i) => `<button class="mrow ${U.nome === o ? "on" : ""}" data-act="uniNome" data-v="${i}"><div class="nm">${nice(o)}</div><span class="radio"></span></button>`).join("")}
          <div class="form" style="margin-top:8px"><label>Ou escreva um nome melhor<input id="uniOutro" placeholder="Ex.: Leite Integral Italac 1L" value="${ops.includes(U.nome) ? "" : esc(nice(U.nome).replace(/&amp;/g, "&"))}"></label></div>
        </div>
        ${U.erro ? `<div class="err" style="margin:6px 0 0">${esc(U.erro)}</div>` : ""}
      </div>
      <div class="sheet-foot"><button class="btn btn-ghost" data-act="uniVoltar">Voltar</button><button class="btn btn-red" style="flex:1" data-act="uniOk" ${U.loading ? "disabled" : ""}>${U.loading ? "Unificando…" : "Unificar"}</button></div>`;
    }
  }
  if (k === "ren") {
    const R = S.ren;
    el.innerHTML = `<div class="grab"></div><div class="sheet-h"><h3>Corrigir nome</h3></div>
    <div class="sheet-body">
      <p class="uni-sub">O nome novo vale em todos os mercados. O app guarda o antigo: as próximas notas que vierem com ele já entram com o nome corrigido.</p>
      <div class="form"><label>Nome do produto<input id="renNome" value="${nice(R.de)}" placeholder="Ex.: Leite Integral Italac 1L"></label></div>
      ${R.erro ? `<div class="err" style="margin:10px 0 0">${esc(R.erro)}</div>` : ""}
    </div>
    <div class="sheet-foot"><button class="btn btn-ghost" data-act="closeSheet">Cancelar</button><button class="btn btn-red" style="flex:1" data-act="renOk" ${R.loading ? "disabled" : ""}>${R.loading ? "Salvando…" : "Salvar"}</button></div>`;
  }
  if (k === "editMk") {
    const m = S.mercados.find((x) => x.cnpj === S.editCnpj) || {};
    el.innerHTML = `<div class="grab"></div><div class="sheet-h"><h3>Editar mercado</h3></div>
    <div class="sheet-body"><div class="form">
      <label>Nome fantasia <small class="lbl-sub">aparece no app</small><input id="mkNome" value="${esc(m.nome || "")}" placeholder="Ex.: Assaí Atacadista"></label>
      <label>Razão social <small class="lbl-sub">só no cadastro</small><input id="mkRazao" value="${esc(m.razao_social || "")}" placeholder="Ex.: Sendas Distribuidora S/A"></label>
      <label>Endereço<input id="mkEnd" value="${esc(m.endereco || "")}" placeholder="Rua e número"></label>
      <div class="two"><label>Bairro<input id="mkBairro" value="${esc(m.bairro || "")}"></label><label>Cidade<input id="mkCidade" value="${esc(m.cidade || "")}"></label></div>
      ${S.editErro ? `<div class="err" style="margin:4px 0 0">${esc(S.editErro)}</div>` : ""}
    </div></div>
    <div class="sheet-foot"><button class="btn btn-ghost" data-act="closeSheet">Cancelar</button><button class="btn btn-red" style="flex:1" data-act="saveMk">Salvar</button></div>`;
  }
  if (k === "sort") {
    el.innerHTML = `<div class="grab"></div><div class="sheet-h"><h3>Ordenar por</h3></div><div class="sheet-body">
    ${[["price", "Menor preço", "O item mais barato aparece primeiro"], ["save", "Maior economia", "Onde a diferença entre mercados é maior"], ["recent", "Mais recentes", "Preços de notas mais novas"], ["az", "A–Z", "Ordem alfabética"]].map(([v, l, d]) => `
      <button class="mrow ${S.f.sort === v ? "on" : ""}" data-act="setSort" data-v="${v}"><div><div class="nm">${l}</div><div class="meta">${d}</div></div><span class="radio"></span></button>`).join("")}
    </div><div style="height:20px"></div>`;
  }
  if (k === "city") {
    el.innerHTML = `<div class="grab"></div><div class="sheet-h"><h3>Escolha a cidade</h3></div><div class="sheet-body">
      <div class="wrap" style="padding-bottom:20px"><button class="opt ${!S.cidade ? "on" : ""}" data-act="pickCity" data-v="">Todas as cidades</button>${cidades().map((c) => `<button class="opt ${c === S.cidade ? "on" : ""}" data-act="pickCity" data-v="${esc(c)}">📍 ${esc(c)}</button>`).join("")}</div>
      ${!cidades().length ? `<p class="proto" style="margin:0 0 20px">As cidades aparecem conforme as notas chegam.</p>` : ""}</div>`;
  }
}

/* ================= ENVIO ================= */
let scanner = null;
async function scanStart() {
  S.envio.erro = null; S.envio.step = "scan"; render();
  try {
    scanner = new Html5Qrcode("reader");
    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 230, height: 230 } }, async (txt) => {
      await scanStop(true);
      if (/^https?:\/\/[^/]*fazenda\.sp\.gov\.br/i.test(txt)) { S.envio.url = txt; toast("✓ QR Code lido"); }
      else if (/^https?:\/\//i.test(txt)) { S.envio.url = txt; S.envio.erro = "Esse QR Code não parece ser de uma nota de São Paulo. Pode tentar, mas a leitura talvez não funcione."; }
      else S.envio.erro = "Esse QR Code não é de uma nota fiscal.";
      render();
    });
  } catch (e) {
    S.envio.step = "inicio";
    S.envio.erro = "Não consegui abrir a câmera. Libere o acesso à câmera nas configurações do navegador, ou use a câmera normal do celular para abrir a nota.";
    render();
  }
}
async function scanStop(silent) {
  try { if (scanner) { await scanner.stop(); scanner.clear(); } } catch {}
  scanner = null; if (!silent) { S.envio.step = "inicio"; render(); } else S.envio.step = "inicio";
}
async function post(fn, body) {
  const convite = ls.get("convite", "");
  if (!convite) throw new Error("Falta o código de convite. Abra o app pelo link que você recebeu ou digite o código abaixo.");
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
      body: JSON.stringify({ ...body, convite }),
    });
  } catch { throw new Error("Sem conexão. Confira sua internet e tente de novo."); }
  const j = await r.json().catch(() => ({ erro: "Resposta inválida do servidor." }));
  if (!r.ok) throw new Error(j.erro || "Erro ao enviar.");
  return j;
}
function redimensionar(file, max = 1600) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => rej(new Error("Não consegui abrir essa imagem."));
    img.src = url;
  });
}
let stepTimer;
function animarPassos() {
  clearInterval(stepTimer); let i = 1;
  stepTimer = setInterval(() => {
    const st = document.querySelectorAll(".steps .step"); if (!st.length) return clearInterval(stepTimer);
    i = Math.min(i + 1, st.length - 1);
    st.forEach((e, j) => { e.classList.toggle("done", j < i); e.classList.toggle("doing", j === i); });
  }, 3500);
}
async function aplicaApelidos(n) {
  try {
    if (n?.mercado?.cnpj?.length !== 14) return;
    const origs = (n.itens || []).map((i) => i.descricao_original).filter(Boolean);
    if (!origs.length) return;
    const { data: aps } = await sb.from("apelidos_mercado").select("original,nome,categoria").eq("cnpj", n.mercado.cnpj).in("original", origs);
    (aps || []).forEach((a) => n.itens.forEach((i) => {
      if (i.descricao_original === a.original) { i.descricao = a.nome; i.descricao_norm = a.nome; if (a.categoria) i.categoria = a.categoria; i.conhecido = true; }
    }));
  } catch {}
}
async function lerFoto() {
  const E = S.envio; if (!E.fotos?.length) return;
  E.erro = null; E.loading = true; E.modo = "foto"; render(); window.scrollTo(0, 0); animarPassos();
  for (let tent = 1; tent <= 3; tent++) {
    try { const n = await post("ler-foto", { imagens: E.fotos }); await aplicaApelidos(n); E.nota = n; E.origem = "foto"; E.step = "revisao"; E.erro = null; break; }
    catch (e) {
      E.erro = e.message;
      if (!/ocupado/i.test(e.message) || tent === 3) { if (tent === 3) E.erro = "O serviço de leitura está muito ocupado agora. Suas fotos continuam aqui: tente de novo em alguns minutos."; break; }
      const sub = document.querySelector(".page-sub"); if (sub) sub.textContent = "Serviço ocupado, tentando de novo…";
      await new Promise((r) => setTimeout(r, 4000 * tent));
    }
  }
  clearInterval(stepTimer); E.loading = false; render(); window.scrollTo(0, 0);
}
async function sendPreview() {
  const E = S.envio; const ta = document.getElementById("paste"); if (ta) E.texto = ta.value;
  E.modo = "texto";
  if ((E.texto || "").trim().length < 40) { E.erro = "Cole o texto da página da nota antes de continuar."; render(); return; }
  E.erro = null; E.loading = true; render();
  try { const n = await post("enviar-nota", { texto: E.texto, salvar: false }); await aplicaApelidos(n); E.nota = n; E.origem = "texto"; E.step = "revisao"; }
  catch (e) { E.erro = e.message; }
  E.loading = false; render(); window.scrollTo(0, 0);
}
async function sendSave() {
  const E = S.envio; E.loading = true; E.erro = null; render();
  try {
    const j = E.origem === "foto" ? await post("ler-foto", { salvar: true, nota: E.nota }) : await post("enviar-nota", { texto: E.texto, salvar: true });
    E.salvo = j; E.step = "feito"; E.fotos = []; ls.set("enviadas", ls.get("enviadas", 0) + 1); await loadMeta();
    post("editar", { acao: "sugestoes" }).then(() => loadMeta()).catch(() => {});
  } catch (e) { E.erro = e.message; }
  E.loading = false; render(); window.scrollTo(0, 0);
}
document.addEventListener("change", async (e) => {
  if (!e.target.classList?.contains("fotoIn") || !e.target.files?.length) return;
  const arquivos = [...e.target.files].slice(0, 4 - (S.envio.fotos || []).length);
  try { for (const f of arquivos) { const d = await redimensionar(f); S.envio.fotos = [...(S.envio.fotos || []), d]; } S.envio.erro = null; }
  catch (err) { S.envio.erro = err.message; }
  render();
});
document.addEventListener("input", (e) => {
  const p = e.target.dataset?.ed; if (!p || !S.envio.nota) return;
  const ks = p.split("."); let o = S.envio.nota; for (const k of ks.slice(0, -1)) o = o[k];
  const last = ks.at(-1);
  if (last === "preco_unit") { const v = parseFloat(e.target.value.replace(/\./g, "").replace(",", ".")); if (v > 0) { o.preco_unit = v; o.total = Math.round(v * o.qtd * 100) / 100; } }
  else o[last] = e.target.value;
});

/* ================= RENDER ================= */
async function render() {
  const v = document.getElementById("view");
  if (S.tab === "list") { v.innerHTML = `<header class="top slim"><div class="page-title">Minha lista</div></header>${skel(3)}`; const html = await vListHtml(); if (S.tab === "list") v.innerHTML = html; }
  else v.innerHTML = { home: vHome, search: vSearch, send: vSend, markets: vMarkets }[S.tab]();
  if (S.tab === "search") {
    renderResults();
    const q = document.getElementById("q");
    q.addEventListener("input", (e) => { S.q = e.target.value; clearTimeout(debounce); debounce = setTimeout(renderResults, 250); });
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") q.blur(); });
  }
  if (S.tab === "send") { const ta = document.getElementById("paste"); if (ta) ta.addEventListener("input", () => (S.envio.texto = ta.value)); }
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.v === S.tab));
  const n = Object.keys(S.list).length, c = document.getElementById("listCnt"); c.hidden = !n; c.textContent = n;
}
function go(tab) { if (scanner) scanStop(true); S.tab = tab; closeProd(); closeSheet(); window.scrollTo(0, 0); render(); }
let tt; function toast(t) { const e = document.getElementById("toast"); e.textContent = t; e.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => e.classList.remove("show"), 1900); }
const resetF = () => (S.f = { bairros: [], cats: [], mks: [], dias: 0, sort: S.f.sort });

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act, v = el.dataset.v, k = el.dataset.k;
  switch (a) {
    case "tab": if (v === "send" && S.envio.step === "feito") S.envio = { step: "inicio", texto: "", fotos: [] }; go(v); break;
    case "goSearch": go("search"); setTimeout(() => document.getElementById("q")?.focus(), 60); break;
    case "goCat": resetF(); S.f.cats = [v]; S.q = ""; go("search"); break;
    case "goMarket": resetF(); S.f.mks = [v]; S.q = ""; if (S.envio.step === "feito") S.envio = { step: "inicio", texto: "" }; go("search"); break;
    case "clearQ": S.q = ""; render(); break;
    case "openFilters": openSheet("filters"); break;
    case "openSort": openSheet("sort"); break;
    case "openCity": openSheet("city"); break;
    case "closeSheet": closeSheet(); break;
    case "applyFilters": closeSheet(); render(); break;
    case "tgl": { const arr = S.f[k]; const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v);
      if (k === "bairros") S.f.mks = S.f.mks.filter((c) => !S.f.bairros.length || S.f.bairros.includes(S.mercados.find((m) => m.cnpj === c)?.bairro));
      renderSheet(); break; }
    case "rmF": if (k === "dias") S.f.dias = 0; else S.f[k] = S.f[k].filter((x) => x !== v); render(); break;
    case "setDias": S.f.dias = +v; renderSheet(); break;
    case "setSort": S.f.sort = v; closeSheet(); render(); break;
    case "setCity": S.cidade = v || null; ls.set("cidade", S.cidade); S.f.bairros = []; S.f.mks = []; renderSheet(); break;
    case "pickCity": S.cidade = v || null; ls.set("cidade", S.cidade); S.f.bairros = []; S.f.mks = []; closeSheet(); render(); break;
    case "clearAll": resetF(); S.q = ""; if (S.sheet) renderSheet(); render(); break;
    case "openProd": openProd(v); break;
    case "uniOpen": { const nomeAtual = document.querySelector("#over .prod-hero h1")?.textContent || v; S.uni = { de: v, deNome: nomeAtual, q: "", alvo: null }; openSheet("uni"); break; }
    case "uniPick": S.uni.alvo = { k: v, nome: el.dataset.n }; S.uni.nome = el.dataset.n; S.uni.erro = null; renderSheet(); break;
    case "uniNome": S.uni.nome = [S.uni.alvo.nome, S.uni.deNome][+v]; const o = document.getElementById("uniOutro"); if (o) o.value = ""; renderSheet(); break;
    case "uniVoltar": S.uni.alvo = null; renderSheet(); break;
    case "uniOk": uniConfirmar(); break;
    case "renOpen": S.ren = { de: v }; openSheet("ren"); setTimeout(() => document.getElementById("renNome")?.focus(), 250); break;
    case "renOk": {
      const R = S.ren; const nome = document.getElementById("renNome")?.value.trim();
      if (!nome) { R.erro = "Escreva o nome."; renderSheet(); break; }
      R.loading = true; R.erro = null; renderSheet();
      const { data, error } = await sb.rpc("renomear_produto", { p_convite: ls.get("convite", ""), p_de: R.de, p_nome: nome });
      R.loading = false;
      if (error || !data?.nome) { R.erro = /convite/i.test(error?.message || "") ? "Falta o código de convite. Abra o app pelo link que você recebeu." : "Não consegui salvar agora. Tente de novo."; renderSheet(); break; }
      const final = data.nome;
      if (S.list[R.de]) { S.list[final] = (S.list[final] || 0) + S.list[R.de]; if (R.de !== final) delete S.list[R.de]; saveList(); }
      closeSheet(); toast("✓ Nome atualizado"); openProd(final); if (S.tab === "search") renderResults();
      break; }
    case "verSug": S.verTodasSug = true; render(); break;
    case "sugSim": { const s = S.sugestoes.find((x) => x.id === +v); if (!s) break;
      S.uni = { de: s.a, deNome: s.a, q: "", alvo: { k: s.b, nome: s.b }, nome: s.nome || s.b, sugId: s.id }; openSheet("uni"); break; }
    case "sugNao": {
      const { error } = await sb.rpc("ignorar_sugestao", { p_convite: ls.get("convite", ""), p_id: +v });
      if (error) { toast("Falta o código de convite"); break; }
      S.sugestoes = S.sugestoes.filter((x) => x.id !== +v); toast("Ok, não vamos sugerir de novo"); render(); if (S.prodOpen) openProd(S.prodOpen); break; }
    case "editMk": S.editCnpj = v; S.editErro = null; openSheet("editMk"); break;
    case "saveMk": {
      const val = (id) => document.getElementById(id)?.value.trim() || "";
      try {
        el.disabled = true; el.textContent = "Salvando…";
        await post("editar", { acao: "mercado", cnpj: S.editCnpj, nome: val("mkNome"), razao_social: val("mkRazao"), endereco: val("mkEnd"), bairro: val("mkBairro"), cidade: val("mkCidade") });
        closeSheet(); await loadMeta(); render(); toast("✓ Mercado atualizado");
      } catch (err) { S.editErro = err.message; renderSheet(); }
      break; }
    case "closeProd": closeProd(); break;
    case "inc": { const first = !S.list[v]; S.list[v] = (S.list[v] || 0) + 1; saveList(); if (S.prodOpen) openProd(S.prodOpen); if (S.tab === "list") render(); else render(); if (first) toast("✓ Adicionado à lista"); break; }
    case "dec": S.list[v]--; if (S.list[v] <= 0) delete S.list[v]; saveList(); if (S.prodOpen) openProd(S.prodOpen); render(); break;
    case "clearList": S.list = {}; saveList(); render(); break;
    case "scanStart": scanStart(); break;
    case "scanStop": scanStop(false); break;
    case "pasteClip": try { const t = await navigator.clipboard.readText(); if (t) { S.envio.texto = t; S.envio.erro = null; render(); toast("✓ Texto colado"); } else toast("A área de transferência está vazia"); }
      catch { toast("Toque no campo abaixo e cole"); document.getElementById("paste")?.focus(); } break;
    case "saveCode": { const c = document.getElementById("convite")?.value.trim(); if (c) { ls.set("convite", c); S.envio.erro = null; toast("✓ Código salvo"); render(); } break; }
    case "sendPreview": sendPreview(); break;
    case "sendSave": sendSave(); break;
    case "sendReset": S.envio = { step: "inicio", texto: "", url: null, fotos: S.envio.step === "revisao" ? S.envio.fotos : [] }; render(); break;
    case "lerFoto": lerFoto(); break;
    case "rmFoto": S.envio.fotos.splice(+v, 1); render(); break;
    case "rmItem": S.envio.nota.itens.splice(+v, 1); if (!S.envio.nota.itens.length) S.envio = { step: "inicio", fotos: S.envio.fotos }; render(); break;
  }
});

render();
loadMeta().then(() => { if (S.tab === "home" || S.tab === "markets") render(); }).catch(() => {});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
