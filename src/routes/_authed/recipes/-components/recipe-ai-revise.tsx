import { api } from '@convex/_generated/api';
import type { MatchedRecipeFormValues, RecipeSnapshot } from '@convex/recipesAi';
import { useConvexAction } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

type RevisionRound = {
  prompt: string;
  changeSummary: string;
  recipe: RecipeSnapshot;
};

function formatRevisionLog(history: RevisionRound[]): string {
  return history.map((round, index) => `Round ${index + 1}: ${round.prompt}\n${round.changeSummary}`).join('\n\n');
}

type RecipeAiRevisePanelProps = {
  getCurrentRecipe: () => RecipeSnapshot;
  onRevisionApplied: (recipe: MatchedRecipeFormValues, revisionLog: string) => void;
};

export function RecipeAiRevisePanel({ getCurrentRecipe, onRevisionApplied }: RecipeAiRevisePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [revisionHistory, setRevisionHistory] = useState<RevisionRound[]>([]);
  const reviseRecipe = useMutation({
    mutationFn: useConvexAction(api.recipesAi.reviseRecipeWithPrompt),
  });

  const latestSummary = revisionHistory.at(-1)?.changeSummary;
  const earlierSummaries = revisionHistory.slice(0, -1);

  const handleApply = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast.error('Enter a prompt', {
        description: 'Describe how you want the recipe updated.',
      });
      return;
    }

    try {
      const result = await reviseRecipe.mutateAsync({
        prompt: trimmedPrompt,
        currentRecipe: getCurrentRecipe(),
        priorRevisions: revisionHistory,
      });

      const { changeSummary, contextRecipe, ...revisedRecipe } = result;
      const nextHistory = [...revisionHistory, { prompt: trimmedPrompt, changeSummary, recipe: contextRecipe }];

      setRevisionHistory(nextHistory);
      onRevisionApplied(revisedRecipe, formatRevisionLog(nextHistory));
      setPrompt('');
    } catch (error) {
      toast.error('AI revise failed', {
        description: error instanceof Error ? error.message : 'Failed to revise recipe. Please try again.',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Revise with AI
          <Sparkles className="size-4" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ai-revise-prompt">Prompt</Label>
          <Textarea
            id="ai-revise-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="e.g. Make it vegetarian, cut salt in half, and simplify the steps…"
            rows={3}
            disabled={reviseRecipe.isPending}
          />
        </div>

        <Button type="button" onClick={handleApply} disabled={reviseRecipe.isPending || !prompt.trim()}>
          {reviseRecipe.isPending ? (
            <>
              <Spinner />
              Revising…
            </>
          ) : (
            <>
              <Sparkles />
              Apply AI changes
            </>
          )}
        </Button>

        {latestSummary && (
          <Alert>
            <Sparkles className="size-4" />
            <AlertTitle>What changed</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{latestSummary}</AlertDescription>
          </Alert>
        )}

        {earlierSummaries.length > 0 && (
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer select-none">Earlier revisions ({earlierSummaries.length})</summary>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {earlierSummaries.map((round, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: past revisions are append-only and have no id
                <li key={`${index}-${round.prompt.slice(0, 24)}`}>
                  <p className="font-medium text-foreground">{round.prompt}</p>
                  <p className="whitespace-pre-wrap">{round.changeSummary}</p>
                </li>
              ))}
            </ol>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
