import { ScanBarcode } from 'lucide-react';
import { type ComponentProps, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCallbackRef } from '@/hooks/use-callback-ref';
import { isbnSchema } from '@/lib/isbn';

// TypeScript's DOM types don't include the Barcode Detection API yet
declare class BarcodeDetector {
  constructor(options: { formats: string[] });
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

type IsbnScannerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (isbn: string) => void;
};

/** Reads the ISBN barcode on the back of a book with the device camera. */
function IsbnScannerDialog({ open, onOpenChange, onScan }: IsbnScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();
  const handleScan = useCallbackRef(onScan);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    setError(undefined);

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const video = videoRef.current;
        // Closed while the camera was starting; the cleanup ran before `stream` was set
        if (stopped || !video) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        video.srcObject = stream;
        await video.play();

        const detector = new BarcodeDetector({ formats: ['ean_13'] });
        while (!stopped) {
          const barcodes = await detector.detect(video);
          // Book barcodes are EAN-13 codes that are valid ISBNs; others are prices or products
          const isbn = barcodes.map((barcode) => barcode.rawValue).find((value) => isbnSchema.safeParse(value).success);
          if (isbn) {
            handleScan(isbn);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : 'The camera is not available');
      }
    })();

    return () => {
      stopped = true;
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [open, handleScan]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan ISBN</DialogTitle>
          <DialogDescription>Point the camera at the barcode on the back of the book.</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <video ref={videoRef} className="aspect-video w-full rounded-md bg-muted object-cover" muted playsInline />
        )}
      </DialogContent>
    </Dialog>
  );
}

type IsbnScanButtonProps = Pick<ComponentProps<typeof Button>, 'variant' | 'disabled'> & {
  onScan: (isbn: string) => void;
};

/** Opens the camera to scan an ISBN; disabled in browsers without barcode detection. */
export function IsbnScanButton({ onScan, variant = 'outline', disabled }: IsbnScanButtonProps) {
  const [open, setOpen] = useState(false);
  // Chrome on Android and macOS has the Barcode Detection API; Safari and Firefox don't.
  // Only known in the browser, so the server render keeps the button disabled.
  const canScan = useSyncExternalStore(
    () => () => {},
    () => 'BarcodeDetector' in window,
    () => false,
  );

  return (
    <>
      {/* Disabled buttons don't show a title on hover, so the wrapper explains why it's unavailable */}
      <span title={canScan ? undefined : "This browser can't scan barcodes. Try Chrome, or type the ISBN."}>
        <Button
          type="button"
          variant={variant}
          size="icon"
          onClick={() => setOpen(true)}
          disabled={!canScan || disabled}
          aria-label="Scan ISBN barcode"
        >
          <ScanBarcode />
        </Button>
      </span>
      <IsbnScannerDialog
        open={open}
        onOpenChange={setOpen}
        onScan={(isbn) => {
          setOpen(false);
          onScan(isbn);
        }}
      />
    </>
  );
}
