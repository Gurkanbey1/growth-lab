import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, TrendingUp } from 'lucide-react';

interface Revenue {
  id: string;
  company_id?: string;
  project_id?: string;
  amount: number;
  description: string;
  revenue_date: string;
  invoice_number?: string;
  companies?: { name: string };
  projects?: { name: string };
}

const Revenues = () => {
  const [open, setOpen] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [formData, setFormData] = useState<Partial<Revenue>>({
    company_id: undefined,
    project_id: undefined,
    amount: 0,
    description: '',
    revenue_date: new Date().toISOString().split('T')[0],
    invoice_number: undefined,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: revenues, isLoading } = useQuery({
    queryKey: ['revenues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revenues')
        .select('*, companies(name), projects(name)')
        .order('revenue_date', { ascending: false });
      if (error) throw error;
      return data as Revenue[];
    },
  });

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, name, company_id').order('name');
      if (error) throw error;
      return data;
    },
  });

  const totalRevenue = revenues?.reduce((sum, rev) => sum + Number(rev.amount), 0) || 0;

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Revenue>) => {
      const { error } = await supabase.from('revenues').insert([data as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      toast({ title: 'Başarılı', description: 'Gelir eklendi.' });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Revenue> & { id: string }) => {
      const { error } = await supabase.from('revenues').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      toast({ title: 'Başarılı', description: 'Gelir güncellendi.' });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('revenues').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      toast({ title: 'Başarılı', description: 'Gelir silindi.' });
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clean up empty strings to null for optional UUID fields
    const cleanedData = {
      ...formData,
      company_id: formData.company_id || null,
      project_id: formData.project_id || null,
      invoice_number: formData.invoice_number || null,
    };
    
    if (editingRevenue) {
      updateMutation.mutate({ ...cleanedData, id: editingRevenue.id });
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleEdit = (revenue: Revenue) => {
    setEditingRevenue(revenue);
    setFormData({
      company_id: revenue.company_id,
      project_id: revenue.project_id,
      amount: revenue.amount,
      description: revenue.description,
      revenue_date: revenue.revenue_date,
      invoice_number: revenue.invoice_number,
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingRevenue(null);
    setFormData({ company_id: undefined, project_id: undefined, amount: 0, description: '', revenue_date: new Date().toISOString().split('T')[0], invoice_number: undefined });
  };

  const filteredProjects = formData.company_id 
    ? projects?.filter(p => p.company_id === formData.company_id)
    : projects;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Gelir Yönetimi</h1>
            <p className="text-muted-foreground">Gelirlerinizi takip edin</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingRevenue(null); setFormData({ company_id: undefined, project_id: undefined, amount: 0, description: '', revenue_date: new Date().toISOString().split('T')[0], invoice_number: undefined }); }}>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Gelir
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingRevenue ? 'Gelir Düzenle' : 'Yeni Gelir Ekle'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_id">Firma</Label>
                    <Select value={formData.company_id || ''} onValueChange={(value) => setFormData({ ...formData, company_id: value, project_id: '' })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçin (opsiyonel)" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project_id">Proje</Label>
                    <Select value={formData.project_id || ''} onValueChange={(value) => setFormData({ ...formData, project_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçin (opsiyonel)" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredProjects?.map((project) => (
                          <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Tutar (TL) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revenue_date">Tarih *</Label>
                    <Input
                      id="revenue_date"
                      type="date"
                      value={formData.revenue_date}
                      onChange={(e) => setFormData({ ...formData, revenue_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="invoice_number">Fatura No</Label>
                    <Input
                      id="invoice_number"
                      placeholder="FTR-2025-001"
                      value={formData.invoice_number || ''}
                      onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Açıklama *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingRevenue ? 'Güncelle' : 'Ekle'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleClose}>İptal</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Toplam Gelir</CardTitle>
            <div className="flex items-center gap-2 text-2xl font-bold text-primary">
              <TrendingUp className="h-6 w-6" />
              {totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gelirler ({revenues?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : revenues?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Henüz gelir kaydı bulunmuyor.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Açıklama</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Proje</TableHead>
                    <TableHead>Fatura No</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenues?.map((revenue) => (
                    <TableRow key={revenue.id}>
                      <TableCell>{new Date(revenue.revenue_date).toLocaleDateString('tr-TR')}</TableCell>
                      <TableCell className="max-w-xs truncate">{revenue.description}</TableCell>
                      <TableCell>{revenue.companies?.name || '-'}</TableCell>
                      <TableCell>{revenue.projects?.name || '-'}</TableCell>
                      <TableCell>{revenue.invoice_number || '-'}</TableCell>
                      <TableCell className="font-medium text-primary">{Number(revenue.amount).toLocaleString('tr-TR')} TL</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(revenue)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(revenue.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Revenues;