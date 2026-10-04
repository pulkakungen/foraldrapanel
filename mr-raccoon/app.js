"use strict";

/* =========================================================
   MR. RACCOON 🦝

   Föräldrapanelen i miniatyr, för Emil. Den visar bara två saker:
   när barnen varit inne i sina appar, och en ruta där han kan ge dem
   en uppgift. Inga poäng, inga rapporter, inget skickande av notiser.

   Ingen egen server: sidan pratar direkt med varje barns worker, och
   nyckeln sparas bara i den här webbläsaren.
   ========================================================= */

const KEY_STORAGE = "mr_raccoon_key_v1";

const BARN = [
  {
    id: "sassibrass",
    namn: "Sassa",
    app: "Sassibrass",
    url: "https://sassibrass-push.bella-sassibrass.workers.dev"
  },
  {
    id: "sameluren",
    namn: "Samuel",
    app: "Sameluren",
    url: "https://sameluren-push.bella-sassibrass.workers.dev"
  },
  {
    id: "frallan",
    namn: "Olle",
    app: "Frallan",
    url: "https://frallan-push.bella-sassibrass.workers.dev"
  }
];

let nyckel = localStorage.getItem(KEY_STORAGE) || "";
let lagesbilder = {};

/* --------------------------- hämtning --------------------------- */

function headers() {
  return nyckel ? { "X-Admin-Key": nyckel } : {};
}

async function hamtaLagesbild(barn) {
  try {
    const res = await fetch(barn.url + "/admin/summary", { headers: headers() });
    if (res.status === 401) return { status: "fel-nyckel" };
    if (!res.ok) return { status: "fel", detalj: "svarade " + res.status };
    return { status: "ok", data: await res.json() };
  } catch (e) {
    return { status: "fel", detalj: "gick inte att nå" };
  }
}

async function hamtaAllt() {
  document.getElementById("updated").textContent = "Hämtar...";
  const svar = await Promise.all(BARN.map(hamtaLagesbild));
  BARN.forEach((b, i) => (lagesbilder[b.id] = svar[i]));

  if (svar.some((r) => r.status === "fel-nyckel")) {
    visaLas("Nyckeln stämmer inte.");
    return;
  }

  rita();
  const nu = new Date();
  document.getElementById("updated").textContent =
    "Uppdaterad " + String(nu.getHours()).padStart(2, "0") + ":" + String(nu.getMinutes()).padStart(2, "0");
}

/* --------------------------- formatering --------------------------- */

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
  return Number(dag) + "/" + Number(m);
}

function el(tagg, klass, text) {
  const e = document.createElement(tagg);
  if (klass) e.className = klass;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* --------------------------- korten --------------------------- */

function ritaKort(barn) {
  const res = lagesbilder[barn.id] || {};
  const kort = el("article", "card");

  const rubrik = el("div", "card-head");
  rubrik.append(el("span", "who", barn.namn), el("span", "app", barn.app));
  kort.append(rubrik);

  if (res.status !== "ok") {
    kort.classList.add("offline");
    kort.append(el("p", "muted small", "Når inte appen just nu: " + (res.detalj || "okänt fel")));
    return kort;
  }

  const d = res.data;

  // dagens läge
  const idag = el("div", "today");
  const spar = el("div", "track");
  const fyll = el("div");
  const andel = d.totalToday ? Math.round((d.doneToday / d.totalToday) * 100) : 0;
  fyll.style.width = andel + "%";
  spar.append(fyll);
  idag.append(el("span", "count", d.doneToday + " / " + d.totalToday), spar);
  kort.append(idag);

  kort.append(el("p", "muted small", "Senast i appen: " + sedan(d.lastSyncAt)));

  // fjorton dagar bakåt: en stapel per dag, höjden är andel avbockat
  if (Array.isArray(d.history) && d.history.length) {
    const etikett = el("div", "strip-label");
    etikett.append(el("span", "", "Senaste 14 dagarna"), el("span", "", "andel avbockat"));
    kort.append(etikett);

    const strip = el("div", "strip");
    d.history.forEach((dag) => {
      const hallare = el("div", "bar-wrap");
      const stapel = el("div", "bar");
      const kvot = dag.total ? dag.done / dag.total : 0;
      if (!dag.total) stapel.classList.add("empty");
      stapel.style.height = Math.max(4, kvot * 100) + "%";
      hallare.append(stapel);
      hallare.addEventListener("pointerenter", (e) => visaTooltip(e, barn, dag));
      hallare.addEventListener("pointerleave", doljTooltip);
      strip.append(hallare);
    });
    kort.append(strip);

    const forsta = d.history[0], sista = d.history[d.history.length - 1];
    const axel = el("div", "axis");
    axel.append(el("span", "", kortDatum(forsta.date)), el("span", "", kortDatum(sista.date)));
    kort.append(axel);
  }

  return kort;
}

function rita() {
  const wrap = document.getElementById("cards");
  wrap.innerHTML = "";
  BARN.forEach((b) => wrap.append(ritaKort(b)));
  ritaMottagare();
  ritaExtra();
}

/* --------------------------- tooltip --------------------------- */

function visaTooltip(e, barn, dag) {
  const t = document.getElementById("tooltip");
  t.innerHTML = "";
  t.append(el("strong", "", barn.namn + " " + kortDatum(dag.date)));
  t.append(el("div", "", dag.total ? `${dag.done} av ${dag.total} avbockade` : "inget loggat den dagen"));
  t.hidden = false;
  const r = e.currentTarget.getBoundingClientRect();
  t.style.left = Math.min(window.innerWidth - 170, Math.max(8, r.left)) + "px";
  t.style.top = r.top + window.scrollY - 54 + "px";
}

function doljTooltip() {
  document.getElementById("tooltip").hidden = true;
}

/* --------------------------- ge en uppgift --------------------------- */

function ritaMottagare() {
  const wrap = document.getElementById("extra-targets");
  if (wrap.children.length) return;
  BARN.forEach((b) => {
    const etikett = el("label", "target");
    const ruta = document.createElement("input");
    ruta.type = "checkbox";
    ruta.value = b.id;
    etikett.append(ruta, el("span", "", b.namn));
    wrap.append(etikett);
  });
}

function fyllDagar() {
  const sel = document.getElementById("extra-date");
  if (sel.options.length) return;
  const namn = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const varde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const o = document.createElement("option");
    o.value = varde;
    o.textContent = i === 0 ? "Idag" : i === 1 ? "Imorgon" : namn[d.getDay()] + " " + d.getDate() + "/" + (d.getMonth() + 1);
    sel.append(o);
  }
}

async function laggTill() {
  const text = document.getElementById("extra-text").value.trim();
  const status = document.getElementById("extra-status");
  const valda = [...document.querySelectorAll("#extra-targets input:checked")].map((i) => i.value);

  if (!text) return (status.textContent = "Skriv uppgiften först.");
  if (!valda.length) return (status.textContent = "Välj vem den gäller.");

  const knapp = document.getElementById("extra-btn");
  knapp.disabled = true;
  status.textContent = "Lägger till...";

  const body = {
    text,
    emoji: document.getElementById("extra-emoji").value.trim() || "⭐",
    date: document.getElementById("extra-date").value,
    gives: "both"
  };

  const resultat = await Promise.all(
    valda.map(async (id) => {
      const barn = BARN.find((b) => b.id === id);
      try {
        const res = await fetch(barn.url + "/admin/extra", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers() },
          body: JSON.stringify(body)
        });
        return { namn: barn.namn, ok: res.ok };
      } catch (e) {
        return { namn: barn.namn, ok: false };
      }
    })
  );

  knapp.disabled = false;
  const fel = resultat.filter((r) => !r.ok).map((r) => r.namn);
  status.textContent = fel.length
    ? "Gick inte för " + fel.join(", ")
    : "Tillagd för " + resultat.map((r) => r.namn).join(", ");
  if (!fel.length) {
    document.getElementById("extra-text").value = "";
    document.querySelectorAll("#extra-targets input:checked").forEach((i) => (i.checked = false));
  }
  setTimeout(() => (status.textContent = ""), 6000);
  hamtaAllt();
}

// Uppgifter som lagts till utifrån, med status och möjlighet att ångra.
function ritaExtra() {
  const wrap = document.getElementById("extra-list");
  wrap.innerHTML = "";
  let antal = 0;

  BARN.forEach((barn) => {
    const res = lagesbilder[barn.id];
    if (!res || res.status !== "ok") return;
    const d = res.data;
    (d.extra || []).forEach((t) => {
      antal++;
      const klar = (d.tasks || []).some((x) => x.id === t.id && x.done);
      const rad = el("div", "extra-item");
      rad.append(
        el("span", "", t.emoji || "⭐"),
        el("span", "grow", t.text),
        el("span", "who-small", barn.namn),
        el("span", klar ? "done" : "muted small", klar ? "klar" : "väntar")
      );
      const bort = el("button", "bort", "×");
      bort.title = "Ta bort";
      bort.addEventListener("click", () => taBort(barn, t));
      rad.append(bort);
      wrap.append(rad);
    });
  });

  if (!antal) wrap.append(el("p", "muted small", "Inga extrauppgifter just nu."));
}

async function taBort(barn, task) {
  await fetch(barn.url + "/admin/extra/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers() },
    body: JSON.stringify({ date: task.date, id: task.id })
  }).catch(() => {});
  hamtaAllt();
}

/* --------------------------- låsskärm --------------------------- */

function visaLas(fel) {
  document.getElementById("screen-panel").classList.remove("active");
  document.getElementById("screen-lock").classList.add("active");
  const ruta = document.getElementById("lock-error");
  ruta.textContent = fel || "";
  ruta.hidden = !fel;
}

function visaPanel() {
  document.getElementById("screen-lock").classList.remove("active");
  document.getElementById("screen-panel").classList.add("active");
}

/* --------------------------- start --------------------------- */

function init() {
  fyllDagar();

  document.getElementById("lock-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    nyckel = document.getElementById("key-input").value.trim();
    localStorage.setItem(KEY_STORAGE, nyckel);
    visaPanel();
    await hamtaAllt();
  });

  document.getElementById("refresh").addEventListener("click", hamtaAllt);
  document.getElementById("extra-btn").addEventListener("click", laggTill);
  document.getElementById("forget").addEventListener("click", () => {
    localStorage.removeItem(KEY_STORAGE);
    nyckel = "";
    document.getElementById("key-input").value = "";
    visaLas("");
  });

  if (nyckel) {
    visaPanel();
    hamtaAllt();
  } else {
    visaLas("");
  }

  // håll läget färskt när han kommer tillbaka till fliken
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && nyckel) hamtaAllt();
  });
}

document.addEventListener("DOMContentLoaded", init);
