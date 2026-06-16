import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
  ZoomControl,
  ScaleControl,
  CircleMarker,
} from 'react-leaflet';
import L from 'leaflet';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { searchPlaces, type GeocodeResult } from '../../utils/geocoding';
import { buildRouteGeometry } from '../../utils/transportRouteGeometry';
import { calculateRouteDistance, formatDistance } from '../../utils/transportDistance';
import { createSchoolMapIcon } from '../../utils/transportSchoolMarker';
import { useSchool } from '@/contexts/SchoolContext';
import { cn } from '@/lib/utils';
import {
  TRANSPORT_DEFAULT_CENTER,
  TRANSPORT_DEFAULT_ZOOM,
  TRANSPORT_MAP_BOUNDS,
  TRANSPORT_MAP_TILES,
  type TransportMapStyle,
} from '../../utils/transportMapConstants';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  MapPin,
  Plus,
  Trash2,
  Save,
  Sparkles,
  Users,
  Layers,
  Navigation,
  Search,
  School,
  Crosshair,
  Loader2,
  MapPinned,
  Maximize2,
  Minimize2,
  Ruler,
} from 'lucide-react';

interface Stop {
  id: string;
  route_id: string;
  name: string;
  latitude: number;
  longitude: number;
  order_index: number;
}

interface Route {
  id: string;
  name: string;
  time_of_day: string;
  vehicle_id: string;
  transport_driver_id?: number | null;
  status: string;
  color: string;
  plate_number: string;
  vehicle_name: string;
  driver_name: string;
  driver_phone: string;
  student_count?: number;
  stops: Stop[];
}

interface TransportStudent {
  id: number;
  first_name: string;
  last_name: string;
  class_name: string;
  route_id: string;
  stop_id: string;
}

interface SchoolLocation {
  school_name: string;
  logo_url?: string | null;
  latitude: number;
  longitude: number;
  label: string;
  address?: string | null;
}

type MapFocus =
  | { mode: 'routes' }
  | { mode: 'place'; lat: number; lng: number; token: number };

const MapController = ({
  selectedRoute,
  allRoutes,
  fitAll,
  school,
  mapFocus,
}: {
  selectedRoute: Route | null;
  allRoutes: Route[];
  fitAll: boolean;
  school: SchoolLocation | null;
  mapFocus: MapFocus;
}) => {
  const map = useMap();

  useEffect(() => {
    if (mapFocus.mode !== 'place') return;
    map.stop();
    map.flyTo([mapFocus.lat, mapFocus.lng], 14, { duration: 1.2 });
  }, [mapFocus.mode === 'place' ? mapFocus.token : null, mapFocus.mode === 'place' ? mapFocus.lat : null, mapFocus.mode === 'place' ? mapFocus.lng : null, map]);

  useEffect(() => {
    if (mapFocus.mode !== 'routes') return;
    map.stop();

    const coords: [number, number][] = [];
    if (school) coords.push([school.latitude, school.longitude]);

    if (fitAll && allRoutes.length > 0) {
      allRoutes.forEach(r => {
        r.stops?.forEach(s => {
          coords.push([parseFloat(String(s.latitude)), parseFloat(String(s.longitude))]);
        });
      });
    } else if (selectedRoute?.stops?.length) {
      selectedRoute.stops.forEach(s => {
        coords.push([parseFloat(String(s.latitude)), parseFloat(String(s.longitude))]);
      });
    }

    if (coords.length === 0) {
      map.setView(TRANSPORT_DEFAULT_CENTER, TRANSPORT_DEFAULT_ZOOM);
      return;
    }
    if (coords.length === 1) {
      map.flyTo(coords[0], 15, { duration: 1.2 });
      return;
    }
    map.flyToBounds(L.latLngBounds(coords), { padding: [70, 70], maxZoom: 16, duration: 1.2 });
  }, [mapFocus.mode, selectedRoute, allRoutes, fitAll, school, map]);

  return null;
};

const MapResizeHandler = ({ active }: { active: boolean }) => {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(id);
  }, [active, map]);
  return null;
};

const MapClickHandler = ({
  onMapClick,
  enabled,
}: {
  onMapClick: (lat: number, lng: number) => void;
  enabled: boolean;
}) => {
  useMapEvents({
    click(e) {
      if (enabled) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const createStopIcon = (orderIndex: number, studentCount: number, color: string, isFirst: boolean, isLast: boolean) =>
  L.divIcon({
    html: `
      <div class="relative flex flex-col items-center" style="width:36px;height:44px;">
        <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-lg border-[3px] border-white" style="background:${color}; box-shadow:0 4px 14px rgba(0,0,0,0.25);">
          ${orderIndex + 1}
        </div>
        <div class="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent -mt-0.5" style="border-top-color:${color};"></div>
        ${studentCount > 0 ? `<span class="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[9px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 border-2 border-white shadow">${studentCount}</span>` : ''}
        ${isFirst || isLast ? `<span class="absolute -bottom-3 text-[8px] font-bold uppercase tracking-wide px-1 rounded bg-white/95 shadow text-slate-600">${isFirst ? 'Start' : 'End'}</span>` : ''}
      </div>
    `,
    className: 'custom-leaflet-marker-stop',
    iconSize: [36, 44],
    iconAnchor: [18, 40],
    popupAnchor: [0, -38],
  });

const searchPinIcon = L.divIcon({
  html: `<div class="w-4 h-4 rounded-full bg-violet-600 border-[3px] border-white shadow-lg ring-4 ring-violet-400/30"></div>`,
  className: 'custom-leaflet-marker-search',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function RoutePolylines({
  route,
  school,
  selected,
}: {
  route: Route;
  school: SchoolLocation | null;
  selected: boolean;
}) {
  const sorted = [...(route.stops || [])].sort((a, b) => a.order_index - b.order_index);
  const geom = buildRouteGeometry(
    sorted.map(s => ({ latitude: parseFloat(String(s.latitude)), longitude: parseFloat(String(s.longitude)) })),
    school ? { latitude: school.latitude, longitude: school.longitude } : null,
    route.time_of_day
  );
  const color = route.color || '#3b82f6';
  const weight = selected ? 6 : 4;
  const opacity = selected ? 0.92 : 0.6;

  if (geom.stopLine.length < 1) return null;

  return (
    <>
      {geom.stopLine.length > 1 && (
        <Polyline positions={geom.stopLine} color={color} weight={weight} opacity={opacity} lineCap="round" lineJoin="round" />
      )}
      {geom.schoolConnector && school && (
        <Polyline
          positions={geom.schoolConnector}
          color={color}
          weight={weight + 1}
          opacity={Math.min(1, opacity + 0.05)}
          lineCap="round"
          dashArray="10 8"
        />
      )}
    </>
  );
}

export const TransportMap: React.FC = () => {
  const { school: systemSchool } = useSchool();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [students, setStudents] = useState<TransportStudent[]>([]);
  const [schoolLocation, setSchoolLocation] = useState<SchoolLocation | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('all');
  const [mapStyle, setMapStyle] = useState<TransportMapStyle>('satellite');
  const [loading, setLoading] = useState(true);

  const [buildMode, setBuildMode] = useState(false);
  const [setSchoolMode, setSetSchoolMode] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteColor, setNewRouteColor] = useState('#2563eb');
  const [buildStops, setBuildStops] = useState<Array<{ name: string; latitude: number; longitude: number; order_index: number }>>([]);

  const [stopPromptCoords, setStopPromptCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [stopPromptName, setStopPromptName] = useState('');
  const [showStopPrompt, setShowStopPrompt] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [placeSearchResults, setPlaceSearchResults] = useState<GeocodeResult[]>([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchPin, setSearchPin] = useState<GeocodeResult | null>(null);
  const [mapFocus, setMapFocus] = useState<MapFocus>({ mode: 'routes' });
  const [savingSchool, setSavingSchool] = useState(false);
  const [deletingSchool, setDeletingSchool] = useState(false);
  const [fullMapView, setFullMapView] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSearchDebounce = useRef(false);

  const schoolDisplayName = schoolLocation?.school_name || systemSchool?.name || 'School';
  const schoolLogoUrl = schoolLocation?.logo_url || systemSchool?.logo_url || null;

  const schoolMapIcon = useMemo(
    () => createSchoolMapIcon(schoolLogoUrl, schoolDisplayName),
    [schoolLogoUrl, schoolDisplayName]
  );

  const schoolLabelForDistance = schoolDisplayName;

  const matchingRoutes = useMemo(() => {
    if (buildMode) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return routes.filter(r => {
      const text = [
        r.name,
        r.driver_name,
        r.driver_phone,
        r.vehicle_name,
        r.plate_number,
        r.status,
        r.time_of_day,
        ...(r.stops || []).map(s => s.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    });
  }, [routes, searchQuery, buildMode]);

  const sidebarRoutes = useMemo(() => {
    const q = searchQuery.trim();
    if (buildMode || !q) return routes;
    return matchingRoutes;
  }, [routes, searchQuery, buildMode, matchingRoutes]);

  const loadData = async () => {
    try {
      const [routesList, studentsList, school] = await Promise.all([
        apiService.get<Route[]>('/transport/routes'),
        apiService.get<TransportStudent[]>('/transport/students'),
        apiService.get<SchoolLocation | null>('/transport/school-location'),
      ]);
      setRoutes(routesList);
      setStudents(studentsList);
      setSchoolLocation(school);
    } catch (err) {
      console.error('Failed to load transport map details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!fullMapView) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullMapView(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullMapView]);

  useEffect(() => {
    if (!buildMode) {
      setPlaceSearchResults([]);
      setPlaceSearchLoading(false);
      return;
    }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (skipSearchDebounce.current) {
      skipSearchDebounce.current = false;
      return;
    }
    const q = searchQuery.trim();
    if (q.length < 2) {
      setPlaceSearchResults([]);
      setPlaceSearchLoading(false);
      return;
    }
    setPlaceSearchLoading(true);
    searchDebounce.current = setTimeout(() => {
      void searchPlaces(q)
        .then(setPlaceSearchResults)
        .catch(() => setPlaceSearchResults([]))
        .finally(() => setPlaceSearchLoading(false));
    }, 450);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [searchQuery, buildMode]);

  const visibleRoutes = useMemo(() => {
    if (selectedRouteId === 'all') return routes.filter(r => r.stops?.length > 0);
    const one = routes.find(r => r.id === selectedRouteId);
    return one ? [one] : [];
  }, [routes, selectedRouteId]);

  const activeRoute = useMemo(() => {
    if (selectedRouteId === 'all') return null;
    return routes.find(r => r.id === selectedRouteId) || null;
  }, [routes, selectedRouteId]);

  const mapSummary = useMemo(() => {
    const stopCount = visibleRoutes.reduce((n, r) => n + (r.stops?.length || 0), 0);
    const studentCount = visibleRoutes.reduce((n, r) => n + students.filter(st => st.route_id === r.id).length, 0);
    const totalDistanceKm = visibleRoutes.reduce((n, r) => {
      const sorted = [...(r.stops || [])].sort((a, b) => a.order_index - b.order_index);
      if (sorted.length < 2 && !schoolLocation) return n;
      const summary = calculateRouteDistance(
        sorted.map(s => ({ latitude: parseFloat(String(s.latitude)), longitude: parseFloat(String(s.longitude)) })),
        schoolLocation ? { latitude: schoolLocation.latitude, longitude: schoolLocation.longitude } : null,
        r.time_of_day,
        { schoolLabel: schoolLabelForDistance, stopNames: sorted.map(s => s.name) }
      );
      return n + summary.totalKm;
    }, 0);
    return { routes: visibleRoutes.length, stops: stopCount, students: studentCount, distanceKm: totalDistanceKm };
  }, [visibleRoutes, students, schoolLocation]);

  const activeRouteDistance = useMemo(() => {
    if (!activeRoute?.stops?.length) return null;
    const sorted = [...activeRoute.stops].sort((a, b) => a.order_index - b.order_index);
    return calculateRouteDistance(
      sorted.map(s => ({ latitude: parseFloat(String(s.latitude)), longitude: parseFloat(String(s.longitude)) })),
      schoolLocation ? { latitude: schoolLocation.latitude, longitude: schoolLocation.longitude } : null,
      activeRoute.time_of_day,
      { schoolLabel: schoolLabelForDistance, stopNames: sorted.map(s => s.name) }
    );
  }, [activeRoute, schoolLocation]);

  const getRouteDistance = (route: Route) => {
    const sorted = [...(route.stops || [])].sort((a, b) => a.order_index - b.order_index);
    if (sorted.length < 2 && !schoolLocation) return null;
    return calculateRouteDistance(
      sorted.map(s => ({ latitude: parseFloat(String(s.latitude)), longitude: parseFloat(String(s.longitude)) })),
      schoolLocation ? { latitude: schoolLocation.latitude, longitude: schoolLocation.longitude } : null,
      route.time_of_day,
      { schoolLabel: schoolLabelForDistance, stopNames: sorted.map(s => s.name) }
    );
  };

  const buildGeom = useMemo(() => {
    return buildRouteGeometry(
      buildStops,
      schoolLocation ? { latitude: schoolLocation.latitude, longitude: schoolLocation.longitude } : null,
      'morning'
    );
  }, [buildStops, schoolLocation]);

  const handleMapClick = (lat: number, lng: number) => {
    if (setSchoolMode) {
      void saveSchoolLocation(lat, lng);
      setSetSchoolMode(false);
      return;
    }
    if (!buildMode) return;
    setStopPromptCoords({ lat, lng });
    setStopPromptName(`Stop ${buildStops.length + 1}`);
    setShowStopPrompt(true);
  };

  const handleRouteSelect = (routeId: string) => {
    setSelectedRouteId(routeId);
    setMapFocus({ mode: 'routes' });
  };

  const focusPlace = (lat: number, lng: number) => {
    setMapFocus({ mode: 'place', lat, lng, token: Date.now() });
  };

  const saveSchoolLocation = async (lat: number, lng: number) => {
    setSavingSchool(true);
    try {
      const saved = await apiService.patch<SchoolLocation>('/transport/school-location', {
        latitude: lat,
        longitude: lng,
      });
      setSchoolLocation(saved);
      focusPlace(lat, lng);
      toast({ title: 'School location saved', description: `${saved.school_name} is now the route hub on the map.` });
    } catch (err: any) {
      toast({ title: 'Could not save', description: err?.message || 'Failed to save school location.', variant: 'destructive' });
    } finally {
      setSavingSchool(false);
    }
  };

  const deleteSchoolLocation = async () => {
    if (!schoolLocation) return;
    if (!window.confirm('Remove the school location from the map? Routes will no longer connect to a school hub.')) return;
    setDeletingSchool(true);
    try {
      await apiService.delete('/transport/school-location');
      setSchoolLocation(null);
      setSetSchoolMode(false);
      toast({ title: 'School location removed', description: 'You can set a new school pin anytime from the map.' });
    } catch (err: any) {
      toast({ title: 'Could not remove', description: err?.message || 'Failed to remove school location.', variant: 'destructive' });
    } finally {
      setDeletingSchool(false);
    }
  };

  const handlePickPlaceResult = (result: GeocodeResult) => {
    setSearchPin(result);
    focusPlace(result.lat, result.lng);
    setSearchOpen(false);
    skipSearchDebounce.current = true;
    setSearchQuery(result.display_name.split(',')[0]);
  };

  const handlePickRouteFromSearch = (route: Route) => {
    handleRouteSelect(route.id);
    setSearchQuery(route.name);
    setSearchOpen(false);
  };

  const handleAddStopFromSearch = () => {
    if (!searchPin || !buildMode) return;
    setStopPromptCoords({ lat: searchPin.lat, lng: searchPin.lng });
    setStopPromptName(searchPin.display_name.split(',')[0] || `Stop ${buildStops.length + 1}`);
    setShowStopPrompt(true);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (buildMode && placeSearchResults.length > 0) {
        e.preventDefault();
        handlePickPlaceResult(placeSearchResults[0]);
      } else if (!buildMode && matchingRoutes.length > 0) {
        e.preventDefault();
        handlePickRouteFromSearch(matchingRoutes[0]);
      }
    }
    if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  };

  const handleConfirmStop = () => {
    if (!stopPromptCoords || !stopPromptName.trim()) return;
    setBuildStops(prev => [
      ...prev,
      {
        name: stopPromptName.trim(),
        latitude: stopPromptCoords.lat,
        longitude: stopPromptCoords.lng,
        order_index: prev.length,
      },
    ]);
    setStopPromptCoords(null);
    setStopPromptName('');
    setShowStopPrompt(false);
    setSearchPin(null);
    toast({ title: 'Stop added', description: 'Stop added to the route sequence.' });
  };

  const handleStopDrag = (index: number, lat: number, lng: number) => {
    setBuildStops(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], latitude: lat, longitude: lng };
      return updated;
    });
  };

  const handleSaveBuiltRoute = async () => {
    if (!newRouteName.trim()) {
      toast({ title: 'Validation', description: 'Please specify a route name.', variant: 'destructive' });
      return;
    }
    if (buildStops.length < 2) {
      toast({ title: 'Validation', description: 'Drop at least 2 stops on the map.', variant: 'destructive' });
      return;
    }
    try {
      await apiService.post('/transport/routes', {
        name: newRouteName.trim(),
        color: newRouteColor,
        time_of_day: 'both',
        status: 'active',
        stops: buildStops,
      });
      toast({ title: 'Route saved', description: `"${newRouteName}" was created.` });
      setNewRouteName('');
      setBuildStops([]);
      setBuildMode(false);
      setLoading(true);
      await loadData();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.message || 'Could not save route.', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <div className="h-10 w-64 bg-slate-100 animate-pulse rounded-xl" />
        <div className="h-[70vh] w-full bg-slate-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  const tile = TRANSPORT_MAP_TILES[mapStyle];
  const mapClickEnabled = buildMode || setSchoolMode;

  return (
    <div
      className={cn(
        'flex flex-col bg-gradient-to-b from-slate-50/80 to-white transition-all duration-300',
        fullMapView
          ? 'fixed z-50 top-[calc(4.25rem+env(safe-area-inset-top))] bottom-0 right-0 left-0 md:left-[var(--sidebar-width)] p-0 gap-0 min-h-0 h-auto bg-slate-900'
          : 'p-4 md:p-6 lg:p-8 gap-4 h-[calc(100vh-5rem)] min-h-[640px]'
      )}
    >
      {/* Toolbar — hidden in full map view */}
      {!fullMapView && (
      <div className="shrink-0 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-violet-950 px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <MapPinned className="h-5 w-5 text-violet-300" />
              Transport map
            </h1>
            <p className="text-sm text-slate-300 mt-0.5">Search routes, school hub, and live overview</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!buildMode && (
              <>
                <Select value={selectedRouteId} onValueChange={handleRouteSelect}>
                  <SelectTrigger className="w-44 h-9 rounded-lg bg-white/10 border-white/20 text-white [&>span]:text-white">
                    <SelectValue placeholder="All routes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All routes</SelectItem>
                    {routes.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={mapStyle} onValueChange={v => setMapStyle(v as TransportMapStyle)}>
                  <SelectTrigger className="w-32 h-9 rounded-lg bg-white/10 border-white/20 text-white">
                    <Layers className="h-3.5 w-3.5 mr-1 text-violet-200" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TRANSPORT_MAP_TILES) as TransportMapStyle[]).map(key => (
                      <SelectItem key={key} value={key}>{TRANSPORT_MAP_TILES[key].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            {!buildMode && (
              <Button
                type="button"
                size="sm"
                variant={setSchoolMode ? 'primaryAction' : 'outline'}
                className={`h-9 rounded-lg ${setSchoolMode ? '' : 'bg-white/10 border-white/30 text-white hover:bg-white/20'}`}
                disabled={savingSchool}
                onClick={() => { setSetSchoolMode(v => !v); setBuildMode(false); }}
              >
                <School className="h-4 w-4 mr-1" />
                {setSchoolMode ? 'Tap map to pin school' : 'Set school'}
              </Button>
            )}
            {buildMode ? (
              <>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg bg-white/10 border-white/30 text-white hover:bg-white/20" onClick={() => { setBuildMode(false); setBuildStops([]); }}>
                  Cancel
                </Button>
                <Button type="button" variant="primaryAction" size="sm" className="h-9 rounded-lg" onClick={handleSaveBuiltRoute} disabled={buildStops.length < 2}>
                  <Save className="h-4 w-4 mr-1" /> Save route
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-lg bg-white/10 border-white/30 text-white hover:bg-white/20 gap-1.5"
                  onClick={() => setFullMapView(true)}
                >
                  <Maximize2 className="h-4 w-4" />
                  Full map
                </Button>
                <Button type="button" size="sm" className="h-9 rounded-lg bg-white text-slate-800 hover:bg-slate-100" onClick={() => { setBuildMode(true); setSetSchoolMode(false); }}>
                  <Plus className="h-4 w-4 mr-1" /> Build route
                </Button>
              </>
            )}
          </div>
        </div>
        {!buildMode && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/50">
            {[
              { label: 'Routes', value: mapSummary.routes, icon: MapPin },
              { label: 'Stops', value: mapSummary.stops, icon: Navigation },
              { label: 'Distance', value: formatDistance(mapSummary.distanceKm), icon: Ruler },
              { label: 'Students', value: mapSummary.students, icon: Users },
              { label: 'School hub', value: schoolLocation ? 'Set' : '—', icon: School },
            ].map(item => (
              <div key={item.label} className="px-4 py-3 flex items-center gap-3">
                <item.icon className="h-4 w-4 text-violet-500 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{item.label}</p>
                  <p className="text-lg font-bold text-slate-800">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      <div
        className={cn(
          'flex-1 min-h-0 flex flex-col lg:flex-row gap-0 overflow-hidden bg-white',
          fullMapView ? 'rounded-none border-0 shadow-none ring-0 h-full' : 'rounded-2xl border border-slate-200 shadow-xl ring-1 ring-slate-900/5'
        )}
      >
        {!fullMapView && (
        <aside className="w-full lg:w-[340px] xl:w-[380px] border-b lg:border-b-0 lg:border-r bg-slate-50 shrink-0 overflow-y-auto max-h-[40vh] lg:max-h-none">
          {/* School hub card */}
          {!buildMode && (
            <div className="p-4 border-b border-slate-200/80 bg-gradient-to-br from-violet-50 to-indigo-50/50">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-500/25 shrink-0">
                  <School className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">School hub</p>
                  {schoolLocation ? (
                    <>
                      <p className="font-bold text-slate-900 text-sm truncate">{schoolDisplayName}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {schoolLocation.latitude.toFixed(5)}, {schoolLocation.longitude.toFixed(5)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">Routes run from {schoolDisplayName} through each stop</p>
                      <div className="flex gap-2 mt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] rounded-lg flex-1"
                          disabled={savingSchool || deletingSchool}
                          onClick={() => { setSetSchoolMode(true); setBuildMode(false); }}
                        >
                          Move pin
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] rounded-lg text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          disabled={savingSchool || deletingSchool}
                          onClick={() => void deleteSchoolLocation()}
                        >
                          {deletingSchool ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          <span className="ml-1">Remove</span>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-600 mt-1">Set your school on the map so every route links to campus after pickup stops.</p>
                  )}
                </div>
              </div>
              {searchPin && buildMode && (
                <Button
                  type="button"
                  size="sm"
                  variant="primaryAction"
                  className="w-full mt-3 h-8 text-xs rounded-lg"
                  disabled={savingSchool}
                  onClick={handleAddStopFromSearch}
                >
                  Add stop at search result
                </Button>
              )}
            </div>
          )}

          {buildMode ? (
            <div className="p-5 space-y-5">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Route builder
              </h3>
              <p className="text-xs text-slate-500 -mt-2">Click the map for stops. Route will link to school hub when saved.</p>
              <div className="space-y-1.5">
                <Label htmlFor="buildName" className="text-xs">Route name</Label>
                <Input id="buildName" value={newRouteName} onChange={e => setNewRouteName(e.target.value)} placeholder="Tema morning route" className="h-9 bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="buildColor" className="text-xs">Route colour</Label>
                <div className="flex gap-3 items-center bg-white p-2 border rounded-xl">
                  <Input id="buildColor" type="color" value={newRouteColor} onChange={e => setNewRouteColor(e.target.value)} className="w-10 h-8 p-0 border-0 cursor-pointer" />
                  <span className="font-mono text-xs uppercase font-bold text-slate-600">{newRouteColor}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-500">
                  <span>Stops ({buildStops.length})</span>
                  <span className="text-slate-400">min. 2</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {buildStops.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl text-[11px] text-slate-400">
                      Tap the map to add stops
                    </div>
                  ) : (
                    buildStops.map((stop, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded-xl border shadow-sm text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: newRouteColor }}>
                            {idx + 1}
                          </span>
                          <p className="font-semibold text-slate-800 truncate">{stop.name}</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setBuildStops(buildStops.filter((_, i) => i !== idx).map((s, id) => ({ ...s, order_index: id })))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm">
                  {selectedRouteId === 'all' ? 'Route overview' : activeRoute?.name}
                </h3>
                {selectedRouteId !== 'all' && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleRouteSelect('all')}>
                    Show all
                  </Button>
                )}
              </div>
              {selectedRouteId === 'all' ? (
                sidebarRoutes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">
                    {searchQuery.trim() ? 'No routes match your search.' : 'No routes yet.'}
                  </p>
                ) : (
                  <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-100 hover:bg-slate-100">
                          <TableHead className="text-[10px] font-bold h-8">Driver</TableHead>
                          <TableHead className="text-[10px] font-bold h-8">Car</TableHead>
                          <TableHead className="text-[10px] font-bold h-8">Route</TableHead>
                          <TableHead className="text-[10px] font-bold h-8 text-right">Dist.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sidebarRoutes.map(r => {
                          const dist = getRouteDistance(r);
                          return (
                          <TableRow key={r.id} className="cursor-pointer hover:bg-indigo-50/60" onClick={() => handleRouteSelect(r.id)}>
                            <TableCell className="py-2 text-xs font-medium truncate max-w-[80px]">{r.driver_name || '—'}</TableCell>
                            <TableCell className="py-2 text-xs truncate max-w-[80px]">{r.vehicle_name || '—'}</TableCell>
                            <TableCell className="py-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                                <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                                <span className="truncate max-w-[90px]">{r.name}</span>
                              </span>
                            </TableCell>
                            <TableCell className="py-2 text-[10px] text-right font-mono text-slate-500">
                              {dist ? formatDistance(dist.totalKm) : '—'}
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )
              ) : activeRoute ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl border bg-white text-xs space-y-2">
                    <div className="flex gap-2 flex-wrap items-center">
                      <Badge variant="secondary" className="capitalize">{activeRoute.time_of_day}</Badge>
                      <Badge variant="outline" className="capitalize">{activeRoute.status}</Badge>
                      {activeRouteDistance && (
                        <Badge className="gap-1 bg-violet-500/10 text-violet-700 border-violet-200">
                          <Ruler className="h-3 w-3" />
                          {formatDistance(activeRouteDistance.totalKm)} total
                        </Badge>
                      )}
                    </div>
                    <p className="text-slate-600">
                      Distances measured from {schoolDisplayName} through each stop in order
                    </p>
                    {activeRouteDistance && activeRouteDistance.totalKm > 0 && (
                      <p className="text-[10px] text-slate-400">
                        {formatDistance(activeRouteDistance.fromSchoolKm)} from school to first stop
                        {activeRouteDistance.betweenStopsKm > 0 && (
                          <> · {formatDistance(activeRouteDistance.betweenStopsKm)} between stops</>
                        )}
                        <> · {formatDistance(activeRouteDistance.totalKm)} total</>
                      </p>
                    )}
                  </div>
                  {(activeRoute.stops || []).map((stop, idx) => {
                    const count = students.filter(st => st.stop_id === stop.id).length;
                    const fromSchoolKm = activeRouteDistance?.segments.find(s => s.toLabel === stop.name)?.distanceFromSchoolKm;
                    return (
                      <div key={stop.id} className="flex gap-2.5 p-2.5 rounded-xl border bg-white text-xs">
                        <span className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: activeRoute.color }}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 truncate">{stop.name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {fromSchoolKm != null && fromSchoolKm > 0 && (
                              <Badge variant="outline" className="text-[9px] font-mono text-violet-700 border-violet-200 bg-violet-50/80">
                                {formatDistance(fromSchoolKm)} from school
                              </Badge>
                            )}
                            {count > 0 && <Badge className="text-[9px] bg-rose-500/10 text-rose-600 border-rose-200">{count} students</Badge>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {activeRouteDistance?.fromSchoolKm ? (
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-dashed border-violet-200 bg-violet-50/50 text-[10px] text-violet-700">
                      <School className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {schoolDisplayName} → first stop · {formatDistance(activeRouteDistance.fromSchoolKm)} (dashed line on map)
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </aside>
        )}

        {/* Map canvas */}
        <div className={cn('flex-1 min-h-[320px] lg:min-h-0 relative bg-slate-200', fullMapView && 'min-h-0 h-full')}>
          {/* Full map — compact floating controls */}
          {fullMapView && (
            <div className="absolute top-4 right-4 z-[1001] flex items-center gap-2 pointer-events-none">
              {!buildMode && (
                <>
                  <Select value={selectedRouteId} onValueChange={handleRouteSelect}>
                    <SelectTrigger className="pointer-events-auto w-40 h-9 rounded-xl bg-white/95 backdrop-blur-md border-white/80 shadow-lg text-sm">
                      <SelectValue placeholder="All routes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All routes</SelectItem>
                      {routes.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={mapStyle} onValueChange={v => setMapStyle(v as TransportMapStyle)}>
                    <SelectTrigger className="pointer-events-auto w-32 h-9 rounded-xl bg-white/95 backdrop-blur-md border-white/80 shadow-lg text-sm">
                      <Layers className="h-3.5 w-3.5 mr-1 text-violet-500" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TRANSPORT_MAP_TILES) as TransportMapStyle[]).map(key => (
                        <SelectItem key={key} value={key}>{TRANSPORT_MAP_TILES[key].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              <Button
                type="button"
                size="sm"
                variant="primaryAction"
                className="pointer-events-auto h-9 rounded-xl shadow-lg gap-1.5"
                onClick={() => setFullMapView(false)}
              >
                <Minimize2 className="h-4 w-4" />
                Exit full map
              </Button>
            </div>
          )}

          {/* Search overlay */}
          <div className={cn(
            'absolute top-4 left-4 z-[1000] pointer-events-none',
            fullMapView ? 'right-4 sm:right-[22rem] lg:right-[26rem]' : 'right-4 max-w-lg'
          )}>
            <div className="pointer-events-auto rounded-2xl bg-white/95 backdrop-blur-md border border-white/80 shadow-2xl shadow-slate-900/10 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                <Search className="h-4 w-4 text-violet-500 shrink-0" />
                <Input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={buildMode ? 'Search places — Tema, Wamfie, Accra…' : 'Search routes — name, driver, vehicle, stop…'}
                  className="border-0 shadow-none focus-visible:ring-0 h-9 bg-transparent text-sm"
                />
                {buildMode && placeSearchLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}
              </div>
              {searchOpen && searchQuery.trim() && (
                buildMode ? (
                  placeSearchResults.length > 0 ? (
                    <ul className="max-h-52 overflow-y-auto py-1">
                      {placeSearchResults.map(r => (
                        <li key={r.place_id}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2.5 text-xs hover:bg-violet-50 flex items-start gap-2 transition-colors"
                            onClick={() => handlePickPlaceResult(r)}
                          >
                            <MapPin className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
                            <span className="text-slate-700 line-clamp-2">{r.display_name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : placeSearchLoading ? null : (
                    <p className="px-3 py-2.5 text-xs text-slate-400">No places found</p>
                  )
                ) : matchingRoutes.length > 0 ? (
                  <ul className="max-h-52 overflow-y-auto py-1">
                    {matchingRoutes.map(r => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2.5 text-xs hover:bg-violet-50 flex items-start gap-2 transition-colors"
                          onClick={() => handlePickRouteFromSearch(r)}
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ background: r.color || '#3b82f6' }} />
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold text-slate-800 block truncate">{r.name}</span>
                            <span className="text-slate-500 block truncate">
                              {[r.driver_name, r.vehicle_name].filter(Boolean).join(' · ') || 'Unassigned'}
                              {r.stops?.length ? ` · ${r.stops.length} stops` : ''}
                              {(() => {
                                const d = getRouteDistance(r);
                                return d ? ` · ${formatDistance(d.totalKm)}` : '';
                              })()}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-2.5 text-xs text-slate-400">No routes match your search</p>
                )
              )}
            </div>
            {buildMode && mapFocus.mode === 'place' && (
              <p className="pointer-events-none mt-2 text-center text-[11px] font-medium text-slate-600 bg-white/90 backdrop-blur rounded-full px-3 py-1 shadow-sm border border-slate-200/80">
                Searched location — add stop or click the map
              </p>
            )}
          </div>

          {setSchoolMode && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[999] px-4 py-2 rounded-full bg-violet-600 text-white text-xs font-semibold shadow-lg flex items-center gap-2 animate-pulse">
              <Crosshair className="h-3.5 w-3.5" />
              Click anywhere on the map to set school location
            </div>
          )}

          <MapContainer center={TRANSPORT_DEFAULT_CENTER} zoom={TRANSPORT_DEFAULT_ZOOM} minZoom={6} maxBounds={TRANSPORT_MAP_BOUNDS} maxBoundsViscosity={0.85} className="w-full h-full z-0" scrollWheelZoom zoomControl={false}>
            <TileLayer url={tile.url} attribution={tile.attribution} />
            <ZoomControl position="bottomright" />
            <ScaleControl position="bottomleft" imperial={false} />

            <MapController selectedRoute={activeRoute} allRoutes={visibleRoutes} fitAll={selectedRouteId === 'all' && !buildMode} school={schoolLocation} mapFocus={mapFocus} />
            <MapResizeHandler active={fullMapView} />
            <MapClickHandler onMapClick={handleMapClick} enabled={mapClickEnabled} />

            {schoolLocation && (
              <>
                <CircleMarker center={[schoolLocation.latitude, schoolLocation.longitude]} radius={28} pathOptions={{ color: '#7c3aed', fillColor: '#8b5cf6', fillOpacity: 0.08, weight: 2, dashArray: '4 6' }} />
                <Marker position={[schoolLocation.latitude, schoolLocation.longitude]} icon={schoolMapIcon} zIndexOffset={1000}>
                  <Popup maxWidth={260}>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase text-violet-600">School hub</p>
                      <p className="font-bold text-base text-slate-900">{schoolDisplayName}</p>
                      {schoolLocation.address && <p className="text-xs text-slate-500">{schoolLocation.address}</p>}
                      <p className="text-[10px] text-slate-400">All routes connect here after stops</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-[11px] text-red-600 border-red-200 hover:bg-red-50"
                        disabled={deletingSchool}
                        onClick={() => void deleteSchoolLocation()}
                      >
                        Remove school pin
                      </Button>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}

            {buildMode && searchPin && (
              <Marker position={[searchPin.lat, searchPin.lng]} icon={searchPinIcon}>
                <Popup><p className="text-xs font-medium">{searchPin.display_name}</p></Popup>
              </Marker>
            )}

            {buildMode ? (
              <>
                {buildStops.map((stop, idx) => (
                  <Marker
                    key={idx}
                    position={[stop.latitude, stop.longitude]}
                    draggable
                    eventHandlers={{ dragend(e: L.DragEndEvent) { const p = e.target.getLatLng(); handleStopDrag(idx, p.lat, p.lng); } }}
                    icon={createStopIcon(idx, 0, newRouteColor, idx === 0, idx === buildStops.length - 1 && buildStops.length > 1)}
                  />
                ))}
                {buildGeom.stopLine.length > 1 && (
                  <Polyline positions={buildGeom.stopLine} color={newRouteColor} weight={5} opacity={0.85} lineCap="round" />
                )}
                {buildGeom.schoolConnector && (
                  <Polyline positions={buildGeom.schoolConnector} color={newRouteColor} weight={6} opacity={0.9} dashArray="10 8" lineCap="round" />
                )}
              </>
            ) : (
              visibleRoutes.map(route => {
                const sorted = [...(route.stops || [])].sort((a, b) => a.order_index - b.order_index);
                const lastIdx = sorted.length - 1;
                return (
                  <React.Fragment key={route.id}>
                    <RoutePolylines route={route} school={schoolLocation} selected={selectedRouteId === route.id || selectedRouteId === 'all'} />
                    {sorted.map((stop, idx) => {
                      const stopStudents = students.filter(st => st.stop_id === stop.id);
                      return (
                        <Marker
                          key={stop.id}
                          position={[parseFloat(String(stop.latitude)), parseFloat(String(stop.longitude))]}
                          icon={createStopIcon(idx, stopStudents.length, route.color || '#3b82f6', idx === 0, idx === lastIdx && lastIdx > 0)}
                        >
                          <Popup maxWidth={260}>
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase text-indigo-600">Stop {idx + 1}</p>
                              <h4 className="font-bold text-sm">{stop.name}</h4>
                              <p className="text-[11px] text-slate-500">{route.name}</p>
                              {stopStudents.length > 0 && (
                                <p className="text-xs text-slate-600">{stopStudents.length} student(s) at this stop</p>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}
          </MapContainer>

          {buildMode && searchPin && !showStopPrompt && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[min(92%,320px)]">
              <Button type="button" variant="primaryAction" className="w-full h-10 rounded-xl shadow-xl text-sm gap-2" onClick={handleAddStopFromSearch}>
                <Plus className="h-4 w-4" />
                Add stop at {searchPin.display_name.split(',')[0]}
              </Button>
            </div>
          )}

          {showStopPrompt && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white border shadow-2xl p-4 rounded-2xl w-[min(20rem,calc(100%-2rem))] z-[1001]">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Navigation className="h-4 w-4 text-emerald-500" />
                Name this stop
              </h4>
              <Input value={stopPromptName} onChange={e => setStopPromptName(e.target.value)} autoFocus className="h-9 mb-3" onKeyDown={e => e.key === 'Enter' && handleConfirmStop()} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setShowStopPrompt(false)}>Cancel</Button>
                <Button type="button" variant="primaryAction" size="sm" className="flex-1" onClick={handleConfirmStop}>Add stop</Button>
              </div>
            </div>
          )}

          {activeRouteDistance && fullMapView && !buildMode && (
            <div className="absolute bottom-6 left-4 z-[1000] pointer-events-none">
              <div className="pointer-events-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-white/80 shadow-xl text-sm font-semibold text-slate-800">
                <Ruler className="h-4 w-4 text-violet-500" />
                {selectedRouteId === 'all' ? (
                  <span>{formatDistance(mapSummary.distanceKm)} across {mapSummary.routes} routes</span>
                ) : (
                  <span>{activeRoute.name} · {formatDistance(activeRouteDistance.totalKm)}</span>
                )}
              </div>
            </div>
          )}

          {!buildMode && routes.length > 0 && !fullMapView && (
            <div className="absolute bottom-4 right-14 z-[400] flex flex-wrap gap-1.5 max-w-[45%] justify-end pointer-events-none">
              {(selectedRouteId === 'all' ? routes : visibleRoutes).slice(0, 8).map(r => (
                <span key={r.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur border shadow-md text-[10px] font-semibold text-slate-700">
                  <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                  {r.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransportMap;
