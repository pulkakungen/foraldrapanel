"use strict";

/* =========================================================
   FÖRÄLDRAPANELEN
   Läser lägesbilden från varje barns worker och kan skicka
   notiser till dem. Ingen egen server: sidan pratar direkt
   med workrarna och nyckeln ligger bara i den här webbläsaren.
   ========================================================= */

const KEY_STORAGE = "foraldrapanel_key_v1";

const APPS = [
  {
    id: "sassibrass",
    child: "Sassa",
    app: "Sassibrass",
    url: "https://sassibrass-push.bella-sassibrass.workers.dev",
    accent: "var(--c1)",
    report: true
  },
  {
    id: "sameluren",
    child: "Samuel",
    app: "Sameluren",
    url: "https://sameluren-push.bella-sassibrass.workers.dev",
    accent: "var(--c2)",
    report: true
  },
  {
    id: "mrs-raccoon",
    child: "Emil",
    app: "Mrs Raccoon",
    url: "https://mrs-raccoon-push.bella-sassibrass.workers.dev",
    accent: "var(--c3)",
    report: false
  },
  {
    // Frallan sparar allt lokalt i barnets telefon och har ingen worker, så
    // det finns inget att hämta här förrän den får en.
    id: "frallan",
    child: "Frallan",
    app: "Frallan",
    url: null,
    accent: "var(--c4)",
    report: false
  }
];

let adminKey = localStorage.getItem(KEY_STORAGE) || "";
let summaries = {};

/* ---------------------------------------------------------
   Hämtning
   --------------------------------------------------------- */
function headers() {
  return adminKey ? { "X-Admin-Key": adminKey } : {};
}

async function fetchSummary(app) {
  if (!app.url) return { status: "ingen-server" };
  try {
    const res = await fetch(app.url + "/admin/summary", { headers: headers() });
    if (res.status === 401) return { status: "fel-nyckel" };
    if (!res.ok) return { status: "fel", detail: "svarade " + res.status };
    return { status: "ok", data: await res.json() };
  } catch (e) {
    return { status: "fel", detail: "gick inte att nå" };
  }
}

async function loadAll() {
  document.getElementById("updated").textContent = "Hämtar...";
  const results = await Promise.all(APPS.map((a) => fetchSummary(a)));
  APPS.forEach((a, i) => (summaries[a.id] = results[i]));

  if (results.some((r) => r.status === "fel-nyckel")) {
    showLock("Nyckeln stämmer inte.");
    return;
  }

  render();
  const nu = new Date();
  document.getElementById("updated").textContent =
    "Uppdaterad " + String(nu.getHours()).padStart(2, "0") + ":" + String(nu.getMinutes()).padStart(2, "0");
}

/* ---------------------------------------------------------
   Formatering
   --------------------------------------------------------- */
function sedan(iso) {
  if (!iso) return "aldrig";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "nyss";
  if (min < 60) return min + " min sedan";
  const h = Math.round(min / 60);
  if (h < 24) return h + " h sedan";
  return Math.round(h / 24) + " dygn sedan";
}

function kortDatum(d) {
  const [, m, dag] = d.split("-");
  return dag + "/" + Number(m);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* ---------------------------------------------------------
   Kort per barn
   --------------------------------------------------------- */
function renderCard(app) {
  const res = summaries[app.id] || {};
  const card = el("div", "card");
  card.style.setProperty("--accent", app.accent);

  const head = el("div", "card-head");
  head.append(el("span", "who", app.child), el("span", "app", app.app), el("span", "spacer"));

  if (res.status !== "ok") {
    card.classList.add("offline");
    const text =
      res.status === "ingen-server"
        ? "Ingen server"
        : res.status === "fel-nyckel"
        ? "Fel nyckel"
        : "Når inte appen";
    head.append(el("span", "pill warn", text));
    card.append(head);
    card.append(
      el(
        "p",
        "muted small",
        app.url
          ? "Workern svarade inte: " + (res.detail || "okänt fel")
          : "Frallan sparar allt i barnets telefon och har ingen worker än, så det finns inget att visa eller skicka härifrån."
      )
    );
    return card;
  }

  const d = res.data;

  head.append(el("span", "pill " + (d.notifications ? "on" : "off"), d.notifications ? "Notiser på" : "Notiser av"));
  card.append(head);

  // dagens läge
  const today = el("div", "today");
  const track = el("div", "track");
  const fill = el("div");
  const andel = d.totalToday ? Math.round((d.doneToday / d.totalToday) * 100) : 0;
  fill.style.width = andel + "%";
  track.append(fill);
  today.append(el("span", "count", d.doneToday + " / " + d.totalToday), track, el("span", "count", andel + "%"));
  card.append(today);

  // nyckeltal
  const stats = el("div", "stats");
  const chip = (t, cls) => stats.append(el("span", "pill" + (cls ? " " + cls : ""), t));
  chip("Senast i appen: " + sedan(d.lastSyncAt));
  if (d.petName) chip(d.petName + (d.level ? ", nivå " + d.level : ""));
  else if (d.level) chip("Nivå " + d.level);
  if (typeof d.streak === "number") chip("Streak " + d.streak);
  // Nivåerna är uppskattade från senaste synk, appen räknar ner dem i telefonen.
  const niva = (etikett, nu, vidSynk) => {
    if (typeof nu !== "number") return;
    const c = el("span", "pill" + (nu < 30 ? " warn" : ""), etikett + " " + nu + "%");
    if (typeof vidSynk === "number" && vidSynk !== nu) {
      c.title = "Uppskattat nu. Var " + vidSynk + "% vid senaste synk.";
    }
    stats.append(c);
  };
  niva("Mat", d.hunger, d.hungerAtSync);
  niva("Kärlek", d.happiness, d.happinessAtSync);
  if (d.allDoneToday) chip("Allt klart idag", "on");
  card.append(stats);

  // fjorton dagar bakåt, en stapel per dag
  if (Array.isArray(d.history) && d.history.length) {
    const label = el("div", "strip-label");
    label.append(el("span", "", "Senaste 14 dagarna"), el("span", "", "andel avbockat"));
    card.append(label);

    const strip = el("div", "strip");
    d.history.forEach((dag) => {
      const wrap = el("div", "bar-wrap");
      const bar = el("div", "bar");
      const andelDag = dag.total ? dag.done / dag.total : 0;
      if (!dag.total) bar.classList.add("empty");
      bar.style.height = Math.max(4, andelDag * 100) + "%";
      wrap.append(bar);
      wrap.addEventListener("mouseenter", (e) => visaTooltip(e, dag));
      wrap.addEventListener("mousemove", flyttaTooltip);
      wrap.addEventListener("mouseleave", doljTooltip);
      strip.append(wrap);
    });
    card.append(strip);
  }

  // dagens lista
  if (Array.isArray(d.tasks) && d.tasks.length) {
    const details = el("details", "tasks");
    details.append(el("summary", "", "Dagens uppgifter"));
    const ul = el("ul");
    d.tasks.forEach((t) => {
      const li = el("li", t.done ? "done" : "");
      li.append(el("span", "mark", t.done ? "✓" : "○"), el("span", "", t.text));
      ul.append(li);
    });
    details.append(ul);
    card.append(details);
  }

  if (d.affirmation) card.append(el("p", "muted small", d.affirmation));

  const links = el("div", "links");
  const med = (path) => app.url + path + (adminKey ? (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(adminKey) : "");
  const lank = (text, path) => {
    const a = el("a", "", text);
    a.href = med(path);
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  };
  // Appar som har en egen dagsvy att rätta i skickar med adressen till den.
  if (d.panelUrl) {
    const a = el("a", "primary", "Rätta dagar");
    a.href = d.panelUrl;
    a.target = "_blank";
    a.rel = "noopener";
    links.append(a);
  }
  links.append(lank("Status", "/admin/status"));
  if (app.report) links.append(lank("Rapport", "/report"));
  card.append(links);

  return card;
}

function render() {
  const wrap = document.getElementById("cards");
  wrap.innerHTML = "";
  APPS.forEach((a) => wrap.append(renderCard(a)));
  renderTargets();
}

/* ---------------------------------------------------------
   Tooltip på dagsstaplarna
   --------------------------------------------------------- */
const tooltip = () => document.getElementById("tooltip");

function visaTooltip(e, dag) {
  const t = tooltip();
  t.innerHTML = "";
  t.append(el("span", "t-date", kortDatum(dag.date)));
  t.append(
    document.createTextNode(
      dag.total ? dag.done + " av " + dag.total + " avbockade" + (dag.allDone ? ", allt klart" : "") : "ingen data"
    )
  );
  t.hidden = false;
  flyttaTooltip(e);
}

function flyttaTooltip(e) {
  const t = tooltip();
  const x = Math.min(e.clientX + 12, window.innerWidth - t.offsetWidth - 8);
  t.style.left = x + "px";
  t.style.top = Math.max(8, e.clientY - t.offsetHeight - 10) + "px";
}

function doljTooltip() {
  tooltip().hidden = true;
}

/* ---------------------------------------------------------
   Meddelanden
   --------------------------------------------------------- */
function renderTargets() {
  const wrap = document.getElementById("message-targets");
  wrap.innerHTML = "";
  APPS.forEach((a) => {
    const res = summaries[a.id] || {};
    const gar = res.status === "ok" && res.data.notifications;
    const label = el("label", "target" + (gar ? "" : " disabled"));
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = a.id;
    box.disabled = !gar;
    label.append(box, el("span", "", a.child));
    wrap.append(label);
  });
}

async function skicka() {
  const text = document.getElementById("message-text").value.trim();
  const status = document.getElementById("send-status");
  const valda = [...document.querySelectorAll("#message-targets input:checked")].map((i) => i.value);

  if (!text) return (status.textContent = "Skriv något först.");
  if (!valda.length) return (status.textContent = "Välj vem det ska till.");

  const btn = document.getElementById("send-btn");
  btn.disabled = true;
  status.textContent = "Skickar...";

  const resultat = await Promise.all(
    valda.map(async (id) => {
      const app = APPS.find((a) => a.id === id);
      try {
        const res = await fetch(app.url + "/admin/send?text=" + encodeURIComponent(text), { headers: headers() });
        const data = await res.json().catch(() => ({}));
        return { child: app.child, ok: res.ok && data.ok !== false };
      } catch (e) {
        return { child: app.child, ok: false };
      }
    })
  );

  btn.disabled = false;
  const misslyckade = resultat.filter((r) => !r.ok).map((r) => r.child);
  if (misslyckade.length) {
    status.textContent = "Gick inte fram till " + misslyckade.join(", ");
  } else {
    status.textContent = "Skickat till " + resultat.map((r) => r.child).join(", ");
    document.getElementById("message-text").value = "";
    document.querySelectorAll("#message-targets input:checked").forEach((i) => (i.checked = false));
  }
  setTimeout(() => (status.textContent = ""), 6000);
}

/* ---------------------------------------------------------
   Lås
   --------------------------------------------------------- */
function showLock(fel) {
  document.getElementById("screen-panel").classList.remove("active");
  document.getElementById("screen-lock").classList.add("active");
  const e = document.getElementById("lock-error");
  e.hidden = !fel;
  if (fel) e.textContent = fel;
}

function showPanel() {
  document.getElementById("screen-lock").classList.remove("active");
  document.getElementById("screen-panel").classList.add("active");
  loadAll();
}

function init() {
  document.getElementById("lock-form").addEventListener("submit", (e) => {
    e.preventDefault();
    adminKey = document.getElementById("key-input").value.trim();
    localStorage.setItem(KEY_STORAGE, adminKey);
    showPanel();
  });

  document.getElementById("refresh-btn").addEventListener("click", loadAll);
  document.getElementById("lock-btn").addEventListener("click", () => {
    localStorage.removeItem(KEY_STORAGE);
    adminKey = "";
    document.getElementById("key-input").value = "";
    showLock();
  });
  document.getElementById("send-btn").addEventListener("click", skicka);

  // hämta om när panelen kommer fram igen, så siffrorna inte är gamla
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && document.getElementById("screen-panel").classList.contains("active")) loadAll();
  });

  if (adminKey) showPanel();
  else showLock();
}

document.addEventListener("DOMContentLoaded", init);
