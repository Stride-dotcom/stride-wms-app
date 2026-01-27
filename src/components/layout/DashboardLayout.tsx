import { ReactNode, useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Menu,
  X,
  GripVertical,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface NavItem {
  label: string;
  href: string;
  emoji: string;
  requiredRole?: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', emoji: '⚡' },
  { label: 'Shipments', href: '/shipments', emoji: '🚚' },
  { label: 'Inventory', href: '/inventory', emoji: '📦' },
  { label: 'Tasks', href: '/tasks', emoji: '📝' },
  { label: 'Cycle Counts', href: '/stocktakes', emoji: '📋' },
  { label: 'Scan', href: '/scan', emoji: '📱' },

  { label: 'Analytics', href: '/reports', emoji: '📊', requiredRole: ['admin', 'tenant_admin'] },
  { label: 'Quotes', href: '/quotes', emoji: '💰', requiredRole: ['admin', 'tenant_admin'] },
  { label: 'Claims', href: '/claims', emoji: '📄', requiredRole: ['admin', 'tenant_admin'] },
  { label: 'Accounts', href: '/accounts', emoji: '👥', requiredRole: ['admin', 'tenant_admin'] },
  { label: 'Settings', href: '/settings', emoji: '⚙️', requiredRole: ['admin', 'tenant_admin'] },
  { label: 'Diagnostics', href: '/diagnostics', emoji: '🐛', requiredRole: ['admin', 'tenant_admin'] },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

// Sortable nav item component
interface SortableNavItemProps {
  item: NavItem;
  isActive: boolean;
  sidebarCollapsed: boolean;
  onNavigate: () => void;
}

function SortableNavItem({ item, isActive, sidebarCollapsed, onNavigate }: SortableNavItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.href });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
    >
      <Link
        to={item.href}
        onClick={onNavigate}
        title={sidebarCollapsed ? item.label : undefined}
        className={cn(
          'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-primary text-white'
            : 'text-white/70 hover:text-white hover:bg-white/10',
          sidebarCollapsed && 'lg:justify-center lg:px-2'
        )}
      >
        <div className={cn(
          "nav-emoji-tile",
          isActive && "bg-white/20"
        )}>
          {item.emoji}
        </div>
        <span className={cn(
          "relative z-10 transition-opacity duration-200 flex-1",
          sidebarCollapsed ? "lg:hidden" : ""
        )}>{item.label}</span>
      </Link>
      {/* Drag handle - only visible on hover and when not collapsed */}
      {!sidebarCollapsed && (
        <button
          {...attributes}
          {...listeners}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-opacity cursor-grab active:cursor-grabbing hidden lg:block"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-white/40" />
        </button>
      )}
    </div>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('stride-theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [navOrder, setNavOrder] = useState<string[]>([]);
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>('Stride WMS');
  const [unreadCount, setUnreadCount] = useState(0);
  const { profile, signOut } = useAuth();
  const { hasRole, isAdmin } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

  // Apply theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('stride-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Fetch unread notification/message count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!profile?.id) return;
      try {
        // Try the RPC function first
        const { data, error } = await (supabase as any).rpc('get_total_unread_count', {
          p_user_id: profile.id,
        });
        if (!error && data !== null) {
          setUnreadCount(typeof data === 'number' ? data : 0);
        }
      } catch {
        // Silently fail - tables may not exist yet
      }
    };
    fetchUnreadCount();

    // Set up interval to refresh count periodically
    const interval = setInterval(fetchUnreadCount, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [profile?.id]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Save sidebar collapsed preference
  const toggleSidebarCollapsed = () => {
    const newValue = !sidebarCollapsed;
    setSidebarCollapsed(newValue);
    localStorage.setItem('sidebar-collapsed', String(newValue));
  };

  // Load nav order from localStorage per user
  useEffect(() => {
    if (profile?.id) {
      const savedOrder = localStorage.getItem(`nav-order-${profile.id}`);
      if (savedOrder) {
        try {
          setNavOrder(JSON.parse(savedOrder));
        } catch {
          setNavOrder([]);
        }
      }
    }
  }, [profile?.id]);

  // Save nav order to localStorage
  const saveNavOrder = (order: string[]) => {
    if (profile?.id) {
      localStorage.setItem(`nav-order-${profile.id}`, JSON.stringify(order));
    }
    setNavOrder(order);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedNavItems.findIndex((item) => item.href === active.id);
      const newIndex = sortedNavItems.findIndex((item) => item.href === over.id);
      const newOrder = arrayMove(sortedNavItems, oldIndex, newIndex).map((item) => item.href);
      saveNavOrder(newOrder);
    }
  };

  // Fetch tenant logo and name
  useEffect(() => {
    const fetchTenantBranding = async () => {
      if (!profile?.tenant_id) return;

      try {
        // Fetch tenant name
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('name')
          .eq('id', profile.tenant_id)
          .single();

        if (tenantData?.name) {
          setTenantName(tenantData.name);
        }

        // Fetch logo from tenant_company_settings
        const { data: settingsData } = await supabase
          .from('tenant_company_settings')
          .select('logo_url')
          .eq('tenant_id', profile.tenant_id)
          .maybeSingle();

        if (settingsData?.logo_url) {
          setTenantLogo(settingsData.logo_url);
        }
      } catch (error) {
        console.error('Error fetching tenant branding:', error);
      }
    };

    fetchTenantBranding();
  }, [profile?.tenant_id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return 'U';
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!item.requiredRole) return true;
    return item.requiredRole.some((role) => hasRole(role)) || isAdmin;
  });

  // Sort nav items based on saved order
  const sortedNavItems = useMemo(() => {
    if (navOrder.length === 0) return filteredNavItems;

    return [...filteredNavItems].sort((a, b) => {
      const aIndex = navOrder.indexOf(a.href);
      const bIndex = navOrder.indexOf(b.href);
      // Items not in saved order go to the end
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [filteredNavItems, navOrder]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Glossy Dark Surface */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full border-r border-white/5 transform transition-all duration-300 ease-bounce lg:translate-x-0',
          'bg-gradient-to-b from-slate-800 to-slate-950',
          'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),inset_0_-1px_0_0_rgba(0,0,0,0.2)]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-64',
          'w-64' // Mobile always full width
        )}
      >
        <div className={cn(
          "flex h-16 items-center border-b border-white/10",
          sidebarCollapsed ? "lg:justify-center lg:px-2 px-4" : "justify-between px-4"
        )}>
          <Link to="/" className="flex items-center gap-3">
            {tenantLogo ? (
              <img
                src={tenantLogo}
                alt={tenantName}
                className="h-8 w-8 object-contain rounded"
              />
            ) : (
              <div className="nav-emoji-tile bg-white/10">
                📦
              </div>
            )}
            <span className={cn(
              "font-bold text-white transition-opacity duration-200",
              sidebarCollapsed ? "lg:hidden" : ""
            )}>{tenantName}</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className={cn(
          "p-4 space-y-1 relative",
          sidebarCollapsed && "lg:p-2"
        )}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedNavItems.map((item) => item.href)}
              strategy={verticalListSortingStrategy}
            >
              {sortedNavItems.map((item) => (
                <SortableNavItem
                  key={item.href}
                  item={item}
                  isActive={location.pathname === item.href}
                  sidebarCollapsed={sidebarCollapsed}
                  onNavigate={() => setSidebarOpen(false)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </nav>

        {/* Collapse toggle button - only visible on desktop */}
        <div className={cn(
          "absolute bottom-4 hidden lg:flex",
          sidebarCollapsed ? "left-0 right-0 justify-center" : "left-4 right-4"
        )}>
          <button
            onClick={toggleSidebarCollapsed}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors",
              sidebarCollapsed ? "justify-center" : ""
            )}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span>{sidebarCollapsed ? '▶️' : '◀️'}</span>
            {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn(
        "flex flex-col flex-1 min-h-0 transition-all duration-300",
        sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
      )}>
        {/* Header */}
        <header className="sticky top-0 z-30 shrink-0 bg-card border-b flex items-center justify-between px-4 lg:px-6 pt-safe h-[calc(4rem+env(safe-area-inset-top,0px))]">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors mr-2"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {/* Notification Bell */}
          <button
            onClick={() => navigate('/messages')}
            className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors mr-2"
            title="Messages & Notifications"
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {profile?.first_name} {profile?.last_name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {profile?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <span className="mr-2">🚪</span>
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content - scrollable */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-safe animate-fade-in">{children}</main>
      </div>
    </div>
  );
}