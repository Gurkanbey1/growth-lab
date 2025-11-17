import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FolderKanban, Share2, TrendingUp, DollarSign, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { data: companies } = useQuery({
    queryKey: ['companies-count'],
    queryFn: async () => {
      const { count } = await supabase.from('companies').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: activeProjects } = useQuery({
    queryKey: ['active-projects-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      return count || 0;
    },
  });

  const { data: socialAccounts } = useQuery({
    queryKey: ['social-accounts-count'],
    queryFn: async () => {
      const { count } = await supabase.from('social_media_accounts').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: monthlyRevenue, isLoading: revenueLoading } = useQuery({
    queryKey: ['monthly-revenue'],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
      
      const { data } = await supabase
        .from('revenues')
        .select('amount')
        .gte('revenue_date', startOfMonth.toISOString().split('T')[0])
        .lte('revenue_date', endOfMonth.toISOString().split('T')[0]);
      
      return data?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
    },
  });

  const { data: upcomingItems, isLoading: upcomingLoading } = useQuery({
    queryKey: ['upcoming-reminders'],
    queryFn: async () => {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 30);
      
      const [domains, socialMedia, expenses] = await Promise.all([
        supabase
          .from('domains')
          .select('domain_name, expire_date')
          .gte('expire_date', today.toISOString().split('T')[0])
          .lte('expire_date', futureDate.toISOString().split('T')[0])
          .order('expire_date')
          .limit(5),
        supabase
          .from('social_media_accounts')
          .select('platform, account_name, renewal_date')
          .gte('renewal_date', today.toISOString().split('T')[0])
          .lte('renewal_date', futureDate.toISOString().split('T')[0])
          .order('renewal_date')
          .limit(5),
        supabase
          .from('expenses')
          .select('description, next_payment_date')
          .eq('is_active', true)
          .not('next_payment_date', 'is', null)
          .gte('next_payment_date', today.toISOString().split('T')[0])
          .lte('next_payment_date', futureDate.toISOString().split('T')[0])
          .order('next_payment_date')
          .limit(5),
      ]);

      return {
        domains: domains.data || [],
        socialMedia: socialMedia.data || [],
        expenses: expenses.data || [],
      };
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Wind Medya CRM Yönetim Paneli</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Toplam Firma
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companies ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Müşteri, freelancer ve tedarikçi
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Aktif Proje
              </CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeProjects ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Devam eden projeler
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Sosyal Medya
              </CardTitle>
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{socialAccounts ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Yönetilen hesaplar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Aylık Gelir
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {revenueLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  `${(monthlyRevenue ?? 0).toLocaleString('tr-TR')} TL`
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Bu ay
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Yaklaşan Ödemeler & Yenilemeler</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingItems?.domains.map((domain) => (
                    <div key={domain.domain_name} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Domain: {domain.domain_name}</span>
                      <span className="font-medium">{new Date(domain.expire_date).toLocaleDateString('tr-TR')}</span>
                    </div>
                  ))}
                  {upcomingItems?.socialMedia.map((sm) => (
                    <div key={sm.account_name} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">SM: {sm.platform} - {sm.account_name}</span>
                      <span className="font-medium">{new Date(sm.renewal_date).toLocaleDateString('tr-TR')}</span>
                    </div>
                  ))}
                  {upcomingItems?.expenses.map((expense, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gider: {expense.description}</span>
                      <span className="font-medium">{new Date(expense.next_payment_date!).toLocaleDateString('tr-TR')}</span>
                    </div>
                  ))}
                  {!upcomingItems?.domains.length && 
                   !upcomingItems?.socialMedia.length && 
                   !upcomingItems?.expenses.length && (
                    <p className="text-sm text-muted-foreground">Yaklaşan hatırlatma bulunmuyor.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hızlı Erişim</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a href="/projects" className="block p-2 hover:bg-accent rounded-md text-sm">
                ➤ Proje Yönetimi
              </a>
              <a href="/revenues" className="block p-2 hover:bg-accent rounded-md text-sm">
                ➤ Gelir Yönetimi
              </a>
              <a href="/expenses" className="block p-2 hover:bg-accent rounded-md text-sm">
                ➤ Gider Yönetimi
              </a>
              <a href="/calendar" className="block p-2 hover:bg-accent rounded-md text-sm">
                ➤ Takvim Görünümü
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
