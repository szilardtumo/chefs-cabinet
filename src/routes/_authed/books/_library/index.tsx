import { createFileRoute } from '@tanstack/react-router';

// Lets `/books` match the library layout; the layout itself renders the page
export const Route = createFileRoute('/_authed/books/_library/')({});
