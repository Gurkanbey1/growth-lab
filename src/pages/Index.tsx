import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FolderKanban, Share2, TrendingUp, DollarSign, Loader2, AlertCircle, Globe, Calendar, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

  const { data: totalDebt, isLoading: debtLoading } = useQuery({
    queryKey: ['total-debt'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('budget, paid_amount, remaining_amount');
      return data?.reduce((sum, p) => sum + ((p.budget || 0) - (p.paid_amount || 0)), 0) || 0;
    },
  });

  const { data: totalRevenue, isLoading: revenueLoading } = useQuery({
    queryKey: ['total-revenue'],
    queryFn: async () => {
      const { data } = await supabase.from('revenues').select('amount');
      return data?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
    },
  });

  const { data: totalExpense, isLoading: expenseLoading } = useQuery({
    queryKey: ['total-expense'],
    queryFn: async () => {
      const { data } = await supabase.from('expenses').select('amount');
      return data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
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

  const { data: upcomingDomains } = useQuery({
    queryKey: ['upcomingDomains'],
    queryFn: async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .lte('expire_date', thirtyDaysFromNow.toISOString().split('T')[0])
        .gte('expire_date', new Date().toISOString().split('T')[0])
        .order('expire_date', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: monthlyData } = useQuery({
    queryKey: ['monthlyTrend'],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: revenues, error: revError } = await supabase
        .from('revenues')
        .select('amount, revenue_date')
        .gte('revenue_date', sixMonthsAgo.toISOString().split('T')[0]);

      const { data: expenses, error: expError } = await supabase
        .from('expenses')
        .select('amount, next_payment_date')
        .gte('next_payment_date', sixMonthsAgo.toISOString().split('T')[0]);

      if (revError || expError) throw revError || expError;

      const monthlyMap = new Map();
      
      revenues?.forEach((rev: any) => {
        const month = new Date(rev.revenue_date).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' });
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, { month, gelir: 0, gider: 0 });
        }
        monthlyMap.get(month).gelir += Number(rev.amount);
      });

      expenses?.forEach((exp: any) => {
        if (!exp.next_payment_date) return;
        const month = new Date(exp.next_payment_date).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' });
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, { month, gelir: 0, gider: 0 });
        }
        monthlyMap.get(month).gider += Number(exp.amount);
      });

      return Array.from(monthlyMap.values()).sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA.getTime() - dateB.getTime();
      });
    },
  });

  const { data: projectStatusData } = useQuery({
    queryKey: ['projectStatus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('status');

      if (error) throw error;

      const statusCount = data.reduce((acc: any, project: any) => {
        acc[project.status] = (acc[project.status] || 0) + 1;
        return acc;
      }, {});

      const statusLabels: Record<string, string> = {
        active: 'Aktif',
        completed: 'Tamamlandı',
        cancelled: 'İptal',
        pending: 'Beklemede',
      };

      return Object.entries(statusCount).map(([status, count]) => ({
        name: statusLabels[status] || status,
        value: count,
      }));
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
              <CardTitle className="text-sm font-medium">Toplam Borç</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {debtLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">
                  {(totalDebt || 0).toLocaleString('tr-TR')} ₺
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Gelir</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {revenueLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">
                  {(totalRevenue || 0).toLocaleString('tr-TR')} ₺
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Gider</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {expenseLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">
                  {(totalExpense || 0).toLocaleString('tr-TR')} ₺
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Yaklaşan Domain Yenilemeleri</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {upcomingDomains?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">30 gün içinde</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Son 6 Ay Gelir/Gider Trendi</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => value.toLocaleString('tr-TR') + ' ₺'}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="gelir" 
                    stroke="hsl(var(--primary))" 
                    name="Gelir"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="gider" 
                    stroke="hsl(var(--destructive))" 
                    name="Gider"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proje Durumları</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={projectStatusData || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {(projectStatusData || []).map((entry: any, index: number) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={[
                          'hsl(var(--primary))',
                          'hsl(var(--secondary))',
                          'hsl(var(--destructive))',
                          'hsl(var(--muted))'
                        ][index % 4]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

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
    </Layout>
  );
};

export default Index;
