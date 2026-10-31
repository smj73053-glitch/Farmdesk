import * as React from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  ChevronDown,
  CloudSun,
  FileBarChart,
  LayoutDashboard,
  Landmark,
  Leaf,
  LifeBuoy,
  LogOut,
  Menu,
  Receipt,
  RefreshCw,
  Settings,
  Sprout,
  Tractor,
  TrendingUp,
  UserRound,
  Wallet,
  WifiOff,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useOfflineSync } from '@/hooks/useOffline';
import { useNotifications } from '@/hooks/useFarmOps';
import { notificationService } from '@/services/farmOpsService';
import { formatArea } from '@/lib/units';
import { getInitials } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { LoadingBlock } from '@/components/common/states';

interface NavItem {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Overview',
    items: [
      { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
      { to: '/weather', labelKey: 'nav.weather', icon: CloudSun },
      { to: '/crop-intelligence', labelKey: 'nav.crops', icon: Sprout },
      { to: '/market', labelKey: 'nav.market', icon: TrendingUp },
    ],
  },
  {
    heading: 'My farm',
    items: [
      { to: '/farms', labelKey: 'nav.farm', icon: Tractor },
      { to: '/crops', labelKey: 'nav.cropLifecycle', icon: Leaf },
      { to: '/soil', labelKey: 'nav.soil', icon: Landmark },
      { to: '/expenses', labelKey: 'nav.expenses', icon: Receipt },
      { to: '/income', labelKey: 'nav.income', icon: Wallet },
    ],
  },
  {
    heading: 'Insights',
    items: [
      { to: '/ai', labelKey: 'nav.ai', icon: Sparkles },
      { to: '/reports', labelKey: 'nav.reports', icon: FileBarChart },
      { to: '/schemes', labelKey: 'nav.schemes', icon: Landmark },
      { to: '/knowledge', labelKey: 'nav.knowledge', icon: BookOpen },
    ],
  },
  {
    heading: 'Account',
    items: [
      { to: '/profile', labelKey: 'nav.profile', icon: UserRound },
      { to: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
];

const MOBILE_ITEMS: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/weather', labelKey: 'nav.weather', icon: CloudSun },
  { to: '/crops', labelKey: 'nav.cropLifecycle', icon: Leaf },
  { to: '/expenses', labelKey: 'nav.expenses', icon: Receipt },
  { to: '/ai', labelKey: 'nav.ai', icon: Sparkles },
];

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Sprout className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-base font-bold tracking-tight text-foreground">FarmDesk</span>
        <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Farm intelligence</span>
      </span>
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b px-5">
        <Brand onNavigate={onNavigate} />
      </div>
      <nav className="hide-scrollbar flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.heading} className="mb-4">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
              {group.heading}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t p-3">
        <div className="rounded-lg bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Data, not guesses</p>
          <p className="mt-1">
            Weather from Open-Meteo, climate from NASA POWER and mandi prices from data.gov.in / AGMARKNET. Estimates are always labelled.
          </p>
        </div>
      </div>
    </div>
  );
}

function FarmSwitcher() {
  const { farms, farm, selectFarm } = useWorkspace();
  if (!farms.length) return null;
  return (
    <Select value={farm?.id ?? ''} onValueChange={selectFarm}>
      <SelectTrigger className="h-9 w-[170px] border-input bg-background text-xs sm:w-[220px]">
        <Tractor className="mr-1 h-3.5 w-3.5 shrink-0 text-primary" />
        <SelectValue placeholder="Select farm" />
      </SelectTrigger>
      <SelectContent>
        {farms.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            <span className="flex items-center gap-2">
              {item.name}
              {item.total_area != null ? (
                <span className="text-muted-foreground">· {formatArea(item.total_area, item.area_unit)}</span>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NotificationMenu() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data = [], refetch } = useNotifications();
  const unread = data.filter((item) => !item.is_read).length;

  const markAll = async () => {
    await notificationService.markAllRead();
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px] max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unread > 0 ? (
            <button type="button" className="text-[11px] font-medium text-primary hover:underline" onClick={() => void markAll()}>
              Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {data.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No notifications yet. Weather, task and market alerts will appear here when generated.
            </p>
          ) : (
            data.slice(0, 10).map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="flex flex-col items-start gap-0.5 py-2"
                onClick={async () => {
                  if (!item.is_read) {
                    await notificationService.markRead(item.id);
                    await refetch();
                  }
                  navigate(item.type === 'weather_alert' ? '/weather' : item.type === 'task_reminder' ? '/crops' : '/dashboard');
                }}
              >
                <span className={cn('text-xs font-semibold', !item.is_read && 'text-primary')}>{item.title}</span>
                {item.message ? <span className="line-clamp-2 text-[11px] text-muted-foreground">{item.message}</span> : null}
                <span className="text-[10px] text-muted-foreground">
                  {new Date(item.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const name = profile?.full_name || user?.email || 'Farmer';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:px-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {getInitials(name)}
          </span>
          <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">{name}</span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate text-sm">{name}</span>
          <span className="block truncate text-[11px] font-normal text-muted-foreground">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { onNavigate?.(); navigate('/profile'); }}>
          <UserRound /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { onNavigate?.(); navigate('/settings'); }}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <LanguageSwitcher compact />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          className="text-red-600 focus:text-red-700"
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SyncBanner() {
  const { online, pending, conflicts, syncing, sync } = useOfflineSync();
  if (online && pending === 0) return null;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs',
        online ? 'border-sky-200 bg-sky-50 text-sky-950' : 'border-amber-200 bg-amber-50 text-amber-950'
      )}
    >
      <div className="flex items-center gap-2">
        {online ? <RefreshCw className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        <span>
          {online
            ? `${pending} offline change${pending === 1 ? '' : 's'} waiting to sync.`
            : 'You are offline. New expenses and activities are saved on this device and synced when you reconnect.'}
        </span>
        {conflicts.length > 0 ? <Badge variant="warning">{conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}</Badge> : null}
      </div>
      {online ? (
        <Button size="sm" variant="outline" className="h-7 bg-white/70 text-xs" disabled={syncing} onClick={() => void sync()}>
          <RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} /> {syncing ? 'Syncing…' : 'Sync now'}
        </Button>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const { profile, loading } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="page-container">
        <LoadingBlock rows={5} />
      </div>
    );
  }

  // New accounts finish the farm setup before entering the workspace.
  if (profile && !profile.onboarding_completed && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] border-r bg-card shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <SyncBanner />
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <FarmSwitcher />
          </div>
          <div className="hidden items-center gap-1 md:flex">
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/reports">
                <FileBarChart className="h-3.5 w-3.5" /> Reports
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/knowledge">
                <LifeBuoy className="h-3.5 w-3.5" /> Help
              </Link>
            </Button>
          </div>
          <NotificationMenu />
          <UserMenu />
        </header>

        <main className="page-container pb-24 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur lg:hidden" aria-label="Primary">
        <div className="grid grid-cols-5">
          {MOBILE_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate">{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
