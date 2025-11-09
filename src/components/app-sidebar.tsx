import { Link } from '@tanstack/react-router';
import { BookOpen, Carrot, ChefHat, Home, ShoppingCart } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
    label: 'Shopping List',
    icon: ShoppingCart,
    to: '/shopping',
  },
];

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Link to="/dashboard">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <ChefHat />
              </div>
              <span className="font-bold">Chef's Cabinet</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((navItem) => (
                <SidebarMenuItem key={navItem.label}>
                  <SidebarMenuButton asChild tooltip={navItem.label}>
                    <Link to={navItem.to} activeProps={{ 'data-active': 'true' }}>
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
