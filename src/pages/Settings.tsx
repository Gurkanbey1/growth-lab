import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Settings as SettingsIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const Settings = () => {
  const { toast } = useToast();
  
  // Default values - bu değerler localStorage'da saklanacak
  const [firmaTipleri, setFirmaTipleri] = useState<string[]>(['Müşteri', 'Freelancer', 'Tedarikçi']);
  const [giderKategorileri, setGiderKategorileri] = useState<string[]>(['Kira', 'Fatura', 'Maaş', 'Ofis', 'Pazarlama', 'Diğer']);
  const [smPlatformlar, setSmPlatformlar] = useState<string[]>(['Instagram', 'Facebook', 'Twitter/X', 'LinkedIn', 'TikTok', 'YouTube']);
  const [domainTipleri, setDomainTipleri] = useState<string[]>(['Domain', 'Hosting', 'SSL']);
  const [projeDurumlari, setProjeDurumlari] = useState<string[]>(['Aktif', 'Tamamlandı', 'İptal', 'Beklemede']);

  const [yeniFirmaTipi, setYeniFirmaTipi] = useState('');
  const [yeniKategori, setYeniKategori] = useState('');
  const [yeniPlatform, setYeniPlatform] = useState('');
  const [yeniDomainTipi, setYeniDomainTipi] = useState('');
  const [yeniProjeDurumu, setYeniProjeDurumu] = useState('');

  const ekle = (liste: string[], setListe: (list: string[]) => void, deger: string, setDeger: (val: string) => void) => {
    if (!deger.trim()) {
      toast({ title: 'Hata', description: 'Boş değer eklenemez.', variant: 'destructive' });
      return;
    }
    if (liste.includes(deger.trim())) {
      toast({ title: 'Hata', description: 'Bu değer zaten mevcut.', variant: 'destructive' });
      return;
    }
    setListe([...liste, deger.trim()]);
    setDeger('');
    toast({ title: 'Başarılı', description: 'Yeni değer eklendi.' });
  };

  const sil = (liste: string[], setListe: (list: string[]) => void, deger: string) => {
    setListe(liste.filter(item => item !== deger));
    toast({ title: 'Başarılı', description: 'Değer silindi.' });
  };

  const renderList = (
    baslik: string,
    aciklama: string,
    liste: string[],
    setListe: (list: string[]) => void,
    yeniDeger: string,
    setYeniDeger: (val: string) => void
  ) => (
    <Card>
      <CardHeader>
        <CardTitle>{baslik}</CardTitle>
        <CardDescription>{aciklama}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Yeni değer ekle..."
            value={yeniDeger}
            onChange={(e) => setYeniDeger(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                ekle(liste, setListe, yeniDeger, setYeniDeger);
              }
            }}
          />
          <Button onClick={() => ekle(liste, setListe, yeniDeger, setYeniDeger)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {liste.map((item) => (
            <Badge key={item} variant="secondary" className="text-sm py-1.5 px-3">
              {item}
              <button
                onClick={() => sil(liste, setListe, item)}
                className="ml-2 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Ayarlar</h1>
            <p className="text-muted-foreground">Sistem ayarlarını ve seçenekleri yönetin</p>
          </div>
        </div>

        <div className="grid gap-6">
          {renderList(
            'Firma Tipleri',
            'Firma eklerken kullanılacak tipler',
            firmaTipleri,
            setFirmaTipleri,
            yeniFirmaTipi,
            setYeniFirmaTipi
          )}
          
          {renderList(
            'Proje Durumları',
            'Proje durumu seçenekleri',
            projeDurumlari,
            setProjeDurumlari,
            yeniProjeDurumu,
            setYeniProjeDurumu
          )}
          
          {renderList(
            'Gider Kategorileri',
            'Gider kategorisi seçenekleri',
            giderKategorileri,
            setGiderKategorileri,
            yeniKategori,
            setYeniKategori
          )}
          
          {renderList(
            'Sosyal Medya Platformları',
            'Platform seçenekleri',
            smPlatformlar,
            setSmPlatformlar,
            yeniPlatform,
            setYeniPlatform
          )}
          
          {renderList(
            'Domain Tipleri',
            'Domain/hosting kayıt tipleri',
            domainTipleri,
            setDomainTipleri,
            yeniDomainTipi,
            setYeniDomainTipi
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Para Birimi</CardTitle>
            <CardDescription>Sistemde kullanılan para birimi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Label htmlFor="currency" className="text-base">Para Birimi:</Label>
              <Badge variant="outline" className="text-lg px-4 py-2">TL (Türk Lirası)</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle>Not</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Bu ayarlar tarayıcınızda saklanır. Farklı bir tarayıcı veya cihaz kullandığınızda 
              varsayılan değerler görüntülenecektir. İleride bu ayarları veritabanında saklayabilir 
              ve tüm cihazlarda senkronize edebilirsiniz.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Settings;