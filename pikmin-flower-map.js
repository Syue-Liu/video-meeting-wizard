const storageKey = "pikmin-big-flower-map-v1";
const syncStorageKey = "pikmin-big-flower-sync-v1";
const defaultSyncScriptUrl = "https://script.google.com/macros/s/AKfycbzE76ta4_CqygzkmMqjcditxU8i_fiD4EdhdvcXPS-pVL0eSypiG8vMF7-nVWo_L3969Q/exec";
const routeFactor = 1.25;
const urgentMinutes = 30;
const maxGoogleStops = 10;

const travelModes = {
  walking: { label: "步行", speedKmh: 4.8, googleMode: "walking" },
  bicycling: { label: "腳踏車", speedKmh: 13, googleMode: "bicycling" },
  scooter: { label: "騎車", speedKmh: 24, googleMode: "driving" },
  driving: { label: "開車", speedKmh: 28, googleMode: "driving" },
};

const flowerTypes = [
  "一般花",
  "玫瑰",
  "鬱金香",
  "百合",
  "康乃馨",
  "風信子",
  "菊花",
  "牡丹",
  "櫻花",
  "梅花",
  "繡球花",
  "雞冠花",
  "萬壽菊",
  "其他",
];

const colorClass = {
  "白色": "white",
  "紅色": "red",
  "黃色": "yellow",
  "藍色": "blue",
};

const state = {
  flowers: loadFlowers(),
  userLocation: null,
  syncSettings: loadSyncSettings(),
};

const els = {
  mapsInput: document.querySelector("#mapsInput"),
  nameInput: document.querySelector("#nameInput"),
  colorInput: document.querySelector("#colorInput"),
  typeInput: document.querySelector("#typeInput"),
  hoursInput: document.querySelector("#hoursInput"),
  minutesInput: document.querySelector("#minutesInput"),
  noteInput: document.querySelector("#noteInput"),
  addButton: document.querySelector("#addButton"),
  clearExpiredButton: document.querySelector("#clearExpiredButton"),
  locateButton: document.querySelector("#locateButton"),
  syncNowButton: document.querySelector("#syncNowButton"),
  exportButton: document.querySelector("#exportButton"),
  fitButton: document.querySelector("#fitButton"),
  travelModeInput: document.querySelector("#travelModeInput"),
  filterInput: document.querySelector("#filterInput"),
  selectedRouteSummary: document.querySelector("#selectedRouteSummary"),
  selectedRouteHint: document.querySelector("#selectedRouteHint"),
  selectReachableButton: document.querySelector("#selectReachableButton"),
  clearRouteButton: document.querySelector("#clearRouteButton"),
  planRouteButton: document.querySelector("#planRouteButton"),
  flowerList: document.querySelector("#flowerList"),
  mapCanvas: document.querySelector("#mapCanvas"),
  mapCaption: document.querySelector("#mapCaption"),
  totalCount: document.querySelector("#totalCount"),
  readyCount: document.querySelector("#readyCount"),
  urgentCount: document.querySelector("#urgentCount"),
  reachableCount: document.querySelector("#reachableCount"),
  nearestDistance: document.querySelector("#nearestDistance"),
  nearestLabel: document.querySelector("#nearestLabel"),
  syncUrlInput: document.querySelector("#syncUrlInput"),
  reporterInput: document.querySelector("#reporterInput"),
  saveSyncButton: document.querySelector("#saveSyncButton"),
  pullSyncButton: document.querySelector("#pullSyncButton"),
  syncSummary: document.querySelector("#syncSummary"),
  syncHint: document.querySelector("#syncHint"),
  template: document.querySelector("#flowerTemplate"),
  inputHint: document.querySelector("#inputHint"),
};

function fillTypeSelect(select, selected = "一般花") {
  select.innerHTML = flowerTypes
    .map((type) => `<option${type === selected ? " selected" : ""}>${escapeHtml(type)}</option>`)
    .join("");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function loadFlowers() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveFlowers() {
  localStorage.setItem(storageKey, JSON.stringify(state.flowers));
}

function loadSyncSettings() {
  try {
    return JSON.parse(localStorage.getItem(syncStorageKey)) || { scriptUrl: defaultSyncScriptUrl, reporter: "" };
  } catch {
    return { scriptUrl: defaultSyncScriptUrl, reporter: "" };
  }
}

function saveSyncSettings() {
  localStorage.setItem(syncStorageKey, JSON.stringify(state.syncSettings));
}

function parseLocation(text) {
  const raw = text.trim();
  if (!raw) return null;

  const direct = raw.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (direct) return toLocation(direct[1], direct[2]);

  const decoded = safeDecode(raw);
  const atMatch = decoded.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (atMatch) return toLocation(atMatch[1], atMatch[2]);

  const bangMatch = decoded.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (bangMatch) return toLocation(bangMatch[1], bangMatch[2]);

  const queryMatch = decoded.match(/[?&](?:q|query|ll)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (queryMatch) return toLocation(queryMatch[1], queryMatch[2]);

  return null;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toLocation(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { lat: latitude, lng: longitude };
}

function addFlower() {
  const location = parseLocation(els.mapsInput.value);
  if (!location) {
    els.inputHint.textContent = "我抓不到座標。請貼完整 Google Maps 網址，或直接輸入像 25.033964, 121.564468 這樣的座標。";
    els.inputHint.classList.add("warning");
    return;
  }

  const remaining = Math.max(0, Number(els.hoursInput.value || 0) * 60 + Number(els.minutesInput.value || 0));
  const now = Date.now();
  const flower = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(now),
    name: els.nameInput.value.trim() || makeDefaultName(location),
    lat: location.lat,
    lng: location.lng,
    color: els.colorInput.value,
    type: els.typeInput.value,
    note: els.noteInput.value.trim(),
    claimed: false,
    createdAt: now,
    bloomEndsAt: now + remaining * 60 * 1000,
  };

  state.flowers.unshift(flower);
  saveFlowers();
  syncFlower(flower);
  clearInputs();
  render();
}

function makeDefaultName(location) {
  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
}

function clearInputs() {
  els.mapsInput.value = "";
  els.nameInput.value = "";
  els.noteInput.value = "";
  els.hoursInput.value = "3";
  els.minutesInput.value = "0";
  els.inputHint.textContent = "短網址如果抓不到座標，請先打開連結，再複製瀏覽器網址列中的完整 Google Maps 網址。";
  els.inputHint.classList.remove("warning");
}

function minutesLeft(flower) {
  return Math.max(0, Math.ceil((flower.bloomEndsAt - Date.now()) / 60000));
}

function getFlowerState(flower) {
  const left = minutesLeft(flower);
  if (left <= 0) return { label: "已過期", className: "expired", rank: 4 };
  if (flower.claimed) return { label: "已採果", className: "claimed", rank: 3 };
  if (left <= urgentMinutes) return { label: "快結束", className: "urgent", rank: 0 };
  return { label: "可採", className: "ready", rank: 1 };
}

function distanceKm(a, b) {
  if (!a || !b) return null;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function routeInfo(flower) {
  const direct = distanceKm(state.userLocation, flower);
  if (direct === null) {
    return { distanceKm: null, minutes: null, reachable: null };
  }
  const mode = getTravelMode();
  const estimatedKm = direct * routeFactor;
  const minutes = Math.ceil((estimatedKm / mode.speedKmh) * 60);
  return {
    distanceKm: estimatedKm,
    minutes,
    reachable: minutes + 5 <= minutesLeft(flower),
  };
}

function getTravelMode() {
  return travelModes[els.travelModeInput.value] || travelModes.walking;
}

function formatTime(minutes) {
  if (minutes <= 0) return "0 分";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} 分`;
  return mins ? `${hours} 時 ${mins} 分` : `${hours} 時`;
}

function formatDistance(km) {
  if (km === null || !Number.isFinite(km)) return "待定位";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

function sortedFlowers() {
  const filter = els.filterInput.value;
  return [...state.flowers]
    .filter((flower) => {
      const left = minutesLeft(flower);
      if (filter === "active") return left > 0;
      if (filter === "unclaimed") return left > 0 && !flower.claimed;
      return true;
    })
    .sort((a, b) => {
      const routeA = routeInfo(a);
      const routeB = routeInfo(b);
      if (state.userLocation) {
        return (
          (routeA.distanceKm ?? 99999) - (routeB.distanceKm ?? 99999) ||
          minutesLeft(a) - minutesLeft(b)
        );
      }
      const stateA = getFlowerState(a);
      const stateB = getFlowerState(b);
      return (
        stateA.rank - stateB.rank ||
        minutesLeft(a) - minutesLeft(b) ||
        (routeA.minutes ?? 99999) - (routeB.minutes ?? 99999)
      );
    });
}

function render() {
  renderSummary();
  renderSyncStatus();
  renderRouteBasket();
  renderMap();
  renderList();
}

function renderSyncStatus() {
  els.syncUrlInput.value = state.syncSettings.scriptUrl || "";
  els.reporterInput.value = state.syncSettings.reporter || "";
  els.syncSummary.textContent = state.syncSettings.scriptUrl
    ? `已連到共享表${state.syncSettings.reporter ? `，${state.syncSettings.reporter}` : ""}`
    : "尚未設定同步";
}

function renderRouteBasket() {
  const selected = orderedRouteFlowers();
  const total = routeTotals(selected);
  els.selectedRouteSummary.textContent = `${selected.length} 朵${total.minutes ? `，約 ${formatTime(total.minutes)}` : ""}`;
  els.selectedRouteHint.textContent = routeBasketHint(selected, total);
  els.planRouteButton.disabled = selected.length === 0;
}

function routeBasketHint(selected, total) {
  if (!selected.length) return "勾選想去的花點，再交給 Google Maps 導航。";
  if (!state.userLocation) return "尚未定位；Google Maps 會用目前位置嘗試導航，建議先按上方定位。";
  const limited = selected.length > maxGoogleStops ? `；會先帶前 ${maxGoogleStops} 朵進 Google Maps` : "";
  return `依近到遠規劃，總距離約 ${formatDistance(total.distanceKm)}${limited}。`;
}

function renderSummary() {
  const active = state.flowers.filter((flower) => minutesLeft(flower) > 0 && !flower.claimed);
  const urgent = active.filter((flower) => minutesLeft(flower) <= urgentMinutes);
  const activeWithRoutes = active.map((flower) => ({ flower, route: routeInfo(flower) }));
  const reachable = activeWithRoutes.filter((item) => item.route.reachable).length;
  els.totalCount.textContent = String(state.flowers.length);
  els.readyCount.textContent = String(active.length);
  els.urgentCount.textContent = String(urgent.length);
  els.reachableCount.textContent = state.userLocation ? String(reachable) : "待定位";

  const nearest = activeWithRoutes
    .filter((item) => item.route.minutes !== null)
    .sort((a, b) => a.route.distanceKm - b.route.distanceKm)[0];

  els.nearestDistance.textContent = nearest ? formatDistance(nearest.route.distanceKm) : state.userLocation ? "無可採" : "待定位";
  els.nearestLabel.textContent = nearest
    ? `${nearest.flower.name}，約 ${nearest.route.minutes} 分`
    : state.userLocation
      ? "附近尚無可採花點"
      : "請先定位";
}

function renderMap() {
  els.mapCanvas.innerHTML = "";
  const points = [...state.flowers];
  if (state.userLocation) points.push({ ...state.userLocation, user: true, name: "你的位置" });

  if (!points.length) {
    els.mapCanvas.innerHTML = `<p class="map-empty">貼上 Google Maps 連結或座標，就可以開始做自己的巨大花朵採果地圖。</p>`;
    return;
  }

  const bounds = getBounds(points);
  els.mapCaption.textContent = state.userLocation
    ? "這是相對位置圖；實際路線請用每張卡片的導航按鈕確認。"
    : "目前尚未定位，時間會等定位後再估算。";

  points.forEach((point) => {
    const pos = projectPoint(point, bounds);
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = point.user
      ? "pin user"
      : `pin ${colorClass[point.color] || "white"} ${minutesLeft(point) <= 0 ? "expired" : ""}`;
    pin.style.left = `${pos.x}%`;
    pin.style.top = `${pos.y}%`;
    pin.title = point.name;
    pin.innerHTML = `<span>${escapeHtml(point.name)}</span>`;
    if (!point.user) {
      pin.addEventListener("click", () => {
        document.querySelector(`[data-flower-id="${point.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    els.mapCanvas.append(pin);
  });
}

function getBounds(points) {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latPad = Math.max((maxLat - minLat) * 0.18, 0.001);
  const lngPad = Math.max((maxLng - minLng) * 0.18, 0.001);
  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };
}

function projectPoint(point, bounds) {
  const x = ((point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
  const y = (1 - (point.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
  return {
    x: Math.min(94, Math.max(6, x)),
    y: Math.min(92, Math.max(8, y)),
  };
}

function renderList() {
  const flowers = sortedFlowers();
  els.flowerList.innerHTML = "";

  if (!flowers.length) {
    els.flowerList.innerHTML = `<p class="empty-list">目前沒有符合條件的花點。</p>`;
    return;
  }

  flowers.forEach((flower) => {
    const node = els.template.content.firstElementChild.cloneNode(true);
    const flowerState = getFlowerState(flower);
    const route = routeInfo(flower);
    node.dataset.flowerId = flower.id;
    node.querySelector("h3").textContent = flower.name;
    node.querySelector(".meta").textContent = `${flower.color}${flower.type} · ${flower.lat.toFixed(5)}, ${flower.lng.toFixed(5)}`;

    const pill = node.querySelector(".state-pill");
    pill.textContent = flowerState.label;
    pill.classList.add(flowerState.className);

    node.querySelector(".quick-stats").innerHTML = `
      <div><span>剩餘</span><strong>${formatTime(minutesLeft(flower))}</strong></div>
      <div><span>距離</span><strong>${route.distanceKm === null ? "待定位" : formatDistance(route.distanceKm)}</strong></div>
      <div><span>${getTravelMode().label}時間</span><strong>${route.minutes === null ? "待定位" : `${route.minutes} 分`}</strong></div>
      <div><span>判斷</span><strong>${reachLabel(route, flower)}</strong></div>
    `;

    node.querySelectorAll("select[data-field='type']").forEach((select) => fillTypeSelect(select, flower.type));
    node.querySelector("[data-field='selectedRoute']").checked = Boolean(flower.selectedRoute);
    node.querySelector("[data-field='color']").value = flower.color;
    node.querySelector("[data-field='remaining']").value = String(minutesLeft(flower));
    node.querySelector("[data-field='claimed']").value = String(flower.claimed);
    node.querySelector("[data-field='note']").value = flower.note || "";

    node.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("change", () => {
        const value = input.type === "checkbox" ? input.checked : input.value;
        updateFlower(flower.id, input.dataset.field, value);
      });
    });

    node.querySelector(".map-link").href = directionsUrl(flower);
    node.querySelector("[data-action='refresh']").addEventListener("click", () => updateFlower(flower.id, "remaining", 180));
    node.querySelector("[data-action='delete']").addEventListener("click", () => deleteFlower(flower.id));
    els.flowerList.append(node);
  });
}

function reachLabel(route, flower) {
  if (minutesLeft(flower) <= 0) return "過期";
  if (flower.claimed) return "已採";
  if (route.reachable === null) return "待定位";
  return route.reachable ? "來得及" : "可能來不及";
}

function directionsUrl(flower) {
  const destination = `${flower.lat},${flower.lng}`;
  if (state.userLocation) {
    const origin = `${state.userLocation.lat},${state.userLocation.lng}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${getTravelMode().googleMode}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${destination}`;
}

function hasSync() {
  return Boolean(state.syncSettings.scriptUrl);
}

function syncJsonp(params) {
  if (!hasSync()) return Promise.resolve({ ok: false, error: "尚未設定同步網址" });
  const callbackName = `pikminSync_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const url = new URL(state.syncSettings.scriptUrl);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("callback", callbackName);

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("同步逾時"));
    }, 12000);

    function cleanup() {
      window.clearTimeout(timeout);
      script.remove();
      delete window[callbackName];
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("同步網址讀取失敗"));
    };
    script.src = url.toString();
    document.head.append(script);
  });
}

function toSyncFlower(flower) {
  const syncFlowerData = {
    ...flower,
    reporter: state.syncSettings.reporter || flower.reporter || "",
    updatedAt: Date.now(),
  };
  delete syncFlowerData.selectedRoute;
  return syncFlowerData;
}

async function syncFlower(flower) {
  if (!hasSync()) return;
  try {
    els.syncHint.textContent = "同步中...";
    const payload = JSON.stringify(toSyncFlower(flower));
    const result = await syncJsonp({ action: "upsert", payload });
    els.syncHint.textContent = result.ok ? "已同步到共享表。" : result.error || "同步失敗。";
  } catch (error) {
    els.syncHint.textContent = error.message || "同步失敗。";
  }
}

async function deleteSyncedFlower(id) {
  if (!hasSync()) return;
  try {
    await syncJsonp({ action: "delete", id });
  } catch {
    els.syncHint.textContent = "本機已刪除，但共享表刪除失敗。";
  }
}

async function pullSharedFlowers() {
  if (!hasSync()) {
    els.syncHint.textContent = "請先貼上 Google Apps Script 網址並儲存。";
    return;
  }
  try {
    els.syncHint.textContent = "讀取大家的花點中...";
    const result = await syncJsonp({ action: "list" });
    if (!result.ok) throw new Error(result.error || "讀取失敗");
    mergeSharedFlowers(result.flowers || []);
    saveFlowers();
    render();
    els.syncHint.textContent = `已讀取 ${result.flowers.length} 個共享花點。`;
  } catch (error) {
    els.syncHint.textContent = error.message || "讀取失敗。";
  }
}

function mergeSharedFlowers(sharedFlowers) {
  const selected = new Map(state.flowers.map((flower) => [flower.id, Boolean(flower.selectedRoute)]));
  const byId = new Map(state.flowers.map((flower) => [flower.id, flower]));
  sharedFlowers.forEach((flower) => {
    if (!flower || !flower.id) return;
    byId.set(flower.id, {
      ...byId.get(flower.id),
      ...flower,
      selectedRoute: selected.get(flower.id) || false,
    });
  });
  state.flowers = [...byId.values()].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}

function saveSyncFromInputs() {
  state.syncSettings = {
    scriptUrl: els.syncUrlInput.value.trim(),
    reporter: els.reporterInput.value.trim(),
  };
  saveSyncSettings();
  renderSyncStatus();
  els.syncHint.textContent = state.syncSettings.scriptUrl ? "同步設定已儲存，現在可以讀取大家的花點。" : "已清除同步設定。";
}

function orderedRouteFlowers(flowers = state.flowers.filter((flower) => flower.selectedRoute)) {
  const active = flowers.filter((flower) => minutesLeft(flower) > 0 && !flower.claimed);
  if (!state.userLocation || active.length <= 1) {
    return [...active].sort((a, b) => (routeInfo(a).distanceKm ?? 99999) - (routeInfo(b).distanceKm ?? 99999));
  }

  const remaining = [...active];
  const ordered = [];
  let current = state.userLocation;
  while (remaining.length) {
    remaining.sort((a, b) => distanceKm(current, a) - distanceKm(current, b));
    const next = remaining.shift();
    ordered.push(next);
    current = next;
  }
  return ordered;
}

function routeTotals(flowers) {
  if (!state.userLocation || !flowers.length) return { distanceKm: null, minutes: null };
  let current = state.userLocation;
  let totalKm = 0;
  flowers.forEach((flower) => {
    totalKm += (distanceKm(current, flower) || 0) * routeFactor;
    current = flower;
  });
  const minutes = Math.ceil((totalKm / getTravelMode().speedKmh) * 60);
  return { distanceKm: totalKm, minutes };
}

function routePlanUrl() {
  const flowers = orderedRouteFlowers().slice(0, maxGoogleStops);
  if (!flowers.length) return "";
  const destinationFlower = flowers.at(-1);
  const params = new URLSearchParams({
    api: "1",
    destination: `${destinationFlower.lat},${destinationFlower.lng}`,
    travelmode: getTravelMode().googleMode,
  });
  if (state.userLocation) {
    params.set("origin", `${state.userLocation.lat},${state.userLocation.lng}`);
  }
  const waypoints = flowers.slice(0, -1).map((flower) => `${flower.lat},${flower.lng}`).join("|");
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function openRoutePlan() {
  const url = routePlanUrl();
  if (!url) {
    els.selectedRouteHint.textContent = "請先勾選至少一朵還沒過期、還沒採果的花點。";
    return;
  }
  window.open(url, "_blank", "noreferrer");
}

function selectReachableFlowers() {
  state.flowers = state.flowers.map((flower) => ({
    ...flower,
    selectedRoute: minutesLeft(flower) > 0 && !flower.claimed && (!state.userLocation || routeInfo(flower).reachable !== false),
  }));
  saveFlowers();
  render();
}

function clearRouteSelection() {
  state.flowers = state.flowers.map((flower) => ({ ...flower, selectedRoute: false }));
  saveFlowers();
  render();
}

function updateFlower(id, field, value) {
  const flower = state.flowers.find((item) => item.id === id);
  if (!flower) return;

  if (field === "remaining") {
    flower.bloomEndsAt = Date.now() + Math.max(0, Number(value || 0)) * 60 * 1000;
  } else if (field === "claimed") {
    flower.claimed = value === "true";
    if (flower.claimed) flower.selectedRoute = false;
  } else if (field === "selectedRoute") {
    flower.selectedRoute = Boolean(value);
  } else {
    flower[field] = value;
  }

  saveFlowers();
  if (field !== "selectedRoute") syncFlower(flower);
  render();
}

function deleteFlower(id) {
  state.flowers = state.flowers.filter((flower) => flower.id !== id);
  saveFlowers();
  deleteSyncedFlower(id);
  render();
}

function clearExpired() {
  const expired = state.flowers.filter((flower) => minutesLeft(flower) <= 0);
  state.flowers = state.flowers.filter((flower) => minutesLeft(flower) > 0);
  saveFlowers();
  expired.forEach((flower) => deleteSyncedFlower(flower.id));
  render();
}

function locateUser() {
  if (!navigator.geolocation) {
    els.nearestLabel.textContent = "瀏覽器不支援定位";
    return;
  }

  els.nearestLabel.textContent = "定位中...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      render();
    },
    () => {
      els.nearestLabel.textContent = "定位失敗";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
  );
}

function exportData() {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), flowers: state.flowers }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pikmin-big-flowers-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  els.addButton.addEventListener("click", addFlower);
  els.clearExpiredButton.addEventListener("click", clearExpired);
  els.locateButton.addEventListener("click", locateUser);
  els.syncNowButton.addEventListener("click", pullSharedFlowers);
  els.exportButton.addEventListener("click", exportData);
  els.fitButton.addEventListener("click", renderMap);
  els.travelModeInput.addEventListener("change", render);
  els.filterInput.addEventListener("change", renderList);
  els.selectReachableButton.addEventListener("click", selectReachableFlowers);
  els.clearRouteButton.addEventListener("click", clearRouteSelection);
  els.planRouteButton.addEventListener("click", openRoutePlan);
  els.saveSyncButton.addEventListener("click", saveSyncFromInputs);
  els.pullSyncButton.addEventListener("click", pullSharedFlowers);

  els.mapsInput.addEventListener("paste", () => {
    window.setTimeout(() => {
      const location = parseLocation(els.mapsInput.value);
      if (location && !els.nameInput.value.trim()) {
        els.nameInput.value = makeDefaultName(location);
      }
    }, 0);
  });
}

fillTypeSelect(els.typeInput);
bindEvents();
render();
if (hasSync()) pullSharedFlowers();
window.setInterval(render, 30000);
window.setInterval(() => {
  if (hasSync()) pullSharedFlowers();
}, 90000);
