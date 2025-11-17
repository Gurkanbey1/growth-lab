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
import { Plus, Pencil, Trash2, Loader2, DollarSign, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ExpenseFrequency = 'once' | 'monthly' | 'quarterly' | 'biannual' | 'yearly';

interface Expense {
  id: string;
  company_id?: string;
  amount: number;
  description: string;
  category?: string;
  frequency: ExpenseFrequency;
  payment_day?: number;
  next_payment_date?: string;
  is_active: boolean;
  companies?: { name: string };
}

const Expenses = () => {
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState<Partial<Expense>>({
    company_id: undefined,
    amount: 0,
    description: '',
    category: undefined,
    frequency: 'once',
    payment_day: undefined,
    next_payment_date: undefined,
    is_active: true,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, companies(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Expense[];
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

  const totalExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
  const activeRecurring = expenses?.filter(e => e.frequency !== 'once' && e.is_active).length || 0;

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Expense>) => {
      const { error } = await supabase.from('expenses').insert([data as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Başarılı', description: 'Gider eklendi.' });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Expense> & { id: string }) => {
      const { error } = await supabase.from('expenses').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Başarılı', description: 'Gider güncellendi.' });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Başarılı', description: 'Gider silindi.' });
    },
    onError: (error: any) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (expense: Expense) => {
      if (!expense.next_payment_date) return;
      
      // Add payment record
      await supabase.from('expense_payments').insert([{
        expense_id: expense.id,
        amount: expense.amount,
        payment_date: expense.next_payment_date,
        is_paid: true,
        paid_at: new Date().toISOString(),
      } as any]);

      // Calculate next payment date
      if (expense.frequency !== 'once') {
        const currentDate = new Date(expense.next_payment_date);
        let nextDate: Date;
        
        switch (expense.frequency) {
          case 'monthly':
            nextDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
            break;
          case 'quarterly':
            nextDate = new Date(currentDate.setMonth(currentDate.getMonth() + 3));
            break;
          case 'biannual':
            nextDate = new Date(currentDate.setMonth(currentDate.getMonth() + 6));
            break;
          case 'yearly':
            nextDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 1));
            break;
          default:
            nextDate = currentDate;
        }

        await supabase.from('expenses').update({
          next_payment_date: nextDate.toISOString().split('T')[0],
        }).eq('id', expense.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Başarılı', description: 'Ödeme kaydedildi ve sonraki tarih güncellendi.' });
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
      category: formData.category || null,
      next_payment_date: formData.next_payment_date || null,
    };
    
    if (editingExpense) {
      updateMutation.mutate({ ...cleanedData, id: editingExpense.id });
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData(expense);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingExpense(null);
    setFormData({ company_id: undefined, amount: 0, description: '', frequency: 'once', is_active: true });
  };

  const getFrequencyLabel = (freq: ExpenseFrequency) => {
    const labels = { once: 'Tek Seferlik', monthly: 'Aylık', quarterly: '3 Ayda Bir', biannual: '6 Ayda Bir', yearly: 'Yıllık' };
    return labels[freq];
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Gider Yönetimi</h1>
            <p className="text-muted-foreground">Giderlerinizi ve düzenli ödemelerinizi takip edin</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingExpense(null); setFormData({ company_id: undefined, amount: 0, description: '', frequency: 'once', is_active: true }); }}>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Gider
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingExpense ? 'Gider Düzenle' : 'Yeni Gider Ekle'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor="category">Kategori</Label>
                    <Input
                      id="category"
                      placeholder="Kira, Fatura, vb."
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="frequency">Sıklık *</Label>
                    <Select value={formData.frequency} onValueChange={(value: ExpenseFrequency) => setFormData({ ...formData, frequency: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">Tek Seferlik</SelectItem>
                        <SelectItem value="monthly">Aylık</SelectItem>
                        <SelectItem value="quarterly">3 Ayda Bir</SelectItem>
                        <SelectItem value="biannual">6 Ayda Bir</SelectItem>
                        <SelectItem value="yearly">Yıllık</SelectItem>
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
                  {formData.frequency !== 'once' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="payment_day">Ödeme Günü (1-31)</Label>
                        <Input
                          id="payment_day"
                          type="number"
                          min="1"
                          max="31"
                          value={formData.payment_day || ''}
                          onChange={(e) => setFormData({ ...formData, payment_day: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="next_payment_date">Sonraki Ödeme Tarihi</Label>
                        <Input
                          id="next_payment_date"
                          type="date"
                          value={formData.next_payment_date || ''}
                          onChange={(e) => setFormData({ ...formData, next_payment_date: e.target.value })}
                        />
                      </div>
                    </>
                  )}
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
                    {editingExpense ? 'Güncelle' : 'Ekle'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleClose}>İptal</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Toplam Gider</CardTitle>
              <div className="flex items-center gap-2 text-2xl font-bold text-destructive">
                <DollarSign className="h-6 w-6" />
                {totalExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
              </div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Aktif Düzenli Ödemeler</CardTitle>
              <div className="text-3xl font-bold">{activeRecurring}</div>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Giderler ({expenses?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : expenses?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Henüz gider kaydı bulunmuyor.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Açıklama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Sıklık</TableHead>
                    <TableHead>Sonraki Ödeme</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses?.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="max-w-xs truncate">{expense.description}</TableCell>
                      <TableCell>{expense.category || '-'}</TableCell>
                      <TableCell>{expense.companies?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={expense.frequency === 'once' ? 'outline' : 'secondary'}>
                          {getFrequencyLabel(expense.frequency)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {expense.next_payment_date ? new Date(expense.next_payment_date).toLocaleDateString('tr-TR') : '-'}
                      </TableCell>
                      <TableCell className="font-medium text-destructive">{Number(expense.amount).toLocaleString('tr-TR')} TL</TableCell>
                      <TableCell className="text-right space-x-2">
                        {expense.frequency !== 'once' && expense.next_payment_date && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => markPaidMutation.mutate(expense)}
                            disabled={markPaidMutation.isPending}
                            title="Ödendi olarak işaretle"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(expense.id)}
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

export default Expenses;