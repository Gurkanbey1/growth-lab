import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, StickyNote, CheckCircle2 } from "lucide-react";
import { AINoteDialog } from "@/components/AINoteDialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  note_type: string;
  due_date?: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

const Notes = () => {
  const [open, setOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formData, setFormData] = useState<Partial<Note>>({
    title: "",
    content: "",
    note_type: "note",
    due_date: undefined,
    is_completed: false,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: notes, isLoading } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
    enabled: !!currentUser,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Note>) => {
      const { error } = await supabase.from("notes").insert([data as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast({ title: "Başarılı", description: "Not eklendi." });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Note> & { id: string }) => {
      const { error } = await supabase.from("notes").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast({ title: "Başarılı", description: "Not güncellendi." });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast({ title: "Başarılı", description: "Not silindi." });
    },
    onError: (error: any) => {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase.from("notes").update({ is_completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: (error: any) => {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedData = {
      ...formData,
      due_date: formData.due_date || null,
    };

    if (editingNote) {
      updateMutation.mutate({ ...cleanedData, id: editingNote.id });
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      note_type: note.note_type,
      due_date: note.due_date || undefined,
      is_completed: note.is_completed,
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingNote(null);
    setFormData({
      title: "",
      content: "",
      note_type: "note",
      due_date: undefined,
      is_completed: false,
    });
  };

  const handleNoteCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["notes"] });
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "reminder":
        return "default";
      case "task":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "reminder":
        return "Hatırlatma";
      case "task":
        return "Görev";
      default:
        return "Not";
    }
  };

  const activeNotes = notes?.filter((n) => !n.is_completed) || [];
  const completedNotes = notes?.filter((n) => n.is_completed) || [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StickyNote className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Notlar & Hatırlatmalar</h1>
              <p className="text-muted-foreground">AI destekli not alma ve görev yönetimi</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AINoteDialog onNoteCreated={handleNoteCreated} />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Not
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>{editingNote ? "Not Düzenle" : "Yeni Not"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Başlık</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">İçerik</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={4}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="note_type">Tip</Label>
                      <Select
                        value={formData.note_type}
                        onValueChange={(value) => setFormData({ ...formData, note_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="note">Not</SelectItem>
                          <SelectItem value="reminder">Hatırlatma</SelectItem>
                          <SelectItem value="task">Görev</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="due_date">Son Tarih (Opsiyonel)</Label>
                      <Input
                        id="due_date"
                        type="datetime-local"
                        value={formData.due_date || ""}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleClose}>
                      İptal
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {editingNote ? "Güncelle" : "Ekle"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Not</CardTitle>
              <StickyNote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notes?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktif Görevler</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeNotes.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tamamlanan</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedNotes.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Aktif Notlar</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : activeNotes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Henüz aktif not yok</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Başlık</TableHead>
                    <TableHead>İçerik</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Son Tarih</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeNotes.map((note) => (
                    <TableRow key={note.id}>
                      <TableCell>
                        <Checkbox
                          checked={note.is_completed}
                          onCheckedChange={(checked) =>
                            toggleCompleteMutation.mutate({ id: note.id, is_completed: !!checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{note.title}</TableCell>
                      <TableCell className="max-w-md truncate">{note.content}</TableCell>
                      <TableCell>
                        <Badge variant={getTypeBadgeVariant(note.note_type)}>{getTypeLabel(note.note_type)}</Badge>
                      </TableCell>
                      <TableCell>
                        {note.due_date ? new Date(note.due_date).toLocaleString("tr-TR") : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(note)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(note.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {completedNotes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tamamlanan Notlar</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Başlık</TableHead>
                    <TableHead>İçerik</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedNotes.map((note) => (
                    <TableRow key={note.id} className="opacity-60">
                      <TableCell>
                        <Checkbox
                          checked={note.is_completed}
                          onCheckedChange={(checked) =>
                            toggleCompleteMutation.mutate({ id: note.id, is_completed: !!checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium line-through">{note.title}</TableCell>
                      <TableCell className="max-w-md truncate line-through">{note.content}</TableCell>
                      <TableCell>
                        <Badge variant={getTypeBadgeVariant(note.note_type)}>{getTypeLabel(note.note_type)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Notes;
