import type { LatLng, SchoolHub } from './transportRouteGeometry';

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface RouteDistanceSegment {
  fromLabel: string;
  toLabel: string;
  distanceKm: number;
  /** Cumulative km from school along the route to the end of this leg. */
  distanceFromSchoolKm: number;
  isFromSchool?: boolean;
}

export interface RouteDistanceSummary {
  segments: RouteDistanceSegment[];
  /** Sum of legs between stops only (excludes school → first stop). */
  betweenStopsKm: number;
  /** School → first stop. */
  fromSchoolKm: number;
  totalKm: number;
  /** @deprecated use betweenStopsKm */
  stopsOnlyKm: number;
  /** @deprecated use fromSchoolKm */
  schoolConnectorKm: number;
}

/** Distance along the route starting at school, then each stop in order. */
export function calculateRouteDistance(
  stops: LatLng[],
  school: SchoolHub | null,
  _timeOfDay: string,
  options?: { schoolLabel?: string; stopNames?: string[] }
): RouteDistanceSummary {
  const schoolLabel = options?.schoolLabel || 'School';
  const stopNames = options?.stopNames || stops.map((_, i) => `Stop ${i + 1}`);

  if (!school || stops.length === 0) {
    const segments: RouteDistanceSegment[] = [];
    let betweenStopsKm = 0;
    for (let i = 1; i < stops.length; i += 1) {
      const km = haversineDistanceKm(
        stops[i - 1].latitude,
        stops[i - 1].longitude,
        stops[i].latitude,
        stops[i].longitude
      );
      betweenStopsKm += km;
      segments.push({
        fromLabel: stopNames[i - 1],
        toLabel: stopNames[i],
        distanceKm: km,
        distanceFromSchoolKm: betweenStopsKm,
      });
    }
    return {
      segments,
      betweenStopsKm,
      fromSchoolKm: 0,
      totalKm: betweenStopsKm,
      stopsOnlyKm: betweenStopsKm,
      schoolConnectorKm: 0,
    };
  }

  const points: LatLng[] = [school, ...stops];
  const labels = [schoolLabel, ...stopNames];
  const segments: RouteDistanceSegment[] = [];
  let totalKm = 0;
  let fromSchoolKm = 0;
  let betweenStopsKm = 0;

  for (let i = 1; i < points.length; i += 1) {
    const km = haversineDistanceKm(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
    totalKm += km;
    if (i === 1) {
      fromSchoolKm = km;
    } else {
      betweenStopsKm += km;
    }
    segments.push({
      fromLabel: labels[i - 1],
      toLabel: labels[i],
      distanceKm: km,
      distanceFromSchoolKm: totalKm,
      isFromSchool: i === 1,
    });
  }

  return {
    segments,
    betweenStopsKm,
    fromSchoolKm,
    totalKm,
    stopsOnlyKm: betweenStopsKm,
    schoolConnectorKm: fromSchoolKm,
  };
}

/** Human-readable distance (straight-line / map path). */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return '0 m';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
