// =============================================================================
// OctoSky — Embeddable Weather Widget  (widget.js)
// =============================================================================
// USAGE:
//   <script src="https://YOUR_SERVER/widget.js"></script>
//   — or include inline in any HTML page.
//
// FEATURES:
//   • Floating "Weather" button (bottom-right).
//   • Modern popup with search-to-filter.
//   • Displays city, condition, temps, and AI suggestion.
//   • Graceful Loading / Error / Empty states.
//   • Fully self-contained — no external CSS or JS dependencies.
// =============================================================================

(function () {
  "use strict";

  // -----------------------------------------------------------------------
  // Configuration — change the URL to your server's public IP or domain.
  // -----------------------------------------------------------------------
  const CONFIG = {
    dataUrl: "https://YOUR_SERVER_IP/weather.json",
    refreshIntervalMs: 5 * 60 * 1000, // auto-refresh every 5 min
    maxResults: 200,
  };

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let weatherData = null;
  let isOpen = false;
  let searchTerm = "";
  let isLoading = false;
  let errorMsg = "";
  let refreshTimer = null;

  // -----------------------------------------------------------------------
  // Styles — injected once into the <head>.
  // -----------------------------------------------------------------------
  const STYLES = `
    /* ---- Floating Action Button ---- */
    #octosky-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #fff;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(99,102,241,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #octosky-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 20px rgba(99,102,241,0.55);
    }

    /* ---- Popup Container ---- */
    #octosky-popup {
      position: fixed;
      bottom: 92px;
      right: 24px;
      z-index: 99998;
      width: 380px;
      max-height: 520px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.18);
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      animation: octosky-slideUp 0.25s ease-out;
    }
    #octosky-popup.open { display: flex; }

    @keyframes octosky-slideUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ---- Header ---- */
    .octosky-header {
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #fff;
      padding: 16px 20px 12px;
    }
    .octosky-header h2 {
      margin: 0 0 4px;
      font-size: 1.1rem;
      font-weight: 700;
    }
    .octosky-header small {
      opacity: 0.8;
      font-size: 0.75rem;
    }

    /* ---- Search ---- */
    .octosky-search {
      padding: 10px 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    .octosky-search input {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s;
    }
    .octosky-search input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
    }

    /* ---- Card List ---- */
    .octosky-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px 12px;
    }
    .octosky-card {
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 8px;
      transition: border-color 0.15s;
    }
    .octosky-card:hover {
      border-color: #a5b4fc;
    }
    .octosky-card-city {
      font-weight: 600;
      font-size: 0.95rem;
      color: #1e293b;
    }
    .octosky-card-cond {
      font-size: 0.8rem;
      color: #6366f1;
      margin-top: 2px;
    }
    .octosky-card-temps {
      display: flex;
      gap: 12px;
      margin-top: 6px;
      font-size: 0.8rem;
      color: #475569;
    }
    .octosky-card-temps span {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .octosky-card-suggestion {
      margin-top: 8px;
      padding: 6px 10px;
      background: #eef2ff;
      border-left: 3px solid #6366f1;
      border-radius: 4px;
      font-size: 0.78rem;
      color: #4338ca;
      line-height: 1.35;
    }

    /* ---- States ---- */
    .octosky-state {
      padding: 32px 20px;
      text-align: center;
      color: #94a3b8;
      font-size: 0.9rem;
    }
    .octosky-state.error { color: #ef4444; }
    .octosky-spinner {
      width: 28px; height: 28px;
      border: 3px solid #e5e7eb;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: octosky-spin 0.7s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes octosky-spin {
      to { transform: rotate(360deg); }
    }

    /* ---- Footer ---- */
    .octosky-footer {
      padding: 6px 16px 8px;
      text-align: center;
      font-size: 0.65rem;
      color: #94a3b8;
      border-top: 1px solid #e5e7eb;
    }

    /* ---- Responsive ---- */
    @media (max-width: 440px) {
      #octosky-popup {
        right: 8px;
        left: 8px;
        width: auto;
        bottom: 88px;
        max-height: 70vh;
      }
    }
  `;

  // -----------------------------------------------------------------------
  // Inject Styles
  // -----------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("octosky-styles")) return;
    const style = document.createElement("style");
    style.id = "octosky-styles";
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  // -----------------------------------------------------------------------
  // Build DOM
  // -----------------------------------------------------------------------
  function buildWidget() {
    // Floating Action Button
    const fab = document.createElement("button");
    fab.id = "octosky-fab";
    fab.innerHTML = "☁️";
    fab.title = "Hava Durumu";
    fab.addEventListener("click", togglePopup);
    document.body.appendChild(fab);

    // Popup
    const popup = document.createElement("div");
    popup.id = "octosky-popup";
    popup.innerHTML = `
      <div class="octosky-header">
        <h2>🌤️ OctoSky Hava Durumu</h2>
        <small id="octosky-updated"></small>
      </div>
      <div class="octosky-search">
        <input id="octosky-search-input" type="text" placeholder="Şehir ara…" autocomplete="off" />
      </div>
      <div class="octosky-list" id="octosky-list"></div>
      <div class="octosky-footer">Powered by OctoSky · Project Orca</div>
    `;
    document.body.appendChild(popup);

    // Search handler
    document
      .getElementById("octosky-search-input")
      .addEventListener("input", (e) => {
        searchTerm = e.target.value.trim().toLowerCase();
        renderList();
      });
  }

  // -----------------------------------------------------------------------
  // Toggle
  // -----------------------------------------------------------------------
  function togglePopup() {
    isOpen = !isOpen;
    const popup = document.getElementById("octosky-popup");
    if (isOpen) {
      popup.classList.add("open");
      fetchWeather();
    } else {
      popup.classList.remove("open");
    }
  }

  // -----------------------------------------------------------------------
  // Fetch Data
  // -----------------------------------------------------------------------
  async function fetchWeather() {
    isLoading = true;
    errorMsg = "";
    renderList();

    try {
      const res = await fetch(CONFIG.dataUrl, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      weatherData = await res.json();
    } catch (err) {
      errorMsg = `Veri yüklenemedi: ${err.message}`;
      weatherData = null;
    } finally {
      isLoading = false;
      renderList();
      renderUpdatedTime();
    }
  }

  // -----------------------------------------------------------------------
  // Render City Cards
  // -----------------------------------------------------------------------
  function renderList() {
    const container = document.getElementById("octosky-list");
    if (!container) return;

    // Loading state
    if (isLoading) {
      container.innerHTML = `
        <div class="octosky-state">
          <div class="octosky-spinner"></div>
          Hava durumu yükleniyor…
        </div>`;
      return;
    }

    // Error state
    if (errorMsg) {
      container.innerHTML = `
        <div class="octosky-state error">
          ⚠️ ${escapeHtml(errorMsg)}
        </div>`;
      return;
    }

    // No data
    if (!weatherData || !weatherData.cities || weatherData.cities.length === 0) {
      container.innerHTML = `
        <div class="octosky-state">Henüz veri yok.</div>`;
      return;
    }

    // Filter
    let cities = weatherData.cities;
    if (searchTerm) {
      cities = cities.filter((c) =>
        (c.city || "").toLowerCase().includes(searchTerm)
      );
    }

    if (cities.length === 0) {
      container.innerHTML = `
        <div class="octosky-state">"${escapeHtml(searchTerm)}" için sonuç bulunamadı.</div>`;
      return;
    }

    // Render cards
    const html = cities
      .slice(0, CONFIG.maxResults)
      .map(
        (c) => `
      <div class="octosky-card">
        <div class="octosky-card-city">${escapeHtml(c.city)}</div>
        <div class="octosky-card-cond">${escapeHtml(c.condition || "—")}</div>
        <div class="octosky-card-temps">
          <span>🌡️ Gündüz: <strong>${escapeHtml(c.tempDay || "?")}</strong>°C</span>
          <span>🌙 Gece: <strong>${escapeHtml(c.tempNight || "?")}</strong>°C</span>
        </div>
        ${
          c.suggestion
            ? `<div class="octosky-card-suggestion">💡 ${escapeHtml(c.suggestion)}</div>`
            : ""
        }
      </div>`
      )
      .join("");

    container.innerHTML = html;
  }

  // -----------------------------------------------------------------------
  // Updated Timestamp
  // -----------------------------------------------------------------------
  function renderUpdatedTime() {
    const el = document.getElementById("octosky-updated");
    if (!el || !weatherData) return;
    const ts = weatherData.generatedAt || weatherData.scrapedAt;
    if (ts) {
      const d = new Date(ts);
      el.textContent = `Son güncelleme: ${d.toLocaleString("tr-TR")}`;
    }
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // -----------------------------------------------------------------------
  // Auto-Refresh
  // -----------------------------------------------------------------------
  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (isOpen) fetchWeather();
    }, CONFIG.refreshIntervalMs);
  }

  // -----------------------------------------------------------------------
  // Init — runs when the script loads.
  // -----------------------------------------------------------------------
  function init() {
    injectStyles();
    buildWidget();
    startAutoRefresh();
  }

  // Wait for DOM readiness.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
