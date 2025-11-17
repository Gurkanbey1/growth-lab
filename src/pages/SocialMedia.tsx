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
import { Plus, Pencil, Trash2, Loader2, RefreshCw } from 'lucide-react';

interface SocialMediaAccount {
  id: string;
  company_id: string;
  platform: string;
  account_name: string;
  monthly_fee?: number;
  renewal_date: string;
  last_renewed_at?: string;
  notes?: string;
  companies?: { name: string };
}

const SocialMedia = () => {
  const [open, setOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialMediaAccount | null>(null);
  const [formData, setFormData] = useState<Partial<SocialMediaAccount>>({
    company_id: '',
    platform: '',
    account_name: '',
    monthly_fee: 0,
    renewal_date: '',
    notes: undefined,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['social-media-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_media_accounts')
        .select('*, companies(name)')
        .order('renewal_date', { ascending: true });
      if (error) throw error;
      return data as SocialMediaAccount[];
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

  const createMutation = useMutation({
    mutationFn: async (data: Partial<SocialMediaAccount>) => {
      const { error } = await supabase.from('social_media_accounts').insert([data as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-media-accounts'] });
      toast({ title: 'Başarılı', description: 'Hesap eklendi.' });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<SocialMediaAccount> & { id: string }) => {
      const { error } = await supabase.from('social_media_accounts').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-media-accounts'] });
      toast({ title: 'Başarılı', description: 'Hesap güncellendi.' });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('social_media_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-media-accounts'] });
      toast({ title: 'Başarılı', description: 'Hesap silindi.' });
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const renewMutation = useMutation({
    mutationFn: async (account: SocialMediaAccount) => {
      const currentDate = new Date(account.renewal_date);
      const newDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
      
      const { error } = await supabase
        .from('social_media_accounts')
        .update({
          renewal_date: newDate.toISOString().split('T')[0],
          last_renewed_at: new Date().toISOString(),
        })
        .eq('id', account.id);
      
      if (error) throw error;

      // Add revenue if monthly_fee exists
      if (account.monthly_fee && account.monthly_fee > 0) {
        const { error: revenueError } = await supabase.from('revenues').insert([{
          company_id: account.company_id,
          amount: account.monthly_fee,
          description: `${account.platform} - ${account.account_name} yenileme`,
          revenue_date: new Date().toISOString().split('T')[0],
        }]);
        if (revenueError) throw revenueError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-media-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      toast({ title: 'Başarılı', description: 'Hesap yenilendi ve gelir kaydedildi.' });
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
      notes: formData.notes || null,
      monthly_fee: formData.monthly_fee || null,
    };
    
    if (editingAccount) {
      updateMutation.mutate({ ...cleanedData, id: editingAccount.id });
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleEdit = (account: SocialMediaAccount) => {
    setEditingAccount(account);
    setFormData({
      company_id: account.company_id,
      platform: account.platform,
      account_name: account.account_name,
      monthly_fee: account.monthly_fee,
      renewal_date: account.renewal_date,
      notes: account.notes,
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingAccount(null);
    setFormData({ company_id: '', platform: '', account_name: '', monthly_fee: 0, renewal_date: '', notes: undefined });
  };

  const getDaysUntilRenewal = (renewalDate: string) => {
    const today = new Date();
    const renewal = new Date(renewalDate);
    const diffTime = renewal.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Sosyal Medya Yönetimi</h1>
            <p className="text-muted-foreground">Sosyal medya hesaplarını takip edin</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingAccount(null); setFormData({ company_id: '', platform: '', account_name: '', monthly_fee: 0, renewal_date: '', notes: undefined }); }}>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Hesap
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingAccount ? 'Hesap Düzenle' : 'Yeni Hesap Ekle'}</DialogTitle>
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
                  <div className="space-y-2">
                    <Label htmlFor="platform">Platform *</Label>
                    <Input
                      id="platform"
                      placeholder="Instagram, Facebook, vb."
                      value={formData.platform}
                      onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_name">Hesap Adı *</Label>
                    <Input
                      id="account_name"
                      placeholder="@kullaniciadi"
                      value={formData.account_name}
                      onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly_fee">Aylık Ücret (TL)</Label>
                    <Input
                      id="monthly_fee"
                      type="number"
                      step="0.01"
                      value={formData.monthly_fee}
                      onChange={(e) => setFormData({ ...formData, monthly_fee: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="renewal_date">Yenileme Tarihi *</Label>
                    <Input
                      id="renewal_date"
                      type="date"
                      value={formData.renewal_date}
                      onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notlar</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingAccount ? 'Güncelle' : 'Ekle'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleClose}>İptal</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sosyal Medya Hesapları ({accounts?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : accounts?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Henüz hesap bulunmuyor.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Hesap</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Aylık Ücret</TableHead>
                    <TableHead>Yenileme</TableHead>
                    <TableHead>Kalan Gün</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts?.map((account) => {
                    const daysLeft = getDaysUntilRenewal(account.renewal_date);
                    return (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.platform}</TableCell>
                        <TableCell>{account.account_name}</TableCell>
                        <TableCell>{account.companies?.name}</TableCell>
                        <TableCell>{account.monthly_fee?.toLocaleString('tr-TR') || '-'} {account.monthly_fee ? 'TL' : ''}</TableCell>
                        <TableCell>{new Date(account.renewal_date).toLocaleDateString('tr-TR')}</TableCell>
                        <TableCell>
                          <span className={daysLeft < 7 ? 'text-destructive font-medium' : ''}>
                            {daysLeft} gün
                          </span>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => renewMutation.mutate(account)}
                            disabled={renewMutation.isPending}
                            title="Yenile (30 gün ekle)"
                          >
                            <RefreshCw className="h-4 w-4 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(account)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(account.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SocialMedia;