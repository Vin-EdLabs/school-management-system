export interface GeocodeResult {
  place_id: number;
  display_name: string;
  lat: number;
  lng: number;
  type?: string;
}

/** Search places via OpenStreetMap Nominatim (Ghana-focused, falls back to global). */
export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const base = 'https://nominatim.openstreetmap.org/search';
  const params = new URLSearchParams({
    format: 'json',
    q,
    limit: '10',
    addressdetails: '0',
  });

  const headers = {
    Accept: 'application/json',
    'Accept-Language': 'en',
  };

  const tryFetch = async (countrycodes?: string) => {
    const p = new URLSearchParams(params);
    if (countrycodes) p.set('countrycodes', countrycodes);
    const res = await fetch(`${base}?${p.toString()}`, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
      type?: string;
    }>;
    return data.map(row => ({
      place_id: row.place_id,
      display_name: row.display_name,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lon),
      type: row.type,
    }));
  };

  let results = await tryFetch('gh');
  if (results.length === 0) {
    results = await tryFetch();
  }
  return results.filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}
