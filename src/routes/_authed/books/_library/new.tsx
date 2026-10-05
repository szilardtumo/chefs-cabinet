import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexAction, convexQuery, useConvexAction } from '@convex-dev/react-query';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { FunctionReturnType } from 'convex/server';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { isbnSchema } from '@/lib/isbn';
import { toastError } from '@/lib/toast';
import { BookCover } from '../-components/book-cover';
import { IsbnScanButton } from '../-components/isbn-scan-button';

type SearchResult = FunctionReturnType<typeof api.bookLookup.searchBooks>[number];
type Edition = FunctionReturnType<typeof api.bookLookup.getEditions>[number];

function LookupRow({ title, coverUrl, details }: { title: string; coverUrl?: string; details: unknown[] }) {
  return (
    <>
      <BookCover book={{ title, coverUrl: coverUrl ?? null }} className="w-8" />
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{details.filter(Boolean).join(' · ')}</p>
      </div>
    </>
  );
}

export const Route = createFileRoute('/_authed/books/_library/new')({
  component: QuickAddRoute,
  context: () => ({ title: 'Add book' }),
});

function QuickAddRoute() {
  const navigate = Route.useNavigate();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  // A search result whose editions are listed to pick from
  const [pickedBook, setPickedBook] = useState<SearchResult>();
  const [editionFilter, setEditionFilter] = useState('');
  const { data: books } = useQuery(convexQuery(api.books.getAll, {}));

  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, 400);
  // Every lookup is a request to the rate-limited catalog, so it waits for a pause in typing,
  // and results are never refetched (catalog data doesn't change while you pick)
  const isIsbn = isbnSchema.safeParse(debouncedQuery).success;
  const search = useQuery({
    ...convexAction(api.bookLookup.searchBooks, { query: debouncedQuery }),
    enabled: !isIsbn && debouncedQuery.length >= 3,
    staleTime: Number.POSITIVE_INFINITY,
  });
  // The picked book's editions, or the edition a typed or scanned ISBN belongs to
  const showEditions = pickedBook !== undefined || isIsbn;
  const editions = useQuery({
    ...convexAction(api.bookLookup.getEditions, pickedBook ? { bookId: pickedBook.bookId } : { isbn: debouncedQuery }),
    enabled: showEditions,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const openBook = (bookId: Id<'books'>) =>
    navigate({ to: '/books/$bookId', params: { bookId }, search: (prev) => prev, replace: true });

  const { mutate: addBook, isPending: isAdding } = useMutation({
    mutationFn: useConvexAction(api.bookLookup.addBook),
    onSuccess: openBook,
    onError: toastError,
  });

  // Adds the edition as "Want to read" and opens it, where status and dates can be set;
  // an edition that's already in the library just opens
  const addOrOpen = (edition: Edition) => {
    const existingBook = edition.isbn && books?.find((book) => book.isbn === edition.isbn);
    if (!existingBook) return addBook({ editionId: edition.editionId });
    toast.info('Already in your library');
    openBook(existingBook._id);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        className="w-full gap-0 sm:max-w-md"
        // Fires after the exit animation; skipped when the route unmounts some other way (e.g. browser back)
        onCloseAutoFocus={() => !open && navigate({ to: '/books', search: (prev) => prev, replace: true })}
      >
        <SheetHeader>
          <SheetTitle>Add book</SheetTitle>
          <SheetDescription>Find the edition you have by title, author or ISBN.</SheetDescription>
        </SheetHeader>
        <div className="flex gap-2 px-4 pb-4">
          {/* Search results come ranked from the catalog; editions are filtered here by language, publisher or year */}
          <Command
            shouldFilter={pickedBook !== undefined}
            // Plain substring match on the keywords; cmdk's fuzzy match would also match digits of edition ids
            filter={(_value, search, keywords) =>
              keywords?.join(' ').toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
            }
            className="h-auto rounded-md border"
          >
            {pickedBook && (
              <div className="flex items-center gap-1 border-b px-1 py-1 text-sm">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => {
                    setPickedBook(undefined);
                    setEditionFilter('');
                  }}
                  aria-label="Back to search results"
                >
                  <ArrowLeft />
                </Button>
                <span className="truncate">Editions of {pickedBook.title}</span>
              </div>
            )}
            <CommandInput
              value={pickedBook ? editionFilter : query}
              onValueChange={pickedBook ? setEditionFilter : setQuery}
              placeholder={pickedBook ? 'Filter by language, publisher or year' : 'Title, author or ISBN'}
              disabled={isAdding}
              autoFocus
            />
            {(isAdding || trimmedQuery || pickedBook) && (
              <CommandList className="p-1">
                {isAdding ||
                editions.isLoading ||
                (!pickedBook && (search.isLoading || trimmedQuery !== debouncedQuery)) ? (
                  <div className="flex justify-center py-6">
                    <Spinner />
                  </div>
                ) : showEditions ? (
                  editions.isError ? (
                    <p className="py-6 text-center text-sm text-destructive">{editions.error.message}</p>
                  ) : (
                    <>
                      <CommandEmpty>{pickedBook ? 'No editions found' : 'No book found for this ISBN'}</CommandEmpty>
                      {editions.data?.map((edition) => (
                        <CommandItem
                          key={edition.editionId}
                          value={String(edition.editionId)}
                          keywords={[
                            edition.title,
                            edition.language,
                            edition.publisher,
                            edition.publishedYear,
                            edition.format,
                          ]
                            .filter(Boolean)
                            .map(String)}
                          onSelect={() => addOrOpen(edition)}
                        >
                          <LookupRow
                            title={edition.title}
                            coverUrl={edition.coverUrl}
                            details={[edition.language, edition.format, edition.publisher, edition.publishedYear]}
                          />
                        </CommandItem>
                      ))}
                    </>
                  )
                ) : search.isError ? (
                  <p className="py-6 text-center text-sm text-destructive">{search.error.message}</p>
                ) : (
                  <>
                    <CommandEmpty>
                      {trimmedQuery.length < 3 ? 'Type at least 3 characters' : 'No books found'}
                    </CommandEmpty>
                    {search.data?.map((result) => (
                      <CommandItem
                        key={result.bookId}
                        value={String(result.bookId)}
                        onSelect={() => setPickedBook(result)}
                      >
                        <LookupRow
                          title={result.title}
                          coverUrl={result.coverUrl}
                          details={[result.author, result.releaseYear]}
                        />
                      </CommandItem>
                    ))}
                  </>
                )}
              </CommandList>
            )}
          </Command>
          <IsbnScanButton
            onScan={(isbn) => {
              setPickedBook(undefined);
              setEditionFilter('');
              setQuery(isbn);
            }}
            disabled={isAdding}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
