import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getDatabase, ref, set, update, onValue, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const CONFIG = window.APP_CONFIG || {};
const campaign = CONFIG.campaign || {};
const TEAMS = campaign.teams || {};
const VENDORS_SEED = campaign.vendors || [];

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

function isoToday() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
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
  const raw = localStorage.getItem("copa_tenis_one_state");
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
  localStorage.setItem("copa_tenis_one_state", JSON.stringify(state.data));
}

async function savePath(path, value) {
  if (state.mode === "firebase" && state.db) {
    await set(ref(state.db, path), value);
  } else {
    setDeep(state.data, path.replace(/^copaTenisOne\//, "").split("/"), value);
    localSave();
    render();
  }
}

async function updatePath(path, value) {
  if (state.mode === "firebase" && state.db) {
    await update(ref(state.db, path), value);
  } else {
    const current = getDeep(state.data, path.replace(/^copaTenisOne\//, "").split("/")) || {};
    setDeep(state.data, path.replace(/^copaTenisOne\//, "").split("/"), { ...current, ...value });
    localSave();
    render();
  }
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
  if (state.mode === "firebase" && state.db) {
    const snap = await get(ref(state.db, "copaTenisOne/vendors"));
    if (!snap.exists() || force) {
      await set(ref(state.db, "copaTenisOne"), seed);
      toast("Dados demonstrativos recriados no Firebase.");
    }
  } else {
    if (force || !state.data.vendors || !Object.keys(state.data.vendors).length) {
      state.data = seed;
      localSave();
      toast("Dados demonstrativos recriados localmente.");
      render();
    }
  }
}

async function initFirebaseOrLocal() {
  $("saleDate").value = isoToday();
  $("roundDate").value = isoToday();

  const firebaseReady = isConfigured(CONFIG.firebase, ["apiKey", "authDomain", "databaseURL", "projectId", "appId"]);
  const cloudinaryReady = isConfigured(CONFIG.cloudinary, ["cloudName", "uploadPreset"]);

  $("firebaseCheck").textContent = firebaseReady
    ? "Firebase: configurado. Usando Realtime Database."
    : "Firebase: não configurado. Usando modo local para demonstração.";

  $("cloudinaryCheck").textContent = cloudinaryReady
    ? "Cloudinary: configurado. Upload em nuvem disponível."
    : "Cloudinary: não configurado. Upload local demonstrativo.";

  if (!firebaseReady) {
    state.mode = "local";
    localLoad();
    $("connectionStatus").textContent = "Modo local demonstrativo";
    $("connectionStatus").style.background = "#fff8db";
    $("connectionStatus").style.color = "#6d5200";
    await seedData(false);
    render();
    return;
  }

  try {
    const app = initializeApp(CONFIG.firebase);
    const auth = getAuth(app);
    state.db = getDatabase(app);
    state.mode = "firebase";
    $("connectionStatus").textContent = "Conectando ao Firebase...";

    await signInAnonymously(auth);

    onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      await seedData(false);
      onValue(ref(state.db, "copaTenisOne"), (snapshot) => {
        state.data = snapshot.val() || createSeedData();
        $("connectionStatus").textContent = "Firebase Realtime Database ativo";
        $("connectionStatus").style.background = "#e8f7ee";
        $("connectionStatus").style.color = "#08643a";
        render();
      });
    });
  } catch (error) {
    console.error(error);
    state.mode = "local";
    localLoad();
    $("connectionStatus").textContent = "Falha no Firebase — modo local ativo";
    $("connectionStatus").style.background = "#fff1f1";
    $("connectionStatus").style.color = "#b42318";
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

  await savePath(`copaTenisOne/rounds/${date}`, round);
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
    ruleUsed: "Maior faturamento da dezena — ajustar se Saulo definir meta percentual.",
    closedAt: new Date().toISOString()
  };

  await savePath(`copaTenisOne/bonuses/dezena_${dezena}`, bonus);
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
  $("stickerGrid").innerHTML = vendorsArray().map((vendor) => `
    <article class="sticker">
      <div class="sticker-photo">
        ${vendor.imageUrl ? `<img src="${vendor.imageUrl}" alt="${vendor.name}" />` : `<span>⚽</span>`}
      </div>
      <div class="sticker-body">
        <h3>${vendor.name}</h3>
        <p>${vendor.nickname || "Craque de vendas"} • ${teamName(vendor.team)}</p>
        <div class="sticker-actions">
          <button class="btn btn-light" data-upload="${vendor.id}">Enviar foto</button>
          <button class="btn btn-outline" data-clear-photo="${vendor.id}">Limpar</button>
        </div>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-upload]").forEach((button) => {
    button.addEventListener("click", () => uploadPhoto(button.dataset.upload));
  });

  document.querySelectorAll("[data-clear-photo]").forEach((button) => {
    button.addEventListener("click", async () => {
      await updatePath(`copaTenisOne/vendors/${button.dataset.clearPhoto}`, { imageUrl: "" });
      toast("Foto removida.");
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
  renderStickers();
  renderRules();
}

async function uploadPhoto(vendorId) {
  const cloudinaryReady = isConfigured(CONFIG.cloudinary, ["cloudName", "uploadPreset"]);
  if (cloudinaryReady && window.cloudinary?.createUploadWidget) {
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
          toast("Erro ao enviar imagem para Cloudinary.");
          return;
        }
        if (result && result.event === "success") {
          await updatePath(`copaTenisOne/vendors/${vendorId}`, { imageUrl: result.info.secure_url });
          toast("Foto enviada para Cloudinary.");
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
      await updatePath(`copaTenisOne/vendors/${vendorId}`, { imageUrl: reader.result });
      toast("Foto salva localmente para demonstração.");
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

  function header(title) {
    pdf.setFillColor(8, 100, 58);
    pdf.rect(0, 0, 210, 32, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(title, left, 13);
    pdf.setFontSize(10);
    pdf.text("Tênis One — Copa do Mundo das Vendas", left, 22);
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

  if (stickersOnly) {
    header("Álbum de Figurinhas");
    let x = left;
    let col = 0;
    for (const vendor of vendorsArray()) {
      pageCheck(76);
      pdf.setFillColor(vendor.team === "verde" ? 8 : 20, vendor.team === "verde" ? 100 : 63, vendor.team === "verde" ? 58 : 145);
      pdf.roundedRect(x, y, 54, 68, 4, 4, "F");
      if (vendor.imageUrl) {
        try {
          pdf.addImage(vendor.imageUrl, "JPEG", x + 4, y + 4, 46, 40);
        } catch {}
      }
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(vendor.name, x + 4, y + 50);
      pdf.setFontSize(8);
      pdf.text(pdf.splitTextToSize(`${vendor.nickname || "Craque"} • ${teamName(vendor.team)}`, 46), x + 4, y + 57);
      col += 1;
      x += 63;
      if (col === 3) {
        col = 0;
        x = left;
        y += 78;
      }
    }
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

    await savePath(`copaTenisOne/sales/${sale.id}`, sale);
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
