import { Link, useLocation, useRouter } from '@tanstack/react-router';
import { BookOpen, Carrot, Home, Library, ShoppingCart } from 'lucide-react';
import { useEffect, useLayoutEffect } from 'react';
import { Logo } from '@/components/logo';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  {
    label: 'Dashboard',
    icon: Home,
    to: '/dashboard',
  },

  {
    label: 'Ingredients',
    icon: Carrot,
    to: '/ingredients',
  },
  {
    label: 'Recipes',
    icon: BookOpen,
    to: '/recipes',
  },
  {
    label: 'Books',
    icon: Library,
    to: '/books',
  },
  {
    label: 'Shopping List',
    icon: ShoppingCart,
    to: '/shopping',
  },
];

export function AppSidebar() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const router = useRouter();
  const onSidebarEntry = useLocation({ select: (location) => location.state.sidebar === true });

  // The mobile sidebar gets its own history entry, so Android's back gesture closes it, and the screenshot Chrome
  // shows when swiping back to a page is taken before the sidebar opened. Links in it replace that entry.
  // A layout effect pushes the entry before the open sidebar is painted.
  useLayoutEffect(() => {
    if (!isMobile) return;
    const { href, state } = router.history.location;
    if (openMobile && !state.sidebar) router.navigate({ href, state: { sidebar: true }, resetScroll: false });
    if (!openMobile && state.sidebar) router.history.back();
  }, [isMobile, openMobile, router]);

  useEffect(() => {
    if (!onSidebarEntry) setOpenMobile(false);
  }, [onSidebarEntry, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Link to="/dashboard" replace={onSidebarEntry}>
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Logo className="size-5" />
                </div>
                <span className="font-bold">Chef's Cabinet</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((navItem) => (
                <SidebarMenuItem key={navItem.label}>
                  <SidebarMenuButton asChild tooltip={navItem.label} className="data-[active=true]:[&>svg]:text-brand">
                    <Link to={navItem.to} activeProps={{ 'data-active': 'true' }} replace={onSidebarEntry}>
                      <navItem.icon /> {navItem.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

declare module '@tanstack/react-router' {
  interface HistoryState {
    sidebar?: boolean;
  }
}
