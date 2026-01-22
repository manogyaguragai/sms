// TypeScript types for SubTrack Admin System

export interface Subscriber {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'expired' | 'cancelled' | 'inactive';
  frequency: 'monthly' | 'annual';
  monthly_rate: number;
  reminder_days_before: number;
  subscription_end_date: string;
  created_at: string;
  status_notes: string | null;
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
    email: string;
  };
}

// Form input types
export interface SubscriberFormData {
  full_name: string;
  email: string;
  phone?: string;
  frequency: 'monthly' | 'annual';
  monthly_rate: number;
  reminder_days_before: number;
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
