import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';

export function useStorageUpload() {
  const { mutateAsync: generateUploadUrl } = useMutation({
    mutationFn: useConvexMutation(api.recipes.generateUploadUrl),
  });

  const { mutateAsync: uploadFile, isPending: isUploading } = useMutation({
    mutationFn: async (file: File) => {
      const uploadUrl = await generateUploadUrl({});
      const result = await fetch(uploadUrl, {
        method: 'POST',
        body: file,
      });
      const { storageId } = await result.json();

      return storageId as Id<'_storage'>;
    },
  });

  return { uploadFile, isUploading };
}
