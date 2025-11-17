import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";

export function AIQuickCreate() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen bir açıklama girin",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-quick-create", {
        body: { prompt },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Hata",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Başarılı!",
        description: `${data.company.name} firması ve ${data.project.name} projesi oluşturuldu.`,
      });

      // Show success animation
      setShowSuccess(true);
      
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });

      // Close dialog after animation
      setTimeout(() => {
        setOpen(false);
        setPrompt("");
        setShowSuccess(false);
      }, 2000);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Hata",
        description: "Bir hata oluştu. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 text-foreground bg-gradient-to-r from-primary/10 via-primary/5 to-transparent hover:from-primary/20 hover:via-primary/10 hover:to-primary/5 hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg border-primary/20"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          AI ile Oluştur
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI ile Hızlı Oluşturma</DialogTitle>
        </DialogHeader>
        {showSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 animate-scale-in" />
            <p className="text-lg font-medium text-green-600 animate-fade-in">
              Başarıyla oluşturuldu!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea
              placeholder='Örnek: "yeni firma autogold 1500 aylık anlaşma sosyal medya yönetimi her ayın 5 de ödeme için hatırlat"'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <Button onClick={handleCreate} disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Oluştur
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
