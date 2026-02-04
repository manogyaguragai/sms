// TypeScript types for SubTrack Admin System

// =============================================
// RBAC Types
// =============================================

export type UserRole = 'super_admin' | 'admin' | 'staff';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action_type: ActionType;
  description: string;
  metadata: Record<string, unknown>;
  target_table: string | null;
  target_id: string | null;
  ip_address: string | null;
  created_at: string;
  // Joined profile data
  profiles?: Profile;
}

export type ActionType = 
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_CREATED'
  | 'USER_DELETED'
  | 'SUBSCRIBER_CREATED'
  | 'SUBSCRIBER_UPDATED'
  | 'SUBSCRIBER_DELETED'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_UPDATED'
  | 'PAYMENT_DELETED'
  | 'EMAIL_SENT'
  | 'SMS_SENT'
  | 'DATA_EXPORTED'
  | 'SETTINGS_UPDATED'
  | 'CRON_TRIGGERED';

// Action type categories for UI color coding
export const ACTION_CATEGORIES = {
  CREATE: ['USER_CREATED', 'SUBSCRIBER_CREATED', 'PAYMENT_CREATED'],
  DELETE: ['USER_DELETED', 'SUBSCRIBER_DELETED', 'PAYMENT_DELETED'],
  COMMUNICATION: ['EMAIL_SENT', 'SMS_SENT'],
  SYSTEM: ['USER_LOGIN', 'USER_LOGOUT', 'DATA_EXPORTED', 'SETTINGS_UPDATED', 'CRON_TRIGGERED'],
} as const;

// =============================================
// Existing Types
// =============================================

export interface Subscriber {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'expired' | 'cancelled' | 'inactive';
  frequency: 'monthly' | 'annual';
  monthly_rate: number;
  reminder_days_before: number;
  subscription_end_date: string;
  created_at: string;
  status_notes: string | null;
  referred_by: string | null;
}

export interface Payment {
  id: string;
  subscriber_id: string;
  amount_paid: number;
  payment_date: string;
  proof_url: string | null;
  notes: string | null;
  payment_for_period: string | null;
  receipt_number: string | null;
  payment_mode: 'online_transfer' | 'physical_transfer' | null;
}

export interface PaymentWithSubscriber extends Payment {
  subscribers: {
    full_name: string;
    email: string | null;
  };
}

// Form input types
export interface SubscriberFormData {
  full_name: string;
  email?: string;
  phone?: string;
  frequency: 'monthly' | 'annual';
  reminder_days_before: number;
  referred_by?: string;
}

export interface PaymentFormData {
  amount_paid: number;
  notes?: string;
  proof_file?: File;
}

// Dashboard stats
export interface DashboardStats {
  mrr: number;
  totalSubscribers: number;
  activeSubscribers: number;
  expiringSoon: Subscriber[];
  recentPayments: PaymentWithSubscriber[];
}
