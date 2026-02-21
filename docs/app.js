const state = {
  token: localStorage.getItem("ff_token") || "",
  user: JSON.parse(localStorage.getItem("ff_user") || "null"),
};

const qs = new URLSearchParams(window.location.search);
const apiBaseFromQuery = qs.get("apiBase");
if (apiBaseFromQuery) {
  localStorage.setItem("ff_api_base", apiBaseFromQuery);
}

const API_BASE_URL = (
  window.FLEETFLOW_API_BASE ||
  apiBaseFromQuery ||
  localStorage.getItem("ff_api_base") ||
  ""
).replace(/\/$/, "");

const el = {
  authCard: document.getElementById("authCard"),
  dashboard: document.getElementById("dashboard"),
  loginForm: document.getElementById("loginForm"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  authMsg: document.getElementById("authMsg"),
  dataMsg: document.getElementById("dataMsg"),
  welcome: document.getElementById("welcome"),
  tokenHint: document.getElementById("tokenHint"),
  refreshBtn: document.getElementById("refreshBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  kpis: document.getElementById("kpis"),
  vehiclesTable: document.getElementById("vehiclesTable"),
  driversTable: document.getElementById("driversTable"),
  expiringDrivers: document.getElementById("expiringDrivers"),
  tripsTable: document.getElementById("tripsTable"),
  createVehicleBtn: document.getElementById("createVehicleBtn"),
  vehiclePlate: document.getElementById("vehiclePlate"),
  vehicleUnit: document.getElementById("vehicleUnit"),
  vehicleMileage: document.getElementById("vehicleMileage"),
  createTripBtn: document.getElementById("createTripBtn"),
  tripVehicle: document.getElementById("tripVehicle"),
  tripDriver: document.getElementById("tripDriver"),
  tripOrigin: document.getElementById("tripOrigin"),
  tripDestination: document.getElementById("tripDestination"),
};

async function api(path, options = {}) {
  const hostedOnGithubPages = window.location.hostname.endsWith("github.io");
  if (hostedOnGithubPages && !API_BASE_URL) {
    throw new Error(
      "API base URL is not configured. Open this page with ?apiBase=https://YOUR_API_HOST or set window.FLEETFLOW_API_BASE."
    );
  }

  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (
      hostedOnGithubPages &&
      !API_BASE_URL &&
      (res.status === 404 || res.status === 405)
    ) {
      throw new Error(
        "GitHub Pages is static-only. Configure backend URL with ?apiBase=https://YOUR_API_HOST."
      );
    }
    throw new Error(data?.error?.message || `Request failed (${res.status})`);
  }
  return data;
}

function setAuthVisible(isAuthed) {
  el.authCard.classList.toggle("hidden", isAuthed);
  el.dashboard.classList.toggle("hidden", !isAuthed);
}

function setMessage(target, message, isError = false) {
  target.textContent = message;
  target.style.color = isError ? "#ff9e9e" : "#8ee3ff";
}

function saveSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("ff_token", token);
  localStorage.setItem("ff_user", JSON.stringify(user));
}

function clearSession() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("ff_token");
  localStorage.removeItem("ff_user");
}

function renderKpis(kpis) {
  const items = [
    ["Total Vehicles", kpis.totalVehicles ?? "-"],
    ["Active Vehicles", kpis.active ?? "-"],
    ["In Shop", kpis.inShop ?? "-"],
    ["Avg Mileage", kpis.averageMileage ?? "-"],
  ];

  el.kpis.innerHTML = items
    .map(([label, value]) => `<article class="kpi"><small>${label}</small><strong>${value}</strong></article>`)
    .join("");
}

function renderTable(container, columns, rows) {
  const head = `<thead><tr>${columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
  const body = `<tbody>${rows.length ? rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}">No data</td></tr>`}</tbody>`;
  container.innerHTML = `<table>${head}${body}</table>`;
}

async function loadDashboard() {
  try {
    setMessage(el.dataMsg, "Loading data...");

    const [vehiclesRes, driversRes, tripsRes, kpisRes, expiringRes] = await Promise.all([
      api("/api/vehicles"),
      api("/api/drivers"),
      api("/api/trips"),
      api("/api/vehicles/kpis").catch(() => ({ data: {} })),
      api("/api/drivers/expiring-licences").catch(() => ({ data: [] })),
    ]);

    renderKpis(kpisRes.data || {});

    renderTable(
      el.vehiclesTable,
      ["ID", "Unit", "Plate", "Status", "Mileage", "Maintenance"],
      (vehiclesRes.data || []).map((v) => [
        v.id,
        v.unitNumber,
        v.plate,
        v.status,
        Number(v.mileage).toLocaleString(),
        (v.maintenance || []).length,
      ])
    );

    renderTable(
      el.driversTable,
      ["ID", "Name", "License", "Expires", "Status"],
      (driversRes.data || []).map((d) => [
        d.id,
        d.name,
        d.licenseNumber,
        new Date(d.licenseExpiresAt).toLocaleDateString(),
        d.status,
      ])
    );

    renderTable(
      el.tripsTable,
      ["ID", "Vehicle", "Driver", "Route", "When", "Status", "Action"],
      (tripsRes.data || []).map((t) => [
        t.id,
        t.vehicleId,
        t.driverId,
        `${t.origin} -> ${t.destination}`,
        new Date(t.scheduledAt).toLocaleString(),
        t.status,
        t.status === "planned"
          ? `<button class="btn btn-ghost js-trip" data-op="dispatch" data-id="${t.id}">Dispatch</button>`
          : t.status === "dispatched"
          ? `<button class="btn btn-ghost js-trip" data-op="complete" data-id="${t.id}">Complete</button>`
          : t.status !== "completed"
          ? `<button class="btn btn-ghost js-trip" data-op="cancel" data-id="${t.id}">Cancel</button>`
          : "-",
      ])
    );

    const expiring = expiringRes.data || [];
    el.expiringDrivers.innerHTML = expiring.length
      ? expiring.map((d) => `<span class="chip">${d.name} (${new Date(d.licenseExpiresAt).toLocaleDateString()})</span>`).join("")
      : '<span class="chip">No upcoming expirations</span>';

    setMessage(el.dataMsg, `Loaded ${vehiclesRes.count || 0} vehicles, ${driversRes.count || 0} drivers, ${tripsRes.count || 0} trips.`);
  } catch (err) {
    setMessage(el.dataMsg, err.message, true);
  }
}

el.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    setMessage(el.authMsg, "Signing in...");
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: el.email.value.trim(),
        password: el.password.value,
      }),
    });

    saveSession(res.data.token, res.data.user);
    initAuthed();
    setMessage(el.authMsg, "");
  } catch (err) {
    setMessage(el.authMsg, err.message, true);
  }
});

el.logoutBtn.addEventListener("click", () => {
  clearSession();
  setAuthVisible(false);
  setMessage(el.dataMsg, "");
});

el.refreshBtn.addEventListener("click", loadDashboard);

el.createVehicleBtn.addEventListener("click", async () => {
  try {
    await api("/api/vehicles", {
      method: "POST",
      body: JSON.stringify({
        plate: el.vehiclePlate.value.trim(),
        unitNumber: el.vehicleUnit.value.trim(),
        mileage: Number(el.vehicleMileage.value || "0"),
      }),
    });
    el.vehiclePlate.value = "";
    el.vehicleUnit.value = "";
    el.vehicleMileage.value = "";
    await loadDashboard();
  } catch (err) {
    setMessage(el.dataMsg, err.message, true);
  }
});

el.createTripBtn.addEventListener("click", async () => {
  try {
    await api("/api/trips", {
      method: "POST",
      body: JSON.stringify({
        vehicleId: el.tripVehicle.value.trim(),
        driverId: el.tripDriver.value.trim(),
        origin: el.tripOrigin.value.trim(),
        destination: el.tripDestination.value.trim(),
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    });
    await loadDashboard();
  } catch (err) {
    setMessage(el.dataMsg, err.message, true);
  }
});

el.tripsTable.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || !target.classList.contains("js-trip")) return;

  const op = target.dataset.op;
  const id = target.dataset.id;
  if (!op || !id) return;

  try {
    await api(`/api/trips/${id}/${op}`, { method: "POST" });
    await loadDashboard();
  } catch (err) {
    setMessage(el.dataMsg, err.message, true);
  }
});

function initAuthed() {
  setAuthVisible(true);
  el.welcome.textContent = `Welcome, ${state.user?.name || "Operator"}`;
  el.tokenHint.textContent = `Role: ${state.user?.role || "unknown"}`;
  loadDashboard();
}

if (state.token && state.user) {
  initAuthed();
} else {
  setAuthVisible(false);
}
