import { ReactNode, useState, useEffect } from 'react';
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
  Package,
  LayoutDashboard,
  Boxes,
  ClipboardList,
  Truck,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  FileText,
  Building2,
  MapPin,
  ScanLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRole?: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Shipments', href: '/shipments', icon: Truck },
  { label: 'Inventory', href: '/inventory', icon: Boxes },
  { label: 'Tasks', href: '/tasks', icon: ClipboardList },
  { label: 'Scan Hub', href: '/scan', icon: ScanLine },
  { label: 'Orders', href: '/orders', icon: Package },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Accounts', href: '/accounts', icon: Users, requiredRole: ['admin', 'tenant_admin'] },
  { label: 'Employees', href: '/employees', icon: Building2, requiredRole: ['admin', 'tenant_admin'] },
  { label: 'Settings', href: '/settings', icon: Settings, requiredRole: ['admin', 'tenant_admin'] },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>('Stride WMS');
  const { profile, signOut } = useAuth();
  const { hasRole, isAdmin } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

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
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b">
          <Link to="/" className="flex items-center gap-2">
            {tenantLogo ? (
              <img 
                src={tenantLogo} 
                alt={tenantName} 
                className="h-8 w-8 object-contain rounded"
              />
            ) : (
              <div className="p-1.5 bg-primary rounded-lg">
                <Package className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <span className="font-bold text-lg">{tenantName}</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="p-4 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-0">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 shrink-0 bg-background/95 backdrop-blur border-b flex items-center justify-between px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

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
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content - scrollable */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-safe">{children}</main>
      </div>
    </div>
  );
}
