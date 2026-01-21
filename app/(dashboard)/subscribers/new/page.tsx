import { SubscriberForm } from '@/components/subscriber-form';
import { UserPlus } from 'lucide-react';

export default function NewSubscriberPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-blue-400" />
          Add New Subscriber
        </h1>
        <p className="text-slate-400 mt-1">
          Create a new subscription for a user
        </p>
      </div>

      {/* Form */}
      <SubscriberForm mode="create" />
    </div>
  );
}
