import { ConvexError } from 'convex/values';
import { toast } from 'sonner';

export function toastError(error: unknown) {
  toast.error('Error', {
    // A `ConvexError`'s message also has the function name and request id; its data is the message meant for users
    description:
      error instanceof ConvexError && typeof error.data === 'string'
        ? error.data
        : error instanceof Error
          ? error.message
          : 'An unknown error occurred',
  });
}

/** Success toast with an Undo action that runs `undo` and reports its failure. */
export function toastWithUndo(message: string, undo: () => Promise<unknown>) {
  toast.success(message, {
    action: { label: 'Undo', onClick: () => undo().catch(toastError) },
  });
}
