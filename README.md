# SubTrack - Subscription Management System

A modern, Admin-only Subscription Management System built with Next.js 14+. Designed for organizations managing approximately 1,000 subscribers with features for payment tracking, automated reminders, and revenue analytics.

## Features

- **Subscriber Management** - Add, edit, and manage subscribers with monthly/annual billing cycles
- **Payment Tracking** - Record payments with image proof uploads (auto-compressed)
- **Automated Email Reminders** - Cron-based reminders before subscription expiry
- **Analytics Dashboard** - MRR tracking, expiring subscriptions, and payment audit feed
- **Secure Authentication** - Admin-only access with Supabase Auth

## Tech Stack

- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Database & Auth:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (payment voucher images)
- **UI:** Tailwind CSS + shadcn/ui + Lucide Icons
- **Email:** Resend
- **Cron/Scheduling:** Vercel Cron Jobs
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- Supabase account
- Resend account (for email reminders)

### Environment Variables

Create a `.env.local` file with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key
CRON_SECRET=your_cron_secret
ADMIN_EMAIL=your_admin_email
```

### Database Setup

Execute the following SQL in your Supabase SQL Editor:

```sql
-- Subscribers Table
CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'annual')),
  monthly_rate DECIMAL(10,2) NOT NULL,
  reminder_days_before INT DEFAULT 7,
  subscription_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments Table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
  amount_paid DECIMAL(10,2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  proof_url TEXT,
  notes TEXT
);

-- Enable RLS
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access" ON subscribers 
  FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins have full access" ON payments 
  FOR ALL TO authenticated USING (true);
```

Also create a storage bucket called `vouchers` for payment proof images.

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

### Deployment

Deploy easily to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Configure the cron job in `vercel.json` for automated reminders.

## Project Structure

```
├── app/
│   ├── (auth)/           # Login page
│   ├── (dashboard)/      # Dashboard, subscribers, settings
│   ├── actions/          # Server actions and cron logic
│   └── api/              # API routes (cron endpoint)
├── components/           # UI components (shadcn/ui based)
├── lib/                  # Utilities, Supabase client, Resend config
└── public/               # Static assets
```

## License

MIT License
