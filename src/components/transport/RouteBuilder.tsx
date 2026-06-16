import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap, ZoomControl, ScaleControl, CircleMarker } from 'react-leaflet';
import { buildRouteGeometry } from '../../utils/transportRouteGeometry';
import { calculateRouteDistance, formatDistance } from '../../utils/transportDistance';
import { createSchoolMapIcon } from '../../utils/transportSchoolMarker';
import { useSchool } from '@/contexts/SchoolContext';
import { searchPlaces, type GeocodeResult } from '../../utils/geocoding';
import {
  TRANSPORT_DEFAULT_CENTER,
  TRANSPORT_DEFAULT_ZOOM,
  TRANSPORT_MAP_BOUNDS,
  TRANSPORT_MAP_TILES,
  type TransportMapStyle,
} from '../../utils/transportMapConstants';
import L from 'leaflet';
import {
  MapPin,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Navigation,
  Sun,
  Moon,
  SunMoon,
  Search,
  Loader2,
  Layers,
  Map,
  Ruler,
} from 'lucide-react';

interface Vehicle {
  id: string;
  plate_number: string;
  vehicle_name: string;
  capacity: number;
}

interface Driver {
  id: number;
  full_name: string;
  phone?: string | null;
  license_number?: string | null;
  status?: string;
  vehicle_id?: string | null;
}

interface Stop {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  order_index: number;
}

interface RouteBuilderProps {
  routeToEdit?: any | null;
  onBack: () => void;
  onSuccess: () => void;
  onViewFullMap?: () => void;
}

// Sub-component to capture click events on the Leaflet map
const MapClickHandler = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

type RouteMapFocus =
  | { mode: 'route' }
  | { mode: 'place'; lat: number; lng: number; token: number };

const RouteMapController = ({
  stops,
  schoolHub,
  mapFocus,
}: {
  stops: Stop[];
  schoolHub: { latitude: number; longitude: number } | null;
  mapFocus: RouteMapFocus;
}) => {
  const map = useMap();

  useEffect(() => {
    if (mapFocus.mode !== 'place') return;
    map.stop();
    map.flyTo([mapFocus.lat, mapFocus.lng], 14, { duration: 1.2 });
  }, [mapFocus.mode === 'place' ? mapFocus.token : null, mapFocus.mode === 'place' ? mapFocus.lat : null, mapFocus.mode === 'place' ? mapFocus.lng : null, map]);

  useEffect(() => {
    if (mapFocus.mode !== 'route') return;
    map.stop();

    const coords: [number, number][] = [];
    if (schoolHub) coords.push([schoolHub.latitude, schoolHub.longitude]);
    stops.forEach(s => coords.push([s.latitude, s.longitude]));

    if (coords.length === 0) {
      map.setView(TRANSPORT_DEFAULT_CENTER, TRANSPORT_DEFAULT_ZOOM);
      return;
    }
    if (coords.length === 1) {
      map.flyTo(coords[0], 15, { duration: 1.2 });
      return;
    }
    map.flyToBounds(L.latLngBounds(coords), { padding: [70, 70], maxZoom: 16, duration: 1.2 });
  }, [mapFocus.mode, stops, schoolHub, map]);

  return null;
};

const searchPinIcon = L.divIcon({
  html: `<div class="w-4 h-4 rounded-full bg-violet-600 border-[3px] border-white shadow-lg ring-4 ring-violet-400/30"></div>`,
  className: 'custom-leaflet-marker-search',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const createStopIcon = (orderIndex: number, color: string) =>
  L.divIcon({
    html: `
      <div class="relative flex flex-col items-center" style="width:36px;height:44px;">
        <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-lg border-[3px] border-white" style="background:${color}; box-shadow:0 4px 14px rgba(0,0,0,0.25);">
          ${orderIndex + 1}
        </div>
        <div class="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent -mt-0.5" style="border-top-color:${color};"></div>
      </div>
    `,
    className: 'custom-leaflet-marker-stop',
    iconSize: [36, 44],
    iconAnchor: [18, 40],
    popupAnchor: [0, -38],
  });

export const RouteBuilder: React.FC<RouteBuilderProps> = ({ routeToEdit, onBack, onSuccess, onViewFullMap }) => {
  const { school: systemSchool } = useSchool();
  const [name, setName] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'both'>('both');
  const [vehicleId, setVehicleId] = useState('none');
  const [driverId, setDriverId] = useState('none');
  const [status, setStatus] = useState<'active' | 'suspended'>('active');
  const [color, setColor] = useState('#3b82f6');
  const [stops, setStops] = useState<Stop[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [schoolHub, setSchoolHub] = useState<{ latitude: number; longitude: number; school_name: string; logo_url?: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [mapStyle, setMapStyle] = useState<TransportMapStyle>('satellite');
  const [mapFocus, setMapFocus] = useState<RouteMapFocus>({ mode: 'route' });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchPin, setSearchPin] = useState<GeocodeResult | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSearchDebounce = useRef(false);

  // Stop details prompt state
  const [newStopCoords, setNewStopCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [newStopName, setNewStopName] = useState('');
  const [showStopPrompt, setShowStopPrompt] = useState(false);

  // Load vehicles and drivers
  useEffect(() => {
    const loadData = async () => {
      try {
        const [vList, dList, school] = await Promise.all([
          apiService.get<Vehicle[]>('/transport/vehicles'),
          apiService.get<Driver[]>('/transport/drivers'),
          apiService.get<{ latitude: number; longitude: number; school_name: string; logo_url?: string | null } | null>('/transport/school-location'),
        ]);
        setVehicles(vList);
        setDrivers(dList);
        if (school) {
          setSchoolHub({
            latitude: school.latitude,
            longitude: school.longitude,
            school_name: school.school_name,
            logo_url: school.logo_url,
          });
        }
      } catch (err) {
        console.error('Failed to load route assignment dependencies:', err);
      }
    };
    void loadData();
  }, []);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (skipSearchDebounce.current) {
      skipSearchDebounce.current = false;
      return;
    }
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchDebounce.current = setTimeout(() => {
      void searchPlaces(q)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 450);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [searchQuery]);

  // Pre-populate if editing
  useEffect(() => {
    if (routeToEdit) {
      setName(routeToEdit.name || '');
      setTimeOfDay(routeToEdit.time_of_day || 'both');
      setVehicleId(routeToEdit.vehicle_id || 'none');
      setDriverId(routeToEdit.transport_driver_id ? String(routeToEdit.transport_driver_id) : 'none');
      setStatus(routeToEdit.status || 'active');
      setColor(routeToEdit.color || '#3b82f6');
      if (Array.isArray(routeToEdit.stops)) {
        const sortedStops = [...routeToEdit.stops].sort((a, b) => a.order_index - b.order_index);
        setStops(sortedStops.map(s => ({
          ...s,
          latitude: parseFloat(s.latitude),
          longitude: parseFloat(s.longitude),
        })));
      }
      setMapFocus({ mode: 'route' });
    }
  }, [routeToEdit]);

  const focusPlace = (lat: number, lng: number) => {
    setMapFocus({ mode: 'place', lat, lng, token: Date.now() });
  };

  const openStopPrompt = (lat: number, lng: number, suggestedName?: string) => {
    setNewStopCoords({ lat, lng });
    setNewStopName(suggestedName || `Stop ${stops.length + 1}`);
    setShowStopPrompt(true);
  };

  const handlePickSearchResult = (result: GeocodeResult) => {
    setSearchPin(result);
    focusPlace(result.lat, result.lng);
    setSearchOpen(false);
    skipSearchDebounce.current = true;
    setSearchQuery(result.display_name.split(',')[0]);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      handlePickSearchResult(searchResults[0]);
    }
    if (e.key === 'Escape') setSearchOpen(false);
  };

  const handleAddStopFromSearch = () => {
    if (!searchPin) return;
    openStopPrompt(searchPin.lat, searchPin.lng, searchPin.display_name.split(',')[0]);
  };

  const handleDriverChange = (value: string) => {
    setDriverId(value);
    if (value === 'none') return;
    const selected = drivers.find(d => String(d.id) === value);
    if (selected?.vehicle_id) {
      setVehicleId(selected.vehicle_id);
    }
  };

  // Click handler to drop pin
  const handleMapClick = (lat: number, lng: number) => {
    openStopPrompt(lat, lng);
  };

  // Add stop confirmation
  const handleConfirmStop = () => {
    if (!newStopCoords || !newStopName.trim()) return;

    const newStop: Stop = {
      name: newStopName.trim(),
      latitude: newStopCoords.lat,
      longitude: newStopCoords.lng,
      order_index: stops.length,
    };

    setStops([...stops, newStop]);
    setNewStopCoords(null);
    setNewStopName('');
    setShowStopPrompt(false);
    setSearchPin(null);
    setMapFocus({ mode: 'route' });
    toast({
      title: 'Stop Added',
      description: `"${newStop.name}" added to stops sequence.`,
    });
  };

  // Drag handler to update stop lat/lng
  const handleMarkerDrag = (index: number, lat: number, lng: number) => {
    setStops(prevStops => {
      const updated = [...prevStops];
      updated[index] = {
        ...updated[index],
        latitude: lat,
        longitude: lng,
      };
      return updated;
    });
  };

  // Remove stop
  const handleRemoveStop = (index: number) => {
    const updated = stops.filter((_, i) => i !== index).map((s, idx) => ({
      ...s,
      order_index: idx,
    }));
    setStops(updated);
  };

  // Reorder stops
  const moveStop = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === stops.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...stops];

    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // Reset indices
    const normalized = reordered.map((s, idx) => ({
      ...s,
      order_index: idx,
    }));

    setStops(normalized);
  };

  const schoolDisplayName = schoolHub?.school_name || systemSchool?.name || 'School';
  const schoolMapIcon = useMemo(
    () => createSchoolMapIcon(schoolHub?.logo_url || systemSchool?.logo_url, schoolDisplayName),
    [schoolHub?.logo_url, systemSchool?.logo_url, schoolDisplayName]
  );

  const routeGeometry = useMemo(() => {
    return buildRouteGeometry(
      stops.map(s => ({ latitude: s.latitude, longitude: s.longitude })),
      schoolHub,
      timeOfDay === 'both' ? 'morning' : timeOfDay
    );
  }, [stops, schoolHub, timeOfDay]);

  const routeDistance = useMemo(() => {
    if (stops.length < 2 && !schoolHub) return null;
    return calculateRouteDistance(
      stops.map(s => ({ latitude: s.latitude, longitude: s.longitude })),
      schoolHub,
      timeOfDay === 'both' ? 'morning' : timeOfDay,
      { schoolLabel: schoolDisplayName, stopNames: stops.map(s => s.name) }
    );
  }, [stops, schoolHub, timeOfDay]);

  // Save/Create route submit handler
  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Route name is required.',
        variant: 'destructive',
      });
      return;
    }

    if (stops.length < 2) {
      toast({
        title: 'Validation Error',
        description: 'A route must have at least 2 stops configuration.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        time_of_day: timeOfDay,
        vehicle_id: vehicleId !== 'none' ? vehicleId : null,
        transport_driver_id: driverId !== 'none' ? parseInt(driverId, 10) : null,
        status,
        color,
        stops: stops.map((s, idx) => ({
          name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
          order_index: idx,
        })),
      };

      if (routeToEdit) {
        await apiService.put(`/transport/routes/${routeToEdit.id}`, payload);
        toast({ title: 'Route Updated', description: 'Route modifications saved successfully.' });
      } else {
        await apiService.post('/transport/routes', payload);
        toast({ title: 'Route Created', description: 'New transport route has been created successfully.' });
      }

      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Save Failed',
        description: err?.message || 'Failed to persist transport route details.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-h-[85vh] overflow-hidden">
      {/* Route Info Form & Steps Registry */}
      <div className="w-full lg:w-96 flex flex-col gap-4 overflow-y-auto pr-2 min-h-0 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button type="button" variant="ghost" size="icon" onClick={onBack} className="rounded-xl shrink-0">
              <ArrowLeft className="h-4.5 w-4.5" />
            </Button>
            <h2 className="text-xl font-bold truncate">{routeToEdit ? 'Modify Route' : 'Create Route'}</h2>
          </div>
          {onViewFullMap && (
            <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl shrink-0 gap-2" onClick={onViewFullMap}>
              <Map className="h-4 w-4" />
              View full map
            </Button>
          )}
        </div>

        <form onSubmit={handleSaveRoute} className="space-y-4">
          <Card className="border-slate-200">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="routeName">Route Name *</Label>
                <Input
                  id="routeName"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Tema Morning Route"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Time of Day</Label>
                <div className="flex gap-2">
                  {[
                    { val: 'morning', label: 'Morning', icon: Sun },
                    { val: 'afternoon', label: 'Afternoon', icon: Moon },
                    { val: 'both', label: 'Both', icon: SunMoon },
                  ].map(t => (
                    <Button
                      key={t.val}
                      type="button"
                      variant={timeOfDay === t.val ? 'primaryAction' : 'outline'}
                      size="sm"
                      onClick={() => setTimeOfDay(t.val as any)}
                      className="flex-1 gap-1"
                    >
                      <t.icon className="h-3.5 w-3.5" />
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="routeVehicle">Assign Vehicle</Label>
                <Select value={vehicleId || 'none'} onValueChange={setVehicleId}>
                  <SelectTrigger id="routeVehicle">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.vehicle_name} ({v.plate_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="routeDriver">Assign Driver</Label>
                <Select value={driverId || 'none'} onValueChange={handleDriverChange}>
                  <SelectTrigger id="routeDriver">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {drivers.filter(d => d.status !== 'inactive').map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.full_name}
                        {d.license_number ? ` · ${d.license_number}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Drivers are registered under <strong>Transport → Drivers</strong>. Their assigned bus fills in automatically when you pick a driver.
                </p>
                {drivers.filter(d => d.status !== 'inactive').length === 0 && (
                  <p className="text-[11px] text-amber-600">
                    No drivers found. Go to Transport → Drivers and click Add driver.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="routeColor">Polyline Color</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="routeColor"
                      type="color"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="w-12 h-10 p-0 cursor-pointer rounded-lg overflow-hidden border-0"
                    />
                    <span className="font-mono text-xs font-bold uppercase">{color}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="routeStatus">Status</Label>
                  <Select value={status} onValueChange={setStatus as any}>
                    <SelectTrigger id="routeStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stops List Sequence */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold text-slate-600">Stops Sequence ({stops.length})</Label>
              <p className="text-[10px] text-slate-400">Search map or click to pin stops</p>
            </div>
            {routeDistance && routeDistance.totalKm > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 border border-violet-100 text-xs text-violet-800">
                <Ruler className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold">{formatDistance(routeDistance.totalKm)} from {schoolDisplayName}</span>
                <span className="text-violet-600/80">
                  ({formatDistance(routeDistance.fromSchoolKm)} to 1st stop
                  {routeDistance.betweenStopsKm > 0 && ` · ${formatDistance(routeDistance.betweenStopsKm)} between stops`})
                </span>
              </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {stops.length === 0 ? (
                <div className="text-center p-6 border-2 border-dashed rounded-xl border-slate-200 text-xs text-slate-400">
                  No stops yet. Search a place (e.g. Tema, Wamfie) or click the map to add stops.
                </div>
              ) : (
                stops.map((stop, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2.5 bg-slate-50 border rounded-xl shadow-sm text-xs"
                  >
                    <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={stop.name}
                        onChange={e => {
                          const updated = [...stops];
                          updated[index].name = e.target.value;
                          setStops(updated);
                        }}
                        className="font-semibold text-slate-800 bg-transparent outline-none w-full border-b border-transparent hover:border-slate-300 focus:border-indigo-500 py-0.5"
                      />
                      <div className="text-[9px] text-slate-400 font-mono">
                        {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
                      </div>
                    </div>

                    <div className="flex gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveStop(index, 'up')}
                        disabled={index === 0}
                        className="w-6 h-6 rounded-md"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => moveStop(index, 'down')}
                        disabled={index === stops.length - 1}
                        className="w-6 h-6 rounded-md"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveStop(index)}
                        className="w-6 h-6 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Button type="submit" variant="primaryAction" className="w-full gap-2 rounded-xl" disabled={saving}>
            <Save className="h-4.5 w-4.5" />
            {routeToEdit ? 'Save Changes' : 'Create Route'}
          </Button>
        </form>
      </div>

      {/* Embedded Leaflet Map */}
      <div className="flex-1 h-[55vh] lg:h-[70vh] rounded-2xl border border-slate-200 overflow-hidden relative shadow-xl ring-1 ring-slate-900/5 bg-slate-200">
        {/* Search + map style overlay */}
        <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-col sm:flex-row gap-2 pointer-events-none">
          <div className="pointer-events-auto flex-1 max-w-md rounded-2xl bg-white/95 backdrop-blur-md border border-white/80 shadow-2xl shadow-slate-900/10 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
              <Search className="h-4 w-4 text-violet-500 shrink-0" />
              <Input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search places — Tema, Wamfie, Accra…"
                className="border-0 shadow-none focus-visible:ring-0 h-9 bg-transparent text-sm"
              />
              {searchLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}
            </div>
            {searchOpen && searchResults.length > 0 && (
              <ul className="max-h-52 overflow-y-auto py-1">
                {searchResults.map(r => (
                  <li key={r.place_id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2.5 text-xs hover:bg-violet-50 flex items-start gap-2 transition-colors"
                      onClick={() => handlePickSearchResult(r)}
                    >
                      <MapPin className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
                      <span className="text-slate-700 line-clamp-2">{r.display_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Select value={mapStyle} onValueChange={v => setMapStyle(v as TransportMapStyle)}>
            <SelectTrigger className="pointer-events-auto w-36 h-10 rounded-xl bg-white/95 border-white/80 shadow-lg backdrop-blur-md">
              <Layers className="h-3.5 w-3.5 mr-1 text-violet-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TRANSPORT_MAP_TILES) as TransportMapStyle[]).map(key => (
                <SelectItem key={key} value={key}>{TRANSPORT_MAP_TILES[key].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mapFocus.mode === 'place' && (
          <p className="absolute top-[4.75rem] sm:top-4 sm:left-auto sm:right-44 left-4 z-[999] pointer-events-none text-[11px] font-medium text-slate-600 bg-white/90 backdrop-blur rounded-full px-3 py-1 shadow-sm border border-slate-200/80 max-w-[220px] text-center">
            Searched location — add stop or click map
          </p>
        )}

        {searchPin && !showStopPrompt && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[min(92%,320px)]">
            <Button
              type="button"
              variant="primaryAction"
              className="w-full h-10 rounded-xl shadow-xl text-sm gap-2"
              onClick={handleAddStopFromSearch}
            >
              <Plus className="h-4 w-4" />
              Add stop at {searchPin.display_name.split(',')[0]}
            </Button>
          </div>
        )}

        <MapContainer
          center={TRANSPORT_DEFAULT_CENTER}
          zoom={TRANSPORT_DEFAULT_ZOOM}
          minZoom={6}
          maxBounds={TRANSPORT_MAP_BOUNDS}
          maxBoundsViscosity={0.85}
          className="w-full h-full"
          scrollWheelZoom
          zoomControl={false}
        >
          <TileLayer url={TRANSPORT_MAP_TILES[mapStyle].url} attribution={TRANSPORT_MAP_TILES[mapStyle].attribution} />
          <ZoomControl position="bottomright" />
          <ScaleControl position="bottomleft" imperial={false} />
          <RouteMapController stops={stops} schoolHub={schoolHub} mapFocus={mapFocus} />
          <MapClickHandler onMapClick={handleMapClick} />

          {searchPin && (
            <Marker position={[searchPin.lat, searchPin.lng]} icon={searchPinIcon}>
              <Popup><p className="text-xs font-medium">{searchPin.display_name}</p></Popup>
            </Marker>
          )}

          {stops.map((stop, index) => (
            <Marker
              key={index}
              position={[stop.latitude, stop.longitude]}
              draggable
              icon={createStopIcon(index, color)}
              eventHandlers={{
                dragend(e: L.DragEndEvent) {
                  const pos = e.target.getLatLng();
                  handleMarkerDrag(index, pos.lat, pos.lng);
                },
              }}
            >
              <Popup>
                <div className="p-1 space-y-1">
                  <div className="font-bold text-xs">Stop {index + 1}: {stop.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Lat: {stop.latitude.toFixed(5)}<br />
                    Lng: {stop.longitude.toFixed(5)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {schoolHub && (
            <>
              <CircleMarker
                center={[schoolHub.latitude, schoolHub.longitude]}
                radius={28}
                pathOptions={{ color: '#7c3aed', fillColor: '#8b5cf6', fillOpacity: 0.08, weight: 2, dashArray: '4 6' }}
              />
              <Marker position={[schoolHub.latitude, schoolHub.longitude]} icon={schoolMapIcon} zIndexOffset={1000}>
                <Popup>
                  <div className="text-xs font-bold text-violet-700">School hub</div>
                  <div className="text-sm font-semibold">{schoolDisplayName}</div>
                </Popup>
              </Marker>
            </>
          )}

          {routeGeometry.stopLine.length > 1 && (
            <Polyline positions={routeGeometry.stopLine} color={color} weight={5} opacity={0.85} lineCap="round" />
          )}
          {routeGeometry.schoolConnector && (
            <Polyline positions={routeGeometry.schoolConnector} color={color} weight={6} opacity={0.9} dashArray="10 8" lineCap="round" />
          )}
        </MapContainer>

        {/* Floating Modal Prompt when dropping a stop */}
        {showStopPrompt && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur border shadow-2xl p-4 rounded-2xl w-80 z-[1000] flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <Navigation className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
              Configure Route Stop Name
            </h4>
            <div className="space-y-1.5">
              <Label htmlFor="stopName" className="text-xs">Stop Name</Label>
              <Input
                id="stopName"
                value={newStopName}
                onChange={e => setNewStopName(e.target.value)}
                placeholder="Enter Stop Name..."
                autoFocus
                className="h-9"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowStopPrompt(false)} className="flex-1 h-8 text-xs">
                Cancel
              </Button>
              <Button type="button" variant="primaryAction" size="sm" onClick={handleConfirmStop} className="flex-1 h-8 text-xs">
                Confirm
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
