import { GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export type Instruction = {
  id: string;
  text: string;
};

type SortableInstructionRowProps = {
  instruction: Instruction;
  index: number;
  onUpdate: (updated: Instruction) => void;
  onRemove: (id: string) => void;
};

export function SortableInstructionRow({ instruction, index, onUpdate, onRemove }: SortableInstructionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: instruction.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 p-3 border rounded-lg bg-card">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-2">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold mt-1">
        {index + 1}
      </div>

      <Textarea
        value={instruction.text}
        onChange={(e) => onUpdate({ ...instruction, text: e.target.value })}
        placeholder="Enter instruction..."
        rows={2}
        className="flex-1"
      />

      <Button variant="ghost" size="icon" onClick={() => onRemove(instruction.id)} className="mt-1">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

