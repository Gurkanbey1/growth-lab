import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Settings as SettingsIcon, Save, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as XLSX from 'xlsx';

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local storage settings
  const [firmaTipleri, setFirmaTipleri] = useState<string[]>(["Müşteri", "Freelancer", "Tedarikçi"]);
  const [giderKategorileri, setGiderKategorileri] = useState<string[]>(["Kira", "Fatura", "Maaş", "Ofis", "Pazarlama", "Diğer"]);
  const [smPlatformlar, setSmPlatformlar] = useState<string[]>(["Instagram", "Facebook", "Twitter/X", "LinkedIn", "TikTok", "YouTube"]);
  const [domainTipleri, setDomainTipleri] = useState<string[]>(["Domain", "Hosting", "SSL"]);
  const [projeDurumlari, setProjeDurumlari] = useState<string[]>(["Aktif", "Tamamlandı", "İptal", "Beklemede"]);

  const [yeniFirmaTipi, setYeniFirmaTipi] = useState("");
  const [yeniKategori, setYeniKategori] = useState("");
  const [yeniPlatform, setYeniPlatform] = useState("");
  const [yeniDomainTipi, setYeniDomainTipi] = useState("");
  const [yeniProjeDurumu, setYeniProjeDurumu] = useState("");

  // Database settings
  const [userSettings, setUserSettings] = useState({
    smtp_host: "",
    smtp_port: 587,
    smtp_username: "",
    smtp_password: "",
    notification_email: "",
    telegram_chat_id: "",
    openai_api_key: "",
  });

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch user settings
  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ["userSettings", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!currentUser?.id,
  });

  // Update settings state when data is fetched
  useEffect(() => {
    if (dbSettings) {
      setUserSettings({
        smtp_host: dbSettings.smtp_host || "",
        smtp_port: dbSettings.smtp_port || 587,
        smtp_username: dbSettings.smtp_username || "",
        smtp_password: dbSettings.smtp_password || "",
        notification_email: dbSettings.notification_email || "",
        telegram_chat_id: dbSettings.telegram_chat_id || "",
        openai_api_key: dbSettings.openai_api_key || "",
      });
    }
  }, [dbSettings]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: typeof userSettings) => {
      if (!currentUser?.id) throw new Error("User not authenticated");
      
      if (dbSettings) {
        // Update existing settings
        const { error } = await supabase
          .from("user_settings")
          .update(settings)
          .eq("user_id", currentUser.id);
        if (error) throw error;
      } else {
        // Insert new settings
        const { error } = await supabase
          .from("user_settings")
          .insert([{ ...settings, user_id: currentUser.id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userSettings"] });
      toast({ title: "Başarılı", description: "Ayarlar kaydedildi." });
    },
    onError: (error: any) => {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate(userSettings);
  };

  const handleExportDatabase = async () => {
    try {
      toast({ title: "İndiriliyor...", description: "Veritabanı yedekleniyor, lütfen bekleyin." });
      
      const tables = [
        'companies',
        'projects',
        'revenues',
        'expenses',
        'expense_payments',
        'domains',
        'social_media_accounts',
        'notes',
        'profiles',
        'user_roles',
        'user_settings',
        'project_payments',
        'ai_prompt_history'
      ] as const;

      const workbook = XLSX.utils.book_new();

      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('*');
        
        if (error) {
          console.error(`Error fetching ${table}:`, error);
          continue;
        }

        if (data && data.length > 0) {
          const worksheet = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(workbook, worksheet, String(table));
        }
      }

      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `database-backup-${timestamp}.xlsx`);
      
      toast({ title: "Başarılı", description: "Veritabanı başarıyla indirildi." });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({ 
        title: "Hata", 
        description: "Veritabanı yedeklenirken bir hata oluştu.", 
        variant: "destructive" 
      });
    }
  };

  const ekle = (liste: string[], setListe: (list: string[]) => void, deger: string, setDeger: (val: string) => void) => {
    if (!deger.trim()) {
      toast({ title: "Hata", description: "Boş değer eklenemez.", variant: "destructive" });
      return;
    }
    if (liste.includes(deger.trim())) {
      toast({ title: "Hata", description: "Bu değer zaten mevcut.", variant: "destructive" });
      return;
    }
    setListe([...liste, deger.trim()]);
    setDeger("");
    toast({ title: "Başarılı", description: "Yeni değer eklendi." });
  };

  const sil = (liste: string[], setListe: (list: string[]) => void, deger: string) => {
    setListe(liste.filter((item) => item !== deger));
    toast({ title: "Başarılı", description: "Değer silindi." });
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
              if (e.key === "Enter") {
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
              <button onClick={() => sil(liste, setListe, item)} className="ml-2 hover:text-destructive">
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

        <Tabs defaultValue="lists" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lists">Listeler</TabsTrigger>
            <TabsTrigger value="notifications">Bildirimler</TabsTrigger>
            <TabsTrigger value="ai">AI Ayarları</TabsTrigger>
          </TabsList>

          <TabsContent value="lists" className="space-y-6">
            {renderList("Firma Tipleri", "Firmalar için kullanılabilir tipler", firmaTipleri, setFirmaTipleri, yeniFirmaTipi, setYeniFirmaTipi)}
            {renderList("Proje Durumları", "Projeler için kullanılabilir durumlar", projeDurumlari, setProjeDurumlari, yeniProjeDurumu, setYeniProjeDurumu)}
            {renderList("Gider Kategorileri", "Giderler için kullanılabilir kategoriler", giderKategorileri, setGiderKategorileri, yeniKategori, setYeniKategori)}
            {renderList("Sosyal Medya Platformları", "Sosyal medya hesapları için platformlar", smPlatformlar, setSmPlatformlar, yeniPlatform, setYeniPlatform)}
            {renderList("Domain Tipleri", "Domainler için kullanılabilir tipler", domainTipleri, setDomainTipleri, yeniDomainTipi, setYeniDomainTipi)}

            <Card>
              <CardHeader>
                <CardTitle>Para Birimi</CardTitle>
                <CardDescription>Uygulama genelinde kullanılan para birimi</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-lg py-2 px-4">
                    TL (Türk Lirası)
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Veritabanı Yedeği</CardTitle>
                <CardDescription>Tüm veritabanını Excel formatında indirin</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleExportDatabase} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Veritabanını İndir
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Not</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Bu ayarlar tarayıcınızda yerel olarak saklanır. Tarayıcı verilerini temizlerseniz, ayarlarınız sıfırlanacaktır.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>SMTP Ayarları</CardTitle>
                <CardDescription>E-posta bildirimleri için SMTP sunucu ayarları</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp_host">SMTP Host</Label>
                    <Input
                      id="smtp_host"
                      placeholder="smtp.gmail.com"
                      value={userSettings.smtp_host}
                      onChange={(e) => setUserSettings({ ...userSettings, smtp_host: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_port">SMTP Port</Label>
                    <Input
                      id="smtp_port"
                      type="number"
                      placeholder="587"
                      value={userSettings.smtp_port}
                      onChange={(e) => setUserSettings({ ...userSettings, smtp_port: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_username">SMTP Kullanıcı Adı</Label>
                  <Input
                    id="smtp_username"
                    placeholder="your-email@gmail.com"
                    value={userSettings.smtp_username}
                    onChange={(e) => setUserSettings({ ...userSettings, smtp_username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_password">SMTP Şifre</Label>
                  <Input
                    id="smtp_password"
                    type="password"
                    placeholder="••••••••"
                    value={userSettings.smtp_password}
                    onChange={(e) => setUserSettings({ ...userSettings, smtp_password: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bildirim Ayarları</CardTitle>
                <CardDescription>Hangi e-posta adresine bildirim gönderilsin?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notification_email">Bildirim E-posta Adresi</Label>
                  <Input
                    id="notification_email"
                    type="email"
                    placeholder="notifications@example.com"
                    value={userSettings.notification_email}
                    onChange={(e) => setUserSettings({ ...userSettings, notification_email: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Telegram Ayarları</CardTitle>
                <CardDescription>Telegram bildirimleri için Chat ID</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="telegram_chat_id">Telegram Chat ID</Label>
                  <Input
                    id="telegram_chat_id"
                    placeholder="123456789"
                    value={userSettings.telegram_chat_id}
                    onChange={(e) => setUserSettings({ ...userSettings, telegram_chat_id: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Chat ID'nizi öğrenmek için Telegram botunuza /start yazın
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSaveSettings} disabled={saveSettingsMutation.isPending || isLoading} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saveSettingsMutation.isPending ? "Kaydediliyor..." : "Ayarları Kaydet"}
            </Button>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>OpenAI API Anahtarı</CardTitle>
                <CardDescription>AI destekli not alma ve hatırlatmalar için OpenAI API anahtarınızı girin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="openai_api_key">OpenAI API Key</Label>
                  <Textarea
                    id="openai_api_key"
                    placeholder="sk-proj-..."
                    value={userSettings.openai_api_key}
                    onChange={(e) => setUserSettings({ ...userSettings, openai_api_key: e.target.value })}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    API anahtarınızı{" "}
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      OpenAI Platform
                    </a>
                    'dan alabilirsiniz
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Özellikleri</CardTitle>
                <CardDescription>OpenAI API anahtarı ile kullanabileceğiniz özellikler</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Sesli veya yazılı not alma</li>
                  <li>Otomatik hatırlatma oluşturma</li>
                  <li>Görevleri takvimde görüntüleme</li>
                  <li>AI destekli içerik önerileri</li>
                </ul>
              </CardContent>
            </Card>

            <Button onClick={handleSaveSettings} disabled={saveSettingsMutation.isPending || isLoading} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saveSettingsMutation.isPending ? "Kaydediliyor..." : "Ayarları Kaydet"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
