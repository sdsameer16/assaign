import { AuthResponse, DeliveryOrderView } from "@campusbites/types";

const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.trim().replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8080/api/delivery";
    }
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${window.location.host}/api/delivery`;
  }

  return "http://localhost:8080/api/delivery";
};

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

let isHandling401 = false;

// Generic fetch wrapper
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please check your network connection.");
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("Network unavailable. Please check your internet connection.");
    }
    throw new Error(
      `Unable to connect to delivery backend server (${baseUrl}). Please verify server is reachable.`
    );
  } finally {
    clearTimeout(timeoutId);
  }

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
