import { Image } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ImagePreviewProps extends Omit<React.ComponentProps<'img'>, 'src'> {
  src: File | string | undefined;
}

export const ImagePreview = ({ src, className, ...props }: ImagePreviewProps) => {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!src || typeof src === 'string') {
      setUrl(src);
      return;
    }

    const result = URL.createObjectURL(src);
    setUrl(result);
    return () => {
      URL.revokeObjectURL(result);
      setUrl(undefined);
    };
  }, [src]);

  if (!url)
    return (
      <div className={cn('w-full bg-muted flex items-center justify-center border', className)}>
        <Image className="h-12 w-12 text-muted-foreground" />
      </div>
    );

  return <img src={url} alt="Preview" className={cn('w-full h-full object-cover border', className)} {...props} />;
};
