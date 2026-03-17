import { getEventsForMonth } from '@/app/actions/events';
import { EventsClient } from '@/components/events-client';
import { hasPermission } from '@/lib/rbac';
import NepaliDate from 'nepali-date-converter';

export default async function EventsPage() {
  // Get current Nepali date for initial view
  let currentYear = 2082;
  let currentMonth = 0;
  try {
    const today = new NepaliDate(new Date());
    currentYear = today.getYear();
    currentMonth = today.getMonth();
  } catch {}

  const [initialEvents, canCreate, canEdit, canDelete] = await Promise.all([
    getEventsForMonth(currentYear, currentMonth),
    hasPermission('CREATE_EVENT'),
    hasPermission('UPDATE_EVENT'),
    hasPermission('DELETE_EVENT'),
  ]);

  return (
    <EventsClient
      initialEvents={initialEvents}
      initialYear={currentYear}
      initialMonth={currentMonth}
      canCreateEvent={canCreate}
      canEditEvent={canEdit}
      canDeleteEvent={canDelete}
    />
  );
}
