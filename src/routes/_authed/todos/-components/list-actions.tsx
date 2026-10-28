import { api } from '@convex/_generated/api';
import type { TodoList } from '@convex/todoLists';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { MoreHorizontal, Pencil, Trash } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toastError } from '@/lib/toast';
import { ListNameDialog } from './list-name-dialog';

/** Rename and delete for an extra list, next to its title. */
export function ListActions({ list, onDeleted }: { list: TodoList; onDeleted: () => void }) {
  const { mutateAsync: removeList } = useMutation({ mutationFn: useConvexMutation(api.todoLists.remove) });
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await removeList({ id: list._id });
      onDeleted();
      toast.success(`Deleted ${list.name}`);
    } catch (error) {
      toastError(error);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="List actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ListNameDialog open={renameOpen} onOpenChange={setRenameOpen} list={list} />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        itemType="list"
        description={`Delete "${list.name}" and all its to-dos? This can't be undone.`}
      />
    </>
  );
}
