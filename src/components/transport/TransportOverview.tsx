import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { apiService } from '../../services/api';
import {
  Bus,
  MapPin,
  Users,
  UserCheck,
  Wrench,
  AlertCircle,
  ArrowRight,
  Plus,
  Compass,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Stats {
  totalVehicles: number;
  totalActiveRoutes: number;
  totalStudentsOnTransport: number;
  totalDriversAssigned: number;
  routesWithNoDriver: number;
  vehiclesUnderMaintenance: number;
  unassignedStudents: number;
}

interface Vehicle {
  id: string;
  plate_number: string;
  vehicle_name: string;
  capacity: number;
  model: string;
  color: string;
  status: 'active' | 'maintenance' | 'retired';
  route_names?: string | null;
  route_count?: number;
  driver_name: string;
  instructor_name?: string | null;
  student_count: number;
}

interface TransportOverviewProps {
  onNavigate: (module: string) => void;
}

export const TransportOverview: React.FC<TransportOverviewProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, vehiclesData] = await Promise.all([
          apiService.get<Stats>('/transport/stats'),
          apiService.get<Vehicle[]>('/transport/vehicles'),
        ]);
        setStats(statsData);
        setVehicles(vehiclesData);
      } catch (err) {
        console.error('Failed to load transport overview data:', err);
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, []);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-200/50 dark:bg-emerald-500/20 dark:text-emerald-400';
      case 'maintenance':
        return 'bg-amber-500/10 text-amber-600 border-amber-200/50 dark:bg-amber-500/20 dark:text-amber-400';
      default:
        return 'bg-slate-500/10 text-slate-600 border-slate-200/50 dark:bg-slate-500/20 dark:text-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-slate-100">
              <CardContent className="p-6">
                <Skeleton className="h-12 w-12 rounded-xl mb-4" />
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Transport Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor vehicles fleet, routes planning, and student transport assignments.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onNavigate('transport-routes')} className="h-9 rounded-xl">
            <Compass className="h-4 w-4 mr-2" />
            Manage Routes
          </Button>
          <Button type="button" variant="primaryAction" size="sm" onClick={() => onNavigate('transport-vehicles')} className="h-9 rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Vehicles', val: stats?.totalVehicles ?? 0, icon: Bus, desc: 'Registered Fleet size', color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
          { label: 'Active Routes', val: stats?.totalActiveRoutes ?? 0, icon: MapPin, desc: 'Currently running routes', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
          { label: 'Students Commuting', val: stats?.totalStudentsOnTransport ?? 0, icon: Users, desc: 'Assigned transport students', color: 'text-sky-600 bg-sky-50 border-sky-100' },
          { label: 'Assigned Drivers', val: stats?.totalDriversAssigned ?? 0, icon: UserCheck, desc: 'Drivers on active routes', color: 'text-violet-600 bg-violet-50 border-violet-100' },
        ].map((kpi, idx) => (
          <Card key={idx} className="border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden bg-white/70 backdrop-blur">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-2xl border ${kpi.color} shrink-0`}>
                <kpi.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                <h3 className="text-2xl font-bold mt-1 tabular-nums text-slate-800 dark:text-white">{kpi.val}</h3>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{kpi.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grid: Vehicles Fleet & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Vehicles Fleet Summary */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-slate-700">Vehicle Fleet Summary</h2>

          {vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white text-slate-500">
              <Bus className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-sm font-semibold">No vehicles registered in fleet</p>
              <p className="text-xs text-slate-400 mt-1 mb-4 text-center">Add a vehicle to manage capacities and routes assignments.</p>
              <Button type="button" variant="primaryAction" size="sm" onClick={() => onNavigate('transport-vehicles')} className="rounded-xl">
                Add Vehicle
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {vehicles.map(vehicle => {
                const filledPct = vehicle.capacity ? Math.min(100, Math.round((vehicle.student_count / vehicle.capacity) * 100)) : 0;
                return (
                  <Card key={vehicle.id} className="border-slate-200/60 dark:border-slate-800 bg-white/70 backdrop-blur shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate max-w-[12rem]">{vehicle.vehicle_name}</h4>
                          <span className="font-mono text-xs font-semibold text-slate-400">{vehicle.plate_number}</span>
                        </div>
                        <Badge variant="outline" className={`capitalize font-bold text-[10px] border px-2 py-0.5 rounded-full ${getStatusBadgeClass(vehicle.status)}`}>
                          {vehicle.status}
                        </Badge>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Capacity assigned</span>
                          <span className="font-bold">{vehicle.student_count}/{vehicle.capacity} Students</span>
                        </div>
                        <Progress value={filledPct} className="h-1.5" />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Routes</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block mt-0.5" title={vehicle.route_names || undefined}>
                            {vehicle.route_names || '—'}
                            {vehicle.route_count != null && vehicle.route_count > 1 && (
                              <span className="text-[10px] text-slate-400 ml-1">({vehicle.route_count})</span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Assigned Driver</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block mt-0.5">
                            {vehicle.driver_name || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Instructor</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block mt-0.5">
                            {vehicle.instructor_name || '—'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Stats Panel */}
        <div className="space-y-4 shrink-0">
          <h2 className="text-lg font-bold text-slate-700">Quick Stats</h2>

          <Card className="border-slate-200 bg-white/70 backdrop-blur shadow-sm">
            <CardContent className="p-5 space-y-5">
              {[
                {
                  label: 'Routes with no driver',
                  val: stats?.routesWithNoDriver ?? 0,
                  icon: AlertCircle,
                  color: 'text-amber-500 bg-amber-50 border-amber-100',
                  action: () => onNavigate('transport-routes'),
                },
                {
                  label: 'Vehicles in maintenance',
                  val: stats?.vehiclesUnderMaintenance ?? 0,
                  icon: Wrench,
                  color: 'text-blue-500 bg-blue-50 border-blue-100',
                  action: () => onNavigate('transport-vehicles'),
                },
                {
                  label: 'Unassigned students',
                  val: stats?.unassignedStudents ?? 0,
                  icon: Users,
                  color: 'text-slate-500 bg-slate-50 border-slate-100',
                  action: () => onNavigate('transport-students'),
                },
              ].map((stat, idx) => (
                <div key={idx} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${stat.color} shrink-0`}>
                      <stat.icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600">{stat.label}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Needs action</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg tabular-nums text-slate-800">{stat.val}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={stat.action}
                      className="h-8 w-8 hover:bg-slate-100 rounded-md"
                      title="Manage details"
                    >
                      <ArrowRight className="h-4 w-4 text-slate-400 hover:text-slate-700" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TransportOverview;
