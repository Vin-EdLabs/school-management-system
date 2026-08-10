import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed, RefreshCw, Save, Printer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  boardingHeroBadgeEmerald,
  boardingHeroEmerald,
  boardingHeroSubtitle,
  boardingHeroTitle,
  boardingKpiCard,
} from '@/utils/boardingUi';
import {
  boardingService,
  type MealType,
  type WeeklyMenu,
  type WeeklyMenuItem,
} from '@/services/boardingService';
import { printHtmlInHiddenIframe } from '@/utils/printHtml';

const DAYS: { value: WeeklyMenuItem['day_of_week']; label: string }[] = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

const MEALS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

function buildEmptyMenu(): WeeklyMenu {
  const items: WeeklyMenuItem[] = [];
  for (const day of DAYS) {
    for (const meal of MEALS) {
      items.push({ day_of_week: day.value, meal_type: meal.value, menu_item: '' });
    }
  }
  return { items };
}

export const BoardingFeeding: React.FC = () => {
  const [menu, setMenu] = useState<WeeklyMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setMenu(await boardingService.getWeeklyMenu());
    } catch (e) {
      toast({ title: 'Failed to load menu', description: (e as Error).message, variant: 'destructive' });
      setMenu(buildEmptyMenu());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const cellMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of menu?.items ?? []) {
      map.set(`${item.day_of_week}:${item.meal_type}`, item.menu_item);
    }
    return map;
  }, [menu]);

  const setCell = (day: number, meal: MealType, value: string) => {
    setMenu((prev) => {
      const base = prev ?? buildEmptyMenu();
      const items = base.items.map((item) =>
        item.day_of_week === day && item.meal_type === meal ? { ...item, menu_item: value } : item
      );
      return { items };
    });
  };

  const saveMenu = async () => {
    if (!menu) return;
    setSaving(true);
    try {
      setMenu(await boardingService.saveWeeklyMenu(menu));
      toast({ title: 'Menu saved', description: 'This menu applies every week until you edit it again.' });
    } catch (e) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const printMenu = () => {
    if (!menu) return;
    const rows = DAYS.map((day) => {
      const cells = MEALS.map((meal) => {
        const val = cellMap.get(`${day.value}:${meal.value}`) || '—';
        return `<td style="padding:8px;border:1px solid #d1d5db">${val.replace(/</g, '&lt;')}</td>`;
      }).join('');
      return `<tr><th style="padding:8px;border:1px solid #d1d5db;text-align:left;background:#ecfdf5">${day.label}</th>${cells}</tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Boarding Meal Menu</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px}h1{font-size:20px;color:#047857}p{color:#64748b;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px}th.meal{background:#ecfdf5;padding:8px;border:1px solid #d1d5db}</style></head><body>
      <h1>Boarding Weekly Meal Menu</h1><p>Monday – Sunday · Breakfast, Lunch & Dinner</p>
      <table><thead><tr><th></th>${MEALS.map((m) => `<th class="meal">${m.label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
    printHtmlInHiddenIframe(html, 'Boarding Meal Menu');
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 animate-in fade-in duration-300">
      <div className={boardingHeroEmerald}>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className={boardingHeroBadgeEmerald}>
              <UtensilsCrossed className="h-3.5 w-3.5" />
              Permanent weekly menu
            </div>
            <h1 className={boardingHeroTitle}>Meal Menu</h1>
            <p className={boardingHeroSubtitle}>
              Set what boarders eat Monday through Sunday. Once saved, this menu stays until you change it — no dates or term reset.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={printMenu} disabled={!menu}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button type="button" variant="primaryAction" size="sm" className="rounded-xl" onClick={() => void saveMenu()} disabled={saving || !menu}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving…' : 'Save menu'}
            </Button>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="pb-2 border-b bg-muted/30">
          <CardTitle className="text-base">Monday – Sunday</CardTitle>
          <CardDescription>Enter meals for each day. Empty cells show as blank on printouts.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <p className="p-10 text-center text-muted-foreground text-sm">Loading menu…</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm border-collapse">
              <thead>
                <tr className="bg-emerald-50/80 border-b">
                  <th className="text-left p-3 font-semibold w-32">Day</th>
                  {MEALS.map((m) => (
                    <th key={m.value} className="text-left p-3 font-semibold capitalize">{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day.value} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3 font-medium text-slate-700 align-top">{day.label}</td>
                    {MEALS.map((meal) => (
                      <td key={meal.value} className="p-2 align-top">
                        <Input
                          value={cellMap.get(`${day.value}:${meal.value}`) ?? ''}
                          onChange={(e) => setCell(day.value, meal.value, e.target.value)}
                          placeholder="e.g. Jollof & chicken"
                          className="rounded-xl min-h-[44px] text-sm"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BoardingFeeding;
