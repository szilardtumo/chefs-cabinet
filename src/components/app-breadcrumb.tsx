import { Link, useRouterState } from '@tanstack/react-router';
import { uniqBy } from 'es-toolkit';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ITEMS_TO_DISPLAY = 3;

export function AppBreadcrumb(props: React.ComponentProps<typeof Breadcrumb>) {
  const matches = useRouterState({ select: (s) => s.matches });

  const items = uniqBy(matches, (match) => match.context.title).map(({ pathname, context }) => {
    return {
      title: context.title,
      path: pathname,
    };
  });

  return (
    <Breadcrumb {...props}>
      <BreadcrumbList>
        {items.length > 0 && (
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={items[0].path}>{items[0].title}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
        )}
        {items.length > 1 && <BreadcrumbSeparator />}
        {items.length > ITEMS_TO_DISPLAY && (
          <>
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1" aria-label="Toggle menu">
                  <BreadcrumbEllipsis />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {items.slice(1, -2).map((item) => (
                    <DropdownMenuItem key={item.path}>
                      <Link to={item.path}> {item.title}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        {items.slice(Math.max(items.length - ITEMS_TO_DISPLAY + 1, 1), -1).map((item) => (
          <BreadcrumbItem key={item.path}>
            <BreadcrumbLink asChild className="max-w-20 truncate md:max-w-none">
              <Link to={item.path}>{item.title}</Link>
            </BreadcrumbLink>
            <BreadcrumbSeparator />
          </BreadcrumbItem>
        ))}
        {items.length > 1 && <BreadcrumbPage>{items[items.length - 1].title}</BreadcrumbPage>}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
