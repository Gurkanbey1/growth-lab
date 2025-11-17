import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  Share2,
  Globe,
  DollarSign,
  TrendingUp,
  Calendar,
  Users,
  LogOut,
  Menu,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Firmalar', href: '/companies', icon: Building2 },
  { name: 'Projeler', href: '/projects', icon: FolderKanban },
  { name: 'Sosyal Medya', href: '/social-media', icon: Share2 },
  { name: 'Domain/Hosting', href: '/domains', icon: Globe },
  { name: 'Gelirler', href: '/revenues', icon: TrendingUp },
  { name: 'Giderler', href: '/expenses', icon: DollarSign },
  { name: 'Takvim', href: '/calendar', icon: Calendar },
  { name: 'Ayarlar', href: '/settings', icon: Settings },
];

const adminNavigation = [
  { name: 'Kullanıcılar', href: '/users', icon: Users },
];

const Sidebar = ({ className }: { className?: string }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, isAdmin } = useAuth();

  const items = isAdmin ? [...navigation, ...adminNavigation] : navigation;

  return (
    <div className={cn('flex flex-col h-full bg-sidebar text-sidebar-foreground', className)}>
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-primary">Wind Medya CRM</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <Button
              key={item.href}
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start',
                isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
              onClick={() => navigate(item.href)}
            >
              <Icon className="mr-3 h-5 w-5" />
              {item.name}
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={signOut}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Çıkış Yap
        </Button>
      </div>
    </div>
  );
};

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-4 left-4 z-40"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;