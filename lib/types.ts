// TypeScript types for SubTrack Admin System

export interface Subscriber {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'expired' | 'cancelled';
  frequency: 'monthly' | 'annual';
  monthly_rate: number;
  reminder_days_before: number;
  subscription_end_date: string;
  created_at: string;
}

export interface Payment {
  id: string;
  subscriber_id: string;
  amount_paid: number;
  payment_date: string;
  proof_url: string | null;
  notes: string | null;
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
