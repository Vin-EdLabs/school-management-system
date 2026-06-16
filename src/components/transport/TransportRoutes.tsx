import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiService } from '../../services/api';
import { RouteBuilder } from './RouteBuilder';
import { AssignStudentsModal } from './AssignStudentsModal';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  UserPlus,
  Sun,
  Moon,
  SunMoon,
  AlertCircle,
  Search,
  Map,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateRouteDistance, formatDistance } from '../../utils/transportDistance';

interface Stop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  order_index: number;
}

interface Route {
  id: string;
  name: string;
  time_of_day: 'morning' | 'afternoon' | 'both';
  vehicle_id?: string;
  plate_number?: string;
  vehicle_name?: string;
  transport_driver_id?: number;
  driver_name?: string;
  driver_phone?: string;
  student_count: number;
  color: string;
  status: 'active' | 'suspended';
  stops: Stop[];
}

interface TransportRoutesProps {
  onNavigate: (module: string) => void;
}

export const TransportRoutes: React.FC<TransportRoutesProps> = ({ onNavigate }) => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedRouteForAssign, setSelectedRouteForAssign] = useState<Route | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<Route | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolHub, setSchoolHub] = useState<{ latitude: number; longitude: number; school_name: string; logo_url?: string | null } | null>(null);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const [data, school] = await Promise.all([
        apiService.get<Route[]>('/transport/routes'),
        apiService.get<{ latitude: number; longitude: number; label: string; school_name: string } | null>('/transport/school-location'),
      ]);
      setRoutes(data);
      if (school) {
        setSchoolHub({
          latitude: school.latitude,
          longitude: school.longitude,
          school_name: school.school_name,
          logo_url: school.logo_url,
        });
      }
    } catch (err) {
      console.error('Failed to fetch transport routes:', err);
      toast({ title: 'Error', description: 'Failed to load transport routes.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRoutes();
  }, []);

  const getTimeOfDayBadge = (time: string) => {
    switch (time) {
      case 'morning':
        return (
          <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
            <Sun className="h-3 w-3" /> Morning
          </Badge>
        );
      case 'afternoon':
        return (
          <Badge variant="outline" className="gap-1 bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
            <Moon className="h-3 w-3" /> Afternoon
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 bg-sky-50 text-sky-700 border-sky-200 text-[10px]">
            <SunMoon className="h-3 w-3" /> Both
          </Badge>
        );
    }
  };

  const stopsPreview = (stops: Stop[]) => {
    if (!stops?.length) return '—';
    const names = stops.slice(0, 3).map(s => s.name);
    const extra = stops.length > 3 ? ` +${stops.length - 3}` : '';
    return names.join(' → ') + extra;
  };

  const filteredRoutes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter(route => {
      const text = [
        route.name,
        route.driver_name,
        route.driver_phone,
        route.vehicle_name,
        route.plate_number,
        route.status,
        route.time_of_day,
        ...(route.stops || []).map(s => s.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    });
  }, [routes, searchQuery]);

  const routeDistanceKm = (route: Route) => {
    const sorted = [...(route.stops || [])].sort((a, b) => a.order_index - b.order_index);
    if (sorted.length < 2 && !schoolHub) return null;
    return calculateRouteDistance(
      sorted.map(s => ({ latitude: parseFloat(String(s.latitude)), longitude: parseFloat(String(s.longitude)) })),
      schoolHub,
      route.time_of_day,
      { schoolLabel: schoolHub?.school_name || 'School', stopNames: sorted.map(s => s.name) }
    ).totalKm;
  };

  if (showBuilder) {
    return (
      <div className="p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
        <RouteBuilder
          routeToEdit={editingRoute}
          onBack={() => { setShowBuilder(false); setEditingRoute(null); }}
          onSuccess={() => { setShowBuilder(false); setEditingRoute(null); void loadRoutes(); }}
          onViewFullMap={() => onNavigate('transport-map')}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-white">Routes</h1>
          <p className="mt-1 text-sm text-slate-500">All school transport routes in one table.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onNavigate('transport-map')} className="h-9 rounded-xl gap-2">
            <Map className="h-4 w-4" /> View full map
          </Button>
          <Button type="button" variant="primaryAction" size="sm" onClick={() => { setEditingRoute(null); setShowBuilder(true); }} className="h-9 rounded-xl">
            <Plus className="h-4 w-4 mr-2" /> Create route
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search routes — name, driver, vehicle, stop…"
          className="pl-9 h-10 rounded-xl border-slate-200 bg-white shadow-sm"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-800 hover:bg-slate-800">
              <TableHead className="font-semibold text-white min-w-[160px]">Route name</TableHead>
              <TableHead className="font-semibold text-white">Shift</TableHead>
              <TableHead className="font-semibold text-white text-center">Stops</TableHead>
              <TableHead className="font-semibold text-white text-center min-w-[72px]">Distance</TableHead>
              <TableHead className="font-semibold text-white min-w-[200px]">Stop path</TableHead>
              <TableHead className="font-semibold text-white text-center">Students</TableHead>
              <TableHead className="font-semibold text-white min-w-[130px]">Driver</TableHead>
              <TableHead className="font-semibold text-white min-w-[130px]">Vehicle</TableHead>
              <TableHead className="font-semibold text-white">Status</TableHead>
              <TableHead className="font-semibold text-white text-right min-w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(10)].map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full max-w-[100px]" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredRoutes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-40 text-center">
                  <MapPin className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-600">
                    {searchQuery.trim() ? 'No routes match your search' : 'No routes configured'}
                  </p>
                  {!searchQuery.trim() && (
                    <Button type="button" variant="primaryAction" size="sm" className="mt-3 rounded-xl" onClick={() => setShowBuilder(true)}>
                      Create first route
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredRoutes.map(route => (
                <TableRow key={route.id} className="hover:bg-slate-50/80 even:bg-slate-50/30">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white shadow" style={{ background: route.color || '#3b82f6' }} />
                      <span className="font-semibold text-slate-900 text-sm">{route.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">{getTimeOfDayBadge(route.time_of_day)}</TableCell>
                  <TableCell className="py-3 text-center text-sm font-medium text-slate-700">
                    {route.stops?.length || 0}
                  </TableCell>
                  <TableCell className="py-3 text-center text-xs font-mono text-slate-600">
                    {(() => {
                      const km = routeDistanceKm(route);
                      return km != null ? formatDistance(km) : '—';
                    })()}
                  </TableCell>
                  <TableCell className="py-3 text-xs text-slate-600 max-w-[240px] truncate" title={stopsPreview(route.stops)}>
                    {stopsPreview(route.stops)}
                  </TableCell>
                  <TableCell className="py-3 text-center text-sm font-medium text-slate-700">
                    {route.student_count || 0}
                  </TableCell>
                  <TableCell className="py-3 text-sm">
                    {route.driver_name ? (
                      <span className="font-medium text-slate-800">{route.driver_name}</span>
                    ) : (
                      <span className="text-slate-400 italic text-xs">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-sm">
                    {route.vehicle_name ? (
                      <div>
                        <span className="font-medium text-slate-800">{route.vehicle_name}</span>
                        <span className="block text-[11px] font-mono text-slate-500">{route.plate_number}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-xs">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${route.status === 'active' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-rose-600 border-rose-200 bg-rose-50'}`}
                    >
                      {route.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs rounded-lg"
                        onClick={() => { setSelectedRouteForAssign(route); setAssignModalOpen(true); }}
                        title="Assign students"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingRoute(route); setShowBuilder(true); }} title="Edit">
                        <Edit2 className="h-3.5 w-3.5 text-slate-600" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:text-rose-600" onClick={() => { setRouteToDelete(route); setDeleteConfirmOpen(true); }} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selectedRouteForAssign && (
        <AssignStudentsModal
          route={selectedRouteForAssign}
          open={assignModalOpen}
          onClose={() => { setAssignModalOpen(false); setSelectedRouteForAssign(null); }}
          onSuccess={() => { setAssignModalOpen(false); setSelectedRouteForAssign(null); void loadRoutes(); }}
        />
      )}

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="h-5 w-5" /> Delete route
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-2 py-2">
            <p className="text-sm text-slate-600">
              Delete <span className="font-bold text-slate-800">&quot;{routeToDelete?.name}&quot;</span>?
            </p>
            <p className="text-xs text-slate-400">All stops will be removed and enrolled students unassigned.</p>
          </DialogBody>
          <DialogFooter className="gap-2 bg-slate-50 p-4 border-t rounded-b-lg">
            <Button type="button" variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={async () => {
              if (!routeToDelete) return;
              setDeleting(true);
              try {
                await apiService.delete(`/transport/routes/${routeToDelete.id}`);
                toast({ title: 'Deleted', description: `Route "${routeToDelete.name}" removed.` });
                setDeleteConfirmOpen(false);
                setRouteToDelete(null);
                void loadRoutes();
              } catch (err: any) {
                toast({ title: 'Failed', description: err?.message, variant: 'destructive' });
              } finally {
                setDeleting(false);
              }
            }} disabled={deleting} className="bg-rose-600 hover:bg-rose-700">
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransportRoutes;
