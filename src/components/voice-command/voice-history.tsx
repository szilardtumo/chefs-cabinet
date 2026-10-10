import { useLocation } from '@tanstack/react-router';
import { History, SendHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { useVoiceCommand } from '@/components/voice-command/voice-command-provider';

/**
 * The history button and its popover: past commands with their results, Undo for each change,
 * answer buttons for the last question, and a field to type a command.
 */
export function VoiceHistory() {
  const { status, commands, send } = useVoiceCommand();
  const [text, setText] = useState('');
  const { pathname } = useLocation();
  // Remembers the page it was opened on, so it closes by itself when a command opens a recipe
  const [openOn, setOpenOn] = useState<string>();
  const lastCommand = commands.at(-1);

  return (
    <Popover open={openOn === pathname} onOpenChange={(open) => setOpenOn(open ? pathname : undefined)}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Voice command history">
          <History />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="flex h-[min(32rem,70vh)] w-[min(24rem,calc(100vw-2rem))] flex-col p-0">
        <PopoverHeader className="p-4 pb-2">
          <PopoverTitle>Ask Chef's Cabinet</PopoverTitle>
          <PopoverDescription>Add to the shopping list, open a recipe or log your reading.</PopoverDescription>
        </PopoverHeader>

        {/* Reversed, so the list starts scrolled to the newest command */}
        <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-4">
          <div className="flex flex-col gap-2 pb-2">
            {commands.map((command) => (
              <div key={command.id} className="flex flex-col gap-2">
                <Bubble align="end">
                  <BubbleContent>{command.text ?? <Spinner />}</BubbleContent>
                </Bubble>
                {command.lines.map(({ message, error, undone, undo }) => (
                  <Bubble key={message} variant={error ? 'destructive' : 'muted'}>
                    <BubbleContent className="flex items-center gap-2">
                      <span className={undone ? 'line-through' : undefined}>{message}</span>
                      {undo && !undone && (
                        <Button variant="link" size="sm" className="h-auto p-0" onClick={undo}>
                          Undo
                        </Button>
                      )}
                    </BubbleContent>
                  </Bubble>
                ))}
                {command.question && (
                  <>
                    <Bubble variant="muted">
                      <BubbleContent>{command.question.text}</BubbleContent>
                    </Bubble>
                    {command === lastCommand && (
                      <div className="flex flex-wrap gap-2">
                        {command.question.options.map((option) => (
                          <Button
                            key={option}
                            variant="outline"
                            size="sm"
                            disabled={status.type === 'working'}
                            onClick={() => send(option)}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <form
          className="p-4 pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!text.trim() || status.type === 'working') return;
            send(text.trim());
            setText('');
          }}
        >
          <InputGroup>
            <InputGroupInput
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={status.type === 'listening' ? 'Listening…' : 'Add milk and eggs to my list'}
              disabled={status.type === 'listening'}
            />
            <InputGroupAddon align="inline-end">
              {text.trim() && (
                <InputGroupButton type="submit" size="icon-xs" aria-label="Send" disabled={status.type === 'working'}>
                  <SendHorizontal />
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
        </form>
      </PopoverContent>
    </Popover>
  );
}
