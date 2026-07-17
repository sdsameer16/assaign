import {
  AuthResponse,
  DashboardSummary,
  Product,
  Student,
  DeliveryPartner,
  Order,
  AuditLog,
} from "@campusbites/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/admin";

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

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

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

  cancelOrder: (orderId: string) =>
    apiRequest<{ message: string }>(`/orders/${orderId}/cancel`, {
      method: "POST",
    }),

  deliverOrder: (orderId: string) =>
    apiRequest<{ message: string }>(`/orders/${orderId}/deliver`, {
      method: "POST",
    }),

  getCutoff: () => apiRequest<{ cutoff_time: string }>("/cutoff"),

  setCutoff: (cutoffTime: string) =>
    apiRequest<{ message: string }>("/cutoff", {
      method: "POST",
      body: JSON.stringify({ cutoff_time: cutoffTime }),
    }),

  // Audit Trails
  getAuditLogs: () => apiRequest<AuditLog[]>("/audit-logs"),
};
