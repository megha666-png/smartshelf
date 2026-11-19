/**
 * SmartShelf Client API Bridge.
 * Connects frontend views to FastAPI endpoints.
 */

const API_BASE = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1")
  ? "" 
  : "http://localhost:8000";

export const API = {
  async request(endpoint, options = {}) {
    const defaultHeaders = {
      "Content-Type": "application/json",
    };
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...(options.headers || {})
        }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP Error ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  // Auth & Household
  login: (email, password) => API.request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  getHousehold: (id = 1) => API.request(`/api/household?household_id=${id}`),
  joinHousehold: (share_code) => API.request("/api/household/join", { method: "POST", body: JSON.stringify({ share_code }) }),
  renameHousehold: (name, id = 1) => API.request("/api/household/rename", { method: "POST", body: JSON.stringify({ name, household_id: id }) }),

  // Products
  getProducts: (category = "All") => API.request(`/api/products?category=${encodeURIComponent(category)}`),
  createProduct: (product) => API.request("/api/products", { method: "POST", body: JSON.stringify(product) }),
  classifyProduct: (image_base64 = null, filename = "", text_hint = "") =>
    API.request("/api/products/classify", {
      method: "POST",
      body: JSON.stringify({ image_base64, filename, text_hint })
    }),
  productAction: (id, action, waste_reason = null) => 
    API.request(`/api/products/${id}/action`, { method: "POST", body: JSON.stringify({ action, waste_reason }) }),
  updateProduct: (id, data) =>
    API.request(`/api/products/${id}`, { method: "POST", body: JSON.stringify(data) }),
  deleteProduct: (id) => API.request(`/api/products/${id}`, { method: "DELETE" }),
  batchDeleteProducts: (ids) => API.request("/api/products/batch-delete", { method: "POST", body: JSON.stringify({ ids }) }),
  renameCategory: (old_name, new_name) => API.request("/api/categories/rename", { method: "POST", body: JSON.stringify({ old_name, new_name }) }),

  // AI & Analytics
  getAnalysisOverview: () => API.request("/api/analysis/overview"),
  evaluatePurchase: (product_name, category, price, quantity = 1) =>
    API.request("/api/analysis/evaluate-purchase", {
      method: "POST",
      body: JSON.stringify({ product_name, category, price, quantity })
    }),
  analyzeIngredients: (ingredient_text, image_base64 = null) =>
    API.request("/api/ingredients/analyze", {
      method: "POST",
      body: JSON.stringify({ ingredient_text, image_base64 })
    }),
  getInsights: () => API.request("/api/analysis/insights"),
  getAnalytics: () => API.request("/api/analytics"),
  getMonthlyExpenditure: (household_id = 1, month = null) => {
    let url = `/api/expenditure/monthly?household_id=${household_id}`;
    if (month) url += `&month=${encodeURIComponent(month)}`;
    return API.request(url);
  },
  getExpenditureHistory: (household_id = 1) => API.request(`/api/expenditure/history?household_id=${household_id}`),
  getNotifications: () => API.request("/api/notifications"),
  markNotificationRead: (id) => API.request(`/api/notifications/${id}/read`, { method: "POST" })
};
