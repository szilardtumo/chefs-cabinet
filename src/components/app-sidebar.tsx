import { Link, useLocation, useRouter } from '@tanstack/react-router';
import { BookOpen, Carrot, Home, Library, ShoppingCart } from 'lucide-react';
import { useEffect } from 'react';
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
  const open = useLocation({ select: (location) => location.state.sidebar === true });

  // The mobile drawer is open while its history entry is current, so Android's back gesture closes it, and the page
  // screenshot Chrome shows when swiping back is taken before the drawer opened. On mobile, Sidebar passes open and
  // onOpenChange to its Sheet, so the trigger's openMobile only requests a new entry.
  useEffect(() => {
    if (!openMobile) return;
    setOpenMobile(false);
    router.navigate({ href: router.state.location.href, state: { sidebar: true }, resetScroll: false });
  }, [openMobile, setOpenMobile, router]);

  return (
    <Sidebar
      collapsible="icon"
      {...(isMobile && { open, onOpenChange: (open: boolean) => !open && router.history.back() })}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Link to="/dashboard" replace={open}>
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
                    <Link to={navItem.to} activeProps={{ 'data-active': 'true' }} replace={open}>
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
