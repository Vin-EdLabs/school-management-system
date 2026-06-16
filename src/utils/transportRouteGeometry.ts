export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface SchoolHub {
  latitude: number;
  longitude: number;
}

/** Stop coordinates in route order, plus connector segment to/from school. */
export function buildRouteGeometry(
  stops: LatLng[],
  school: SchoolHub | null,
  timeOfDay: string
): {
  stopLine: [number, number][];
  schoolConnector: [number, number][] | null;
  fullLine: [number, number][];
} {
  const stopLine = stops.map(s => [s.latitude, s.longitude] as [number, number]);
  if (!school || stopLine.length === 0) {
    return { stopLine, schoolConnector: null, fullLine: stopLine };
  }

  const schoolPt: [number, number] = [school.latitude, school.longitude];
  const isAfternoon = timeOfDay === 'afternoon';

  if (isAfternoon) {
    const schoolConnector: [number, number][] = [schoolPt, stopLine[0]];
    return {
      stopLine,
      schoolConnector,
      fullLine: [schoolPt, ...stopLine],
    };
  }

  const schoolConnector: [number, number][] = [schoolPt, stopLine[0]];
  return {
    stopLine,
    schoolConnector,
    fullLine: [schoolPt, ...stopLine],
  };
}
