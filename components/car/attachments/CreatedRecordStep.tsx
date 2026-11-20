import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui';
import type { AttachmentRecord } from '@/queries/attachments';
import RecordAttachments from './RecordAttachments';

export default function CreatedRecordStep({
  vehicleId,
  record,
  summary,
  warning,
  busy,
  onBusyChange,
  onDone,
}: {
  vehicleId: string;
  record?: AttachmentRecord;
  summary: string;
  warning?: string;
  busy: boolean;
  onBusyChange: (_busy: boolean) => void;
  onDone: () => void;
}) {
  const confirmation = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    confirmation.current?.focus();
  }, []);
  return (
    <>
      <p ref={confirmation} tabIndex={-1} className="wrap-anywhere text-sm text-muted-foreground">
        {summary}
      </p>
      {warning && (
        <p role="alert" className="text-sm text-destructive">
          {warning}
        </p>
      )}
      {record && (
        <RecordAttachments
          vehicleId={vehicleId}
          record={record}
          context="creation"
          disabled={busy}
          onBusyChange={onBusyChange}
        />
      )}
      <footer className="flex justify-end border-t pt-4">
        <Button
          type="button"
          className="w-full min-h-11 sm:w-auto"
          disabled={busy}
          onClick={onDone}
        >
          Done
        </Button>
      </footer>
    </>
  );
}
