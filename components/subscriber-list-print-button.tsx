'use client';

import { useState } from 'react';
import { PrintSubscriberList } from '@/components/print-subscriber-list';
import { Button } from '@/components/ui/button';
import { Printer, Loader2 } from 'lucide-react';

export function SubscriberListPrintButton() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setDialogOpen(true)}
        className="border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
      >
        <Printer className="w-4 h-4 mr-2" />
        Print List
      </Button>
      <PrintSubscriberList
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
