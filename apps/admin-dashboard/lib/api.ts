import {
  AuthResponse,
  DashboardSummary,
  Product,
  Category,
  DeliverySlot,
  Student,
  DeliveryPartner,
  Order,
  AuditLog,
  PrintPricing,
  TrackingAd,
} from "@campusbites/types";

const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/admin";
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1" &&
    (envUrl.includes("localhost") || envUrl.includes("127.0.0.1"))
  ) {
    return envUrl
      .replace("localhost", window.location.hostname)
      .replace("127.0.0.1", window.location.hostname);
  }
  return envUrl;
};

const API_BASE_URL = getApiBaseUrl();

export const getToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("admin_token");
  }
  return null;
};

export const setSession = (token: string, admin: any) => {
  localStorage.setItem("admin_token", token);
  localStorage.setItem("admin_profile", JSON.stringify(admin));
};

export const getProfile = (): any | null => {
  if (typeof window !== "undefined") {
    const profile = localStorage.getItem("admin_profile");
    return profile ? JSON.parse(profile) : null;
  }
  return null;
};

export const logout = () => {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_profile");
};

let isHandling401 = false;

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const baseUrl = getApiBaseUrl();
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (token || isHandling401) {
      logout();
      if (!isHandling401 && typeof window !== "undefined") {
        isHandling401 = true;
        window.location.reload();
      }
      throw new Error("Session expired");
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`,
    );
  }

  return response.json();
}

export const adminApi = {
  // Login
  login: (emailStr: string, pass: string) =>
    apiRequest<AuthResponse>("/login", {
      method: "POST",
      body: JSON.stringify({ email: emailStr, password: pass }),
    }),

  // Summary Metrics
  getSummary: () => apiRequest<DashboardSummary>("/dashboard/summary"),

  // Categories
  getCategories: () => apiRequest<Category[]>("/categories"),

  createCategory: (name: string) =>
    apiRequest<Category>("/categories", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  // Products CRUD
  getProducts: () => apiRequest<Product[]>("/products"),

  createProduct: (data: {
    name: string;
    category_id: string;
    mrp: number;
    selling_price: number;
    image_url: string;
  }) =>
    apiRequest<{ id: string; message: string }>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateProduct: (
    id: string,
    data: {
      name: string;
      category_id: string;
      mrp: number;
      selling_price: number;
      image_url: string;
      is_available: boolean;
    },
  ) =>
    apiRequest<{ message: string }>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Students verification list
  getStudents: () => apiRequest<Student[]>("/students"),

  verifyStudent: (id: string, status: "verified" | "rejected") =>
    apiRequest<{ message: string }>(`/students/${id}/verify`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // Delivery Partners
  getPartners: () => apiRequest<DeliveryPartner[]>("/delivery-partners"),

  createPartner: (data: {
    name: string;
    mobile_number: string;
    password: string;
  }) =>
    apiRequest<{ id: string; message: string }>("/delivery-partners", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Order Assignments
  getOrders: () => apiRequest<Order[]>("/orders"),

  assignPartner: (orderId: string, partnerId: string) =>
    apiRequest<{ message: string }>(`/orders/${orderId}/assign`, {
      method: "POST",
      body: JSON.stringify({ delivery_partner_id: partnerId }),
    }),

  markOutOfStock: (orderId: string) =>
    apiRequest<{ message: string }>(`/orders/${orderId}/out-of-stock`, {
      method: "POST",
    }),

  cancelOrder: (orderId: string) =>
    apiRequest<{ message: string }>(`/orders/${orderId}/cancel`, {
      method: "POST",
    }),

  deliverOrder: (orderId: string) =>
    apiRequest<{ message: string }>(`/orders/${orderId}/deliver`, {
      method: "POST",
    }),

  getCutoff: async () => {
    try {
      return await apiRequest<{ cutoff_time: string }>("/cutoff");
    } catch (e) {
      const baseUrl = getApiBaseUrl().replace("/api/admin", "/api/student");
      const res = await fetch(`${baseUrl}/cutoff`);
      if (res.ok) {
        return await res.json();
      }
      return { cutoff_time: "00:01" };
    }
  },

  setCutoff: (cutoffTime: string) =>
    apiRequest<{ message: string }>("/cutoff", {
      method: "POST",
      body: JSON.stringify({ cutoff_time: cutoffTime }),
    }),

  getDeliverySlots: () => apiRequest<DeliverySlot[]>("/delivery-slots"),

  createDeliverySlot: (data: {
    name: string;
    delivery_start: string;
    delivery_end: string;
    order_cutoff: string;
    is_active?: boolean;
  }) =>
    apiRequest<DeliverySlot>("/delivery-slots", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDeliverySlot: (
    id: string,
    data: {
      name: string;
      delivery_start: string;
      delivery_end: string;
      order_cutoff: string;
      is_active?: boolean;
    },
  ) =>
    apiRequest<DeliverySlot>(`/delivery-slots/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  toggleDeliverySlot: (id: string, isActive: boolean) =>
    apiRequest<DeliverySlot>(`/delivery-slots/${id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    }),

  getPrintPricing: () => apiRequest<PrintPricing>("/print-pricing"),

  updatePrintPricing: (data: {
    bw_single: number;
    bw_double: number;
    color_single: number;
    color_double: number;
  }) =>
    apiRequest<PrintPricing>("/print-pricing", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getTrackingAd: () => apiRequest<TrackingAd>("/tracking-ad"),

  updateTrackingAd: (data: { is_enabled: boolean; image_url: string }) =>
    apiRequest<TrackingAd>("/tracking-ad", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  sendNotification: (target: string, title: string, body: string) =>
    apiRequest<{ message: string; targetCount: number }>("/send-notification", {
      method: "POST",
      body: JSON.stringify({ target_student: target, title, body }),
    }),

  getDeliveryConfig: () =>
    apiRequest<{ delivery_fee: number; min_free_delivery_amount: number }>("/delivery-config"),

  updateDeliveryConfig: (deliveryFee: number, minFreeDeliveryAmount: number) =>
    apiRequest<{ status: string; delivery_fee: number; min_free_delivery_amount: number }>("/delivery-config", {
      method: "PUT",
      body: JSON.stringify({ delivery_fee: deliveryFee, min_free_delivery_amount: minFreeDeliveryAmount }),
    }),

  // Menu Schedules
  getMenuSchedules: () => apiRequest<import("@campusbites/types").MenuSchedule[]>("/menu-schedules"),

  createMenuSchedule: (data: {
    name: string;
    start_time: string;
    end_time: string;
    is_enabled: boolean;
    display_order: number;
    category_ids: string[];
  }) =>
    apiRequest<{ status: string; id: string }>("/menu-schedules", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateMenuSchedule: (
    id: string,
    data: {
      name: string;
      start_time: string;
      end_time: string;
      is_enabled: boolean;
      display_order: number;
      category_ids: string[];
    },
  ) =>
    apiRequest<{ status: string }>(`/menu-schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteMenuSchedule: (id: string) =>
    apiRequest<{ status: string }>(`/menu-schedules/${id}`, {
      method: "DELETE",
    }),

  // Audit Trails
  getAuditLogs: () => apiRequest<AuditLog[]>("/audit-logs"),

  // Payment Health & Reconciliation
  getPaymentHealth: () => apiRequest<PaymentHealthRecord[]>("/payments/health"),

  reconcilePayment: (id: string) =>
    apiRequest<{ message: string; razorpay_order_id: string; razorpay_payment_id: string }>(
      `/payments/${id}/reconcile`,
      { method: "POST" },
    ),
};

export interface PaymentHealthRecord {
  id: string;
  order_id: string;
  order_number: string;
  student_name: string;
  student_phone: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amount: number;
  status: string;
  reconciled_at?: string;
  reconciliation_notes?: string;
  reconciliation_attempt_count: number;
  last_reconciliation_error?: string;
  last_reconciliation_at?: string;
  reconciliation_source?: string;
  razorpay_status?: string;
  created_at: string;
}


