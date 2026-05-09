import { api } from '@convex/_generated/api';
import { convexAction } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Command, CommandInput, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';

export type UnsplashPhoto = {
  id: string;
  thumbUrl: string;
  imageUrl: string;
  alt: string;
  photographer: string;
};

type UnsplashCoverPhotoPickerProps = {
  onPhotoSelected: (photo: UnsplashPhoto) => void;
  disabled?: boolean;
};

export function UnsplashCoverPhotoPicker({ onPhotoSelected, disabled }: UnsplashCoverPhotoPickerProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);

  const { data, isFetching, isError, error, isFetched } = useQuery({
    ...convexAction(api.unsplash.searchPhotos, { query: debouncedQuery, page: 1 }),
    enabled: debouncedQuery.length >= 2,
  });

  const results = data?.results ?? [];
  const total = data?.total ?? 0;

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border bg-background',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search e.g. pasta, cake, salad…"
          value={query}
          onValueChange={setQuery}
          disabled={disabled}
        />
        <div className="space-y-1 border-b px-3 py-2">
          <p className="text-muted-foreground text-xs">
            Photos provided by{' '}
            <a
              href="https://unsplash.com/?utm_source=chefs_cabinet&utm_medium=referral"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Unsplash
            </a>
            . Type at least 2 characters to search.
            {total > 0 ? ` · ${total} results` : null}
          </p>
          {isError && (
            <p className="text-destructive text-xs">{error instanceof Error ? error.message : 'Search failed.'}</p>
          )}
        </div>
        <CommandList className="max-h-none overflow-hidden">
          {!results.length ? (
            <div className="h-[min(320px,40vh)] flex items-center justify-center px-4 text-muted-foreground text-sm">
              {isFetching ? (
                <Spinner className="size-5" />
              ) : isFetched ? (
                'No photos found. Try another search.'
              ) : (
                'Enter a search to browse stock photos for your recipe cover.'
              )}
            </div>
          ) : (
            <ScrollArea className="h-[min(320px,40vh)]">
              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                {results.map((photo) => (
                  <img
                    key={photo.id}
                    src={photo.thumbUrl}
                    alt={photo.alt}
                    onClick={() => onPhotoSelected(photo)}
                    // 'group relative aspect-video w-full overflow-hidden rounded-md border bg-muted transition hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60',

                    className="aspect-video rounded-md bg-muted object-cover transition cursor-pointer hover:scale-[1.02] hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60 "
                    loading="lazy"
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CommandList>
      </Command>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        Using a photo registers the download with Unsplash and should include credit to the photographer when you share
        the recipe publicly.{' '}
        <a
          href="https://unsplash.com/terms"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Terms
        </a>
      </div>
    </div>
  );
}
