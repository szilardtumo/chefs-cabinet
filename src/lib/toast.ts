import { ConvexError } from 'convex/values';
import { toast } from 'sonner';

/** The message to show users for an error. */
export function errorMessage(error: unknown) {
  // A `ConvexError`'s message also has the function name and request id; its data is the message meant for users
  if (error instanceof ConvexError && typeof error.data === 'string') return error.data;
  return error instanceof Error ? error.message : 'An unknown error occurred';
}

export function toastError(error: unknown) {
  toast.error('Error', { description: errorMessage(error) });
}

/** Success toast with an Undo action that runs `undo` and reports its failure. */
export function toastWithUndo(message: string, undo: () => Promise<unknown>) {
  toast.success(message, {
    action: { label: 'Undo', onClick: () => undo().catch(toastError) },
  });
}
