import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2 } from "lucide-react";

interface AINoteDialogProps {
  onNoteCreated?: () => void;
}

export function AINoteDialog({ onNoteCreated }: AINoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCreateNote = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen bir not veya hatırlatma girin",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Kullanıcı girişi yapılmamış");

      const { data, error } = await supabase.functions.invoke("ai-notes", {
        body: {
          prompt: prompt.trim(),
          userId: user.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "AI destekli not oluşturuldu",
      });

      setPrompt("");
      setOpen(false);
      onNoteCreated?.();
    } catch (error: any) {
      console.error("Error creating AI note:", error);
      toast({
        title: "Hata",
        description: error.message || "Not oluşturulamadı",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          AI ile Not Al
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>AI Destekli Not Alma</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Örnek: Yarın saat 14:00'te müşteri toplantısı var, not al..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              AI, notunuzu analiz edip otomatik olarak başlık, içerik ve hatırlatma tarihi oluşturacak
            </p>
          </div>
          <Button onClick={handleCreateNote} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                AI ile Oluştur
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
