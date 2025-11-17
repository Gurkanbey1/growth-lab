import { useState, useEffect } from 'react';
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
import { Plus, Pencil, Trash2, Loader2, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ProjectStatus = 'active' | 'completed' | 'cancelled' | 'pending';

interface Project {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  budget: number;
  paid_amount: number;
  remaining_amount?: number;
  start_date?: string;
  end_date?: string;
  assigned_to?: string;
  companies?: { name: string };
  profiles?: { full_name: string };
}

const Projects = () => {
  const [open, setOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectStatuses, setProjectStatuses] = useState<string[]>(['active', 'pending', 'completed', 'cancelled']);
  const [formData, setFormData] = useState<Partial<Project>>({
    company_id: '',
    name: '',
    description: undefined,
    status: 'active',
    budget: 0,
    paid_amount: 0,
    start_date: undefined,
    end_date: undefined,
    assigned_to: undefined,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const savedStatuses = localStorage.getItem('projeDurumlari');
    if (savedStatuses) {
      setProjectStatuses(JSON.parse(savedStatuses));
    }
  }, []);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          companies(name),
          assigned_user:profiles!projects_assigned_to_fkey(full_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
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

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Project>) => {
      const remaining = (data.budget || 0) - (data.paid_amount || 0);
      const projectData = { ...data, remaining_amount: remaining };
      const { error } = await supabase.from('projects').insert([projectData as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Başarılı', description: 'Proje eklendi.' });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Project> & { id: string }) => {
      const remaining = (data.budget || 0) - (data.paid_amount || 0);
      const projectData = { ...data, remaining_amount: remaining };
      const { error } = await supabase.from('projects').update(projectData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Başarılı', description: 'Proje güncellendi.' });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Başarılı', description: 'Proje silindi.' });
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: async ({ projectId, amount }: { projectId: string; amount: number }) => {
      const project = projects?.find(p => p.id === projectId);
      if (!project) throw new Error('Proje bulunamadı');
      
      const newPaidAmount = (project.paid_amount || 0) + amount;
      const newRemainingAmount = (project.budget || 0) - newPaidAmount;
      
      const { error } = await supabase
        .from('projects')
        .update({ 
          paid_amount: newPaidAmount,
          remaining_amount: newRemainingAmount
        })
        .eq('id', projectId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Başarılı', description: 'Ödeme eklendi.' });
      setPaymentOpen(false);
      setPaymentAmount(0);
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clean up empty strings to null for optional fields
    const cleanedData = {
      ...formData,
      description: formData.description || null,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      assigned_to: formData.assigned_to || null,
    };
    
    if (editingProject) {
      updateMutation.mutate({ ...cleanedData, id: editingProject.id });
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      company_id: project.company_id,
      name: project.name,
      description: project.description,
      status: project.status,
      budget: project.budget,
      paid_amount: project.paid_amount,
      start_date: project.start_date,
      end_date: project.end_date,
      assigned_to: project.assigned_to,
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingProject(null);
    setFormData({ company_id: '', name: '', status: 'active', budget: 0, paid_amount: 0, description: undefined, start_date: undefined, end_date: undefined, assigned_to: undefined });
  };

  const handleOpenPayment = (project: Project) => {
    setSelectedProject(project);
    setPaymentAmount(0);
    setPaymentOpen(true);
  };

  const handleClosePayment = () => {
    setPaymentOpen(false);
    setSelectedProject(null);
    setPaymentAmount(0);
  };

  const handleAddPayment = () => {
    if (!selectedProject || paymentAmount <= 0) {
      toast({ 
        title: 'Hata', 
        description: 'Geçerli bir ödeme tutarı girin',
        variant: 'destructive' 
      });
      return;
    }

    const remaining = (selectedProject.budget || 0) - (selectedProject.paid_amount || 0);
    if (paymentAmount > remaining) {
      toast({ 
        title: 'Hata', 
        description: 'Ödeme tutarı kalan bakiyeden fazla olamaz',
        variant: 'destructive' 
      });
      return;
    }

    addPaymentMutation.mutate({ 
      projectId: selectedProject.id, 
      amount: paymentAmount 
    });
  };

  const getStatusBadge = (status: ProjectStatus) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      active: { label: 'Aktif', variant: 'default' },
      completed: { label: 'Tamamlandı', variant: 'secondary' },
      cancelled: { label: 'İptal', variant: 'destructive' },
      pending: { label: 'Beklemede', variant: 'outline' },
    };
    const statusConfig = config[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Proje Yönetimi</h1>
            <p className="text-muted-foreground">Projeleri takip edin ve yönetin</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingProject(null); setFormData({ company_id: '', name: '', status: 'active', budget: 0, paid_amount: 0, description: undefined, start_date: undefined, end_date: undefined, assigned_to: undefined }); }}>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Proje
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProject ? 'Proje Düzenle' : 'Yeni Proje Ekle'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="company_id">Firma *</Label>
                    <Select value={formData.company_id} onValueChange={(value) => setFormData({ ...formData, company_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Firma seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="name">Proje Adı *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Durum</Label>
                    <Select value={formData.status} onValueChange={(value: ProjectStatus) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {projectStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status === 'active' ? 'Aktif' : 
                             status === 'pending' ? 'Beklemede' : 
                             status === 'completed' ? 'Tamamlandı' : 
                             status === 'cancelled' ? 'İptal' : status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assigned_to">Atanan Kişi</Label>
                    <Select value={formData.assigned_to || ''} onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget">Bütçe (TL)</Label>
                    <Input
                      id="budget"
                      type="number"
                      step="0.01"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paid_amount">Ödenen (TL)</Label>
                    <Input
                      id="paid_amount"
                      type="number"
                      step="0.01"
                      value={formData.paid_amount}
                      onChange={(e) => setFormData({ ...formData, paid_amount: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Başlangıç Tarihi</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date || ''}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">Bitiş Tarihi</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date || ''}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Açıklama</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingProject ? 'Güncelle' : 'Ekle'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleClose}>İptal</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Projeler ({projects?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : projects?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Henüz proje bulunmuyor.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proje Adı</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Bütçe</TableHead>
                    <TableHead>Ödenen</TableHead>
                    <TableHead>Kalan</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects?.map((project) => {
                    const remaining = (project.budget || 0) - (project.paid_amount || 0);
                    return (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell>{project.companies?.name}</TableCell>
                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                        <TableCell>{Number(project.budget).toLocaleString('tr-TR')} TL</TableCell>
                        <TableCell>{Number(project.paid_amount || 0).toLocaleString('tr-TR')} TL</TableCell>
                        <TableCell>
                          <span className={remaining > 0 ? 'text-red-500 font-semibold' : 'text-green-500'}>
                            {remaining.toLocaleString('tr-TR')} TL
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {remaining > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenPayment(project)}
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                Ödeme Ekle
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(project)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(project.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ödeme Ekle - {selectedProject?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Proje Bilgileri</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Bütçe:</span>{' '}
                    <span className="font-semibold">{Number(selectedProject?.budget || 0).toLocaleString('tr-TR')} TL</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ödenen:</span>{' '}
                    <span className="font-semibold">{Number(selectedProject?.paid_amount || 0).toLocaleString('tr-TR')} TL</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Kalan Borç:</span>{' '}
                    <span className="font-semibold text-red-500">
                      {((selectedProject?.budget || 0) - (selectedProject?.paid_amount || 0)).toLocaleString('tr-TR')} TL
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_amount">Ödeme Tutarı (TL)</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  placeholder="Ödeme tutarını girin"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddPayment} disabled={addPaymentMutation.isPending}>
                  {addPaymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ödeme Ekle
                </Button>
                <Button type="button" variant="outline" onClick={handleClosePayment}>
                  İptal
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Projects;