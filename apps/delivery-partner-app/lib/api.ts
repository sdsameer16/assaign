import { AuthResponse, DeliveryOrderView } from "@campusbites/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/delivery";

export const getToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("delivery_token");
  }
  return null;
};

export const setSession = (token: string, partner: any) => {
  localStorage.setItem("delivery_token", token);
  localStorage.setItem("delivery_profile", JSON.stringify(partner));
};

export const getProfile = (): any | null => {
  if (typeof window !== "undefined") {
    const profile = localStorage.getItem("delivery_profile");
    return profile ? JSON.parse(profile) : null;
  }
  return null;
};

export const logout = () => {
  localStorage.removeItem("delivery_token");
  localStorage.removeItem("delivery_profile");
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

export const deliveryApi = {
  // Login
  login: (mobileNumber: string, secret: string) =>
    apiRequest<AuthResponse>("/login", {
      method: "POST",
      body: JSON.stringify({ mobile_number: mobileNumber, password: secret }),
    }),

  // List assigned deliveries
  getAssigned: () => apiRequest<DeliveryOrderView[]>("/orders"),

  // Mark delivered
  markDelivered: (id: string) =>
    apiRequest<{ message: string }>(`/orders/${id}/delivered`, {
      method: "PATCH",
    }),

  // Mark customer missing
  markNotAvailable: (id: string) =>
    apiRequest<{ message: string }>(`/orders/${id}/not-available`, {
      method: "PATCH",
    }),

  // Update notes
  updateNotes: (id: string, notes: string) =>
    apiRequest<{ message: string }>(`/orders/${id}/notes`, {
      method: "PATCH",
      body: JSON.stringify({ notes }),
    }),

  // Own delivery stats (shift summaries)
  getStats: () => apiRequest<{ pending: number; delivered: number }>("/stats"),

  // Own completed delivery history logs
  getHistory: () => apiRequest<any[]>("/history"),
};
