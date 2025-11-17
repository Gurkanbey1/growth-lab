import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, CheckCircle2, History, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function AIQuickCreate() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch prompt history
  const { data: promptHistory } = useQuery({
    queryKey: ["ai-prompt-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_prompt_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

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
      queryClient.invalidateQueries({ queryKey: ["ai-prompt-history"] });

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
            {promptHistory && promptHistory.length > 0 && !showHistory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(true)}
                className="w-full justify-start gap-2 text-muted-foreground"
              >
                <History className="h-4 w-4" />
                Geçmiş promptları göster ({promptHistory.length})
              </Button>
            )}

            {showHistory && promptHistory && promptHistory.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Son Promptlar</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistory(false)}
                  >
                    Gizle
                  </Button>
                </div>
                <ScrollArea className="h-40 rounded-md border p-2">
                  {promptHistory.map((item) => (
                    <div key={item.id} className="mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPrompt(item.prompt);
                          setShowHistory(false);
                        }}
                        className="w-full justify-start text-left h-auto py-2 px-2 hover:bg-accent"
                      >
                        <div className="space-y-1 w-full">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(item.created_at).toLocaleDateString("tr-TR")}
                          </div>
                          <p className="text-sm line-clamp-2">{item.prompt}</p>
                          {item.result_summary && (
                            <p className="text-xs text-muted-foreground italic">
                              {item.result_summary}
                            </p>
                          )}
                        </div>
                      </Button>
                      <Separator className="mt-2" />
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

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
