// CampusBites Shared TypeScript Types

export type VerificationStatus = "pending" | "verified" | "rejected";
export type ConfidenceLevel = "high" | "medium" | "low";
export type OrderStatus =
  | "received"
  | "preparing"
  | "packed"
  | "assigned"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "out_of_stock";
export type PaymentStatus = "created" | "paid" | "failed" | "refunded";
export type AdminRole = "super_admin" | "staff";

// Hostel Buildings
export const BUILDINGS = [
  "Hostel A",
  "Hostel B",
  "Hostel C",
  "Hostel D",
  "PG Block",
] as const;
export type Building = (typeof BUILDINGS)[number];

// Student Interface
export interface Student {
  id: string;
  mobile_number: string;
  short_name: string;
  roll_number: string;
  last_room_number?: string;
  verification_status: VerificationStatus;
  registered_at: string;
}

// Student Document details (Admin-only context)
export interface StudentDocument {
  id: string;
  student_id: string;
  id_card_url: string;
  ocr_extracted_name?: string;
  ocr_extracted_roll_number?: string;
  name_similarity_score?: number;
  duplicate_flag: boolean;
  confidence_level: ConfidenceLevel;
}

// Product Menu item
export interface Product {
  id: string;
  name: string;
  category_id: string;
  mrp: number;
  selling_price: number;
  image_url: string;
  is_available: boolean;
}

// Category
export interface Category {
  id: string;
  name: string;
}

// Order item line
export interface OrderItem {
  id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
}

// Order header
export interface Order {
  id: string;
  order_number: string;
  student_id: string;
  room_number: string;
  building: string;
  floor: number;
  total_amount: number;
  status: OrderStatus;
  payment_status?: string;
  special_instructions?: string;
  delivery_slot_id?: string;
  slot_name?: string;
  slot_delivery_start?: string;
  slot_delivery_end?: string;
  created_at: string;
  items?: OrderItem[];
  items_summary?: string;
  print_jobs?: PrintJob[];
  print_jobs_summary?: string;
  student_name?: string;
  student_phone?: string;
  delivery_partner_name?: string;
  not_available_flag?: boolean;
}

export type PrintColorMode = "bw" | "color";
export type PrintSides = "single" | "double";

export interface PrintPricing {
  id?: string;
  bw_single: number;
  bw_double: number;
  color_single: number;
  color_double: number;
  updated_at?: string;
}

export interface PrintJob {
  id?: string;
  order_id?: string;
  file_url: string;
  file_name: string;
  file_type: string;
  color_mode: PrintColorMode;
  sides: PrintSides;
  page_count: number;
  copies: number;
  unit_price: number;
  line_total: number;
}

// Recurring daily delivery slot
export interface DeliverySlot {
  id: string;
  name: string;
  delivery_start: string; // HH:MM
  delivery_end: string; // HH:MM
  order_cutoff: string; // HH:MM
  is_active: boolean;
  is_ordering_open: boolean;
  created_at?: string;
  updated_at?: string;
}

// Secure Order View for Delivery Partner
export interface DeliveryOrderView {
  id: string;
  order_number: string;
  student_name: string;
  student_phone: string;
  room_number: string;
  building: string;
  floor: number;
  total_amount: number;
  status: OrderStatus;
  special_instructions?: string;
  items: OrderItem[];
  print_jobs?: PrintJob[];
  payment_status: "Paid" | "Unpaid";
  assigned_at: string;
  delivered_at?: string;
  not_available_flag: boolean;
  delivery_notes?: string;
  slot_name?: string;
  slot_delivery_start?: string;
  slot_delivery_end?: string;
}

// Payment details
export interface Payment {
  id: string;
  order_id: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  amount: number;
  status: PaymentStatus;
}

// Delivery Partner Account
export interface DeliveryPartner {
  id: string;
  name: string;
  mobile_number: string;
  is_online: boolean;
  current_building?: string;
  current_floor?: number;
}

// Audit log entry
export interface AuditLog {
  id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

// API Responses
export interface AuthResponse {
  token: string;
  student?: Student;
  admin?: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
  };
  delivery_partner?: {
    id: string;
    name: string;
    mobile_number: string;
    is_online: boolean;
  };
}

export interface DashboardSummary {
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  verified_students: number;
  online_partners: number;
  popular_product: string;
}
