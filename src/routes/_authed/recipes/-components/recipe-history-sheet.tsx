import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { type Change, diffWords } from 'diff';
import { groupBy } from 'es-toolkit';
import { ArrowRight, ChevronRight, ImageIcon, Sparkles } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '@/components/ui/timeline';
import { isStorageId } from '@/lib/storage';
import { cn } from '@/lib/utils';

type HistoryEntry = Doc<'recipeHistories'>;

/** Each part of the recipe as text, with ingredients and steps one per line by group, so every change shows as a word diff. */
function recipeText(entry: HistoryEntry): Record<string, string> {
  return {
    Title: entry.title,
    Description: entry.description,
    'Prep time': entry.prepTime ? `${entry.prepTime} min` : '',
    'Cook time': entry.cookingTime ? `${entry.cookingTime} min` : '',
    Servings: entry.servings?.toString() ?? '',
    Tags: entry.tags.join(', '),
    Source: entry.source ?? '',
    Ingredients: groupsText(
      Object.entries(groupBy(entry.ingredients, (ingredient) => ingredient.group ?? '')).map(
        ([title, ingredients]) => ({
          title,
          lines: ingredients.map(
            ({ name, quantity, unit, notes }) =>
              [quantity, unit, name].filter(Boolean).join(' ') + (notes ? `, ${notes}` : ''),
          ),
        }),
      ),
    ),
    Instructions: groupsText(entry.instructions.map(({ title, steps }) => ({ title, lines: steps }))),
  };
}

/** Each group's lines under a `Title:` line, with a blank line between groups. */
function groupsText(groups: { title?: string; lines: string[] }[]) {
  return groups.map(({ title, lines }) => [title && `${title}:`, ...lines].filter(Boolean).join('\n')).join('\n\n');
}

/** The text once, with removed words struck out and added words highlighted. */
function WordDiff({ parts }: { parts: Change[] }) {
  return parts.map((part, i) => (
    <span
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts never reorder
      key={i}
      className={cn(
        part.added && 'rounded-sm bg-success/10 text-success',
        part.removed && 'rounded-sm bg-destructive/10 text-destructive line-through decoration-destructive/50',
        // Space between a removed word and the word that replaces it, so they don't read as one word
        part.removed && parts[i + 1]?.added && 'me-1',
      )}
    >
      {part.value}
    </span>
  ));
}

/** Linked images preview directly. Uploads are stored by ID, which only the server can turn into a URL. */
function ImagePreview({ value, removed }: { value?: string; removed?: boolean }) {
  if (!value) return <span className="text-muted-foreground">None</span>;
  const className = cn('size-16 rounded-md border', removed && 'opacity-50');
  if (isStorageId(value)) {
    return (
      <span title="Uploaded image" className={cn(className, 'flex items-center justify-center bg-muted')}>
        <ImageIcon className="size-4" />
      </span>
    );
  }
  return <img src={value} alt="" className={cn(className, 'object-cover')} />;
}

function entryTitle(entry: HistoryEntry, previous?: HistoryEntry) {
  if (entry.type === 'created') return entry.aiPrompt ? 'Imported with AI' : 'Created';
  // Recipes from before history was kept start with an entry of how they were then
  if (!previous) return 'History started';
  return entry.aiPrompt ? 'Revised with AI' : 'Edited';
}

/** A recipe's change history, newest first, with each save compared to the one before it. */
export function RecipeHistorySheet({
  recipeId,
  open,
  onOpenChange,
}: {
  recipeId: Id<'recipes'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: history = [] } = useQuery({
    ...convexQuery(api.recipeHistories.getByRecipe, { recipeId }),
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Recipe history</SheetTitle>
          <SheetDescription>Every save, newest first</SheetDescription>
        </SheetHeader>
        <Timeline className="px-4 pb-6">
          {history
            .map((entry, index) => ({ entry, previous: history[index - 1] }))
            .reverse()
            .map(({ entry, previous }, index) => {
              const before = previous && recipeText(previous);
              // Diffed first, because a change in whitespace alone doesn't show as a change
              const changed = before
                ? Object.entries(recipeText(entry))
                    .map(([label, text]) => ({ label, parts: diffWords(before[label], text) }))
                    .filter(({ parts }) => parts.some((part) => part.added || part.removed))
                : [];

              return (
                <TimelineItem key={entry._id} step={index + 1}>
                  <TimelineHeader>
                    <TimelineSeparator />
                    <TimelineDate title={format(entry._creationTime, 'PPpp')}>
                      {formatDistanceToNow(entry._creationTime, { addSuffix: true })}
                    </TimelineDate>
                    <TimelineTitle className="flex items-center gap-1.5">
                      {entryTitle(entry, previous)}
                      {entry.aiPrompt && <Sparkles className="size-3.5 text-brand" />}
                    </TimelineTitle>
                    <TimelineIndicator />
                  </TimelineHeader>
                  <TimelineContent className="mt-2 flex flex-col gap-3">
                    {previous && previous.image !== entry.image && (
                      <div>
                        <p className="text-xs font-medium">Image</p>
                        <div className="mt-1 flex items-center gap-2">
                          <ImagePreview value={previous.image} removed />
                          <ArrowRight className="size-3" />
                          <ImagePreview value={entry.image} />
                        </div>
                      </div>
                    )}
                    {changed.map(({ label, parts }) => (
                      <div key={label}>
                        <p className="text-xs font-medium">{label}</p>
                        <p className="whitespace-pre-line text-foreground wrap-anywhere">
                          <WordDiff parts={parts} />
                        </p>
                      </div>
                    ))}
                    {entry.aiPrompt && (
                      <Collapsible>
                        <CollapsibleTrigger className="group flex items-center gap-1 hover:text-foreground">
                          <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
                          AI request
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <p className="mt-1 whitespace-pre-wrap text-foreground wrap-anywhere">{entry.aiPrompt}</p>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </TimelineContent>
                </TimelineItem>
              );
            })}
        </Timeline>
      </SheetContent>
    </Sheet>
  );
}
