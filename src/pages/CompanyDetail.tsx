import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, Mail, Phone, MapPin, FileText, Trash2, Plus, Pencil } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ['company-projects', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, profiles!projects_assigned_to_fkey(full_name)')
        .eq('company_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: domains } = useQuery({
    queryKey: ['company-domains', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .eq('company_id', id)
        .order('expire_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: socialAccounts } = useQuery({
    queryKey: ['company-social', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_media_accounts')
        .select('*')
        .eq('company_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: revenues } = useQuery({
    queryKey: ['company-revenues', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revenues')
        .select('*')
        .eq('company_id', id)
        .order('revenue_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ['company-expenses', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('company_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalDebt = projects?.reduce((sum, p) => sum + ((p.budget || 0) - (p.paid_amount || 0)), 0) || 0;
  const totalRevenue = revenues?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  const totalExpense = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = { customer: 'Müşteri', freelancer: 'Freelancer', supplier: 'Tedarikçi' };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
      pending: 'outline',
    };
    const labels: Record<string, string> = {
      active: 'Aktif',
      completed: 'Tamamlandı',
      cancelled: 'İptal',
      pending: 'Beklemede',
    };
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-muted-foreground">Yükleniyor...</div>
        </div>
      </Layout>
    );
  }

  if (!company) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="text-muted-foreground">Firma bulunamadı</div>
          <Button onClick={() => navigate('/companies')}>Firmalara Dön</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/companies')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{company.name}</h1>
            <p className="text-muted-foreground">{getTypeLabel(company.type)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Toplam Borç</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalDebt > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                {totalDebt.toLocaleString('tr-TR')} TL
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Toplam Gelir</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {totalRevenue.toLocaleString('tr-TR')} TL
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Toplam Gider</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                {totalExpense.toLocaleString('tr-TR')} TL
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Domain Sayısı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{domains?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Firma Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {company.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{company.email}</span>
              </div>
            )}
            {company.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{company.phone}</span>
              </div>
            )}
            {company.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{company.address}</span>
              </div>
            )}
            {company.tax_number && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>Vergi No: {company.tax_number}</span>
              </div>
            )}
            {company.notes && (
              <div className="text-sm mt-4 p-3 bg-muted rounded-md">
                <strong>Notlar:</strong> {company.notes}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="projects" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="projects">Projeler ({projects?.length || 0})</TabsTrigger>
            <TabsTrigger value="domains">Domainler ({domains?.length || 0})</TabsTrigger>
            <TabsTrigger value="social">Sosyal Medya ({socialAccounts?.length || 0})</TabsTrigger>
            <TabsTrigger value="revenues">Gelirler ({revenues?.length || 0})</TabsTrigger>
            <TabsTrigger value="expenses">Giderler ({expenses?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Projeler</CardTitle>
                <Button onClick={() => navigate('/projects')} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Proje
                </Button>
              </CardHeader>
              <CardContent>
                {!projects || projects.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Henüz proje bulunmuyor.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proje Adı</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead>Bütçe</TableHead>
                        <TableHead>Ödenen</TableHead>
                        <TableHead>Kalan</TableHead>
                        <TableHead>Atanan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium">{project.name}</TableCell>
                          <TableCell>{getStatusBadge(project.status)}</TableCell>
                          <TableCell>{project.budget.toLocaleString('tr-TR')} TL</TableCell>
                          <TableCell>{project.paid_amount.toLocaleString('tr-TR')} TL</TableCell>
                          <TableCell>
                            <span className={project.remaining_amount && project.remaining_amount > 0 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}>
                              {(project.remaining_amount || 0).toLocaleString('tr-TR')} TL
                            </span>
                          </TableCell>
                          <TableCell>{(project as any).profiles?.full_name || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="domains" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Domainler</CardTitle>
                <Button onClick={() => navigate('/domains')} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Domain
                </Button>
              </CardHeader>
              <CardContent>
                {!domains || domains.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Henüz domain bulunmuyor.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain Adı</TableHead>
                        <TableHead>Tip</TableHead>
                        <TableHead>Registrar</TableHead>
                        <TableHead>Başlangıç</TableHead>
                        <TableHead>Bitiş</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {domains.map((domain) => (
                        <TableRow key={domain.id}>
                          <TableCell className="font-medium">{domain.domain_name}</TableCell>
                          <TableCell><Badge>{domain.type}</Badge></TableCell>
                          <TableCell>{domain.registrar || '-'}</TableCell>
                          <TableCell>{domain.start_date ? new Date(domain.start_date).toLocaleDateString('tr-TR') : '-'}</TableCell>
                          <TableCell>{new Date(domain.expire_date).toLocaleDateString('tr-TR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Sosyal Medya Hesapları</CardTitle>
                <Button onClick={() => navigate('/social-media')} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Hesap
                </Button>
              </CardHeader>
              <CardContent>
                {!socialAccounts || socialAccounts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Henüz sosyal medya hesabı bulunmuyor.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead>Hesap Adı</TableHead>
                        <TableHead>Aylık Ücret</TableHead>
                        <TableHead>Yenileme Tarihi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {socialAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell><Badge variant="secondary">{account.platform}</Badge></TableCell>
                          <TableCell className="font-medium">{account.account_name}</TableCell>
                          <TableCell>{account.monthly_fee ? `${account.monthly_fee.toLocaleString('tr-TR')} TL` : '-'}</TableCell>
                          <TableCell>{new Date(account.renewal_date).toLocaleDateString('tr-TR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenues" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Gelirler</CardTitle>
                <Button onClick={() => navigate('/revenues')} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Gelir
                </Button>
              </CardHeader>
              <CardContent>
                {!revenues || revenues.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Henüz gelir bulunmuyor.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Açıklama</TableHead>
                        <TableHead>Fatura No</TableHead>
                        <TableHead>Tutar</TableHead>
                        <TableHead>Tarih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenues.map((revenue) => (
                        <TableRow key={revenue.id}>
                          <TableCell className="font-medium">{revenue.description}</TableCell>
                          <TableCell>{revenue.invoice_number || '-'}</TableCell>
                          <TableCell className="text-green-600 font-semibold">
                            {revenue.amount.toLocaleString('tr-TR')} TL
                          </TableCell>
                          <TableCell>{new Date(revenue.revenue_date).toLocaleDateString('tr-TR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Giderler</CardTitle>
                <Button onClick={() => navigate('/expenses')} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Gider
                </Button>
              </CardHeader>
              <CardContent>
                {!expenses || expenses.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Henüz gider bulunmuyor.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Açıklama</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Tutar</TableHead>
                        <TableHead>Sıklık</TableHead>
                        <TableHead>Durum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="font-medium">{expense.description}</TableCell>
                          <TableCell>{expense.category || '-'}</TableCell>
                          <TableCell className="text-orange-600 font-semibold">
                            {expense.amount.toLocaleString('tr-TR')} TL
                          </TableCell>
                          <TableCell><Badge variant="outline">{expense.frequency}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={expense.is_active ? 'default' : 'secondary'}>
                              {expense.is_active ? 'Aktif' : 'Pasif'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default CompanyDetail;
