import { query } from '../db/connection.js';

export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type MenuDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type WeeklyMenuItem = {
  day_of_week: MenuDay;
  meal_type: MealType;
  menu_item: string;
};

export type WeeklyMenuResponse = {
  items: WeeklyMenuItem[];
};

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner'];
const DAYS: MenuDay[] = [1, 2, 3, 4, 5, 6, 7];

function emptyGrid(): WeeklyMenuItem[] {
  const items: WeeklyMenuItem[] = [];
  for (const day of DAYS) {
    for (const meal of MEALS) {
      items.push({ day_of_week: day, meal_type: meal, menu_item: '' });
    }
  }
  return items;
}

/** Permanent tenant menu — persists across terms until edited. */
export async function getWeeklyMenu(tenantId: number): Promise<WeeklyMenuResponse> {
  const result = await query(
    `SELECT day_of_week, meal_type, menu_item
     FROM boarding_weekly_menu
     WHERE tenant_id = $1
     ORDER BY day_of_week, meal_type`,
    [tenantId]
  );

  const map = new Map<string, string>();
  for (const row of result.rows) {
    map.set(`${row.day_of_week}:${row.meal_type}`, String(row.menu_item || ''));
  }

  const items = emptyGrid().map((cell) => ({
    ...cell,
    menu_item: map.get(`${cell.day_of_week}:${cell.meal_type}`) ?? '',
  }));

  return { items };
}

export async function saveWeeklyMenu(
  tenantId: number,
  items: WeeklyMenuItem[]
): Promise<WeeklyMenuResponse> {
  for (const item of items) {
    const day = Number(item.day_of_week);
    const meal = String(item.meal_type);
    if (!DAYS.includes(day as MenuDay) || !MEALS.includes(meal as MealType)) continue;

    await query(
      `INSERT INTO boarding_weekly_menu (tenant_id, day_of_week, meal_type, menu_item)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, day_of_week, meal_type)
       DO UPDATE SET menu_item = EXCLUDED.menu_item, updated_at = NOW()`,
      [tenantId, day, meal, String(item.menu_item || '').trim()]
    );
  }

  return getWeeklyMenu(tenantId);
}
