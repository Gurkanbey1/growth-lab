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
import { Plus, Pencil, Trash2, Loader2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Domain {
  id: string;
  company_id?: string;
  domain_name: string;
  type: string;
  start_date?: string;
  expire_date: string;
  registrar?: string;
  notes?: string;
  companies?: { name: string };
}

const Domains = () => {
  const [open, setOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [csvText, setCsvText] = useState('');
  const [csvDateType, setCsvDateType] = useState<'start' | 'expire'>('expire');
  const [formData, setFormData] = useState<Partial<Domain>>({
    company_id: undefined,
    domain_name: '',
    type: 'domain',
    start_date: undefined,
    expire_date: '',
    registrar: undefined,
    notes: undefined,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: domains, isLoading } = useQuery({
    queryKey: ['domains'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('domains')
        .select('*, companies(name)')
        .order('expire_date', { ascending: true });
      if (error) throw error;
      return data as Domain[];
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
    mutationFn: async (data: Partial<Domain>) => {
      const { error } = await supabase.from('domains').insert([data as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast({ title: 'Başarılı', description: 'Domain eklendi.' });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Domain> & { id: string }) => {
      const { error } = await supabase.from('domains').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast({ title: 'Başarılı', description: 'Domain güncellendi.' });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('domains').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast({ title: 'Başarılı', description: 'Domain silindi.' });
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async () => {
      const lines = csvText.split('\n').filter(line => line.trim());

      const normalizeDate = (raw: string): string | null => {
        const value = raw.trim();
        if (!value) return null;

        // Eğer zaten YYYY-MM-DD ise olduğu gibi kullan
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return value;
        }

        // Ortak ayraçları destekle: 01.01.2025, 01/01/2025, 01-01-2025
        const separatorMatch = value.match(/[.\/-]/);
        if (!separatorMatch) return null;
        const sep = separatorMatch[0];
        const parts = value.split(sep).map(p => p.trim());

        if (parts.length !== 3) return null;

        let day: number, month: number, year: number;

        // Yıl başta: 2025-01-31
        if (parts[0].length === 4) {
          year = Number(parts[0]);
          month = Number(parts[1]);
          day = Number(parts[2]);
        } else {
          // Gün/Ay/Yıl varsay: 31.01.2025 veya 31.01.25
          day = Number(parts[0]);
          month = Number(parts[1]);
          year = Number(parts[2].length === 2 ? `20${parts[2]}` : parts[2]);
        }

        if (!year || !month || !day) return null;

        const jsDate = new Date(year, month - 1, day);
        if (Number.isNaN(jsDate.getTime())) return null;

        // JS `Date` doğrulaması (ay/gün taşması olmamalı)
        if (
          jsDate.getFullYear() !== year ||
          jsDate.getMonth() !== month - 1 ||
          jsDate.getDate() !== day
        ) {
          return null;
        }

        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${year}-${mm}-${dd}`;
      };

      const domains = lines
        .map(line => {
          const [domain_name_raw, date_raw] = line.split(',');
          const domain_name = domain_name_raw?.trim();
          const normalizedDate = date_raw ? normalizeDate(date_raw) : null;

          // Zorunlu alanlar: domain_name + geçerli tarih
          if (!domain_name || !normalizedDate) {
            return null;
          }

          return {
            domain_name,
            type: 'domain',
            start_date: csvDateType === 'start' ? normalizedDate : null,
            expire_date: csvDateType === 'expire' ? normalizedDate : normalizedDate,
          };
        })
        .filter((domain): domain is { domain_name: string; type: string; start_date: string | null; expire_date: string } =>
          domain !== null
        );

      if (domains.length === 0) {
        throw new Error('CSV dosyasında geçerli kayıt bulunamadı. Her satır "alan.com,01.01.2025" gibi bir tarih içermeli.');
      }

      const { error } = await supabase.from('domains').insert(domains as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast({ title: 'Başarılı', description: 'Domainler toplu olarak eklendi.' });
      setCsvOpen(false);
      setCsvText('');
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
      company_id: formData.company_id || null,
      start_date: formData.start_date || null,
      registrar: formData.registrar || null,
      notes: formData.notes || null,
    };
    
    if (editingDomain) {
      updateMutation.mutate({ ...cleanedData, id: editingDomain.id });
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleEdit = (domain: Domain) => {
    setEditingDomain(domain);
    setFormData({
      company_id: domain.company_id,
      domain_name: domain.domain_name,
      type: domain.type,
      start_date: domain.start_date,
      expire_date: domain.expire_date,
      registrar: domain.registrar,
      notes: domain.notes,
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingDomain(null);
    setFormData({ company_id: undefined, domain_name: '', type: 'domain', start_date: undefined, expire_date: '', registrar: undefined, notes: undefined });
  };

  const getDaysUntilExpiry = (expireDate: string) => {
    const today = new Date();
    const expiry = new Date(expireDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getTypeBadge = (type: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      domain: { label: 'Domain', variant: 'default' },
      hosting: { label: 'Hosting', variant: 'secondary' },
      ssl: { label: 'SSL', variant: 'outline' },
    };
    const { label, variant } = config[type] || { label: type, variant: 'outline' as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Domain & Hosting Yönetimi</h1>
            <p className="text-muted-foreground">Domain, hosting ve SSL sertifikalarını takip edin</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  CSV İçe Aktar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>CSV ile Toplu Ekleme</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tarih Tipi</Label>
                    <Select value={csvDateType} onValueChange={(value: 'start' | 'expire') => setCsvDateType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="start">Başlangıç Tarihi</SelectItem>
                        <SelectItem value="expire">Bitiş Tarihi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>CSV Verisi (her satır: domain, tarih)</Label>
                    <Textarea
                      placeholder="example.com, 2025-12-31&#10;test.com, 2025-11-30"
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      rows={8}
                    />
                    <p className="text-xs text-muted-foreground">Format: domain_adi, YYYY-MM-DD</p>
                  </div>
                  <Button
                    onClick={() => bulkImportMutation.mutate()}
                    disabled={bulkImportMutation.isPending || !csvText.trim()}
                    className="w-full"
                  >
                    {bulkImportMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    İçe Aktar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingDomain(null); setFormData({ company_id: undefined, domain_name: '', type: 'domain', start_date: undefined, expire_date: '', registrar: undefined, notes: undefined }); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Yeni Kayıt
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingDomain ? 'Kayıt Düzenle' : 'Yeni Kayıt Ekle'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="domain_name">Domain/Host Adı *</Label>
                      <Input
                        id="domain_name"
                        placeholder="example.com"
                        value={formData.domain_name}
                        onChange={(e) => setFormData({ ...formData, domain_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Tip *</Label>
                      <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="domain">Domain</SelectItem>
                          <SelectItem value="hosting">Hosting</SelectItem>
                          <SelectItem value="ssl">SSL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_id">Firma</Label>
                      <Select value={formData.company_id || ''} onValueChange={(value) => setFormData({ ...formData, company_id: value })}>
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
                      <Label htmlFor="start_date">Başlangıç Tarihi</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date || ''}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expire_date">Bitiş Tarihi *</Label>
                      <Input
                        id="expire_date"
                        type="date"
                        value={formData.expire_date}
                        onChange={(e) => setFormData({ ...formData, expire_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="registrar">Kayıt Firması</Label>
                      <Input
                        id="registrar"
                        placeholder="GoDaddy, Namecheap, vb."
                        value={formData.registrar || ''}
                        onChange={(e) => setFormData({ ...formData, registrar: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notlar</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingDomain ? 'Güncelle' : 'Ekle'}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleClose}>İptal</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Kayıtlar ({domains?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : domains?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Henüz kayıt bulunmuyor.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain/Host</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Kayıt Firması</TableHead>
                    <TableHead>Bitiş Tarihi</TableHead>
                    <TableHead>Kalan Gün</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains?.map((domain) => {
                    const daysLeft = getDaysUntilExpiry(domain.expire_date);
                    return (
                      <TableRow key={domain.id}>
                        <TableCell className="font-medium">{domain.domain_name}</TableCell>
                        <TableCell>{getTypeBadge(domain.type)}</TableCell>
                        <TableCell>{domain.companies?.name || '-'}</TableCell>
                        <TableCell>{domain.registrar || '-'}</TableCell>
                        <TableCell>{new Date(domain.expire_date).toLocaleDateString('tr-TR')}</TableCell>
                        <TableCell>
                          <span className={daysLeft < 30 ? 'text-destructive font-medium' : daysLeft < 60 ? 'text-orange-500' : ''}>
                            {daysLeft} gün
                          </span>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(domain)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(domain.id)}
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

export default Domains;