const CONFIG = window.APP_CONFIG || {};
const campaign = CONFIG.campaign || {};
const TEAMS = campaign.teams || {};
const VENDORS_SEED = campaign.vendors || [];
const TRIAL_DAYS = Number(CONFIG.trialDays || 3);
const CONTACT_TEXT = `${CONFIG.contactChannel || "WhatsApp"} do ${CONFIG.contactPerson || "Thiago Ventura Valêncio"}`;
const TRIAL_KEY = "copa_tenis_one_trial_started_at";
const LOCAL_STATE_KEY = "copa_tenis_one_state";
let services = {};

const state = {
  mode: "local",
  db: null,
  rootRef: null,
  data: {
    vendors: {},
    sales: {},
    rounds: {},
    bonuses: {},
    settings: campaign
  }
};

const $ = (id) => document.getElementById(id);

function brl(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stickerNumber(index) {
  return String(index + 1).padStart(2, "0");
}

function teamAccent(team) {
  return team === "azul"
    ? { primary: "#143f91", soft: "#edf3ff", strong: "#0d2e6b" }
    : { primary: "#08643a", soft: "#eefaf3", strong: "#054e2d" };
}

function isoToday() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function getTrialInfo() {
  let startRaw = localStorage.getItem(TRIAL_KEY);
  if (!startRaw) {
    startRaw = new Date().toISOString();
    localStorage.setItem(TRIAL_KEY, startRaw);
  }

  let startDate = new Date(startRaw);
  if (Number.isNaN(startDate.getTime())) {
    startDate = new Date();
    startRaw = startDate.toISOString();
    localStorage.setItem(TRIAL_KEY, startRaw);
  }

  const expiresAt = new Date(startDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const remainingMs = expiresAt.getTime() - Date.now();
  const expired = remainingMs <= 0;
  const daysLeft = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

  return { startDate, expiresAt, expired, daysLeft };
}

function updateTrialUI() {
  const info = getTrialInfo();
  const loginNotice = $("trialLoginNotice");
  const status = $("trialStatus");

  const validText = `Teste gratuito: ${info.daysLeft} dia(s) restante(s). Depois disso, novos dados não serão salvos. Sugestões e alterações: ${CONTACT_TEXT}.`;
  const expiredText = `Teste gratuito encerrado. Novos dados não serão salvos. Envie sugestões e alterações para o ${CONTACT_TEXT}.`;

  [loginNotice, status].forEach((el) => {
    if (!el) return;
    el.textContent = info.expired ? expiredText : validText;
    el.classList.toggle("expired", info.expired);
  });

  document.querySelectorAll("#saleForm button, #closeTodayBtn, #closeRoundBtn, [data-bonus], [data-upload], [data-clear-photo], #seedBtn")
    .forEach((el) => el.classList.toggle("trial-lock", info.expired));

  return info;
}

function resetDemoViewAfterTrial() {
  state.data = createSeedData();
  localStorage.removeItem(LOCAL_STATE_KEY);
  render();
  updateTrialUI();
}

function ensureCanSave(action = "salvar novos dados") {
  const info = updateTrialUI();
  if (!info.expired) return true;
  resetDemoViewAfterTrial();
  toast(`Teste gratuito encerrado. Não é possível ${action}. Envie sugestões e alterações para o ${CONTACT_TEXT}.`);
  return false;
}

function dayFromISO(date) {
  return Number(String(date || "").slice(-2));
}

function getGoalsForDate(date) {
  const day = dayFromISO(date);
  if (day <= 10) return 1;
  if (day <= 20) return 2;
  return 3;
}

function getDezena(date) {
  const day = dayFromISO(date);
  if (day <= 10) return 1;
  if (day <= 20) return 2;
  return 3;
}

function dateRangeForDezena(n) {
  const start = campaign.startDate || "2026-06-01";
  const [year, month] = start.split("-");
  if (Number(n) === 1) return [`${year}-${month}-01`, `${year}-${month}-10`];
  if (Number(n) === 2) return [`${year}-${month}-11`, `${year}-${month}-20`];
  return [`${year}-${month}-21`, campaign.endDate || `${year}-${month}-30`];
}

function isConfigured(obj, keys) {
  return !!obj && keys.every((key) => typeof obj[key] === "string" && obj[key].trim());
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = "none"; }, 3600);
}

function localLoad() {
  if (getTrialInfo().expired) {
    state.data = createSeedData();
    localStorage.removeItem(LOCAL_STATE_KEY);
    return;
  }

  const raw = localStorage.getItem(LOCAL_STATE_KEY);
  if (raw) {
    try {
      state.data = JSON.parse(raw);
    } catch {
      state.data = createSeedData();
    }
  } else {
    state.data = createSeedData();
    localSave();
  }
}

function localSave() {
  if (getTrialInfo().expired) return false;
  localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state.data));
  return true;
}

async function savePath(path, value) {
  if (!ensureCanSave("salvar novos dados")) return false;

  if (state.mode === "firebase" && state.db) {
    await services.set(services.ref(state.db, path), value);
  } else {
    setDeep(state.data, path.replace(/^copaTenisOne\//, "").split("/"), value);
    localSave();
    render();
  }

  updateTrialUI();
  return true;
}

async function updatePath(path, value) {
  if (!ensureCanSave("salvar alterações")) return false;

  if (state.mode === "firebase" && state.db) {
    await services.update(services.ref(state.db, path), value);
  } else {
    const current = getDeep(state.data, path.replace(/^copaTenisOne\//, "").split("/")) || {};
    setDeep(state.data, path.replace(/^copaTenisOne\//, "").split("/"), { ...current, ...value });
    localSave();
    render();
  }

  updateTrialUI();
  return true;
}

function getDeep(obj, parts) {
  return parts.reduce((acc, part) => acc && acc[part], obj);
}

function setDeep(obj, parts, value) {
  let target = obj;
  parts.slice(0, -1).forEach((part) => {
    if (!target[part]) target[part] = {};
    target = target[part];
  });
  target[parts[parts.length - 1]] = value;
}

function createSeedData() {
  const vendors = {};
  VENDORS_SEED.forEach((vendor) => {
    vendors[vendor.id] = {
      id: vendor.id,
      name: vendor.name,
      team: vendor.team,
      nickname: vendor.nickname || "Craque de vendas",
      imageUrl: ""
    };
  });

  return {
    settings: campaign,
    vendors,
    sales: {},
    rounds: {},
    bonuses: {}
  };
}

async function seedData(force = false) {
  const seed = createSeedData();

  if (getTrialInfo().expired) {
    state.data = seed;
    localStorage.removeItem(LOCAL_STATE_KEY);
    render();
    updateTrialUI();
    if (force) toast(`Teste gratuito encerrado. Não é possível recriar dados. Envie sugestões e alterações para o ${CONTACT_TEXT}.`);
    return false;
  }

  if (force && !ensureCanSave("recriar dados")) return false;

  if (state.mode === "firebase" && state.db) {
    const snap = await services.get(services.ref(state.db, "copaTenisOne/vendors"));
    if (!snap.exists() || force) {
      await services.set(services.ref(state.db, "copaTenisOne"), seed);
      toast("Dados demonstrativos recriados.");
    }
  } else {
    if (force || !state.data.vendors || !Object.keys(state.data.vendors).length) {
      state.data = seed;
      localSave();
      toast("Dados demonstrativos recriados.");
      render();
    }
  }

  updateTrialUI();
  return true;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = Array.from(document.scripts).find((script) => script.src === src);
    if (existing) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadPhotoWidget() {
  if (window.cloudinary?.createUploadWidget) return true;
  try {
    await loadScript("https://upload-widget.cloudinary.com/global/all.js");
    return !!window.cloudinary?.createUploadWidget;
  } catch {
    return false;
  }
}

async function loadSyncServices() {
  const [appModule, databaseModule, authModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js")
  ]);

  services = {
    initializeApp: appModule.initializeApp,
    getDatabase: databaseModule.getDatabase,
    ref: databaseModule.ref,
    set: databaseModule.set,
    update: databaseModule.update,
    onValue: databaseModule.onValue,
    get: databaseModule.get,
    getAuth: authModule.getAuth,
    signInAnonymously: authModule.signInAnonymously,
    onAuthStateChanged: authModule.onAuthStateChanged
  };
}

async function initFirebaseOrLocal() {
  $("saleDate").value = isoToday();
  $("roundDate").value = isoToday();

  const trial = updateTrialUI();
  if (trial.expired) {
    state.mode = "expired";
    state.data = createSeedData();
    localStorage.removeItem(LOCAL_STATE_KEY);
    $("connectionStatus").textContent = "Teste gratuito encerrado";
    $("connectionStatus").style.background = "#fff1f1";
    $("connectionStatus").style.color = "#9b1c1c";
    render();
    updateTrialUI();
    return;
  }

  const firebaseReady = isConfigured(CONFIG.firebase, ["apiKey", "authDomain", "databaseURL", "projectId", "appId"]);

  if (!firebaseReady) {
    state.mode = "local";
    localLoad();
    $("connectionStatus").textContent = "Sistema pronto para apresentação";
    $("connectionStatus").style.background = "#fff8db";
    $("connectionStatus").style.color = "#6d5200";
    await seedData(false);
    render();
    return;
  }

  try {
    await loadSyncServices();
    const app = services.initializeApp(CONFIG.firebase);
    const auth = services.getAuth(app);
    state.db = services.getDatabase(app);
    state.mode = "firebase";
    $("connectionStatus").textContent = "Conectando...";

    await services.signInAnonymously(auth);

    services.onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      await seedData(false);
      services.onValue(services.ref(state.db, "copaTenisOne"), (snapshot) => {
        state.data = snapshot.val() || createSeedData();
        $("connectionStatus").textContent = "Sistema sincronizado";
        $("connectionStatus").style.background = "#e8f7ee";
        $("connectionStatus").style.color = "#08643a";
        render();
      });
    });
  } catch (error) {
    console.error(error);
    state.mode = "local";
    localLoad();
    $("connectionStatus").textContent = "Sistema pronto para apresentação";
    $("connectionStatus").style.background = "#fff8db";
    $("connectionStatus").style.color = "#6d5200";
    render();
  }
}

function vendorsArray() {
  return Object.values(state.data.vendors || {});
}

function salesArray() {
  return Object.values(state.data.sales || {});
}

function roundsArray() {
  return Object.values(state.data.rounds || {});
}

function bonusesArray() {
  return Object.values(state.data.bonuses || {});
}

function teamName(teamId) {
  return TEAMS[teamId]?.name || teamId;
}

function vendorById(id) {
  return state.data.vendors?.[id] || {};
}

function saleKey(date, vendorId) {
  return `${date}_${vendorId}`;
}

function sumSales(filterFn = () => true) {
  return salesArray().filter(filterFn).reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
}

function getTeamTotalsForDate(date) {
  const totals = { verde: 0, azul: 0 };
  salesArray().filter((sale) => sale.date === date).forEach((sale) => {
    const vendor = vendorById(sale.vendorId);
    if (vendor.team) totals[vendor.team] = (totals[vendor.team] || 0) + Number(sale.amount || 0);
  });
  return totals;
}

function getTeamTotalsForRange(startDate, endDate) {
  const totals = { verde: 0, azul: 0 };
  salesArray().filter((sale) => sale.date >= startDate && sale.date <= endDate).forEach((sale) => {
    const vendor = vendorById(sale.vendorId);
    if (vendor.team) totals[vendor.team] = (totals[vendor.team] || 0) + Number(sale.amount || 0);
  });
  return totals;
}

function calculateScore() {
  const score = {
    verde: { goals: 0, sales: 0, wins: 0 },
    azul: { goals: 0, sales: 0, wins: 0 }
  };

  salesArray().forEach((sale) => {
    const vendor = vendorById(sale.vendorId);
    if (vendor.team && score[vendor.team]) score[vendor.team].sales += Number(sale.amount || 0);
  });

  roundsArray().forEach((round) => {
    if (round.winnerTeam && score[round.winnerTeam]) {
      score[round.winnerTeam].goals += Number(round.goalsAwarded || 0);
      score[round.winnerTeam].wins += 1;
    }
  });

  bonusesArray().forEach((bonus) => {
    if (bonus.winnerTeam && score[bonus.winnerTeam]) {
      score[bonus.winnerTeam].goals += Number(bonus.goalsAwarded || 0);
    }
  });

  return score;
}

function calculateSellerRanking() {
  const totals = {};
  vendorsArray().forEach((vendor) => {
    totals[vendor.id] = { ...vendor, total: 0 };
  });
  salesArray().forEach((sale) => {
    if (!totals[sale.vendorId]) return;
    totals[sale.vendorId].total += Number(sale.amount || 0);
  });
  return Object.values(totals).sort((a, b) => b.total - a.total);
}

function getStickerRarityMap() {
  const ranking = calculateSellerRanking();
  const definitions = [
    { key: "legendary", label: "Lendária", shortLabel: "Holo", note: "Destaque máximo da coleção" },
    { key: "gold", label: "Ouro", shortLabel: "Ouro", note: "Grande destaque" },
    { key: "silver", label: "Prata", shortLabel: "Prata", note: "Figurinha premium" },
    { key: "classic", label: "Clássica", shortLabel: "Clássica", note: "Figurinha oficial da coleção" }
  ];
  const map = {};
  ranking.forEach((vendor, index) => {
    map[vendor.id] = definitions[index] || definitions[definitions.length - 1];
  });
  vendorsArray().forEach((vendor, index) => {
    if (!map[vendor.id]) map[vendor.id] = definitions[Math.min(index, definitions.length - 1)];
  });
  return map;
}

function getCollectionSummary() {
  const vendors = vendorsArray();
  const withPhotos = vendors.filter((vendor) => !!vendor.imageUrl).length;
  const score = calculateScore();
  const ranking = calculateSellerRanking();
  let leaderTeam = null;
  if (score.verde.goals !== score.azul.goals) {
    leaderTeam = score.verde.goals > score.azul.goals ? "verde" : "azul";
  } else if (score.verde.sales !== score.azul.sales) {
    leaderTeam = score.verde.sales > score.azul.sales ? "verde" : "azul";
  }
  return {
    total: vendors.length,
    withPhotos,
    missingPhotos: vendors.length - withPhotos,
    topSeller: ranking[0] || null,
    leaderTeam,
    rarityMap: getStickerRarityMap()
  };
}

function renderAlbumShowcase() {
  const panel = $("albumStats");
  const grid = $("albumPageGrid");
  if (!panel || !grid) return;

  const summary = getCollectionSummary();
  const progressText = `${summary.withPhotos}/${summary.total} figurinhas prontas`;
  const leaderText = summary.leaderTeam ? teamName(summary.leaderTeam) : "Empate no momento";
  const coverStore = $("albumCoverStore");
  const coverProgress = $("albumCoverProgress");
  if (coverStore) coverStore.textContent = campaign.store || "Tênis One";
  if (coverProgress) coverProgress.textContent = progressText;

  panel.innerHTML = `
    <div class="album-stat-card">
      <span>Figurinhas prontas</span>
      <strong>${progressText}</strong>
      <small>${summary.missingPhotos} vendedor(es) ainda sem foto</small>
    </div>
    <div class="album-stat-card">
      <span>Artilheiro da coleção</span>
      <strong>${summary.topSeller?.name || "A definir"}</strong>
      <small>${summary.topSeller ? brl(summary.topSeller.total) : "Sem vendas lançadas"}</small>
    </div>
    <div class="album-stat-card">
      <span>Equipe em destaque</span>
      <strong>${leaderText}</strong>
      <small>Líder atual da competição</small>
    </div>
  `;

  const slots = vendorsArray().map((vendor) => {
    const rarity = summary.rarityMap[vendor.id] || { key: "classic", label: "Clássica" };
    return `
      <article class="album-slot ${vendor.imageUrl ? "filled" : "empty"} ${rarity.key}">
        <div class="album-slot-thumb ${vendor.imageUrl ? "has-photo" : ""}">
          ${vendor.imageUrl ? `<img src="${escapeHtml(vendor.imageUrl)}" alt="${escapeHtml(vendor.name)}" />` : `<span>⚽</span>`}
        </div>
        <strong>${escapeHtml(vendor.name)}</strong>
        <span>${escapeHtml(rarity.label)}</span>
      </article>
    `;
  }).join("");

  const topSeller = summary.topSeller;
  const specialArtilheiro = `
    <article class="album-slot special legendary">
      <div class="album-slot-thumb has-badge"><span>🏅</span></div>
      <strong>Especial Artilheiro</strong>
      <span>${escapeHtml(topSeller?.name || "A definir")}</span>
    </article>
  `;

  const specialLeader = `
    <article class="album-slot special gold">
      <div class="album-slot-thumb has-badge"><span>🏆</span></div>
      <strong>Especial Campeão</strong>
      <span>${escapeHtml(leaderText)}</span>
    </article>
  `;

  grid.innerHTML = slots + specialArtilheiro + specialLeader;
}

function winnerFromTotals(totals) {
  if ((totals.verde || 0) === (totals.azul || 0)) return null;
  return (totals.verde || 0) > (totals.azul || 0) ? "verde" : "azul";
}

async function closeRound(date) {
  if (!date) return toast("Escolha uma data para fechar.");
  const totals = getTeamTotalsForDate(date);
  const winnerTeam = winnerFromTotals(totals);
  const goalsAwarded = winnerTeam ? getGoalsForDate(date) : 0;

  const round = {
    id: date,
    date,
    dezena: getDezena(date),
    teamTotals: totals,
    winnerTeam,
    goalsAwarded,
    closedAt: new Date().toISOString()
  };

  const saved = await savePath(`copaTenisOne/rounds/${date}`, round);
  if (!saved) return;
  toast(winnerTeam ? `${teamName(winnerTeam)} venceu a rodada e marcou ${goalsAwarded} gol(s).` : "Rodada empatada. Nenhum gol aplicado na demo.");
}

async function applyBonus(dezena) {
  const [start, end] = dateRangeForDezena(dezena);
  const totals = getTeamTotalsForRange(start, end);
  const winnerTeam = winnerFromTotals(totals);
  const bonus = {
    id: `dezena_${dezena}`,
    dezena: Number(dezena),
    startDate: start,
    endDate: end,
    teamTotals: totals,
    winnerTeam,
    goalsAwarded: winnerTeam ? 3 : 0,
    ruleUsed: "Maior faturamento da dezena.",
    closedAt: new Date().toISOString()
  };

  const saved = await savePath(`copaTenisOne/bonuses/dezena_${dezena}`, bonus);
  if (!saved) return;
  toast(winnerTeam ? `${teamName(winnerTeam)} ganhou +3 gols na ${dezena}ª dezena.` : "Bônus empatado. Nenhum gol aplicado na demo.");
}

function renderVendorSelect() {
  const select = $("saleVendor");
  const current = select.value;
  select.innerHTML = "";
  vendorsArray().forEach((vendor) => {
    const opt = document.createElement("option");
    opt.value = vendor.id;
    opt.textContent = `${vendor.name} — ${teamName(vendor.team)}`;
    select.appendChild(opt);
  });
  if (current) select.value = current;
}

function renderDashboard() {
  const score = calculateScore();
  $("scoreVerde").textContent = score.verde.goals;
  $("scoreAzul").textContent = score.azul.goals;
  $("salesVerde").textContent = brl(score.verde.sales);
  $("salesAzul").textContent = brl(score.azul.sales);
  $("winsVerde").textContent = `${score.verde.wins} vitória(s) diária(s)`;
  $("winsAzul").textContent = `${score.azul.wins} vitória(s) diária(s)`;

  const today = $("saleDate").value || isoToday();
  $("todayRule").textContent = `Hoje vale ${getGoalsForDate(today)} gol(s) para a dupla vencedora`;

  const todayRound = state.data.rounds?.[today];
  const todayTotals = getTeamTotalsForDate(today);
  $("todayStatus").textContent = todayRound?.winnerTeam
    ? `${teamName(todayRound.winnerTeam)} venceu`
    : "Rodada aberta";
  $("todayTotals").textContent = `Verde: ${brl(todayTotals.verde)} | Azul: ${brl(todayTotals.azul)}`;

  renderMembers("verde", "membersVerde");
  renderMembers("azul", "membersAzul");

  const ranking = calculateSellerRanking();
  const top = ranking[0];
  $("topSellerName").textContent = top && top.total > 0 ? top.name : "Ainda sem vendas";
  $("topSellerValue").textContent = top ? brl(top.total) : brl(0);

  const totalSales = ranking.reduce((sum, row) => sum + row.total, 0);
  $("sellerRanking").innerHTML = ranking.map((row, index) => {
    const share = totalSales ? Math.round((row.total / totalSales) * 100) : 0;
    return `<tr>
      <td>${index + 1}º</td>
      <td><strong>${row.name}</strong></td>
      <td>${teamName(row.team)}</td>
      <td>${brl(row.total)}</td>
      <td>${share}%</td>
    </tr>`;
  }).join("");
}

function renderMembers(team, elementId) {
  const el = $(elementId);
  el.innerHTML = vendorsArray().filter((v) => v.team === team).map((vendor) => {
    if (vendor.imageUrl) return `<div class="avatar" title="${vendor.name}"><img src="${vendor.imageUrl}" alt="${vendor.name}" /></div>`;
    return `<div class="avatar" title="${vendor.name}">${vendor.name.slice(0, 1).toUpperCase()}</div>`;
  }).join("");
}

function renderDailySales() {
  const date = $("saleDate").value || isoToday();
  $("dailyTitle").textContent = `Vendas de ${date.split("-").reverse().join("/")}`;
  const rows = vendorsArray().map((vendor) => {
    const sale = state.data.sales?.[saleKey(date, vendor.id)];
    return { vendor, sale };
  });

  $("dailySalesList").innerHTML = rows.map(({ vendor, sale }) => `
    <div class="sale-row">
      <div>
        <strong>${vendor.name}</strong>
        <span>${teamName(vendor.team)} ${sale?.note ? `• ${sale.note}` : ""}</span>
      </div>
      <strong>${brl(sale?.amount || 0)}</strong>
    </div>
  `).join("");
}

function renderRounds() {
  const rounds = roundsArray().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const bonuses = bonusesArray().sort((a, b) => Number(b.dezena) - Number(a.dezena));

  const roundRows = rounds.map((round) => `
    <div class="timeline-row">
      <strong>${round.date.split("-").reverse().join("/")} — ${round.winnerTeam ? teamName(round.winnerTeam) : "Empate"}</strong>
      <span>Verde ${brl(round.teamTotals?.verde || 0)} x Azul ${brl(round.teamTotals?.azul || 0)} • ${round.goalsAwarded || 0} gol(s)</span>
    </div>
  `).join("");

  const bonusRows = bonuses.map((bonus) => `
    <div class="timeline-row">
      <strong>Bônus ${bonus.dezena}ª dezena — ${bonus.winnerTeam ? teamName(bonus.winnerTeam) : "Empate"}</strong>
      <span>${bonus.startDate} a ${bonus.endDate} • +${bonus.goalsAwarded || 0} gol(s) • ${bonus.ruleUsed || ""}</span>
    </div>
  `).join("");

  $("roundHistory").innerHTML = bonusRows + roundRows || `<p class="muted">Nenhuma rodada fechada ainda.</p>`;
}

function renderStickers() {
  const rarityMap = getStickerRarityMap();
  $("stickerGrid").innerHTML = vendorsArray().map((vendor, index) => {
    const accent = vendor.team === "azul" ? "blue" : "green";
    const shirt = vendor.team === "azul" ? "Camisa azul" : "Camisa verde";
    const rarity = rarityMap[vendor.id] || { key: "classic", label: "Clássica", shortLabel: "Clássica", note: "Figurinha oficial da coleção" };
    return `
      <article class="sticker-card-real ${accent} rarity-${rarity.key}">
        <div class="sticker-topbar">
          <span class="sticker-collection">Coleção Copa das Vendas 2026</span>
          <div class="sticker-top-meta">
            <span class="sticker-rarity ${rarity.key}">${escapeHtml(rarity.shortLabel || rarity.label)}</span>
            <span class="sticker-no">#${stickerNumber(index)}</span>
          </div>
        </div>
        <div class="sticker-frame ${accent}">
          <div class="sticker-shine"></div>
          <div class="sticker-photo-real ${rarity.key}">
            ${vendor.imageUrl ? `<img src="${escapeHtml(vendor.imageUrl)}" alt="${escapeHtml(vendor.name)}" />` : `<span>⚽</span>`}
          </div>
          <div class="sticker-team-ribbon ${accent}">${escapeHtml(teamName(vendor.team))}</div>
        </div>
        <div class="sticker-meta-real">
          <span class="sticker-role">${escapeHtml(vendor.nickname || "Craque de vendas")}</span>
          <h3>${escapeHtml(vendor.name)}</h3>
          <p>${escapeHtml(shirt)} • ${escapeHtml(teamName(vendor.team))}</p>
        </div>
        <div class="sticker-mini-stats">
          <span>Nº ${stickerNumber(index)}</span>
          <span>${escapeHtml(rarity.label)}</span>
        </div>
        <div class="sticker-note">${escapeHtml(rarity.note)}</div>
        <div class="sticker-actions">
          <button class="btn btn-light" data-upload="${escapeHtml(vendor.id)}">Enviar foto</button>
          <button class="btn btn-outline" data-clear-photo="${escapeHtml(vendor.id)}">Limpar</button>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll("[data-upload]").forEach((button) => {
    button.addEventListener("click", () => uploadPhoto(button.dataset.upload));
  });

  document.querySelectorAll("[data-clear-photo]").forEach((button) => {
    button.addEventListener("click", async () => {
      const saved = await updatePath(`copaTenisOne/vendors/${button.dataset.clearPhoto}`, { imageUrl: "" });
      if (saved) toast("Foto removida.");
    });
  });
}

function renderRules() {
  const rows = [
    ["Campanha", campaign.name],
    ["Período", `${campaign.startDate} a ${campaign.endDate}`],
    ["Regra diária", "A dupla com maior faturamento no dia marca gol."],
    ["Dias 01 a 10", "Vitória do dia = 1 gol."],
    ["Dias 11 a 20", "Vitória do dia = 2 gols."],
    ["Dias 21 a 30", "Vitória do dia = 3 gols."],
    ["Bônus da dezena", "+3 gols para a dupla com maior faturamento da dezena nesta demo."],
    ["Teste gratuito", `${TRIAL_DAYS} dias. Após o prazo, novos dados não serão salvos.`],
    ["Sugestões e alterações", `Enviar para o ${CONTACT_TEXT}.`],
    ["Prêmio dupla campeã", campaign.prizes?.teamChampion || "A definir"],
    ["Prêmio artilheiro", campaign.prizes?.topSeller || "A definir"]
  ];

  $("rulesBox").innerHTML = rows.map(([label, value]) => `
    <div class="rule-row">
      <strong>${label}</strong>
      <span>${value}</span>
    </div>
  `).join("");
}

function render() {
  renderVendorSelect();
  renderDashboard();
  renderDailySales();
  renderRounds();
  renderAlbumShowcase();
  renderStickers();
  renderRules();
  updateTrialUI();
}

async function uploadPhoto(vendorId) {
  if (!ensureCanSave("enviar foto")) return;

  const cloudinaryReady = isConfigured(CONFIG.cloudinary, ["cloudName", "uploadPreset"]);
  if (cloudinaryReady && await loadPhotoWidget()) {
    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: CONFIG.cloudinary.cloudName,
        uploadPreset: CONFIG.cloudinary.uploadPreset,
        folder: "tenis-one-copa-vendas",
        sources: ["local", "camera"],
        multiple: false,
        cropping: true,
        croppingAspectRatio: 1
      },
      async (error, result) => {
        if (error) {
          console.error(error);
          toast("Erro ao atualizar a foto.");
          return;
        }
        if (result && result.event === "success") {
          const saved = await updatePath(`copaTenisOne/vendors/${vendorId}`, { imageUrl: result.info.secure_url });
          if (saved) toast("Foto atualizada.");
        }
      }
    );
    widget.open();
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const saved = await updatePath(`copaTenisOne/vendors/${vendorId}`, { imageUrl: reader.result });
      if (saved) toast("Foto salva.");
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

async function exportReportPDF(stickersOnly = false) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) return toast("Biblioteca de PDF ainda não carregou. Tente novamente.");

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const left = 14;
  let y = 16;

  function header(title, subtitle = "Tênis One — Copa do Mundo das Vendas") {
    pdf.setFillColor(8, 100, 58);
    pdf.rect(0, 0, 210, 32, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(title, left, 13);
    pdf.setFontSize(10);
    pdf.text(subtitle, left, 22);
    y = 42;
  }

  function pageCheck(extra = 10) {
    if (y + extra > 282) {
      pdf.addPage();
      header("Relatório da Gincana");
    }
  }

  function line(label, value) {
    pageCheck(9);
    pdf.setTextColor(16, 32, 24);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(`${label}:`, left, y);
    pdf.setFont("helvetica", "normal");
    const wrapped = pdf.splitTextToSize(String(value || "Não informado"), 130);
    pdf.text(wrapped, left + 45, y);
    y += Math.max(7, wrapped.length * 5);
  }

  function drawStickerCard(pdfDoc, vendor, x, top, width, height, index) {
    const accent = teamAccent(vendor.team);
    const rarity = getStickerRarityMap()[vendor.id] || { key: "classic", label: "Clássica", shortLabel: "Clássica" };
    const rarityFill = rarity.key === "legendary" ? [111, 66, 193] : rarity.key === "gold" ? [183, 121, 31] : rarity.key === "silver" ? [102, 112, 133] : [8, 100, 58];

    pdfDoc.setFillColor(255, 255, 255);
    pdfDoc.setDrawColor(245, 197, 66);
    pdfDoc.setLineWidth(1.2);
    pdfDoc.roundedRect(x, top, width, height, 5, 5, "FD");

    pdfDoc.setFillColor(248, 250, 252);
    pdfDoc.roundedRect(x + 2, top + 2, width - 4, height - 4, 4, 4, "F");

    pdfDoc.setFillColor(245, 197, 66);
    pdfDoc.roundedRect(x + 4, top + 4, width - 8, 9, 2, 2, "F");
    pdfDoc.setTextColor(61, 49, 0);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(8.5);
    pdfDoc.text("COLEÇÃO COPA DAS VENDAS 2026", x + 6, top + 10);
    pdfDoc.setFillColor(rarityFill[0], rarityFill[1], rarityFill[2]);
    pdfDoc.roundedRect(x + width - 31, top + 5.2, 13, 6.2, 1.5, 1.5, "F");
    pdfDoc.setTextColor(255, 255, 255);
    pdfDoc.setFontSize(6.8);
    pdfDoc.text((rarity.shortLabel || rarity.label).toUpperCase(), x + width - 29, top + 9.4);
    pdfDoc.setTextColor(61, 49, 0);
    pdfDoc.setFontSize(8.5);
    pdfDoc.text(`#${stickerNumber(index)}`, x + width - 16, top + 10);

    pdfDoc.setDrawColor(220, 232, 223);
    pdfDoc.setFillColor(255, 255, 255);
    pdfDoc.roundedRect(x + 7, top + 17, width - 14, 40, 3.5, 3.5, "FD");

    if (vendor.imageUrl) {
      try {
        pdfDoc.addImage(vendor.imageUrl, "JPEG", x + 9, top + 19, width - 18, 36);
      } catch {
        pdfDoc.setTextColor(8, 100, 58);
        pdfDoc.setFontSize(20);
        pdfDoc.text("⚽", x + width / 2 - 3.5, top + 39);
      }
    } else {
      pdfDoc.setTextColor(8, 100, 58);
      pdfDoc.setFontSize(20);
      pdfDoc.text("⚽", x + width / 2 - 3.5, top + 39);
    }

    pdfDoc.setFillColor(accent.primary);
    pdfDoc.roundedRect(x + 7, top + 59, width - 14, 8, 2.5, 2.5, "F");
    pdfDoc.setTextColor(255, 255, 255);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(8.5);
    pdfDoc.text(teamName(vendor.team).toUpperCase(), x + 10, top + 64.5);

    pdfDoc.setTextColor(16, 32, 24);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(11.5);
    pdfDoc.text(vendor.name, x + 7, top + 74);
    pdfDoc.setTextColor(97, 115, 104);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(8.2);
    const nickLines = pdfDoc.splitTextToSize(vendor.nickname || "Craque de vendas", width - 14);
    pdfDoc.text(nickLines, x + 7, top + 80);

    pdfDoc.setFillColor(rarityFill[0], rarityFill[1], rarityFill[2]);
    pdfDoc.roundedRect(x + 7, top + height - 19, width - 14, 6.5, 2.5, 2.5, "F");
    pdfDoc.setTextColor(255, 255, 255);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(7.8);
    pdfDoc.text(`RARIDADE ${rarity.label.toUpperCase()}`, x + 10, top + height - 14.4);

    pdfDoc.setFillColor(239, 245, 255);
    pdfDoc.roundedRect(x + 7, top + height - 11, width - 14, 6, 2.5, 2.5, "F");
    pdfDoc.setTextColor(accent.strong);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(7.2);
    pdfDoc.text(`Loja Tênis One • Nº ${stickerNumber(index)}`, x + 10, top + height - 6.8);
  }

  if (stickersOnly) {
    const summary = getCollectionSummary();
    header("Álbum de Figurinhas", "Coleção visual da Copa das Vendas");
    pdf.setFillColor(255, 248, 219);
    pdf.roundedRect(14, 46, 182, 78, 8, 8, "F");
    pdf.setTextColor(8, 100, 58);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text("ÁLBUM DA COPA DAS VENDAS", 20, 62);
    pdf.setFontSize(12);
    pdf.setTextColor(97, 115, 104);
    pdf.text("Coleção demonstrativa da campanha Tênis One", 20, 72);
    pdf.text(`Loja: ${campaign.store || "Tênis One"}`, 20, 80);
    pdf.text(`Figurinhas prontas: ${summary.withPhotos}/${summary.total}`, 20, 88);
    pdf.text(`Artilheiro atual: ${summary.topSeller?.name || "A definir"}`, 20, 96);
    pdf.text(`Equipe em destaque: ${summary.leaderTeam ? teamName(summary.leaderTeam) : "Empate"}`, 20, 104);
    pdf.setFillColor(20, 63, 145);
    pdf.roundedRect(136, 60, 46, 46, 6, 6, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(28);
    pdf.text("⚽", 159, 84, { align: "center" });
    pdf.setFontSize(10);
    pdf.text("Edição Especial", 159, 98, { align: "center" });

    pdf.addPage();
    header("Página da Coleção", "Figurinhas oficiais da campanha");
    y = 44;
    const cardW = 84;
    const cardH = 103;
    const gapX = 10;
    const gapY = 10;
    let x = 16;
    let col = 0;
    const rowHeight = cardH + gapY;

    vendorsArray().forEach((vendor, index) => {
      if (y + cardH > 282) {
        pdf.addPage();
        header("Página da Coleção", "Figurinhas oficiais da campanha");
        y = 44;
        x = 16;
        col = 0;
      }
      drawStickerCard(pdf, vendor, x, y, cardW, cardH, index);
      col += 1;
      x += cardW + gapX;
      if (col === 2) {
        col = 0;
        x = 16;
        y += rowHeight;
      }
    });

    pdf.addPage();
    header("Espaços Especiais", "Destaques da campanha");
    pdf.setFillColor(247, 250, 252);
    pdf.roundedRect(16, 46, 178, 34, 6, 6, "F");
    pdf.setTextColor(8, 100, 58);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Especial Artilheiro do Mês", 24, 58);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(97, 115, 104);
    pdf.text(summary.topSeller ? `${summary.topSeller.name} • ${brl(summary.topSeller.total)}` : "A definir", 24, 68);

    pdf.setFillColor(247, 250, 252);
    pdf.roundedRect(16, 88, 178, 34, 6, 6, "F");
    pdf.setTextColor(20, 63, 145);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Especial Equipe Campeã", 24, 100);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(97, 115, 104);
    pdf.text(summary.leaderTeam ? `${teamName(summary.leaderTeam)} em destaque no momento` : "Empate no momento", 24, 110);

    pdf.save("album-figurinhas-tenis-one.pdf");
    return;
  }

  header("Relatório da Gincana");
  const score = calculateScore();
  const ranking = calculateSellerRanking();

  line("Campanha", campaign.name);
  line("Período", `${campaign.startDate} a ${campaign.endDate}`);
  line("Placar Time Verde", `${score.verde.goals} gols — ${brl(score.verde.sales)} em vendas`);
  line("Placar Time Azul", `${score.azul.goals} gols — ${brl(score.azul.sales)} em vendas`);
  line("Artilheiro", ranking[0] ? `${ranking[0].name} — ${brl(ranking[0].total)}` : "Sem vendas");
  line("Regra", "A dupla com maior faturamento diário marca gols conforme a dezena do mês.");
  line("Bônus", "+3 gols por dezena para a dupla com maior faturamento da dezena nesta demo.");

  y += 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(8, 100, 58);
  pdf.text("Ranking individual", left, y);
  y += 8;

  ranking.forEach((row, index) => {
    line(`${index + 1}º`, `${row.name} — ${teamName(row.team)} — ${brl(row.total)}`);
  });

  y += 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(8, 100, 58);
  pdf.text("Rodadas fechadas", left, y);
  y += 8;

  roundsArray().sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((round) => {
    line(round.date, `${round.winnerTeam ? teamName(round.winnerTeam) : "Empate"} — ${round.goalsAwarded || 0} gol(s)`);
  });

  pdf.save("relatorio-copa-vendas-tenis-one.pdf");
}

function bindEvents() {
  $("loginBtn").addEventListener("click", () => {
    const pin = $("pinInput").value.trim();
    if (pin === (CONFIG.demoPin || "2026")) {
      $("loginScreen").style.display = "none";
      sessionStorage.setItem("copa_logged", "1");
      updateTrialUI();
    } else {
      $("loginError").textContent = "PIN incorreto.";
    }
  });

  $("pinInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") $("loginBtn").click();
  });

  $("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("copa_logged");
    location.reload();
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      tab.classList.add("active");
      $(tab.dataset.view).classList.add("active");
    });
  });

  $("saleDate").addEventListener("change", render);
  $("roundDate").addEventListener("change", render);

  $("saleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const date = $("saleDate").value;
    const vendorId = $("saleVendor").value;
    const amount = Number($("saleAmount").value || 0);
    if (!date || !vendorId) return toast("Preencha data e vendedor.");
    if (amount < 0) return toast("O valor não pode ser negativo.");

    const sale = {
      id: saleKey(date, vendorId),
      date,
      vendorId,
      amount,
      note: $("saleNote").value.trim(),
      updatedAt: new Date().toISOString()
    };

    const saved = await savePath(`copaTenisOne/sales/${sale.id}`, sale);
    if (!saved) return;
    $("saleAmount").value = "";
    $("saleNote").value = "";
    toast("Venda salva.");
  });

  $("closeTodayBtn").addEventListener("click", () => closeRound($("saleDate").value || isoToday()));
  $("closeRoundBtn").addEventListener("click", () => closeRound($("roundDate").value || isoToday()));

  document.querySelectorAll("[data-bonus]").forEach((btn) => {
    btn.addEventListener("click", () => applyBonus(btn.dataset.bonus));
  });

  $("pdfBtn").addEventListener("click", () => exportReportPDF(false));
  $("downloadStickerPackBtn").addEventListener("click", () => exportReportPDF(true));
  $("seedBtn").addEventListener("click", () => {
    if (confirm("Isso apaga os lançamentos atuais e recria os dados demonstrativos. Continuar?")) {
      seedData(true);
    }
  });
}

bindEvents();

if (sessionStorage.getItem("copa_logged") === "1") {
  $("loginScreen").style.display = "none";
}

initFirebaseOrLocal();
