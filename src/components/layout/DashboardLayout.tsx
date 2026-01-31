import { ReactNode, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSidebar } from '@/contexts/SidebarContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarWithPresence } from '@/components/ui/online-indicator';
import { usePresence } from '@/hooks/usePresence';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  /** Material Symbols icon name */
  icon: string;
  requiredRole?: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard' },
  { label: 'Shipments', href: '/shipments', icon: 'local_shipping' },
  { label: 'Inventory', href: '/inventory', icon: 'inventory_2' },
  { label: 'Tasks', href: '/tasks', icon: 'task_alt' },
  { label: 'Cycle Counts', href: '/stocktakes', icon: 'fact_check' },
  { label: 'Scan', href: '/scan', icon: 'qr_code_scanner', requiredRole: ['admin', 'tenant_admin', 'warehouse_user', 'technician'] },

  { label: 'Analytics', href: '/reports', icon: 'analytics', requiredRole: ['admin', 'tenant_admin'] },
  { label: 'Quotes', href: '/quotes', icon: 'request_quote', requiredRole: ['admin', 'tenant_admin'] },
  { label: 'Claims', href: '/claims', icon: 'assignment_late', requiredRole: ['admin', 'tenant_admin'] },
  { label: 'Accounts', href: '/accounts', icon: 'group', requiredRole: ['admin', 'tenant_admin'] },
  { label: 'Settings', href: '/settings', icon: 'settings', requiredRole: ['admin', 'tenant_admin'] },
  { label: 'Diagnostics', href: '/diagnostics', icon: 'bug_report', requiredRole: ['admin', 'tenant_admin'] },
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
            ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5',
          sidebarCollapsed && 'lg:justify-center lg:px-2'
        )}
      >
        <MaterialIcon
          name={item.icon}
          size="md"
          weight={isActive ? 400 : 300}
          className={cn(
            'flex-shrink-0 transition-colors',
            isActive ? 'text-primary' : 'text-gray-400 dark:text-white/50'
          )}
        />
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
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-white/10 transition-opacity cursor-grab active:cursor-grabbing hidden lg:block"
          title="Drag to reorder"
        >
          <MaterialIcon name="drag_indicator" size="sm" className="text-gray-400 dark:text-white/40" />
        </button>
      )}
    </div>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { sidebarCollapsed, setSidebarCollapsed } = useSidebar();
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
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const { profile, signOut } = useAuth();
  const { hasRole, isAdmin } = usePermissions();
  const { getUserStatus } = usePresence();
  const location = useLocation();
  const navigate = useNavigate();

  // Swipe to close sidebar on mobile
  const touchStartX = useRef<number | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = touchStartX.current - currentX;
    // If swiped left more than 50px, close the sidebar
    if (diff > 50) {
      setSidebarOpen(false);
      touchStartX.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchStartX.current = null;
  }, []);

  // Apply theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('stride-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Auto-hide header on scroll
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
        // Scrolling down - hide header
        setHeaderVisible(false);
      } else {
        // Scrolling up - show header
        setHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Toggle sidebar collapsed state (localStorage handled by context)
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(!sidebarCollapsed);
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

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          'fixed top-0 left-0 z-50 h-full border-r transform transition-all duration-300 ease-bounce lg:translate-x-0 flex flex-col',
          // Light mode: white background
          'bg-white border-gray-200',
          // Dark mode: keep dark gradient
          'dark:bg-gradient-to-b dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 dark:border-slate-700',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-52',
          'w-64' // Mobile always full width when open
        )}
      >
        {/* Fixed Header */}
        <div className={cn(
          "flex-shrink-0 flex h-12 items-center border-b border-gray-200 dark:border-slate-700",
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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md">
                <MaterialIcon name="warehouse" size="sm" className="text-white" weight={300} />
              </div>
            )}
            <span className={cn(
              "font-bold text-gray-900 dark:text-white transition-opacity duration-200",
              sidebarCollapsed ? "lg:hidden" : ""
            )}>{tenantName}</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-gray-700 dark:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <MaterialIcon name="close" size="md" />
          </Button>
        </div>

        {/* Collapse/Expand button - Desktop only, at top */}
        <div className={cn(
          "flex-shrink-0 px-3 py-2 hidden lg:block",
          sidebarCollapsed && "lg:px-2"
        )}>
          <button
            onClick={toggleSidebarCollapsed}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
              "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10",
              sidebarCollapsed && "lg:justify-center lg:px-2"
            )}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <MaterialIcon name="menu_open" size="md" />
            ) : (
              <MaterialIcon name="left_panel_close" size="md" />
            )}
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>

        {/* Scrollable Nav */}
        <nav className={cn(
          "flex-1 overflow-y-auto p-3 space-y-1",
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

        {/* Fixed Footer - Avatar only */}
        <div className={cn(
          "flex-shrink-0 border-t border-gray-200 dark:border-slate-700 p-2",
          sidebarCollapsed && "lg:p-2"
        )}>
          {/* User Avatar/Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-xl transition-colors",
                  "hover:bg-gray-100 dark:hover:bg-slate-800",
                  sidebarCollapsed && "lg:justify-center"
                )}
              >
                <AvatarWithPresence
                  status={profile?.id ? getUserStatus(profile.id) : 'offline'}
                  indicatorSize="sm"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                </AvatarWithPresence>
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium text-gray-900 dark:text-white lg:block hidden truncate">
                    {profile?.first_name} {profile?.last_name}
                  </span>
                )}
              </button>
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
                <MaterialIcon name="logout" size="sm" className="mr-2" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn(
        "flex flex-col flex-1 min-h-0 transition-all duration-300",
        sidebarCollapsed ? "lg:pl-16" : "lg:pl-52"
      )}>
        {/* Header - Auto-hides on scroll */}
        <header className={cn(
          "sticky top-0 z-30 shrink-0 bg-card border-b flex items-center px-4 lg:px-6 pt-safe h-[calc(3rem+env(safe-area-inset-top,0px))] transition-transform duration-300",
          !headerVisible && "-translate-y-full"
        )}>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9"
            onClick={() => setSidebarOpen(true)}
          >
            <MaterialIcon name="menu" size="md" />
          </Button>

          <div className="flex-1" />

          {/* Right side controls */}
          <div className="flex items-center gap-1">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setIsDark(!isDark)}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <MaterialIcon name={isDark ? 'light_mode' : 'dark_mode'} size="md" />
            </Button>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 relative"
              onClick={() => navigate('/messages')}
              title="Messages & Notifications"
            >
              <MaterialIcon name="notifications" size="md" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-red-500 text-white rounded-full animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
          </div>
        </header>

        {/* Page content - scrollable with extra bottom padding for full scrolling */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
