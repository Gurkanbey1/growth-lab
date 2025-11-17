import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CalendarEvent {
  date: string;
  type: 'domain' | 'social_media' | 'expense' | 'note';
  title: string;
  subtitle?: string;
}

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar-events', currentDate.getMonth(), currentDate.getFullYear()],
    queryFn: async () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);

      const [domains, socialMedia, expenses, notes] = await Promise.all([
        supabase
          .from('domains')
          .select('domain_name, expire_date')
          .gte('expire_date', startDate.toISOString().split('T')[0])
          .lte('expire_date', endDate.toISOString().split('T')[0]),
        supabase
          .from('social_media_accounts')
          .select('platform, account_name, renewal_date')
          .gte('renewal_date', startDate.toISOString().split('T')[0])
          .lte('renewal_date', endDate.toISOString().split('T')[0]),
        supabase
          .from('expenses')
          .select('description, next_payment_date')
          .eq('is_active', true)
          .not('next_payment_date', 'is', null)
          .gte('next_payment_date', startDate.toISOString().split('T')[0])
          .lte('next_payment_date', endDate.toISOString().split('T')[0]),
        supabase
          .from('notes')
          .select('title, note_type, due_date')
          .not('due_date', 'is', null)
          .eq('is_completed', false)
          .gte('due_date', startDate.toISOString())
          .lte('due_date', endDate.toISOString()),
      ]);

      const allEvents: CalendarEvent[] = [
        ...(domains.data || []).map((d) => ({
          date: d.expire_date,
          type: 'domain' as const,
          title: `Domain: ${d.domain_name}`,
        })),
        ...(socialMedia.data || []).map((sm) => ({
          date: sm.renewal_date,
          type: 'social_media' as const,
          title: `${sm.platform}`,
          subtitle: sm.account_name,
        })),
        ...(expenses.data || []).map((e) => ({
          date: e.next_payment_date!,
          type: 'expense' as const,
          title: `Gider: ${e.description}`,
        })),
        ...(notes.data || []).map((n) => ({
          date: n.due_date!.split('T')[0],
          type: 'note' as const,
          title: n.note_type === 'task' ? `Görev: ${n.title}` : n.note_type === 'reminder' ? `Hatırlatma: ${n.title}` : `Not: ${n.title}`,
        })),
      ];

      return allEvents;
    },
  });

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getEventsForDay = (day: number) => {
    const dateStr = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day
    ).toISOString().split('T')[0];
    return events?.filter((e) => e.date === dateStr) || [];
  };

  const getEventBadgeVariant = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'domain':
        return 'default';
      case 'social_media':
        return 'secondary';
      case 'expense':
        return 'destructive';
      case 'note':
        return 'outline';
      default:
        return 'default';
    }
  };

  const monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Takvim</h1>
            <p className="text-muted-foreground">Domain, sosyal medya ve gider hatırlatmaları</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold min-w-[200px] text-center">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </div>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Aylık Görünüm</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {dayNames.map((day) => (
                  <div key={day} className="text-center font-semibold text-sm p-2">
                    {day}
                  </div>
                ))}
                {getDaysInMonth().map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="min-h-[100px] p-2" />;
                  }
                  const dayEvents = getEventsForDay(day);
                  const isToday =
                    day === new Date().getDate() &&
                    currentDate.getMonth() === new Date().getMonth() &&
                    currentDate.getFullYear() === new Date().getFullYear();

                  return (
                    <div
                      key={day}
                      className={`min-h-[100px] p-2 border rounded-lg ${
                        isToday ? 'bg-primary/5 border-primary' : 'border-border'
                      }`}
                    >
                      <div className="text-sm font-semibold mb-1">{day}</div>
                      <div className="space-y-1">
                        {dayEvents.map((event, eventIdx) => (
                          <Badge
                            key={eventIdx}
                            variant={getEventBadgeVariant(event.type)}
                            className="text-xs block truncate"
                            title={`${event.title}${event.subtitle ? ` - ${event.subtitle}` : ''}`}
                          >
                            {event.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Domain Yenilemeleri</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {events
                  ?.filter((e) => e.type === 'domain')
                  .map((event, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{event.title}</span>
                      <span className="text-muted-foreground">
                        {new Date(event.date).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                  ))}
                {!events?.some((e) => e.type === 'domain') && (
                  <p className="text-sm text-muted-foreground">Bu ay domain yenilemesi yok.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sosyal Medya Yenilemeleri</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {events
                  ?.filter((e) => e.type === 'social_media')
                  .map((event, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>
                        {event.title}
                        {event.subtitle && <span className="text-muted-foreground"> - {event.subtitle}</span>}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(event.date).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                  ))}
                {!events?.some((e) => e.type === 'social_media') && (
                  <p className="text-sm text-muted-foreground">Bu ay sosyal medya yenilemesi yok.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gider Ödemeleri</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {events
                  ?.filter((e) => e.type === 'expense')
                  .map((event, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{event.title}</span>
                      <span className="text-muted-foreground">
                        {new Date(event.date).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                  ))}
                {!events?.some((e) => e.type === 'expense') && (
                  <p className="text-sm text-muted-foreground">Bu ay gider ödemesi yok.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Calendar;
