import { toast } from 'sonner';

export function toastError(error: unknown) {
  toast.error('Error', {
    description: error instanceof Error ? error.message : 'An unknown error occurred',
  });
}

/** Success toast with an Undo action that runs `undo` and reports its failure. */
export function toastWithUndo(message: string, undo: () => Promise<unknown>) {
  toast.success(message, {
    action: { label: 'Undo', onClick: () => undo().catch(toastError) },
  });
}
