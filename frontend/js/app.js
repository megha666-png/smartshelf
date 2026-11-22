import { API } from "./api.js";

// Global Application State
const state = {
  activeTab: "dashboard",
  theme: localStorage.getItem("smartshelf_theme") || "light",
  currentCategory: "All",
  products: [],
  household: null,
  analysis: null,
  expenditure: null,
  notifications: [],
  userName: localStorage.getItem("smartshelf_user_name") || "Alex Sharma",
  userEmail: "alex@smartshelf.io",
  userAvatar: localStorage.getItem("smartshelf_user_avatar") || null,
  cameraStream: null,
  cameraFacingMode: "environment",
  scanMode: "product", // 'product' (auto-categorize) or 'ingredients'
  deferredInstallPrompt: null,
  currency: localStorage.getItem("smartshelf_currency") || "₹",
  expenditureHistory: null,
  selectedMonthlyHistoryKey: null,
  selectionMode: false,
  selectedProductIds: new Set(),
  inStockSearchQuery: "",
  inventorySort: localStorage.getItem("smartshelf_inv_sort") || "name-asc",
  customCategories: JSON.parse(localStorage.getItem("smartshelf_custom_categories") || '["Personal Care", "Cosmetics", "Medicines & Supplements", "Cleaning", "Household"]'),
  isMenuOpen: false
};

// Application Initialization
document.addEventListener("DOMContentLoaded", async () => {
  setupTheme();
  setupNavigation();
  setupModals();
  setupPWA();
  renderProfileData();
  await loadInitialData();
});

// -------------------------------------------------------------
// PWA & ANDROID INSTALLATION
// -------------------------------------------------------------
function setupPWA() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
  });
}

window.triggerPWAInstall = async function() {
  if (state.deferredInstallPrompt) {
    state.deferredInstallPrompt.prompt();
    const { outcome } = await state.deferredInstallPrompt.userChoice;
    console.log(`PWA install prompt outcome: ${outcome}`);
    state.deferredInstallPrompt = null;
  } else {
    alert("SmartShelf is ready to install! In your Android browser, tap the three dots (⋮) in the top-right corner and select 'Add to Home screen' or 'Install App'.");
  }
};

// -------------------------------------------------------------
// THEME & NAVIGATION
// -------------------------------------------------------------
function setupTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  const themeBtn = document.getElementById("themeToggleBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      state.theme = state.theme === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", state.theme);
      localStorage.setItem("smartshelf_theme", state.theme);
    });
  }
}

function setupNavigation() {
  const tabs = document.querySelectorAll(".nav-tab[data-tab]");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");
      switchTab(target);
    });
  });
}

export function switchTab(tabId) {
  // If moving away from scanner tab, turn off camera hardware
  if (state.activeTab === "scan" && tabId !== "scan") {
    stopCameraStream();
  }

  state.activeTab = tabId;
  document.querySelectorAll(".nav-tab").forEach(t => {
    t.classList.toggle("active", t.getAttribute("data-tab") === tabId);
  });
  document.querySelectorAll(".screen-view").forEach(v => {
    v.classList.remove("active");
  });
  const activeView = document.getElementById(`view-${tabId}`);
  if (activeView) activeView.classList.add("active");

  // Tab specific lifecycle handlers
  if (tabId === "dashboard") renderDashboard();
  if (tabId === "inventory") renderInventory();
  if (tabId === "scan") startCameraScanner();
  if (tabId === "ai-analysis") renderAiAnalysis();
  if (tabId === "monthly-history") renderMonthlyHistory();
  if (tabId === "profile") renderProfileData();
}

async function loadInitialData() {
  try {
    const [hh, prods, analysis, notifs, expenditure] = await Promise.all([
      API.getHousehold(1),
      API.getProducts("All"),
      API.getAnalysisOverview(),
      API.getNotifications(),
      API.getMonthlyExpenditure(1)
    ]);
    state.household = hh;
    state.products = prods;
    state.analysis = analysis;
    state.notifications = notifs;
    state.expenditure = expenditure;

    updateHouseholdUI();
    renderDashboard();
    renderInventory();
    setupEventListeners();
  } catch (err) {
    console.error("Failed to load initial SmartShelf data:", err);
  }
}

function updateHouseholdUI() {
  const hhName = document.getElementById("hhNameDisplay");
  if (hhName && state.household) {
    hhName.textContent = state.household.name;
  }
  const notifBadge = document.getElementById("notifBadge");
  if (notifBadge) {
    const unread = state.notifications.filter(n => !n.is_read).length;
    notifBadge.style.display = unread > 0 ? "block" : "none";
  }
}

// -------------------------------------------------------------
// 1. DASHBOARD VIEW (Clean Minimalist Layout)
// -------------------------------------------------------------
function renderDashboard() {
  const container = document.getElementById("view-dashboard");
  if (!container || !state.analysis) return;

  const attentionItems = state.analysis.attention_items || [];
  const avoidedSpend = state.analysis.total_avoided_spend || 1247;
  const recentProducts = state.products.slice(0, 4);
  const exp = state.expenditure || {
    spending: 3660,
    money_saved: avoidedSpend,
    money_consumed: 6485,
    waste_value: 650,
    wasted_items: [],
    potential_savings: avoidedSpend,
    unnecessary_purchases: [],
    monthly_usage: { units_consumed_this_month: 20, currently_in_use_units: 4, unopened_backup_units: 4 }
  };

  container.innerHTML = `
    <!-- Header Greeting Card -->
    <div class="brand-hero-card">
      <div class="brand-hero-title">Welcome home</div>
      <p class="brand-hero-sub">
        ${state.products.length} products tracked • ${exp.monthly_usage?.currently_in_use_units || 4} in use
      </p>
      <div style="display: flex; gap: 8px; margin-top: 14px;">
        <button class="btn-primary" style="flex: 1; padding: 10px;" onclick="window.openAddProductModal()">
          + Add Product
        </button>
        <button class="btn-secondary" style="flex: 1; padding: 10px;" onclick="window.switchTab('scan')">
          Scan
        </button>
      </div>
    </div>

    <!-- Monthly Summary Spotlight -->
    <div class="card-base" style="cursor: pointer; border-left: 4px solid var(--color-periwinkle-amethyst); margin-bottom: 14px;" onclick="window.switchTab('monthly-history')">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <div style="font-size: 13px; font-weight: 800; color: var(--text-main);">Monthly Overview</div>
          <div style="font-size: 11px; color: var(--text-muted);">${exp.month_label || 'Current Month'}</div>
        </div>
        <span style="font-size: 11px; font-weight: 700; color: var(--color-periwinkle-amethyst);">
          History ›
        </span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
        <div style="background: var(--bg-subtle); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
          <div style="font-size: 10px; font-weight: 700; color: var(--color-periwinkle-amethyst); text-transform: uppercase;">Saved</div>
          <div style="font-size: 16px; font-weight: 800; color: var(--color-periwinkle-amethyst); margin-top: 2px;">
            ${state.currency} ${exp.money_saved}
          </div>
        </div>
        <div style="background: var(--bg-subtle); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
          <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Spent</div>
          <div style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-top: 2px;">
            ${state.currency} ${exp.spending}
          </div>
        </div>
        <div style="background: var(--bg-subtle); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
          <div style="font-size: 10px; font-weight: 700; color: var(--color-muted-rose-currant); text-transform: uppercase;">Wasted</div>
          <div style="font-size: 16px; font-weight: 800; color: var(--color-muted-rose-currant); margin-top: 2px;">
            ${state.currency} ${exp.waste_value}
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Insights -->
    <div class="risk-savings-card">
      <div class="risk-savings-header">
        <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">Insights</span>
      </div>

      <!-- Attention Items -->
      <div class="risk-tile-row ${attentionItems.length > 0 ? 'tile-waste' : 'tile-ai'}" onclick="window.openAttentionItemsModal()">
        <div class="tile-left">
          <div class="tile-icon-circle">${attentionItems.length > 0 ? '!' : '✓'}</div>
          <div class="tile-content">
            <h5>${attentionItems.length > 0 ? `${attentionItems.length} item(s) need attention` : 'Stock is healthy'}</h5>
            <p>${attentionItems.length > 0 ? 'Review expiry & runway' : 'No waste risks detected'}</p>
          </div>
        </div>
        <div class="tile-chevron">›</div>
      </div>
    </div>

    <!-- Inventory Preview -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin: 16px 0 8px 0;">
      <span class="section-label" style="margin-bottom: 0;">Recent Products</span>
      <button class="link-btn" style="color: var(--color-periwinkle-amethyst); font-size: 12px; font-weight: 600;" onclick="window.switchTab('inventory')">
        View all (${state.products.length}) ›
      </button>
    </div>

    <div class="product-list" style="margin-bottom: 16px;">
      ${recentProducts.map(p => {
        const risk = p.ml_risk_level || "low";
        const runway = p.ml_supply_runway_days || 30;
        const badgeClass = risk === "high" ? "badge-high" : (risk === "medium" ? "badge-medium" : "badge-good");
        const badgeLabel = risk === "high" ? "High risk" : (risk === "medium" ? "Medium" : "Good");

        return `
          <div class="product-card" onclick="window.switchTab('inventory')">
            <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
              <div class="product-thumb">
                ${getProductMinimalIconSvg(p.name, p.category)}
              </div>
              <div class="product-meta">
                <div class="product-name">${escapeHtml(p.name)}</div>
                <div class="product-stock">~${runway}d left</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge ${badgeClass}">${badgeLabel}</span>
              <span style="color: var(--text-dim); font-size: 14px;">›</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// -------------------------------------------------------------
// PRODUCT ICON GENERATOR (Sleek Minimalist Pastel Multi-Tone Vector Icons)
// -------------------------------------------------------------
function getProductMinimalIconSvg(name, category) {
  const n = (name || "").toLowerCase();
  const c = (category || "").toLowerCase();

  // 1. Toothpaste / Dental Care (Pastel Mint & Fresh Teal)
  if (n.includes("paste") || n.includes("toothbrush") || n.includes("dental") || n.includes("oral") || n.includes("colgate") || n.includes("sensodyne")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Tube Body with subtle pastel fill -->
          <path d="M14 40h20" stroke="#0284C7" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M15 40l2-20a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6l2 20H15z" fill="#F0F9FF" stroke="#0284C7" stroke-width="2.5" stroke-linejoin="round"/>
          <!-- Pastel fresh stripe on tube -->
          <path d="M21 16h6v18h-6z" fill="#7DD3FC" opacity="0.6"/>
          <!-- Tube screw cap -->
          <rect x="20" y="8" width="8" height="6" rx="2" fill="#38BDF8" stroke="#0284C7" stroke-width="2.2"/>
          <line x1="19" y1="34" x2="29" y2="34" stroke="#0284C7" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>`;
  }

  // 2. Mouthwash (Pastel Seafoam & Sky Blue)
  if (n.includes("mouthwash") || n.includes("mouth wash") || n.includes("listerine")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #CCFBF1 0%, #99F6E4 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Bottle Body -->
          <rect x="13" y="18" width="22" height="24" rx="6" fill="#F0FDFA" stroke="#0F766E" stroke-width="2.5"/>
          <!-- Liquid Level Wave -->
          <path d="M14 28c3-2 7 2 10 0s7-2 10 0v8a5 5 0 0 1-5 5H19a5 5 0 0 1-5-5v-8z" fill="#5EEAD4" opacity="0.55"/>
          <!-- Neck & Cap -->
          <rect x="20" y="14" width="8" height="5" fill="#F0FDFA" stroke="#0F766E" stroke-width="2"/>
          <rect x="18" y="8" width="12" height="7" rx="2" fill="#2DD4BF" stroke="#0F766E" stroke-width="2.2"/>
        </svg>
      </div>`;
  }

  // 3. Shampoo & Haircare (Pastel Periwinkle & Lavender)
  if (n.includes("shampoo") || n.includes("conditioner") || n.includes("hair") || n.includes("serum")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Sleek bottle -->
          <rect x="15" y="16" width="18" height="26" rx="6" fill="#FAF5FF" stroke="#6D28D9" stroke-width="2.5"/>
          <!-- Pastel label ribbon -->
          <rect x="18" y="24" width="12" height="10" rx="3" fill="#C4B5FD" opacity="0.6"/>
          <!-- Dispenser Pump stem and spout -->
          <path d="M24 16v-6" stroke="#6D28D9" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M20 10h8a3 3 0 0 1 3 3" stroke="#6D28D9" stroke-width="2.5" stroke-linecap="round"/>
          <rect x="21" y="14" width="6" height="3" rx="1" fill="#8B5CF6"/>
        </svg>
      </div>`;
  }

  // 4. Face Wash & Cleansers (Pastel Meadow & Aloe Green)
  if (n.includes("face wash") || n.includes("cleanser") || n.includes("facewash") || n.includes("scrub") || n.includes("salicylic") || n.includes("neem") || n.includes("foam")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Squeeze tube standing inverted -->
          <path d="M14 40h20" stroke="#15803D" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M14 40L18 16a4 4 0 0 1 4-3h4a4 4 0 0 1 4 3l4 24H14z" fill="#F0FDF4" stroke="#15803D" stroke-width="2.5" stroke-linejoin="round"/>
          <!-- Pastel Leaf/Gel emblem -->
          <circle cx="24" cy="27" r="4.5" fill="#86EFAC" opacity="0.65"/>
          <!-- Flip Cap base -->
          <rect x="19" y="8" width="10" height="5" rx="2" fill="#4ADE80" stroke="#15803D" stroke-width="2.2"/>
        </svg>
      </div>`;
  }

  // 5. Moisturizer, Lotions, Petroleum Jelly & Creams (Pastel Buttercream & Soft Apricot)
  if (n.includes("moisturizer") || n.includes("cream") || n.includes("lotion") || n.includes("jelly") || n.includes("vaseline") || n.includes("gel") || n.includes("cetaphil")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Jar Pot -->
          <rect x="11" y="21" width="26" height="19" rx="6" fill="#FFFBEB" stroke="#B45309" stroke-width="2.5"/>
          <!-- Pastel Cream Band -->
          <rect x="14" y="28" width="20" height="6" rx="2" fill="#FCD34D" opacity="0.55"/>
          <!-- Wide Lid -->
          <rect x="9" y="14" width="30" height="8" rx="3.5" fill="#FBBF24" stroke="#B45309" stroke-width="2.5"/>
        </svg>
      </div>`;
  }

  // 6. Lipstick & Lip Cosmetics (Pastel Rose & Blush Pink)
  if (n.includes("lipstick") || n.includes("lip") || n.includes("lip tint") || n.includes("lip gloss") || n.includes("lip balm")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #FFE4E6 0%, #FECDD3 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Lipstick Tube Base -->
          <rect x="16" y="24" width="16" height="18" rx="3.5" fill="#FFF1F2" stroke="#BE123C" stroke-width="2.5"/>
          <line x1="16" y1="30" x2="32" y2="30" stroke="#BE123C" stroke-width="2"/>
          <!-- Inner Metallic Swivel -->
          <rect x="18" y="18" width="12" height="6" fill="#FDA4AF" stroke="#BE123C" stroke-width="2"/>
          <!-- Angled Bullet Tip -->
          <path d="M19 18V12l10-5v11H19z" fill="#FB7185" stroke="#BE123C" stroke-width="2.5" stroke-linejoin="round"/>
        </svg>
      </div>`;
  }

  // 7. Foundations, Concealers & Liquid Makeup (Pastel Peach & Warm Sand)
  if (n.includes("foundation") || n.includes("concealer") || n.includes("bb cream") || n.includes("primer") || n.includes("tint") || n.includes("beige") || n.includes("vanilla") || n.includes("fit me")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #FFEDD5 0%, #FED7AA 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Cosmetic Glass Bottle -->
          <rect x="15" y="19" width="18" height="23" rx="5" fill="#FFF7ED" stroke="#C2410C" stroke-width="2.5"/>
          <!-- Foundation Liquid Shade Layer -->
          <rect x="17" y="26" width="14" height="13" rx="3" fill="#FDBA74" opacity="0.6"/>
          <!-- Dropper / Pump Collar -->
          <rect x="19" y="13" width="10" height="7" rx="2" fill="#FB923C" stroke="#C2410C" stroke-width="2"/>
          <!-- Dropper bulb / pump button -->
          <rect x="22" y="8" width="4" height="6" rx="2" fill="#C2410C"/>
        </svg>
      </div>`;
  }

  // 8. Kajal, Eyeliner, Mascara & Eye Pencils (Pastel Lilac & Amethyst)
  if (n.includes("kajal") || n.includes("eyeliner") || n.includes("mascara") || n.includes("kohl") || n.includes("eye") || n.includes("brow")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Slim cosmetic pencil wand -->
          <path d="M10 38l4-4 20-20 4 4-20 20-4 4-4-4z" fill="#FAF5FF" stroke="#7E22CE" stroke-width="2.5" stroke-linejoin="round"/>
          <!-- Color cap -->
          <path d="M26 14l4 4 6-6a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L26 14z" fill="#C084FC" stroke="#7E22CE" stroke-width="2.2"/>
          <!-- Precision Point -->
          <path d="M10 38l2-6 4 4-6 2z" fill="#7E22CE"/>
        </svg>
      </div>`;
  }

  // 9. Compact Powder, Blush & Eyeshadow (Pastel Coral & Rosy Glow)
  if (n.includes("compact") || n.includes("powder") || n.includes("blush") || n.includes("shadow") || n.includes("palette")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #FFE4E6 0%, #FECDD3 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Compact Case -->
          <circle cx="24" cy="27" r="14" fill="#FFF1F2" stroke="#E11D48" stroke-width="2.5"/>
          <!-- Pressed Powder Cake -->
          <circle cx="24" cy="27" r="9" fill="#FDA4AF" opacity="0.6" stroke="#E11D48" stroke-width="1.8"/>
          <!-- Mirror Lid Hinge & Top Ring -->
          <path d="M16 14a13 13 0 0 1 16 0" stroke="#E11D48" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>`;
  }

  // 10. General Cosmetics Fallback (Pastel Mauve Blossom)
  if (c.includes("cosmetic") || c.includes("makeup")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <circle cx="21" cy="27" r="10" fill="#FDF2F8" stroke="#DB2777" stroke-width="2.5"/>
          <path d="M29 11l8 8" stroke="#DB2777" stroke-width="3" stroke-linecap="round"/>
          <path d="M33 7l8 8" stroke="#F472B6" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="21" cy="27" r="5" fill="#F472B6" opacity="0.5"/>
        </svg>
      </div>`;
  }

  // 11. Laundry Detergent (Pastel Cobalt & Fresh Cyan)
  if (n.includes("detergent") || n.includes("ariel") || n.includes("surf") || n.includes("tide") || n.includes("wash powder") || n.includes("laundry") || n.includes("fabric")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #E0E7FF 0%, #C7D2FE 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Laundry Jug with handle -->
          <path d="M15 19h16a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5V24a5 5 0 0 1 5-5z" fill="#EEF2FF" stroke="#4338CA" stroke-width="2.5"/>
          <!-- Handle Cutout -->
          <path d="M10 27h6v8h-6" stroke="#4338CA" stroke-width="2.5" stroke-linecap="round"/>
          <!-- Measuring Dosing Cap -->
          <path d="M20 19v-7a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v7" fill="#818CF8" stroke="#4338CA" stroke-width="2.5"/>
          <!-- Bubble emblem -->
          <circle cx="25" cy="31" r="3.5" fill="#A5B4FC" opacity="0.7"/>
        </svg>
      </div>`;
  }

  // 12. Dishwashing Gel & Surface Spray Cleaners (Pastel Emerald & Lime Mint)
  if (n.includes("vim") || n.includes("dish") || n.includes("soap") || n.includes("sponge") || n.includes("clean") || c.includes("clean")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Spray Bottle Trigger Head -->
          <path d="M19 14h10l6-4h-9v4" stroke="#047857" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M29 14v4" stroke="#047857" stroke-width="2.5"/>
          <rect x="20" y="10" width="8" height="5" rx="1" fill="#34D399" stroke="#047857" stroke-width="2"/>
          <!-- Spray Bottle Flacon Body -->
          <path d="M18 20h12l3 20a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4l3-20z" fill="#ECFDF5" stroke="#047857" stroke-width="2.5"/>
          <!-- Cleaner Fluid Level -->
          <path d="M16.5 32h15l1.5 8a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3l1.5-8z" fill="#6EE7B7" opacity="0.6"/>
        </svg>
      </div>`;
  }

  // 13. Medicine, Tablets & Health Supplements (Pastel Rose Ruby & Coral Red)
  if (n.includes("medicine") || n.includes("med") || n.includes("paracetamol") || n.includes("vitamin") || n.includes("tablet") || n.includes("capsule") || n.includes("pill") || c.includes("medicin") || c.includes("supplement")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Dual-Tone Two-Half Pill Capsule -->
          <path d="M21 13l-7 7a7 7 0 0 0 10 10l7-7-10-10z" fill="#EF4444" stroke="#B91C1C" stroke-width="2.5"/>
          <path d="M21 13l7-7a7 7 0 0 1 10 10l-7 7-10-10z" fill="#FEF2F2" stroke="#B91C1C" stroke-width="2.5"/>
          <line x1="17" y1="17" x2="31" y2="31" stroke="#B91C1C" stroke-width="2.5"/>
          <!-- Health Cross Badge -->
          <circle cx="15" cy="33" r="6.5" fill="#FCA5A5" stroke="#B91C1C" stroke-width="2"/>
          <line x1="15" y1="30" x2="15" y2="36" stroke="#B91C1C" stroke-width="2" stroke-linecap="round"/>
          <line x1="12" y1="33" x2="18" y2="33" stroke="#B91C1C" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>`;
  }

  // 14. Batteries & Household Tech (Pastel Amber Sun & Golden Energy)
  if (n.includes("batter") || n.includes("duracell") || n.includes("charger") || n.includes("bulb")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Battery Body -->
          <rect x="15" y="14" width="18" height="26" rx="4" fill="#FFFBEB" stroke="#D97706" stroke-width="2.5"/>
          <!-- Top Terminal Nub -->
          <rect x="20" y="9" width="8" height="5" rx="1.5" fill="#F59E0B" stroke="#D97706" stroke-width="2.2"/>
          <!-- Battery Charge Level Fill -->
          <rect x="17" y="27" width="14" height="11" rx="2" fill="#FCD34D" opacity="0.7"/>
          <!-- Power Plus / Energy Sign -->
          <line x1="24" y1="19" x2="24" y2="25" stroke="#D97706" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="21" y1="22" x2="27" y2="22" stroke="#D97706" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>`;
  }

  // 15. Pantry / Food / Groceries (Pastel Sage & Olive Harvest)
  if (n.includes("oil") || n.includes("sauce") || n.includes("coffee") || n.includes("tea") || n.includes("sugar") || n.includes("salt") || c.includes("pantry") || c.includes("grocer")) {
    return `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%); border-radius: var(--radius-md);">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <!-- Pantry Jar Container -->
          <rect x="14" y="17" width="20" height="24" rx="5" fill="#F8FAFC" stroke="#475569" stroke-width="2.5"/>
          <!-- Lid with seal -->
          <rect x="16" y="11" width="16" height="6" rx="2" fill="#94A3B8" stroke="#475569" stroke-width="2.2"/>
          <!-- Label -->
          <circle cx="24" cy="29" r="4.5" fill="#CBD5E1" opacity="0.6"/>
        </svg>
      </div>`;
  }

  // 16. Default Fallback (Pastel Lavender Mist Smart Shelf Unit)
  return `
    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #F1F0FB 0%, #E2E0F6 100%); border-radius: var(--radius-md);">
      <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
        <rect x="14" y="16" width="20" height="25" rx="5" fill="#FAF9FD" stroke="#5D6698" stroke-width="2.5"/>
        <path d="M19 16v-6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6" fill="#8790B7" opacity="0.5" stroke="#5D6698" stroke-width="2.2"/>
        <circle cx="24" cy="28.5" r="3.5" fill="#8790B7" opacity="0.6"/>
      </svg>
    </div>`;
}

// -------------------------------------------------------------
// 2. INVENTORY VIEW (Clean, Simple Structure with Selection, Delete & 3-Dot Menu)
// -------------------------------------------------------------
function getActiveCategories() {
  const defaults = ["Personal Care", "Cosmetics", "Medicines & Supplements", "Cleaning", "Household"];
  const list = state.customCategories && state.customCategories.length > 0 ? state.customCategories : defaults;
  return Array.from(new Set(list));
}

function sortProductsList(list, sortKey) {
  const sorted = [...list];
  switch (sortKey) {
    case "date-desc":
      // Latest Product first (newest created_at or highest id)
      return sorted.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (timeA && timeB && timeA !== timeB) return timeB - timeA;
        return (b.id || 0) - (a.id || 0);
      });
    case "date-asc":
      // Earliest Product first (oldest created_at or lowest id)
      return sorted.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (timeA && timeB && timeA !== timeB) return timeA - timeB;
        return (a.id || 0) - (b.id || 0);
      });
    case "name-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "runway-asc":
      return sorted.sort((a, b) => (a.ml_supply_runway_days || 0) - (b.ml_supply_runway_days || 0));
    case "qty-desc":
      return sorted.sort((a, b) => ((b.in_use_quantity || 0) + (b.unopened_quantity || 0)) - ((a.in_use_quantity || 0) + (a.unopened_quantity || 0)));
    case "price-desc":
      return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted;
  }
}

function renderInventory() {
  const container = document.getElementById("view-inventory");
  if (!container) return;

  const activeCategories = getActiveCategories();
  const categories = ["All", ...activeCategories];

  const filtered = state.products.filter(p => {
    if (state.currentCategory === "All") return true;
    const catLower = (p.category || "").toLowerCase();
    const currLower = state.currentCategory.toLowerCase();

    if (currLower.includes("medicine")) {
      return catLower.includes("medicine") || catLower.includes("supplement");
    }
    if (currLower === "cosmetics" || currLower === "cosmetic") {
      return catLower === "cosmetics" || catLower === "cosmetic";
    }
    return catLower === currLower;
  });

  const sortedFiltered = sortProductsList(filtered, state.inventorySort);
  const allFilteredSelected = sortedFiltered.length > 0 && sortedFiltered.every(p => state.selectedProductIds.has(p.id));

  container.innerHTML = `
    <!-- Top Action / Selection Bar -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px;">
      <div>
        <h2 style="font-size: 20px; font-weight: 800;">Inventory</h2>
        <p style="font-size: 12px; color: var(--text-muted);">
          ${state.selectionMode ? `${state.selectedProductIds.size} of ${sortedFiltered.length} selected` : `${state.products.length} items`}
        </p>
      </div>

      <div style="display: flex; gap: 6px; align-items: center; position: relative;">
        ${state.selectionMode ? `
          <button class="action-chip" style="font-size: 11px; padding: 6px 10px;" onclick="window.toggleSelectAllFiltered()">
            ${allFilteredSelected ? 'Deselect All' : 'Select All'}
          </button>
          <button class="action-chip" style="font-size: 11px; padding: 6px 10px; background: rgba(239,68,68,0.15); color: #EF4444; border-color: rgba(239,68,68,0.3);" onclick="window.deleteSelectedProducts()" ${state.selectedProductIds.size === 0 ? 'disabled style="opacity: 0.5;"' : ''}>
            Delete (${state.selectedProductIds.size})
          </button>
          <button class="action-chip" style="font-size: 11px; padding: 6px 10px;" onclick="window.exitSelectionMode()">
            Done
          </button>
        ` : `
          <button class="action-chip" style="font-size: 11px; padding: 6px 10px;" onclick="window.enterSelectionMode()" title="Select multiple items to delete">
            Select
          </button>
          <button class="btn-primary" style="width: auto; padding: 7px 14px; font-size: 12px; border-radius: var(--radius-full);" onclick="window.openAddProductModal()">
            + Add
          </button>
          <!-- 3-Dots Menu Trigger -->
          <button 
            id="invOptionsBtn"
            class="action-chip" 
            style="padding: 6px 9px; font-size: 15px; font-weight: 800; border-radius: var(--radius-sm); line-height: 1;"
            onclick="event.stopPropagation(); window.toggleInventoryOptionsMenu()"
            title="Options (Sort, Add & Edit Categories)"
          >
            ⋮
          </button>

          <!-- Dropdown Menu -->
          <div 
            id="invOptionsMenu" 
            style="display: ${state.isMenuOpen ? 'block' : 'none'}; position: absolute; right: 0; top: calc(100% + 6px); background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); box-shadow: var(--shadow-md); z-index: 100; min-width: 185px; padding: 6px 0;"
            onclick="event.stopPropagation();"
          >
            <div 
              style="padding: 9px 14px; font-size: 12px; font-weight: 600; color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 8px;"
              onmouseover="this.style.background='var(--bg-subtle)'"
              onmouseout="this.style.background='none'"
              onclick="window.openSortModal()"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="14" y2="12"></line><line x1="4" y1="18" x2="8" y2="18"></line></svg>
              <span>Sort Products</span>
            </div>
            <div 
              style="padding: 9px 14px; font-size: 12px; font-weight: 600; color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 8px;"
              onmouseover="this.style.background='var(--bg-subtle)'"
              onmouseout="this.style.background='none'"
              onclick="window.openAddCategoryModal()"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
              <span>Add Category</span>
            </div>
            <div 
              style="padding: 9px 14px; font-size: 12px; font-weight: 600; color: var(--text-main); cursor: pointer; display: flex; align-items: center; gap: 8px;"
              onmouseover="this.style.background='var(--bg-subtle)'"
              onmouseout="this.style.background='none'"
              onclick="window.openEditCategoriesModal()"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
              <span>Edit Category Names</span>
            </div>
          </div>
        `}
      </div>
    </div>

    <div class="search-box">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <input type="text" id="inventorySearchInput" placeholder="Search..." oninput="window.handleInventorySearch(this.value)">
    </div>

    <div class="filter-scroll">
      ${categories.map(cat => `
        <button class="filter-pill ${state.currentCategory === cat ? 'active' : ''}" onclick="window.setCategoryFilter('${cat}')">
          ${cat}
        </button>
      `).join('')}
    </div>

    <div class="product-list" id="productListContainer">
      ${renderProductCards(sortedFiltered)}
    </div>
  `;
}

function renderProductCards(list) {
  if (list.length === 0) {
    return `<div style="text-align: center; padding: 36px 20px; color: var(--text-muted); font-size: 13px;">No products found</div>`;
  }
  return list.map(p => {
    const risk = p.ml_risk_level || "low";
    const totalQty = (p.in_use_quantity || 0) + (p.unopened_quantity || 0);
    const runway = totalQty > 0 ? (p.ml_supply_runway_days || 30) : 0;
    const badgeClass = totalQty === 0 ? "badge-high" : (risk === "high" ? "badge-high" : (risk === "medium" ? "badge-medium" : "badge-good"));
    const badgeLabel = totalQty === 0 ? "Out of stock" : (risk === "high" ? "High risk" : (risk === "medium" ? "Medium" : "Good"));
    const isSelected = state.selectedProductIds.has(p.id);

    return `
      <div 
        class="product-card ${isSelected ? 'selected' : ''}" 
        id="product-card-${p.id}"
        data-product-id="${p.id}"
        onmousedown="window.startLongPress(event, ${p.id})"
        onmouseup="window.cancelLongPress()"
        onmouseleave="window.cancelLongPress()"
        ontouchstart="window.startLongPress(event, ${p.id})"
        ontouchend="window.cancelLongPress()"
        ontouchcancel="window.cancelLongPress()"
        onclick="window.handleProductCardClick(event, ${p.id})"
        style="${isSelected ? 'border-color: var(--color-periwinkle-amethyst); background: rgba(147, 129, 255, 0.08);' : ''} user-select: none; -webkit-user-select: none;"
      >
        <!-- Selection Checkbox (Visible in selection mode or when selected) -->
        ${state.selectionMode ? `
          <div style="margin-right: 10px; display: flex; align-items: center;" onclick="event.stopPropagation(); window.toggleProductSelection(${p.id})">
            <input 
              type="checkbox" 
              class="product-select-checkbox" 
              ${isSelected ? 'checked' : ''} 
              style="width: 18px; height: 18px; accent-color: var(--color-periwinkle-amethyst); cursor: pointer;"
            >
          </div>
        ` : ''}

        <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
          <div class="product-thumb">
            ${getProductMinimalIconSvg(p.name, p.category)}
          </div>
          <div class="product-meta">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="product-name">${escapeHtml(p.name)}</span>
              ${!state.selectionMode ? `
                <button 
                  onclick="event.stopPropagation(); window.openEditProductModal(${p.id}, '${escapeHtml(p.name.replace(/'/g, "\\'"))}')" 
                  title="Edit Product Name"
                  style="background: none; border: none; padding: 2px 4px; cursor: pointer; color: var(--text-dim); border-radius: 4px;"
                  onmouseover="this.style.color='var(--color-periwinkle-amethyst)'"
                  onmouseout="this.style.color='var(--text-dim)'"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                  </svg>
                </button>
              ` : ''}
            </div>
            <div class="product-stock">
              ${p.in_use_quantity || 0} in use • ${p.unopened_quantity || 0} sealed • ~${runway}d left
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px;">
              <span class="badge ${badgeClass}">${badgeLabel}</span>
              ${p.visibility === 'shared' ? '<span style="font-size: 10px; color: var(--text-dim);">Shared</span>' : ''}
            </div>
          </div>
        </div>

        <div class="card-actions" onclick="event.stopPropagation();">
          ${!state.selectionMode ? `
            ${p.unopened_quantity > 0 ? `
              <button class="action-chip" onclick="window.handleProductAction(${p.id}, 'start_using')">Open</button>
            ` : ''}
            ${p.in_use_quantity > 0 ? `
              <button class="action-chip" onclick="window.handleProductAction(${p.id}, 'mark_finished')">Done</button>
            ` : ''}
            <button class="action-chip" style="color: var(--color-muted-rose-currant);" onclick="window.handleProductAction(${p.id}, 'mark_wasted')">Wasted</button>
            <button 
              class="action-chip delete-btn" 
              style="color: var(--color-muted-rose-currant); padding: 5px 8px;" 
              onclick="window.handleDeleteProduct(${p.id}, '${escapeHtml(p.name.replace(/'/g, "\\'"))}')"
              title="Delete Product"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// 3. SCAN TAB (Real Camera Scanner)
// -------------------------------------------------------------
async function startCameraScanner() {
  const video = document.getElementById("cameraVideo");
  if (!video) return;

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const constraints = {
        video: {
          facingMode: state.cameraFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      state.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = state.cameraStream;
      await video.play();
    }
  } catch (err) {
    console.warn("Direct webcam stream not available:", err);
  }
}

function stopCameraStream() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
  }
  const video = document.getElementById("cameraVideo");
  if (video) video.srcObject = null;
}

window.flipCamera = async function() {
  state.cameraFacingMode = state.cameraFacingMode === "environment" ? "user" : "environment";
  stopCameraStream();
  await startCameraScanner();
};

window.setCameraScanMode = function(mode) {
  state.scanMode = mode;
  const ingBtn = document.getElementById("scanModeIngredientsBtn");
  const prodBtn = document.getElementById("scanModeProductBtn");
  if (ingBtn && prodBtn) {
    ingBtn.classList.toggle("active", mode === "ingredients");
    prodBtn.classList.toggle("active", mode === "product");
  }

  const prodContainer = document.getElementById("productInspectorContainer");
  const ingContainer = document.getElementById("ingredientsInspectorContainer");
  if (prodContainer && ingContainer) {
    prodContainer.style.display = mode === "ingredients" ? "none" : "block";
    ingContainer.style.display = mode === "ingredients" ? "block" : "none";
  }
};

window.handleIngredientTextChange = function(text) {
  const countEl = document.getElementById("liveIngredientCount");
  if (!countEl) return;
  const items = (text || "").split(/[,;\n]/).map(s => s.trim()).filter(s => s.length > 1);
  if (items.length === 0) {
    countEl.textContent = "Ready to verify formulation";
    countEl.style.color = "var(--text-muted)";
  } else {
    countEl.innerHTML = `<strong>${items.length}</strong> ingredient(s) detected in label`;
    countEl.style.color = "var(--color-periwinkle-amethyst)";
  }
};

window.analyzeInspectedIngredients = function() {
  const ingInspector = document.getElementById("cameraIngredientInspector");
  const text = ingInspector ? ingInspector.value.trim() : "";
  if (!text) {
    alert("Please capture product packaging or enter ingredient text in the box below.");
    if (ingInspector) ingInspector.focus();
    return;
  }
  processCapturedScan(null, "manual-ingredients", text);
};

window.testSampleFormula = function(type) {
  window.setCameraScanMode("ingredients");
  let formula = "";
  if (type === "clean-cream") {
    formula = "Aqua, Aloe Barbadensis Leaf Juice, Glycerin, Simmondsia Chinensis (Jojoba) Seed Oil, Butyrospermum Parkii (Shea) Butter, Tocopherol (Vitamin E), Camellia Sinensis (Green Tea) Leaf Extract, Xanthan Gum, Cetearyl Olivate";
  } else if (type === "clean-baby") {
    formula = "Aqua, Colloidal Oatmeal, Cocos Nucifera (Coconut) Oil, Chamomilla Recutita (Matricaria) Flower Extract, Vegetable Glycerin, Helianthus Annuus (Sunflower) Seed Oil, Glyceryl Stearate, Caprylic/Capric Triglyceride";
  } else if (type === "harmful-shampoo") {
    formula = "Water, Sodium Laureth Sulfate (SLES), Cocamidopropyl Betaine, Methylparaben, Propylparaben, Fragrance (Parfum), DMDM Hydantoin, Tetrasodium EDTA, CI 19140, BHT";
  } else if (type === "toxic-cosmetic") {
    formula = "Talc, Mica, Dimethicone, Cyclopentasiloxane, Oxybenzone, Octinoxate, Diethyl Phthalate (DEP), PFAS (PTFE), Lead, Toluene, BPA";
  } else if (type === "head-and-shoulders") {
    formula = "Ingredients: Water, Sodium Lauryl Sulfate, Sodium Laureth Sulfate, Sodium Chloride, Glycol Distearate, Zinc Carbonate, Sodium Xylenesulfonate, Zinc Pyrithione, Cocamidopropyl Betaine, Fragrance, Dimethicone, Sodium Benzoate, Guar Hydroxypropyltrimonium Chloride, Magnesium Carbonate Hydroxide, Hexyl Cinnamal, Limonene, Benzyl Salicylate, Citronellol, Propylene Glycol, Amyl Cinnamal, Citrus Limon (Lemon) Fruit Extract, Methylchloroisothiazolinone, Methylisothiazolinone, CI 19140, CI 42090";
  } else if (type === "beige-vanilla") {
    formula = "02 - BEIGE VANILLA\nIngredients : Cyclopentasiloxane and Dimethicone Crosspolymer and Cyclomethicone and Cyclotetrasiloxane, Cyclopentasiloxane, Titanium Dioxide Aluminium Hydroxide and Methicone (CI 77891), Dimethicone/Vinyl Dimethicone Cross Polymer Sillica, Talc and Methicone, Acrylate Crosspolymer, Cetyl Dimethicone, Phenoxy Ethanol, Methyl Paraben, Ethyl Paraben, Propyl Paraben, Butyl Paraben, BHT, Yellow Iron Oxide and Methicone CI 77492, Red Iron Oxide and Methicone CI 77491, Black Iron Oxide and Methicone CI 77499, Butylphenyl Methylpropional, Geraniol, Hexyl Cinnamal, Hydroxycitronellal, Citronellol, Limonene, Linalool, Perfume.";
  } else if (type === "vaseline-jelly") {
    formula = "Vaseline ORIGINAL SKIN PROTECTING JELLY\nINGREDIENTS: MINERAL OIL, PARAFFIN, MICROCRYSTALLINE WAX, TOCOPHERYL ACETATE, FRAGRANCE.\n*MRP ₹ (INCL. OF ALL TAXES), #MFD., B. NO. &\nNET VOL. / NET WT. 100 ml / 85 g";
  }

  const ingInspector = document.getElementById("cameraIngredientInspector");
  if (ingInspector) {
    ingInspector.value = formula;
    window.handleIngredientTextChange(formula);
  }

  const streamWrapper = document.getElementById("cameraStreamWrapper");
  if (streamWrapper) {
    streamWrapper.classList.remove("camera-flash");
    void streamWrapper.offsetWidth;
    streamWrapper.classList.add("camera-flash");
  }

  processCapturedScan(null, type, formula);
};

window.toggleManualInput = function(type) {
  if (type === "product") {
    const box = document.getElementById("manualProductInputBox");
    if (box) {
      box.style.display = box.style.display === "none" ? "block" : "none";
      if (box.style.display === "block") {
        const inp = document.getElementById("cameraTextInspector");
        if (inp) inp.focus();
      }
    }
  } else if (type === "ingredients") {
    const box = document.getElementById("manualIngredientInputBox");
    if (box) {
      box.style.display = box.style.display === "none" ? "block" : "none";
      if (box.style.display === "block") {
        const inp = document.getElementById("cameraIngredientInspector");
        if (inp) inp.focus();
      }
    }
  }
};

window.handlePackagingNameChange = async function(text) {
  const val = (text || "").trim().toLowerCase();
  const feedbackText = document.getElementById("liveCategoryText");
  const feedbackConf = document.getElementById("liveCategoryConfidence");
  if (!feedbackText) return;

  if (!val) {
    feedbackText.textContent = "Point camera at bottle or box";
    feedbackText.style.color = "var(--text-muted)";
    if (feedbackConf) feedbackConf.textContent = "";
    return;
  }

  let cat = "Personal Care";
  let icon = "🧴";
  let conf = 90;

  if (/(tablet|capsule|syrup|paracetamol|dolo|crocin|calpol|aspirin|ibuprofen|vitamin|zinc|calcium|antiseptic|vicks|cough|fever|digene|eno|mg|bandage|first aid|lozenge|strepsils)/i.test(val)) {
    cat = "Medicines & Supplements";
    icon = "💊";
    conf = 94;
  } else if (/(detergent|ariel|surf|tide|vim|dishwash|dish gel|cleaner|floor|toilet|harpic|lizol|colin|bleach|soap bar|wiper|mop|vanish|comfort|scourer|sponge)/i.test(val)) {
    cat = "Cleaning";
    icon = "🧼";
    conf = 93;
  } else if (/(battery|duracell|energizer|tissue|tissues|toilet paper|paper towel|napkin|foil|cling wrap|garbage bag|trash bag|air freshener|odonil|aer|bulb|led|mosquito|all out|good knight)/i.test(val)) {
    cat = "Household";
    icon = "🏡";
    conf = 92;
  } else if (/(shampoo|conditioner|cleanser|face wash|facewash|dove|himalaya|cetaphil|colgate|toothpaste|moisturizer|lotion|sunscreen|serum|soap|body wash|nivea|deodorant|perfume|razor|gillette)/i.test(val)) {
    cat = "Personal Care";
    icon = "🧴";
    conf = 95;
  }

  feedbackText.innerHTML = `${icon} <span style="color: var(--color-periwinkle-amethyst); font-weight: 800;">${cat}</span>`;
  if (feedbackConf) feedbackConf.textContent = `✦ ${conf}% Match`;
};

window.categorizeInspectedProduct = function() {
  const inspector = document.getElementById("cameraTextInspector");
  const name = inspector ? inspector.value.trim() : "";
  if (!name) {
    alert("Please enter the product name printed on the packaging.");
    if (inspector) inspector.focus();
    return;
  }
  processCapturedScan(null, name, name);
};

async function runOCR(imageSource) {
  if (!window.Tesseract) return "";
  try {
    const worker = await Tesseract.createWorker('eng', 1, {
      workerPath: '/static/js/worker.min.js',
      corePath: '/static/js/tesseract-core.wasm.js',
      langPath: '/static/js',
      gzip: true,
      logger: m => console.log('[SmartShelf OCR]', m.status, m.progress ? Math.round(m.progress * 100) + '%' : '')
    });
    const ret = await worker.recognize(imageSource);
    await worker.terminate();
    return (ret.data?.text || "").trim();
  } catch (err) {
    console.warn("Primary local OCR error, falling back to default recognize:", err);
    try {
      const res = await Tesseract.recognize(imageSource, 'eng');
      return (res.data?.text || "").trim();
    } catch (e2) {
      console.warn("Fallback OCR error:", e2);
      return "";
    }
  }
}

window.captureCameraSnap = async function() {
  const video = document.getElementById("cameraVideo");
  const canvas = document.getElementById("cameraCanvas");
  const streamWrapper = document.getElementById("cameraStreamWrapper");
  const overlay = document.getElementById("cameraScanOverlay");

  // Shutter flash effect
  if (streamWrapper) {
    streamWrapper.classList.remove("camera-flash");
    void streamWrapper.offsetWidth; // trigger reflow
    streamWrapper.classList.add("camera-flash");
  }

  let capturedImageData = null;
  if (video && video.videoWidth > 0 && canvas) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      capturedImageData = canvas.toDataURL("image/jpeg", 0.85);
    } catch (e) {
      console.warn("Canvas capture error:", e);
    }
  }

  // Show polite scanning status
  if (overlay) {
    overlay.style.display = "flex";
    const overlayTitle = overlay.querySelector("div[style*='font-weight: 700']");
    const overlaySub = overlay.querySelector("div[style*='font-size: 11px']");
    if (overlayTitle) {
      overlayTitle.textContent = state.scanMode === "ingredients" 
        ? "✦ Reading Ingredient Label..." 
        : "✦ Identifying Product...";
    }
    if (overlaySub) {
      overlaySub.textContent = "Scanning packaging photo";
    }
  }

  let ocrText = "";

  // Run OCR on the captured canvas image
  if (canvas && canvas.width > 0) {
    ocrText = await runOCR(canvas);
  }

  if (state.scanMode === "ingredients") {
    const manualIng = document.getElementById("cameraIngredientInspector");
    const manualText = manualIng ? manualIng.value.trim() : "";
    const formula = (ocrText && ocrText.length > 5) ? ocrText : manualText;
    
    if (!formula) {
      if (overlay) overlay.style.display = "none";
      window.toggleManualInput("ingredients");
      const ingBox = document.getElementById("cameraIngredientInspector");
      if (ingBox) ingBox.focus();
      alert("We couldn't clearly read the ingredients on this label. Please try taking a closer, well-lit photo, or paste/type them in the box below.");
      return;
    }
    
    processCapturedScan(capturedImageData, "captured-ingredients", formula);
  } else {
    // Product Categorization Mode
    const manualProd = document.getElementById("cameraTextInspector");
    let detectedName = "";
    if (ocrText && ocrText.length > 2) {
      // Find the first line that is not OCR punctuation noise or boilerplate keywords
      const firstLine = ocrText
        .split('\n')
        .map(l => l.replace(/^[^\w]+|[^\w\s\-\&]+/g, ' ').trim())
        .find(l => l.length >= 3 && !/^(?:esc|fl|tr|ee|net|mrp|mfd|bno|tel|toll|pvt|ltd|\d+)$/i.test(l));
      if (firstLine) {
        detectedName = firstLine.split(/\s+/).slice(0, 3).join(' ');
      }
    }
    const finalHint = detectedName || (manualProd ? manualProd.value.trim() : "");
    processCapturedScan(capturedImageData, "captured-product", finalHint);
  }
};

window.handleCameraFileUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const overlay = document.getElementById("cameraScanOverlay");
  if (overlay) {
    overlay.style.display = "flex";
    const overlayTitle = overlay.querySelector("div[style*='font-weight: 700']");
    if (overlayTitle) {
      overlayTitle.textContent = state.scanMode === "ingredients" 
        ? "✦ Reading Ingredient Label..." 
        : "✦ Identifying Product...";
    }
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const dataUrl = e.target.result;
    const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

    const ocrText = await runOCR(dataUrl);

    if (state.scanMode === "ingredients") {
      // In ingredients mode: ONLY use valid extracted formula text or user input.
      // NEVER fall back to image filename (cleanName) as that caused false 'Safe to Use' confirmations.
      const manualIng = document.getElementById("cameraIngredientInspector");
      const manualText = manualIng ? manualIng.value.trim() : "";
      const formula = (ocrText && ocrText.length > 5) ? ocrText : manualText;

      if (!formula) {
        if (overlay) overlay.style.display = "none";
        // Open the text paste box to allow immediate user confirmation / input
        window.toggleManualInput("ingredients");
        const ingBox = document.getElementById("cameraIngredientInspector");
        if (ingBox) ingBox.focus();
        alert("We couldn't clearly read the ingredients on this label image. Please paste or type the ingredients below to check for harmful chemicals.");
        return;
      }

      processCapturedScan(dataUrl, "uploaded-ingredients", formula);
    } else {
      let detectedName = "";
      if (ocrText && ocrText.length > 2) {
        const firstLine = ocrText
          .split('\n')
          .map(l => l.replace(/^[^\w]+|[^\w\s\-\&]+/g, ' ').trim())
          .find(l => l.length >= 3 && !/^(?:esc|fl|tr|ee|net|mrp|mfd|bno|tel|toll|pvt|ltd|\d+)$/i.test(l));
        if (firstLine) {
          detectedName = firstLine.split(/\s+/).slice(0, 3).join(' ');
        }
      }
      const finalName = detectedName || cleanName;
      processCapturedScan(dataUrl, file.name, finalName);
    }
  };
  reader.readAsDataURL(file);
};

window.testSampleProduct = function(sampleName, expectedCategory) {
  window.setCameraScanMode("product");
  const inspector = document.getElementById("cameraTextInspector");
  if (inspector) {
    inspector.value = sampleName;
    window.handlePackagingNameChange(sampleName);
  }

  const streamWrapper = document.getElementById("cameraStreamWrapper");
  if (streamWrapper) {
    streamWrapper.classList.remove("camera-flash");
    void streamWrapper.offsetWidth;
    streamWrapper.classList.add("camera-flash");
  }
  processCapturedScan(null, sampleName, sampleName);
};

async function processCapturedScan(imageData = null, fileName = "", textHint = "") {
  const overlay = document.getElementById("cameraScanOverlay");
  if (overlay) overlay.style.display = "flex";

  const inspector = document.getElementById("cameraTextInspector");
  const ingInspector = document.getElementById("cameraIngredientInspector");

  try {
    if (state.scanMode === "ingredients") {
      let formulaToAnalyze = textHint || (ingInspector ? ingInspector.value.trim() : "");
      if (!formulaToAnalyze) {
        if (overlay) overlay.style.display = "none";
        window.toggleManualInput("ingredients");
        const ingBox = document.getElementById("cameraIngredientInspector");
        if (ingBox) ingBox.focus();
        alert("Please provide the ingredient list from the product label to check for harmful chemicals.");
        return;
      }
      const res = await API.analyzeIngredients(formulaToAnalyze, imageData);
      if (overlay) overlay.style.display = "none";
      showScanResults(res, formulaToAnalyze);
    } else {
      const finalHint = textHint || (inspector ? inspector.value.trim() : "") || fileName || "";
      const classification = await API.classifyProduct(imageData, fileName, finalHint);
      if (overlay) overlay.style.display = "none";
      showCategorizationResult(classification, imageData);
    }
  } catch (err) {
    if (overlay) overlay.style.display = "none";
    console.error("Camera scan failed:", err);
    alert("Could not process packaging image: " + err.message);
  }
}

function getCategoryBadgeClass(category) {
  switch ((category || "").toLowerCase()) {
    case "personal care": return "category-personal-care";
    case "cosmetics": return "category-cosmetics";
    case "medicines & supplements": return "category-medicines";
    case "medicines": return "category-medicines";
    case "cleaning": return "category-cleaning";
    case "household": return "category-household";
    default: return "category-personal-care";
  }
}

function showCategorizationResult(res, imageData = null) {
  const modal = document.getElementById("productCategorizeModal");
  const body = document.getElementById("productCategorizeBody");
  if (!modal || !body) return;

  const category = res.category || "Personal Care";
  const badgeClass = getCategoryBadgeClass(category);
  const icon = res.icon || "🧴";
  const confidence = res.confidence || 92;
  const suggestedPrice = res.suggested_price || 250;
  const suggestedDays = res.suggested_duration_days || 35;
  const productName = (res.product_name || "").trim();
  const brand = res.brand || "Brand";

  const defaultExp = new Date();
  defaultExp.setMonth(defaultExp.getMonth() + 18);
  const expiryStr = defaultExp.toISOString().split("T")[0];

  body.innerHTML = `
    <!-- Product Detection Info -->
    <div style="background: var(--bg-subtle); border-radius: var(--radius-md); padding: 12px; margin-bottom: 14px; border: 1px solid var(--border-light); display: flex; gap: 12px; align-items: center;">
      ${imageData ? `
        <div style="width: 50px; height: 50px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-active); flex-shrink: 0;">
          <img src="${imageData}" style="width: 100%; height: 100%; object-fit: cover;" alt="Bottle">
        </div>
      ` : `
        <div style="width: 50px; height: 50px; border-radius: var(--radius-sm); background: var(--bg-accent); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">
          ${icon}
        </div>
      `}
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 800; font-size: 14px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${productName ? escapeHtml(productName) : '<span style="color: var(--text-muted); font-weight: 500; font-style: italic;">Enter product name below</span>'}
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
          ${brand && brand !== "Detected Package" && brand !== "Generic" ? `${escapeHtml(brand)} • ` : ''}${escapeHtml(category)}
        </div>
        <div style="font-size: 10px; color: var(--color-periwinkle-amethyst); font-weight: 700; margin-top: 2px;">
          ${confidence}% match
        </div>
      </div>
    </div>

    <!-- Confirmation Form -->
    <form onsubmit="window.saveCategorizedProduct(event)">
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="catResultName" class="form-control" value="${escapeHtml(productName)}" placeholder="Enter product name..." required>
      </div>

      <div class="form-group">
        <label>Category</label>
        <select id="catResultCategory" class="form-control">
          <option value="Personal Care" ${category === "Personal Care" ? "selected" : ""}>Personal Care</option>
          <option value="Cosmetics" ${category === "Cosmetics" ? "selected" : ""}>Cosmetics</option>
          <option value="Medicines & Supplements" ${category === "Medicines & Supplements" ? "selected" : ""}>Medicines & Supplements</option>
          <option value="Cleaning" ${category === "Cleaning" ? "selected" : ""}>Cleaning</option>
          <option value="Household" ${category === "Household" ? "selected" : ""}>Household</option>
        </select>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div class="form-group">
          <label>Quantity</label>
          <input type="number" id="catResultQty" class="form-control" value="1" min="1" required>
        </div>
        <div class="form-group">
          <label>Price (₹)</label>
          <input type="number" id="catResultPrice" class="form-control" value="${suggestedPrice}">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div class="form-group">
          <label>Status</label>
          <select id="catResultStatus" class="form-control">
            <option value="unopened">Unopened</option>
            <option value="in_use">In Use</option>
          </select>
        </div>
        <div class="form-group">
          <label>Expiry Date</label>
          <input type="date" id="catResultExpiry" class="form-control" value="${expiryStr}">
        </div>
      </div>

      <div class="form-group">
        <label>Visibility</label>
        <select id="catResultVisibility" class="form-control">
          <option value="shared">Shared</option>
          <option value="personal">Personal</option>
        </select>
      </div>

      <div style="display: flex; gap: 8px; margin-top: 14px;">
        <button type="submit" class="btn-primary" style="flex: 1;">
          Save
        </button>
        <button type="button" class="btn-secondary" style="width: auto; padding: 0 14px;" onclick="document.getElementById('productCategorizeModal').classList.remove('active')">
          Cancel
        </button>
      </div>
    </form>
  `;

  modal.classList.add("active");
}

window.saveCategorizedProduct = async function(e) {
  e.preventDefault();
  const name = document.getElementById("catResultName").value.trim();
  const category = document.getElementById("catResultCategory").value;
  const qty = parseInt(document.getElementById("catResultQty").value) || 1;
  const price = parseFloat(document.getElementById("catResultPrice").value) || 0;
  const status = document.getElementById("catResultStatus").value;
  const expiry = document.getElementById("catResultExpiry").value || null;
  const visibility = document.getElementById("catResultVisibility").value;

  const in_use = status === "in_use" ? 1 : 0;
  const unopened = status === "in_use" ? Math.max(0, qty - 1) : qty;

  try {
    await API.createProduct({
      name,
      category,
      quantity: qty,
      unopened_quantity: unopened,
      in_use_quantity: in_use,
      price,
      expiry_date: expiry,
      visibility
    });

    document.getElementById("productCategorizeModal").classList.remove("active");

    // Refresh state
    state.products = await API.getProducts("All");
    state.analysis = await API.getAnalysisOverview();
    renderInventory();
    renderDashboard();
    if (state.activeTab === "ai-analysis") renderAiAnalysis();

    // Show celebration toast
    showSmartShelfToast(`✦ Added ${name} to ${category}!`, category);
  } catch (err) {
    alert("Failed to save product: " + err.message);
  }
};

window.showSmartShelfToast = function(message, category = null) {
  const toast = document.getElementById("smartshelfToast");
  if (!toast) return;

  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    ${category ? `
      <button onclick="window.viewCategoryShelf('${escapeHtml(category)}')" style="background: rgba(255,255,255,0.2); color: #fff; border: none; padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700; cursor: pointer; margin-left: 6px;">
        View Shelf →
      </button>
    ` : ''}
  `;

  toast.classList.add("active");
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove("active");
  }, 4500);
};

window.viewCategoryShelf = function(cat) {
  const toast = document.getElementById("smartshelfToast");
  if (toast) toast.classList.remove("active");
  window.switchTab("inventory");
  window.setCategoryFilter(cat);
};

function showScanResults(res, formulaText = "") {
  const modal = document.getElementById("scanResultsModal");
  const body = document.getElementById("scanResultsBody");
  const title = document.getElementById("scanResultsTitle");
  if (!modal || !body) return;

  const isSafe = res.is_safe === true || (res.flagged_ingredients && res.flagged_ingredients.length === 0);
  const recognizedProd = res.recognized_product;
  const prodName = recognizedProd ? (recognizedProd.product_name || "").trim() : "";
  const prodBrand = recognizedProd ? (recognizedProd.brand || "") : "";
  const prodCategory = recognizedProd ? (recognizedProd.category || "Personal Care") : "Personal Care";

  if (title) {
    title.innerHTML = isSafe 
      ? `<span style="color: #10B981;">Product Safety: Safe</span>`
      : `<span style="color: var(--color-muted-rose-currant);">Product Safety: Caution</span>`;
  }

  body.innerHTML = `
    <!-- Product Name & Labeling Section -->
    <div style="background: var(--bg-subtle); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 12px; border: 1px solid var(--border-light);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label for="scanProductCustomName" style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
          Product Name
        </label>
        ${prodName ? `<span style="font-size: 10px; color: var(--color-periwinkle-amethyst); font-weight: 700;">✦ Auto-Detected</span>` : `<span style="font-size: 10px; color: var(--text-dim);">No label detected</span>`}
      </div>
      <div style="display: flex; gap: 8px;">
        <input 
          type="text" 
          id="scanProductCustomName" 
          class="form-control" 
          style="padding: 7px 10px; font-size: 13px; font-weight: 600;" 
          value="${escapeHtml(prodName)}" 
          placeholder="e.g. My Face Wash, Body Cream..."
        >
        <button 
          class="action-chip" 
          style="padding: 0 12px; font-size: 11px; font-weight: 700; white-space: nowrap; height: auto;" 
          onclick="window.addProductFromScan('${escapeHtml(prodCategory)}')"
        >
          + Add to Shelf
        </button>
      </div>
      ${prodBrand && prodBrand !== "Generic" ? `
        <div style="font-size: 10px; color: var(--text-dim); margin-top: 4px;">
          Detected Brand: <strong>${escapeHtml(prodBrand)}</strong> • Category: ${escapeHtml(prodCategory)}
        </div>
      ` : ''}
    </div>

    <!-- Top Result Banner -->
    ${isSafe ? `
      <div style="background: rgba(16, 185, 129, 0.1); border: 1.5px solid #10B981; border-radius: var(--radius-md); padding: 14px; text-align: center; margin-bottom: 14px;">
        <div style="font-size: 15px; font-weight: 800; color: #10B981; margin-bottom: 2px;">
          Safe to Use
        </div>
        <p style="font-size: 12px; color: var(--text-muted); margin: 0;">
          No harmful chemicals, parabens, sulfates, formaldehyde, or heavy metals were detected.
        </p>
      </div>
    ` : `
      <div style="background: var(--badge-high-bg); border: 1.5px solid rgba(239, 68, 68, 0.4); border-radius: var(--radius-md); padding: 12px; margin-bottom: 14px;">
        <div style="font-size: 14px; font-weight: 800; color: var(--color-muted-rose-currant); margin-bottom: 3px;">
          ${escapeHtml(res.verdict || "Harmful Chemicals Detected")}
        </div>
        <p style="font-size: 11px; color: var(--text-main); margin: 0; line-height: 1.4;">
          ${escapeHtml(res.summary_message || "Harmful chemicals detected that can cause health risks or irritation.")}
        </p>
      </div>
    `}

    <!-- Flagged Ingredients with Explicit Caution / Reminders -->
    ${res.flagged_ingredients && res.flagged_ingredients.length > 0 ? `
      <div class="section-label" style="color: var(--color-muted-rose-currant);">
        Harmful Chemicals Detected (${res.flagged_ingredients.length})
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;">
        ${res.flagged_ingredients.map(ing => `
          <div style="background: var(--bg-card); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid rgba(239,68,68,0.25); border-left: 4px solid #EF4444;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-size: 13px; font-weight: 800; color: #DC2626;">
                  ${escapeHtml(ing.matched_name || ing.ingredient)}
                </div>
                <div style="font-size: 10px; font-weight: 700; color: var(--text-dim); margin-top: 1px;">
                  Class: ${escapeHtml(ing.purpose || ing.category)}
                </div>
              </div>
              <span style="font-size: 9px; font-weight: 800; background: rgba(239,68,68,0.15); color: #B91C1C; padding: 2px 6px; border-radius: 4px;">
                ${ing.hazard_level >= 5 ? 'High Hazard' : 'Moderate'}
              </span>
            </div>
            <div style="font-size: 11px; color: var(--text-main); margin-top: 6px; line-height: 1.4;">
              ⚠️ <strong>Caution:</strong> ${escapeHtml(ing.flag_reason || "Harmful chemical")}
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- Safe Ingredients List -->
    <div class="section-label" style="color: #10B981;">
      Clean / Safe Ingredients (${res.safe_ingredients ? res.safe_ingredients.length : 0})
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 16px; max-height: 120px; overflow-y: auto;">
      ${(res.safe_ingredients || []).map(ing => `
        <div style="background: var(--bg-subtle); padding: 4px 8px; border-radius: var(--radius-full); font-size: 10px; border: 1px solid var(--border-light);">
          ${escapeHtml(ing.matched_name || ing.ingredient)}
        </div>
      `).join('')}
    </div>

    <button class="btn-primary" style="width: 100%;" onclick="document.getElementById('scanResultsModal').classList.remove('active')">
      Got It
    </button>
  `;

  modal.classList.add("active");
}

window.addProductFromScan = function(defaultCategory = "Personal Care") {
  const input = document.getElementById("scanProductCustomName");
  const name = input ? input.value.trim() : "";
  if (!name) {
    if (input) input.focus();
    alert("Please enter a product name to add it to your shelf.");
    return;
  }
  document.getElementById("scanResultsModal").classList.remove("active");
  window.switchTab("scan");
  window.setCameraScanMode("product");
  window.testSampleProduct(name, defaultCategory);
};

// -------------------------------------------------------------
// 4. IN STOCK / AI INVENTORY ANALYSIS VIEW
// -------------------------------------------------------------
async function renderAiAnalysis() {
  const container = document.getElementById("view-ai-analysis");
  if (!container) return;

  container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 13px;">Analyzing inventory...</div>`;

  try {
    const data = await API.getAnalysisOverview();
    state.analysis = data;
    renderInStockContent();
  } catch (err) {
    container.innerHTML = `<div style="color: var(--color-muted-rose-currant); padding: 20px;">Failed to load analysis.</div>`;
  }
}

function matchesStockSearch(item, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const name = (item.name || "").toLowerCase();
  const category = (item.category || "").toLowerCase();
  const brand = (item.brand || "").toLowerCase();
  const reason = (item.reason || "").toLowerCase();

  // If the user searches specifically for "cosmetics" or "cosmetic",
  // strictly match ONLY items whose category is Cosmetics or specific makeup products.
  // NEVER match personal care items like toothpaste, body wash, shampoos, or face washes.
  if (q === "cosmetics" || q === "cosmetic" || q === "makeup" || q === "make up") {
    return category === "cosmetics" || category === "cosmetic" || isMakeupProduct(name);
  }

  // If searching for "personal care", strictly match Personal Care category
  if (q === "personal care" || q === "personalcare") {
    return category.includes("personal care");
  }

  // Direct text match against name, category, brand, or description
  if (name.includes(q) || category.includes(q) || brand.includes(q) || reason.includes(q)) {
    return true;
  }

  // Common category synonym mappings (excluding mixing personal care with cosmetics)
  const synonyms = {
    "beauty": ["cosmetics", "makeup"],
    "medicine": ["medicines & supplements", "tablets", "syrup", "capsules", "dolo", "paracetamol", "limcee", "vitamin"],
    "medicines": ["medicines & supplements", "tablets", "syrup", "capsules", "dolo", "paracetamol", "limcee", "vitamin"],
    "supplement": ["medicines & supplements", "vitamin", "limcee"],
    "cleaning": ["cleaner", "detergent", "dishwash", "floor", "toilet", "vim", "ariel", "lizol"],
    "household": ["batteries", "tissues", "light", "duracell"]
  };

  for (const [key, terms] of Object.entries(synonyms)) {
    if (q === key || key.includes(q)) {
      if (terms.some(t => category.includes(t) || name.includes(t))) {
        return true;
      }
    }
  }

  return false;
}

window.handleInStockSearch = function(query) {
  state.inStockSearchQuery = query || "";
  renderInStockContent();
  // Preserve focus & cursor on the search input
  const input = document.getElementById("inStockSearchInput");
  if (input) {
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }
};

function renderInStockContent() {
  const container = document.getElementById("view-ai-analysis");
  if (!container || !state.analysis) return;

  const data = state.analysis;
  const q = (state.inStockSearchQuery || "").trim();

  // Filter Consider & Avoid lists by search query
  const allConsider = data.consider_buying || [];
  const allAvoid = data.avoid_buying || [];

  const filteredConsider = allConsider.filter(c => matchesStockSearch(c, q));
  const filteredAvoid = allAvoid.filter(a => matchesStockSearch(a, q));
  const totalMatches = filteredConsider.length + filteredAvoid.length;

  container.innerHTML = `
    <div style="margin-bottom: 12px;">
      <h2 style="font-size: 20px; font-weight: 800;">In Stock</h2>
      <p style="font-size: 12px; color: var(--text-muted);">Stock status & purchase recommendations</p>
    </div>

    <!-- In Stock Search Box -->
    <div class="search-box" style="margin-bottom: 14px;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <input 
        type="text" 
        id="inStockSearchInput" 
        placeholder="Search stock by name, brand, or category (e.g. Dove, Cosmetic, Cleaning)..." 
        value="${escapeHtml(state.inStockSearchQuery || '')}" 
        oninput="window.handleInStockSearch(this.value)"
      >
      ${state.inStockSearchQuery ? `
        <button 
          onclick="window.handleInStockSearch('')" 
          style="background: none; border: none; font-size: 14px; color: var(--text-muted); cursor: pointer; padding: 0 4px;"
        >
          &times;
        </button>
      ` : ''}
    </div>

    <!-- Quick Metrics Strip -->
    <div class="analysis-summary-strip">
      <div class="summary-pill">
        <div class="val">${data.summary.total_products}</div>
        <div class="lbl">Total</div>
      </div>
      <div class="summary-pill">
        <div class="val">${data.summary.in_use_count}</div>
        <div class="lbl">In Use</div>
      </div>
      <div class="summary-pill">
        <div class="val">${data.summary.unopened_count}</div>
        <div class="lbl">Sealed</div>
      </div>
    </div>

    ${q && totalMatches === 0 ? `
      <div style="text-align: center; padding: 36px 20px; color: var(--text-muted); font-size: 13px;">
        No stock recommendations match "<strong>${escapeHtml(q)}</strong>"
      </div>
    ` : `
      <!-- Recommendations: Consider Buying -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; margin-bottom: 6px;">
        <span class="section-label" style="color: var(--color-periwinkle-amethyst); margin-bottom: 0;">Restock Recommended (${filteredConsider.length})</span>
      </div>
      <div style="margin-bottom: 14px;">
        ${filteredConsider.length === 0 ? `
          <div style="font-size: 12px; color: var(--text-muted); padding: 8px 10px; background: var(--bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
            ${q ? `No items needing restock match "${escapeHtml(q)}".` : 'No items need restocking right now.'}
          </div>
        ` : ''}
        ${filteredConsider.map(c => `
          <div class="product-card" style="margin-bottom: 8px; border-left: 3.5px solid var(--color-periwinkle-amethyst);">
            <div style="flex: 1; min-width: 0;">
              <strong style="font-size: 13px; color: var(--text-main);">${escapeHtml(c.name)}</strong>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                ${escapeHtml(c.category)} • ${c.stock_left_label || (c.reason && c.reason.includes('0') ? 'Inventory stock is zero' : 'Low stock')}
              </div>
            </div>
            <button class="see-why-btn" style="font-size: 11px; padding: 3px 8px;" onclick="window.showWhyModal('${escapeHtml(c.name)}', ${JSON.stringify(c.why_bullets).replace(/"/g, '&quot;')})">
              Details
            </button>
          </div>
        `).join('')}
      </div>

      <!-- Recommendations: Avoid Buying Now -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span class="section-label" style="color: var(--color-muted-rose-currant); margin-bottom: 0;">Avoid Buying (${filteredAvoid.length})</span>
      </div>
      <div style="margin-bottom: 14px;">
        ${filteredAvoid.length === 0 ? `
          <div style="font-size: 12px; color: var(--text-muted); padding: 8px 10px; background: var(--bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
            ${q ? `No items to avoid match "${escapeHtml(q)}".` : 'No excess stock detected.'}
          </div>
        ` : ''}
        ${filteredAvoid.map(a => `
          <div class="product-card" style="margin-bottom: 8px; border-left: 3.5px solid var(--color-muted-rose-currant);">
            <div style="flex: 1; min-width: 0;">
              <strong style="font-size: 13px; color: var(--text-main);">${escapeHtml(a.name)}</strong>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                ${escapeHtml(a.category)} • ${a.unopened_count} backup • ~${a.supply_runway_days}d left
              </div>
            </div>
            <button class="see-why-btn" style="font-size: 11px; padding: 3px 8px;" onclick="window.showWhyModal('${escapeHtml(a.name)}', ${JSON.stringify(a.why_bullets).replace(/"/g, '&quot;')})">
              Details
            </button>
          </div>
        `).join('')}
      </div>
    `}

    <!-- Financial Savings Metric -->
    <div class="card-base" style="background: var(--bg-accent); padding: 12px 14px; border: none; margin-top: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Potential Savings</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--color-periwinkle-amethyst); margin-top: 2px;">
            ${state.currency} ${data.total_avoided_spend}
          </div>
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// 5. PROFILE & SETTINGS (Custom Avatar, Edit Name, Preferences)
// -------------------------------------------------------------
function renderProfileData() {
  const nameEl = document.getElementById("profileNameDisplay");
  if (nameEl) nameEl.textContent = state.userName;

  const emailEl = document.getElementById("profileEmailDisplay");
  if (emailEl) emailEl.textContent = state.userEmail;

  const avatarEl = document.getElementById("profileAvatarDisplay");
  if (avatarEl) {
    if (state.userAvatar) {
      avatarEl.innerHTML = `<img src="${state.userAvatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    } else {
      const initials = state.userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
      avatarEl.textContent = initials || "AS";
    }
  }

  const hhName = document.getElementById("profileHhName");
  if (hhName && state.household) hhName.textContent = state.household.name;

  const hhCode = document.getElementById("profileHhCode");
  if (hhCode && state.household) hhCode.textContent = state.household.share_code;

  const membersList = document.getElementById("profileMembersList");
  if (membersList && state.household && state.household.members) {
    membersList.innerHTML = state.household.members.map(m => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0;">
        <span style="display: flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          ${escapeHtml(m.name)}
        </span>
        <span style="color: var(--text-dim); text-transform: capitalize; font-size: 11px;">${escapeHtml(m.role)}</span>
      </div>
    `).join('');
  }

  const currSelect = document.getElementById("prefCurrency");
  if (currSelect) currSelect.value = state.currency;
}

window.openEditProfileModal = function() {
  const modal = document.getElementById("editProfileModal");
  const input = document.getElementById("editProfileNameInput");
  if (modal && input) {
    input.value = state.userName;
    modal.classList.add("active");
  }
};

window.saveProfileName = function(e) {
  e.preventDefault();
  const input = document.getElementById("editProfileNameInput");
  if (input && input.value.trim()) {
    state.userName = input.value.trim();
    localStorage.setItem("smartshelf_user_name", state.userName);
    renderProfileData();
    renderDashboard();
    document.getElementById("editProfileModal").classList.remove("active");
  }
};

window.openEditHouseholdModal = function() {
  const modal = document.getElementById("editHouseholdModal");
  const input = document.getElementById("editHouseholdNameInput");
  if (modal && input) {
    input.value = (state.household && state.household.name) ? state.household.name : "My Home";
    modal.classList.add("active");
    setTimeout(() => input.focus(), 100);
  }
};

window.saveHouseholdName = async function(e) {
  e.preventDefault();
  const input = document.getElementById("editHouseholdNameInput");
  const newName = input ? input.value.trim() : "";
  if (!newName) return;

  try {
    const hhId = (state.household && state.household.id) ? state.household.id : 1;
    await API.renameHousehold(newName, hhId);
    if (!state.household) state.household = {};
    state.household.name = newName;
    localStorage.setItem("smartshelf_household_name", newName);
    renderProfileData();
    document.getElementById("editHouseholdModal").classList.remove("active");
    showSmartShelfToast(`✦ Updated household name to "${newName}"`);
  } catch (err) {
    alert("Failed to update household name: " + err.message);
  }
};

window.handleAvatarUpload = function(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      state.userAvatar = e.target.result;
      localStorage.setItem("smartshelf_user_avatar", state.userAvatar);
      renderProfileData();
    };
    reader.readAsDataURL(file);
  }
};

window.savePreference = function(key, val) {
  if (key === "currency") {
    state.currency = val;
    localStorage.setItem("smartshelf_currency", val);
    renderDashboard();
    if (state.activeTab === "ai-analysis") renderAiAnalysis();
  } else {
    localStorage.setItem(`smartshelf_pref_${key}`, val);
  }
};

window.openJoinHouseholdModal = function() {
  const modal = document.getElementById("joinHouseholdModal");
  if (modal) modal.classList.add("active");
};

window.submitJoinHousehold = async function(e) {
  e.preventDefault();
  const code = document.getElementById("joinCodeInput").value.trim();
  if (!code) return;
  try {
    const res = await API.joinHousehold(code);
    alert(res.message);
    document.getElementById("joinHouseholdModal").classList.remove("active");
    await loadInitialData();
  } catch (err) {
    alert("Could not join: " + err.message);
  }
};

window.copyHouseholdCode = function() {
  const code = state.household ? state.household.share_code : "SHLF-4829";
  navigator.clipboard.writeText(code);
  alert("Household sharing code copied: " + code);
};

window.resetDemoData = async function() {
  if (confirm("Reset to default demonstration dataset?")) {
    localStorage.clear();
    location.reload();
  }
};

// -------------------------------------------------------------
// EVENT HANDLERS & PRODUCT CRUD
// -------------------------------------------------------------
window.setCategoryFilter = function(cat) {
  state.currentCategory = cat;
  renderInventory();
};

window.handleInventorySearch = function(query) {
  const q = query.toLowerCase().trim();
  const filtered = state.products.filter(p => {
    // 1. Category filter
    let matchCat = false;
    if (state.currentCategory === "All") {
      matchCat = true;
    } else {
      const catLower = (p.category || "").toLowerCase();
      if (state.currentCategory === "Medicines") {
        matchCat = catLower.includes("medicine") || catLower.includes("supplement");
      } else if (state.currentCategory === "Cosmetics") {
        matchCat = catLower === "cosmetics" || catLower === "cosmetic";
      } else {
        matchCat = catLower.includes(state.currentCategory.toLowerCase());
      }
    }

    if (!matchCat) return false;
    if (!q) return true;

    // 2. Search query filter
    const name = (p.name || "").toLowerCase();
    const brand = (p.brand || "").toLowerCase();
    const cat = (p.category || "").toLowerCase();

    // If searching for "cosmetic" or "cosmetics", ONLY match products categorized as Cosmetics or makeup
    if (q === "cosmetic" || q === "cosmetics") {
      return cat === "cosmetics" || cat === "cosmetic" || isMakeupProduct(name);
    }

    // If searching for "personal care", ONLY match Personal Care items (not cosmetics)
    if (q === "personal care" || q === "personalcare") {
      return cat.includes("personal care");
    }

    return name.includes(q) || brand.includes(q) || cat.includes(q);
  });
  const container = document.getElementById("productListContainer");
  if (container) container.innerHTML = renderProductCards(filtered);
};

function isMakeupProduct(name) {
  const n = (name || "").toLowerCase();
  const makeupTerms = [
    "foundation", "lipstick", "lip gloss", "lip tint", "lip liner", "mascara",
    "eyeliner", "kajal", "kohl", "blush", "bronzer", "highlighter", "compact powder",
    "setting powder", "setting spray", "bb cream", "cc cream", "nail polish",
    "nail enamel", "vanilla", "beige", "contour", "eyeshadow", "primer", "concealer"
  ];
  return makeupTerms.some(t => n.includes(t));
}

window.handleProductAction = async function(id, action) {
  try {
    await API.productAction(id, action);
    const [prods, analysis, expenditure] = await Promise.all([
      API.getProducts(state.currentCategory),
      API.getAnalysisOverview(),
      API.getMonthlyExpenditure(1)
    ]);
    state.products = prods;
    state.analysis = analysis;
    state.expenditure = expenditure;
    renderInventory();
    renderDashboard();
    if (state.activeTab === "ai-analysis") renderAiAnalysis();
  } catch (err) {
    alert("Action failed: " + err.message);
  }
};

window.handleDeleteProduct = async function(id, name) {
  if (!confirm(`Are you sure you want to delete "${name}" from inventory?`)) return;

  try {
    await API.deleteProduct(id);
    state.selectedProductIds.delete(id);
    const [prods, analysis, expenditure] = await Promise.all([
      API.getProducts(state.currentCategory),
      API.getAnalysisOverview(),
      API.getMonthlyExpenditure(1)
    ]);
    state.products = prods;
    state.analysis = analysis;
    state.expenditure = expenditure;
    renderInventory();
    renderDashboard();
    if (state.activeTab === "ai-analysis") renderAiAnalysis();
    showSmartShelfToast(`✦ Deleted "${name}" from inventory`);
  } catch (err) {
    alert("Delete failed: " + err.message);
  }
};

// Selection Mode & Long-Press Handlers (2-second touch hold)
let longPressTimer = null;
let longPressTriggered = false;

window.startLongPress = function(e, id) {
  // Don't trigger if clicking buttons/inputs directly
  if (e.target.closest("button") || e.target.closest("input") || e.target.closest("a")) return;
  longPressTriggered = false;
  clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    longPressTriggered = true;
    window.enterSelectionMode(id);
    if (navigator.vibrate) navigator.vibrate(50);
  }, 2000); // 2 seconds hold
};

window.cancelLongPress = function() {
  clearTimeout(longPressTimer);
};

window.handleProductCardClick = function(e, id) {
  if (longPressTriggered) {
    longPressTriggered = false;
    return;
  }
  if (state.selectionMode) {
    // In selection mode, tapping the card toggles its selection
    window.toggleProductSelection(id);
  }
};

window.enterSelectionMode = function(initialId = null) {
  state.selectionMode = true;
  if (initialId) {
    state.selectedProductIds.add(initialId);
  }
  renderInventory();
};

window.exitSelectionMode = function() {
  state.selectionMode = false;
  state.selectedProductIds.clear();
  renderInventory();
};

window.toggleProductSelection = function(id) {
  if (state.selectedProductIds.has(id)) {
    state.selectedProductIds.delete(id);
  } else {
    state.selectedProductIds.add(id);
  }
  renderInventory();
};

window.toggleSelectAllFiltered = function() {
  const filtered = state.products.filter(p => {
    if (state.currentCategory === "All") return true;
    const catLower = p.category.toLowerCase();
    if (state.currentCategory === "Medicines") {
      return catLower.includes("medicine") || catLower.includes("supplement");
    }
    return catLower.includes(state.currentCategory.toLowerCase());
  });

  const allSelected = filtered.length > 0 && filtered.every(p => state.selectedProductIds.has(p.id));
  if (allSelected) {
    filtered.forEach(p => state.selectedProductIds.delete(p.id));
  } else {
    filtered.forEach(p => state.selectedProductIds.add(p.id));
  }
  renderInventory();
};

window.deleteSelectedProducts = async function() {
  const count = state.selectedProductIds.size;
  if (count === 0) return;

  if (!confirm(`Are you sure you want to delete ${count} selected item${count > 1 ? 's' : ''} from inventory?`)) return;

  try {
    const ids = Array.from(state.selectedProductIds);
    await API.batchDeleteProducts(ids);
    state.selectedProductIds.clear();
    state.selectionMode = false;

    const [prods, analysis, expenditure] = await Promise.all([
      API.getProducts(state.currentCategory),
      API.getAnalysisOverview(),
      API.getMonthlyExpenditure(1)
    ]);
    state.products = prods;
    state.analysis = analysis;
    state.expenditure = expenditure;
    renderInventory();
    renderDashboard();
    if (state.activeTab === "ai-analysis") renderAiAnalysis();
    showSmartShelfToast(`✦ Deleted ${count} item${count > 1 ? 's' : ''} from inventory`);
  } catch (err) {
    alert("Batch delete failed: " + err.message);
  }
};

// 3-Dots Menu & Category Management Handlers
window.toggleInventoryOptionsMenu = function() {
  state.isMenuOpen = !state.isMenuOpen;
  const menu = document.getElementById("invOptionsMenu");
  if (menu) menu.style.display = state.isMenuOpen ? "block" : "none";
};

// Global click to close menu when clicking outside
window.addEventListener("click", (e) => {
  if (state.isMenuOpen && !e.target.closest("#invOptionsMenu") && !e.target.closest("#invOptionsBtn")) {
    state.isMenuOpen = false;
    const menu = document.getElementById("invOptionsMenu");
    if (menu) menu.style.display = "none";
  }
});

window.openSortModal = function() {
  state.isMenuOpen = false;
  const menu = document.getElementById("invOptionsMenu");
  if (menu) menu.style.display = "none";
  const modal = document.getElementById("sortInventoryModal");
  if (modal) modal.classList.add("active");
};

window.applyInventorySort = function(sortKey) {
  state.inventorySort = sortKey;
  localStorage.setItem("smartshelf_inv_sort", sortKey);
  const modal = document.getElementById("sortInventoryModal");
  if (modal) modal.classList.remove("active");
  renderInventory();
  showSmartShelfToast(`✦ Sorted products`);
};

window.openAddCategoryModal = function() {
  state.isMenuOpen = false;
  const menu = document.getElementById("invOptionsMenu");
  if (menu) menu.style.display = "none";
  const input = document.getElementById("newCategoryInput");
  if (input) input.value = "";
  const modal = document.getElementById("addCategoryModal");
  if (modal) modal.classList.add("active");
  if (input) setTimeout(() => input.focus(), 100);
};

window.submitAddCategory = function(e) {
  e.preventDefault();
  const input = document.getElementById("newCategoryInput");
  const name = input ? input.value.trim() : "";
  if (!name) return;

  const active = getActiveCategories();
  if (active.some(c => c.toLowerCase() === name.toLowerCase())) {
    alert("This category already exists!");
    return;
  }

  active.push(name);
  state.customCategories = active;
  localStorage.setItem("smartshelf_custom_categories", JSON.stringify(active));
  document.getElementById("addCategoryModal").classList.remove("active");
  renderInventory();
  showSmartShelfToast(`✦ Added new category "${name}"`);
};

window.openEditCategoriesModal = function() {
  state.isMenuOpen = false;
  const menu = document.getElementById("invOptionsMenu");
  if (menu) menu.style.display = "none";

  const listContainer = document.getElementById("manageCategoriesList");
  if (!listContainer) return;

  const active = getActiveCategories();
  listContainer.innerHTML = active.map((cat, idx) => `
    <div style="display: flex; gap: 8px; align-items: center; background: var(--bg-subtle); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
      <input 
        type="text" 
        id="editCatInput_${idx}" 
        class="form-control" 
        style="padding: 6px 10px; font-size: 13px;" 
        value="${escapeHtml(cat)}"
      >
      <button 
        class="action-chip" 
        style="padding: 6px 10px; font-size: 11px; font-weight: 700;"
        onclick="window.saveCategoryRename(${idx}, '${escapeHtml(cat.replace(/'/g, "\\'"))}')"
      >
        Save
      </button>
    </div>
  `).join('');

  const modal = document.getElementById("editCategoriesModal");
  if (modal) modal.classList.add("active");
};

window.saveCategoryRename = async function(idx, oldName) {
  const input = document.getElementById(`editCatInput_${idx}`);
  const newName = input ? input.value.trim() : "";
  if (!newName) {
    alert("Category name cannot be empty.");
    return;
  }
  if (newName === oldName) {
    showSmartShelfToast("No changes made.");
    return;
  }

  try {
    await API.renameCategory(oldName, newName);
    
    // Update local categories list
    const active = getActiveCategories();
    const pos = active.findIndex(c => c.toLowerCase() === oldName.toLowerCase());
    if (pos !== -1) {
      active[pos] = newName;
      state.customCategories = active;
      localStorage.setItem("smartshelf_custom_categories", JSON.stringify(active));
    }

    // Refresh products & inventory
    state.products = await API.getProducts("All");
    if (state.currentCategory.toLowerCase() === oldName.toLowerCase()) {
      state.currentCategory = newName;
    }
    renderInventory();
    renderDashboard();
    window.openEditCategoriesModal(); // Refresh modal list
    showSmartShelfToast(`✦ Renamed category "${oldName}" to "${newName}"`);
  } catch (err) {
    alert("Failed to rename category: " + err.message);
  }
};

window.openEditProductModal = function(id, currentName) {
  const modal = document.getElementById("editProductModal");
  const idInput = document.getElementById("editProductId");
  const nameInput = document.getElementById("editProductNameInput");
  const catSelect = document.getElementById("editProductCategorySelect");
  if (!modal || !idInput || !nameInput) return;
  idInput.value = id;
  nameInput.value = currentName || "";

  // Populate active categories in select
  const currentProd = state.products.find(p => p.id === id);
  const prodCat = currentProd ? currentProd.category : "Personal Care";
  if (catSelect) {
    const active = getActiveCategories();
    catSelect.innerHTML = active.map(c => `
      <option value="${escapeHtml(c)}" ${c.toLowerCase() === prodCat.toLowerCase() ? 'selected' : ''}>
        ${escapeHtml(c)}
      </option>
    `).join('');
  }

  modal.classList.add("active");
  nameInput.focus();
};

window.saveProductEdit = async function(e) {
  e.preventDefault();
  const id = document.getElementById("editProductId").value;
  const name = document.getElementById("editProductNameInput").value.trim();
  const catSelect = document.getElementById("editProductCategorySelect");
  const category = catSelect ? catSelect.value : undefined;
  if (!id || !name) return;

  try {
    await API.updateProduct(id, { name, category });
    document.getElementById("editProductModal").classList.remove("active");
    state.products = await API.getProducts(state.currentCategory);
    renderInventory();
    renderDashboard();
    showSmartShelfToast(`✦ Updated ${name}`);
  } catch (err) {
    alert("Failed to update product: " + err.message);
  }
};

window.showWhyModal = function(title, bullets) {
  const modal = document.getElementById("whyModal");
  const titleEl = document.getElementById("whyModalTitle");
  const bodyEl = document.getElementById("whyModalBody");
  if (!modal) return;

  titleEl.textContent = `Why: ${title}`;
  if (Array.isArray(bullets)) {
    bodyEl.innerHTML = `
      <ul style="padding-left: 18px; line-height: 1.6; font-size: 13px; color: var(--text-main);">
        ${bullets.map(b => `<li style="margin-bottom: 6px;">${escapeHtml(b)}</li>`).join('')}
      </ul>
    `;
  } else {
    bodyEl.innerHTML = `<p style="font-size: 13px; color: var(--text-main); line-height: 1.5;">${escapeHtml(bullets)}</p>`;
  }
  modal.classList.add("active");
};

window.openAddProductModal = function() {
  const modal = document.getElementById("addProductModal");
  const catSelect = document.getElementById("newProdCategory");
  if (catSelect) {
    const active = getActiveCategories();
    catSelect.innerHTML = active.map(c => `
      <option value="${escapeHtml(c)}">${escapeHtml(c)}</option>
    `).join('');
  }
  if (modal) modal.classList.add("active");
};

window.openNotificationsModal = async function() {
  const modal = document.getElementById("notificationsModal");
  const list = document.getElementById("notificationsModalList");
  const subtitle = document.getElementById("notificationsSubtitle");
  if (!modal || !list) return;

  // Refresh latest notifications from server
  try {
    state.notifications = await API.getNotifications();
    updateHouseholdUI();
  } catch (err) {
    console.warn("Could not refresh notifications:", err);
  }

  renderNotificationsList();
  modal.classList.add("active");
};

function renderNotificationsList() {
  const list = document.getElementById("notificationsModalList");
  const subtitle = document.getElementById("notificationsSubtitle");
  if (!list) return;

  const notifs = state.notifications || [];
  const unreadCount = notifs.filter(n => !n.is_read).length;

  if (subtitle) {
    subtitle.textContent = unreadCount > 0 ? `${unreadCount} unread notification(s)` : 'All caught up';
  }

  if (notifs.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
        <div style="font-size: 28px; margin-bottom: 8px;">🔔</div>
        <div style="font-size: 14px; font-weight: 700; color: var(--text-main);">No notifications right now</div>
        <div style="font-size: 11px; margin-top: 4px;">Smart alerts for expiry, restock, and spend will appear here.</div>
      </div>
    `;
    return;
  }

  list.innerHTML = notifs.map(n => {
    let borderCol = "var(--color-periwinkle-amethyst)";
    let badgeBg = "rgba(93, 102, 152, 0.12)";
    let badgeText = "var(--color-periwinkle-amethyst)";
    let icon = "🔔";

    if (n.type === "expired") {
      borderCol = "#DC2626";
      badgeBg = "#FEE2E2";
      badgeText = "#B91C1C";
      icon = "⚠️";
    } else if (n.type === "expiring_soon") {
      borderCol = "#D97706";
      badgeBg = "#FEF3C7";
      badgeText = "#92400E";
      icon = "⏳";
    } else if (n.type === "need_to_buy") {
      borderCol = "#2563EB";
      badgeBg = "#EFF6FF";
      badgeText = "#1D4ED8";
      icon = "🛒";
    } else if (n.type === "monthly_spent") {
      borderCol = "#059669";
      badgeBg = "#D1FAE5";
      badgeText = "#065F46";
      icon = "💰";
    }

    const isUnread = !n.is_read;

    return `
      <div 
        id="notif-card-${n.id}"
        style="background: ${isUnread ? 'var(--bg-card)' : 'var(--bg-subtle)'}; padding: 12px; border-radius: var(--radius-sm); margin-bottom: 8px; border: 1px solid ${isUnread ? borderCol : 'var(--border-light)'}; border-left: 3.5px solid ${borderCol}; transition: all 0.2s ease; cursor: pointer;"
        onclick="window.handleNotificationClick(${n.id}, '${escapeHtml(n.type)}', '${escapeHtml((n.title || '').replace(/'/g, "\\'"))}')"
      >
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 14px;">${icon}</span>
            <div style="font-weight: 800; font-size: 13px; color: var(--text-main); line-height: 1.3;">
              ${escapeHtml(n.title)}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            ${isUnread ? `
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #EF4444; display: inline-block;"></span>
            ` : `
              <span style="font-size: 10px; color: var(--text-dim);">Read</span>
            `}
          </div>
        </div>

        <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4; margin: 6px 0 8px 0;">
          ${escapeHtml(n.message)}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px dashed var(--border-light);">
          <span style="font-size: 10px; font-weight: 700; color: ${badgeText}; background: ${badgeBg}; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
            ${escapeHtml(n.type.replace(/_/g, ' '))}
          </span>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${isUnread ? `
              <button class="link-btn" style="color: var(--text-muted); font-size: 11px;" onclick="event.stopPropagation(); window.markSingleNotificationRead(${n.id})">
                Mark read
              </button>
            ` : ''}
            <span style="color: var(--color-periwinkle-amethyst); font-size: 11px; font-weight: 700;">
              ${escapeHtml(n.action_text || 'View')} ›
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.markSingleNotificationRead = async function(id) {
  try {
    await API.markNotificationRead(id);
    const n = state.notifications.find(item => item.id === id);
    if (n) n.is_read = 1;
    updateHouseholdUI();
    renderNotificationsList();
  } catch (err) {
    console.error("Failed to mark notification read:", err);
  }
};

window.markAllNotificationsAsRead = async function() {
  try {
    await API.markAllNotificationsRead();
    state.notifications.forEach(n => { n.is_read = 1; });
    updateHouseholdUI();
    renderNotificationsList();
  } catch (err) {
    console.error("Failed to mark all notifications read:", err);
  }
};

window.handleNotificationClick = async function(id, type, title) {
  // Mark as read immediately
  await window.markSingleNotificationRead(id);
  const modal = document.getElementById("notificationsModal");
  if (modal) modal.classList.remove("active");

  if (type === "monthly_spent") {
    window.openExpenditureModal();
  } else if (type === "expired" || type === "expiring_soon") {
    window.switchTab("inventory");
    const searchInput = document.getElementById("inventorySearch");
    const prodNameMatch = title.replace(/^(Expired|Expiring Soon):\s*/i, "").trim();
    if (searchInput && prodNameMatch) {
      searchInput.value = prodNameMatch;
      searchInput.dispatchEvent(new Event("input"));
    }
  } else if (type === "need_to_buy") {
    window.switchTab("ai-analysis");
  } else {
    window.switchTab("inventory");
  }
};

// -------------------------------------------------------------
// MONTHLY EXPENDITURE MODAL & FINANCIAL TRACKER
// -------------------------------------------------------------
window.openExpenditureModal = async function() {
  const modal = document.getElementById("expenditureModal");
  const body = document.getElementById("expenditureModalBody");
  const subtitle = document.getElementById("expenditureMonthSubtitle");
  if (!modal || !body) return;

  modal.classList.add("active");
  body.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted);">Loading monthly expenditure insights...</div>`;

  try {
    const data = await API.getMonthlyExpenditure(1);
    state.expenditure = data;
    if (subtitle && data.month_label) {
      subtitle.textContent = `${data.month_label} Household Overview`;
    }
    renderExpenditureModalContent(data);
  } catch (err) {
    console.error("Failed to load monthly expenditure:", err);
    body.innerHTML = `<div style="color: var(--color-muted-rose-currant); padding: 16px;">Could not load expenditure tracking data.</div>`;
  }
};

function renderExpenditureModalContent(d) {
  const body = document.getElementById("expenditureModalBody");
  if (!body) return;

  const wastedList = d.wasted_items || [];
  const unnecessaryList = d.unnecessary_purchases || [];

  body.innerHTML = `
    <!-- Top Metrics Grid -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px;">
      <div style="background: var(--bg-subtle); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
        <div style="font-size: 9px; font-weight: 700; color: var(--color-periwinkle-amethyst); text-transform: uppercase;">Saved</div>
        <div style="font-size: 16px; font-weight: 800; color: var(--color-periwinkle-amethyst); margin-top: 2px;">
          ${state.currency} ${d.money_saved}
        </div>
      </div>

      <div style="background: var(--bg-subtle); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
        <div style="font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Spent</div>
        <div style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-top: 2px;">
          ${state.currency} ${d.spending}
        </div>
      </div>

      <div style="background: var(--bg-subtle); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
        <div style="font-size: 9px; font-weight: 700; color: var(--color-muted-rose-currant); text-transform: uppercase;">Wasted</div>
        <div style="font-size: 16px; font-weight: 800; color: var(--color-muted-rose-currant); margin-top: 2px;">
          ${state.currency} ${d.waste_value}
        </div>
      </div>
    </div>

    <!-- Wasted Products List -->
    <div style="margin-bottom: 14px;">
      <div class="section-label" style="color: var(--color-muted-rose-currant);">
        <span>Wasted (${wastedList.length})</span>
      </div>

      ${wastedList.length === 0 
        ? `<div style="padding: 6px 0; font-size: 12px; color: var(--text-muted);">
             No products wasted this month.
           </div>`
        : `<div style="display: flex; flex-direction: column; gap: 6px;">
             ${wastedList.map(item => `
               <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-left: 3px solid var(--color-muted-rose-currant); border-radius: var(--radius-sm); padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
                 <div>
                   <div style="font-size: 12px; font-weight: 700; color: var(--text-main);">${escapeHtml(item.product_name)}</div>
                   <div style="font-size: 10px; color: var(--text-muted);">${escapeHtml(item.wasted_reason || 'Expired')}</div>
                 </div>
                 <div style="font-size: 12px; font-weight: 800; color: var(--color-muted-rose-currant);">${state.currency} ${item.cost || 0}</div>
               </div>
             `).join('')}
           </div>`
      }
    </div>

    <!-- Unnecessary / Postpone List -->
    ${unnecessaryList.length > 0 ? `
      <div style="margin-bottom: 16px;">
        <div class="section-label" style="color: var(--color-periwinkle-amethyst);">
          <span>Postpone Repurchase</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${unnecessaryList.map(item => `
            <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-left: 3px solid var(--color-periwinkle-amethyst); border-radius: var(--radius-sm); padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 12px; font-weight: 700; color: var(--text-main);">${escapeHtml(item.product_name)}</div>
                <div style="font-size: 10px; color: var(--text-muted);">${escapeHtml(item.flag_reason)}</div>
              </div>
              <div style="font-size: 12px; font-weight: 800; color: var(--color-periwinkle-amethyst);">Save ${state.currency} ${item.cost}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <button class="btn-primary" onclick="document.getElementById('expenditureModal').classList.remove('active')">
      Close
    </button>
  `;
}

// -------------------------------------------------------------
// Dedicated Attention Items Modal (Insights Detail)
// -------------------------------------------------------------
window.openAttentionItemsModal = function() {
  const modal = document.getElementById("attentionItemsModal");
  const modalBody = document.getElementById("attentionItemsModalBody");
  const subtitle = document.getElementById("attentionItemsSubtitle");
  if (!modal || !modalBody) return;

  const items = (state.analysis && state.analysis.attention_items) ? state.analysis.attention_items : [];

  if (subtitle) {
    subtitle.textContent = items.length > 0 
      ? `${items.length} product(s) flagged for expiry or waste risk`
      : 'All stock is safe & healthy';
  }

  if (items.length === 0) {
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 24px 12px;">
        <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(76, 175, 80, 0.12); color: #2e7d32; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 12px auto; font-weight: 800;">
          ✓
        </div>
        <h4 style="font-size: 15px; font-weight: 800; color: var(--text-main); margin-bottom: 6px;">All stock is healthy!</h4>
        <p style="font-size: 12px; color: var(--text-muted); line-height: 1.4; margin-bottom: 20px;">
          No items have expired or exceed safe consumption runway.
        </p>
        <button class="btn-primary" onclick="document.getElementById('attentionItemsModal').classList.remove('active')">
          Done
        </button>
      </div>
    `;
    modal.classList.add("active");
    return;
  }

  modalBody.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px; max-height: 380px; overflow-y: auto; padding-right: 4px; margin-bottom: 18px;">
      ${items.map(item => {
        const prod = state.products.find(p => (item.id && p.id === item.id) || p.name.toLowerCase() === item.name.toLowerCase());
        const cat = item.category || (prod ? prod.category : 'Personal Care');
        const iconSvg = getProductMinimalIconSvg(item.name, cat);
        const daysExp = item.days_to_expiry !== undefined ? item.days_to_expiry : null;
        const runway = item.runway_days !== undefined ? item.runway_days : null;

        let statusBadge = '';
        if (daysExp !== null && daysExp < 0) {
          statusBadge = `<span style="font-size: 10px; font-weight: 800; color: #b71c1c; background: #ffebee; padding: 2px 7px; border-radius: 4px; text-transform: uppercase;">Expired ${Math.abs(daysExp)}d ago</span>`;
        } else if (daysExp !== null && daysExp <= 7) {
          statusBadge = `<span style="font-size: 10px; font-weight: 800; color: #b71c1c; background: #ffebee; padding: 2px 7px; border-radius: 4px; text-transform: uppercase;">Expires in ${daysExp}d</span>`;
        } else {
          statusBadge = `<span style="font-size: 10px; font-weight: 800; color: #b71c1c; background: #ffebee; padding: 2px 7px; border-radius: 4px; text-transform: uppercase;">Waste Risk</span>`;
        }

        return `
          <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-left: 3.5px solid var(--color-muted-rose-currant); border-radius: var(--radius-sm); padding: 12px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 38px; height: 38px; border-radius: 8px; background: var(--bg-subtle); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  ${iconSvg}
                </div>
                <div>
                  <h4 style="font-size: 13px; font-weight: 800; color: var(--text-main); margin: 0;">${escapeHtml(item.name)}</h4>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 1px;">
                    ${escapeHtml(cat)} • ${state.currency} ${item.price || 0}
                  </div>
                </div>
              </div>
              <div>
                ${statusBadge}
              </div>
            </div>

            <div style="background: var(--bg-subtle); border-radius: 6px; padding: 8px 10px; font-size: 11.5px; line-height: 1.4; color: var(--text-main);">
              ${escapeHtml(item.reason || 'Item requires review based on current consumption rates and expiry.')}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px; border-top: 1px dashed var(--border-light);">
              <div style="font-size: 11px; color: var(--text-muted);">
                ${item.expiry_date ? `Expiry: <strong style="color: var(--text-main);">${escapeHtml(item.expiry_date)}</strong>` : ''}
                ${runway !== null ? ` • Runway: <strong>${runway}d</strong>` : ''}
              </div>
              <button class="link-btn" style="color: var(--color-periwinkle-amethyst); font-size: 11.5px; font-weight: 700;" onclick="window.viewItemInInventory('${escapeHtml(item.name.replace(/'/g, "\\'"))}')">
                View in Shelf ›
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <button class="btn-primary" onclick="document.getElementById('attentionItemsModal').classList.remove('active')">
      Close
    </button>
  `;

  modal.classList.add("active");
};

window.viewItemInInventory = function(productName) {
  document.getElementById("attentionItemsModal")?.classList.remove("active");
  window.switchTab("inventory");
  const searchInput = document.getElementById("inventorySearch");
  if (searchInput) {
    searchInput.value = productName;
    searchInput.dispatchEvent(new Event("input"));
  }
};

// -------------------------------------------------------------
window.renderMonthlyHistory = async function(selectedMonthKey = null) {
  const heroBanner = document.getElementById("monthlyHistoryHeroBanner");
  const trendChart = document.getElementById("multiMonthTrendChart");
  const pills = document.getElementById("monthlyHistorySelectorPills");
  const detailContainer = document.getElementById("selectedMonthDetailContainer");
  if (!heroBanner || !detailContainer) return;

  detailContainer.innerHTML = `<div style="text-align: center; padding: 28px; color: var(--text-muted); font-size: 13px;">Loading history...</div>`;

  try {
    const histData = await API.getExpenditureHistory(1);
    state.expenditureHistory = histData;
    const months = histData.months || [];
    const summary = histData.summary || {};

    // 1. Hero 6-Month Cumulative Summary Banner
    heroBanner.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span class="section-label" style="margin-bottom: 0;">6-Month Total</span>
        <span style="font-size: 11px; font-weight: 700; background: var(--bg-card); color: var(--color-periwinkle-amethyst); padding: 2px 8px; border-radius: var(--radius-full); border: 1px solid var(--border-light);">
          Overview
        </span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div style="background: var(--bg-card); padding: 9px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
          <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Spent</div>
          <div style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-top: 2px;">
            ${state.currency} ${summary.total_spent_6m || 0}
          </div>
        </div>

        <div style="background: var(--bg-card); padding: 9px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-light); border-top: 2.5px solid var(--color-periwinkle-amethyst);">
          <div style="font-size: 10px; font-weight: 700; color: var(--color-periwinkle-amethyst); text-transform: uppercase;">Saved</div>
          <div style="font-size: 16px; font-weight: 800; color: var(--color-periwinkle-amethyst); margin-top: 2px;">
            ${state.currency} ${summary.total_saved_6m || 0}
          </div>
        </div>
      </div>
    `;

    // 2. Multi-Month Trend Comparison Bars
    const maxVal = Math.max(...months.map(m => Math.max(m.spending || 0, m.money_consumed || 0)), 4500);
    trendChart.innerHTML = months.map(m => {
      const spendPct = Math.round(((m.spending || 0) / maxVal) * 100);
      const consumedPct = Math.round(((m.money_consumed || 0) / maxVal) * 100);
      const isCurr = m.is_current;

      return `
        <div style="background: var(--bg-subtle); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-light); cursor: pointer;" onclick="window.switchMonthlyHistoryMonth('${m.month_key}')">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <strong style="font-size: 12px; color: var(--text-main);">${m.month_label}</strong>
              ${isCurr ? `<span style="background: rgba(100, 116, 237, 0.15); color: var(--color-periwinkle-amethyst); font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 4px;">CURRENT</span>` : ''}
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">
              Spent: <strong>${state.currency} ${m.spending}</strong> • Saved: <strong style="color: var(--color-periwinkle-amethyst);">${state.currency} ${m.money_saved}</strong>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <div style="flex: 1; background: var(--bg-card); height: 6px; border-radius: 3px; overflow: hidden;">
                <div style="background: var(--color-periwinkle-amethyst); width: ${spendPct}%; height: 100%; border-radius: 3px;"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Determine active month
    const activeKey = selectedMonthKey || state.selectedMonthlyHistoryKey || months[0]?.month_key || "2026-10";
    state.selectedMonthlyHistoryKey = activeKey;

    // 3. Month Selector Ribbon
    pills.innerHTML = months.map(m => `
      <button class="filter-pill ${m.month_key === activeKey ? 'active' : ''}" onclick="window.switchMonthlyHistoryMonth('${m.month_key}')" style="font-size: 11px; padding: 5px 12px;">
        ${m.month_label}
      </button>
    `).join('');

    // 4. Fetch specific month ledger
    const activeData = await API.getMonthlyExpenditure(1, activeKey);
    renderSelectedMonthDetail(activeData);

  } catch (err) {
    console.error("Failed to load monthly history:", err);
    detailContainer.innerHTML = `<div style="color: var(--color-muted-rose-currant); padding: 20px;">Could not load monthly history.</div>`;
  }
};

window.switchMonthlyHistoryMonth = function(monthKey) {
  state.selectedMonthlyHistoryKey = monthKey;
  window.renderMonthlyHistory(monthKey);
};

function renderSelectedMonthDetail(d) {
  const container = document.getElementById("selectedMonthDetailContainer");
  if (!container) return;

  const wastedList = d.wasted_items || [];
  const consumedList = d.consumed_items || [];
  const isZeroWaste = (d.waste_value === 0);

  container.innerHTML = `
    <!-- Top Selected Month Header & Badge -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 9px 12px; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-sm);">
      <div style="font-size: 14px; font-weight: 800; color: var(--text-main);">${escapeHtml(d.month_label)}</div>
      ${isZeroWaste 
        ? `<span style="background: rgba(16, 185, 129, 0.15); color: #10B981; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: var(--radius-full);">Zero Waste</span>`
        : `<span style="background: var(--badge-high-bg); color: var(--color-muted-rose-currant); font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: var(--radius-full);">${wastedList.length} Wasted</span>`
      }
    </div>

    <!-- Core Metrics Grid -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px;">
      <div style="background: var(--bg-card); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-light); text-align: center;">
        <div style="font-size: 9px; font-weight: 700; color: var(--color-periwinkle-amethyst); text-transform: uppercase;">Saved</div>
        <div style="font-size: 16px; font-weight: 800; color: var(--color-periwinkle-amethyst); margin-top: 2px;">
          ${state.currency} ${d.money_saved}
        </div>
      </div>

      <div style="background: var(--bg-card); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-light); text-align: center;">
        <div style="font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Spent</div>
        <div style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-top: 2px;">
          ${state.currency} ${d.spending}
        </div>
      </div>

      <div style="background: var(--bg-card); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-light); text-align: center;">
        <div style="font-size: 9px; font-weight: 700; color: var(--color-muted-rose-currant); text-transform: uppercase;">Wasted</div>
        <div style="font-size: 16px; font-weight: 800; color: var(--color-muted-rose-currant); margin-top: 2px;">
          ${state.currency} ${d.waste_value}
        </div>
      </div>
    </div>

    <!-- Wasted Products Ledger -->
    <div class="card-base" style="margin-bottom: 12px;">
      <div class="section-label" style="color: var(--color-muted-rose-currant);">
        <span>Wasted Items (${wastedList.length})</span>
      </div>

      ${wastedList.length === 0 
        ? `<div style="padding: 8px 0; font-size: 12px; color: #10B981;">
             Zero products wasted this month.
           </div>`
        : `<div style="display: flex; flex-direction: column; gap: 6px;">
             ${wastedList.map(item => `
               <div style="background: var(--bg-subtle); border: 1px solid var(--border-light); border-left: 3px solid var(--color-muted-rose-currant); border-radius: var(--radius-sm); padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
                 <div>
                   <div style="font-size: 12px; font-weight: 700; color: var(--text-main);">${escapeHtml(item.product_name)}</div>
                   <div style="font-size: 10px; color: var(--text-muted);">${escapeHtml(item.wasted_reason || 'Expired')}</div>
                 </div>
                 <div style="font-size: 12px; font-weight: 800; color: var(--color-muted-rose-currant);">${state.currency} ${item.cost || 0}</div>
               </div>
             `).join('')}
           </div>`
      }
    </div>

    <!-- Consumed Products Ledger -->
    ${consumedList.length > 0 ? `
      <div class="card-base" style="margin-bottom: 14px;">
        <div class="section-label">
          <span>Finished Items (${consumedList.length})</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${consumedList.map(c => `
            <div style="background: var(--bg-subtle); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 12px; font-weight: 700; color: var(--text-main);">${escapeHtml(c.product_name)}</div>
                <div style="font-size: 10px; color: var(--text-muted);">${escapeHtml(c.category)}</div>
              </div>
              <div style="font-size: 12px; font-weight: 700; color: var(--text-main);">
                ${state.currency} ${c.cost}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

window.submitAddProduct = async function(e) {
  e.preventDefault();
  const name = document.getElementById("newProdName").value.trim();
  const category = document.getElementById("newProdCategory").value;
  const qty = parseInt(document.getElementById("newProdQty").value) || 1;
  const price = parseFloat(document.getElementById("newProdPrice").value) || 0;
  const status = document.getElementById("newProdStatus").value;
  const expiry = document.getElementById("newProdExpiry").value || null;
  const visibility = document.getElementById("newProdVisibility").value;

  const in_use = status === "in_use" ? 1 : 0;
  const unopened = status === "in_use" ? Math.max(0, qty - 1) : qty;

  try {
    await API.createProduct({
      name,
      category,
      quantity: qty,
      unopened_quantity: unopened,
      in_use_quantity: in_use,
      price,
      expiry_date: expiry,
      visibility
    });
    document.getElementById("addProductModal").classList.remove("active");
    // Reload state
    state.products = await API.getProducts(state.currentCategory);
    state.analysis = await API.getAnalysisOverview();
    renderInventory();
    renderDashboard();
    if (state.activeTab === "ai-analysis") renderAiAnalysis();
    alert(`Added ${name} to SmartShelf!`);
  } catch (err) {
    alert("Failed to add product: " + err.message);
  }
};

function setupModals() {
  document.querySelectorAll(".close-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
    });
  });
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      e.target.classList.remove("active");
    }
  });
}

function setupEventListeners() {
  window.switchTab = switchTab;
  window.renderMonthlyHistory = renderMonthlyHistory;
  window.switchMonthlyHistoryMonth = switchMonthlyHistoryMonth;
  window.testSampleFormula = testSampleFormula;
  window.analyzeInspectedIngredients = analyzeInspectedIngredients;
  window.handleIngredientTextChange = handleIngredientTextChange;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
