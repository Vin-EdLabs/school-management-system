import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bus,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Wrench,
  ShieldCheck,
  Fuel,
  Info,
} from 'lucide-react';

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
  route_id?: string;
  driver_name: string;
  instructor_id?: number | null;
  instructor_name?: string | null;
  student_count: number;
}

export const TransportVehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [vehicleName, setVehicleName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [capacity, setCapacity] = useState('30');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('#ffcc00');
  const [status, setStatus] = useState<'active' | 'maintenance' | 'retired'>('active');
  const [instructorId, setInstructorId] = useState('none');

  // Deletion state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [teachers, setTeachers] = useState<any[]>([]);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const data = await apiService.get<Vehicle[]>('/transport/vehicles');
      setVehicles(data);
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
      toast({
        title: 'Error',
        description: 'Failed to load transport fleet.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTeachers = async () => {
    try {
      const data = await apiService.get<any[]>('/teachers');
      setTeachers(data);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    }
  };

  useEffect(() => {
    void loadVehicles();
    void loadTeachers();
  }, []);

  // Fleet KPIs
  const fleetKPIs = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter(v => v.status === 'active').length;
    const maintenance = vehicles.filter(v => v.status === 'maintenance').length;
    const retired = vehicles.filter(v => v.status === 'retired').length;
    return { total, active, maintenance, retired };
  }, [vehicles]);

  const handleOpenAdd = () => {
    setEditingVehicle(null);
    setVehicleName('');
    setPlateNumber('');
    setCapacity('30');
    setModel('');
    setColor('#ffcc00');
    setStatus('active');
    setInstructorId('none');
    setDialogOpen(true);
  };

  const handleOpenEdit = (v: Vehicle) => {
    setEditingVehicle(v);
    setVehicleName(v.vehicle_name);
    setPlateNumber(v.plate_number);
    setCapacity(String(v.capacity));
    setModel(v.model || '');
    setColor(v.color || '#ffcc00');
    setStatus(v.status);
    setInstructorId(v.instructor_id ? String(v.instructor_id) : 'none');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vehicleName.trim() || !plateNumber.trim() || !capacity.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        vehicle_name: vehicleName.trim(),
        plate_number: plateNumber.trim(),
        capacity: parseInt(capacity, 10),
        model: model.trim() || null,
        color,
        status,
        instructor_id: instructorId !== 'none' ? parseInt(instructorId, 10) : null,
      };

      if (editingVehicle) {
        await apiService.put(`/transport/vehicles/${editingVehicle.id}`, payload);
        toast({
          title: 'Vehicle Updated',
          description: `Fleet unit "${vehicleName}" details were updated.`,
        });
      } else {
        await apiService.post('/transport/vehicles', payload);
        toast({
          title: 'Vehicle Registered',
          description: `New fleet unit "${vehicleName}" added successfully.`,
        });
      }
      setDialogOpen(false);
      void loadVehicles();
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Save Failed',
        description: err?.message || 'Failed to save vehicle details.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (v: Vehicle) => {
    setVehicleToDelete(v);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!vehicleToDelete) return;
    setDeleting(true);
    try {
      await apiService.delete(`/transport/vehicles/${vehicleToDelete.id}`);
      toast({
        title: 'Vehicle Removed',
        description: `Fleet unit "${vehicleToDelete.vehicle_name}" deleted.`,
      });
      setDeleteConfirmOpen(false);
      setVehicleToDelete(null);
      void loadVehicles();
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Delete Failed',
        description: err?.message || 'Failed to remove vehicle from fleet.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadgeClass = (s: string) => {
    switch (s) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-200/50';
      case 'maintenance':
        return 'bg-amber-500/10 text-amber-600 border-amber-200/50';
      default:
        return 'bg-rose-500/10 text-rose-600 border-rose-200/50';
    }
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'active':
        return <ShieldCheck className="h-4 w-4 text-emerald-500" />;
      case 'maintenance':
        return <Wrench className="h-4 w-4 text-amber-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-rose-500" />;
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-white">Fleet Registry</h1>
          <p className="mt-1 text-sm text-slate-500">Register shuttle buses, manage load capacities, and monitor maintenance schedules.</p>
        </div>
        <div>
          <Button
            type="button"
            variant="primaryAction"
            size="sm"
            onClick={handleOpenAdd}
            className="h-9 rounded-xl"
          >
            <Plus className="h-4.5 w-4.5 mr-2" />
            Add Vehicle
          </Button>
        </div>
      </div>

      {/* Mini KPIs Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Fleet Size', val: fleetKPIs.total, desc: 'Registered buses', color: 'border-slate-100 bg-white' },
          { label: 'Active Service', val: fleetKPIs.active, desc: 'On duty', color: 'border-emerald-100 bg-emerald-50/20' },
          { label: 'In Maintenance', val: fleetKPIs.maintenance, desc: 'In garage', color: 'border-amber-100 bg-amber-50/20' },
          { label: 'Retired', val: fleetKPIs.retired, desc: 'Out of service', color: 'border-rose-100 bg-rose-50/20' },
        ].map((item, i) => (
          <Card key={i} className={`border ${item.color} shadow-sm overflow-hidden`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
                <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-white">{item.val}</h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">{item.desc}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* List Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border-slate-100 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-32 rounded" />
                  <Skeleton className="h-5 w-16 rounded" />
                </div>
                <Skeleton className="h-3.5 w-40 rounded" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-1.5 w-full rounded" />
                </div>
                <div className="flex justify-between items-center border-t pt-3">
                  <Skeleton className="h-3.5 w-24 rounded" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-slate-200 rounded-3xl bg-white/50 text-slate-500">
          <Bus className="h-16 w-16 text-slate-300 mb-4 animate-pulse" />
          <p className="text-base font-semibold text-slate-700">No vehicles in fleet</p>
          <p className="text-xs text-slate-400 mt-1 mb-6 text-center max-w-sm">
            Add a vehicle unit to start planning routes and tracking rider counts.
          </p>
          <Button type="button" variant="primaryAction" size="sm" onClick={handleOpenAdd} className="rounded-xl">
            Register a Vehicle
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map(vehicle => {
            const filledPct = vehicle.capacity ? Math.min(100, Math.round((vehicle.student_count / vehicle.capacity) * 100)) : 0;
            return (
              <Card key={vehicle.id} className="border-slate-200/60 shadow-sm hover:shadow-md transition-all bg-white/80 backdrop-blur overflow-hidden flex flex-col justify-between">
                <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  {/* Top Block */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center border text-slate-500 shadow-sm" style={{ backgroundColor: `${vehicle.color}15`, borderColor: `${vehicle.color}35` }}>
                          <Bus className="h-4.5 w-4.5" style={{ color: vehicle.color }} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 dark:text-white text-sm truncate max-w-[12rem]">{vehicle.vehicle_name}</h3>
                          <span className="font-mono text-xs font-semibold text-slate-400">{vehicle.plate_number}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={`capitalize font-bold text-[10px] border px-2 py-0.5 rounded-full gap-1 flex items-center shrink-0 ${getStatusBadgeClass(vehicle.status)}`}>
                        {getStatusIcon(vehicle.status)}
                        {vehicle.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] text-slate-400 block uppercase tracking-wider">Model / Type</span>
                        <span className="font-semibold text-slate-700 truncate block mt-0.5">
                          {vehicle.model || '—'}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[9px] text-slate-400 block uppercase tracking-wider">Accent Color</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-3.5 h-3.5 rounded-full border border-slate-200" style={{ backgroundColor: vehicle.color }} />
                          <span className="font-mono text-[10px] font-semibold text-slate-600 uppercase">{vehicle.color || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Capacity Progress */}
                  <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-medium">Occupancy Limit</span>
                      <span className="font-bold text-slate-700">{vehicle.student_count} / {vehicle.capacity} Seats</span>
                    </div>
                    <Progress value={filledPct} className="h-1.5" />
                  </div>

                  {/* Route, Driver, and Instructor details */}
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1.5 border-t border-slate-100">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Routes</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block mt-0.5" title={vehicle.route_names || undefined}>
                        {vehicle.route_names || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Assigned Driver</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block mt-0.5">
                        {vehicle.driver_name || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Instructor</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block mt-0.5">
                        {vehicle.instructor_name || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100/60 mt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(vehicle)}
                      className="h-8 w-8 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 border border-transparent hover:border-slate-200"
                      title="Edit vehicle details"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(vehicle)}
                      className="h-8 w-8 hover:bg-red-50 rounded-lg text-rose-500 hover:text-rose-700 border border-transparent hover:border-rose-100"
                      title="Remove from fleet"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? 'Edit Vehicle Details' : 'Register New Fleet Unit'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <DialogBody className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="vehicleName">Vehicle Name *</Label>
                <Input
                  id="vehicleName"
                  value={vehicleName}
                  onChange={e => setVehicleName(e.target.value)}
                  placeholder="e.g. Shuttle Bus A"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="plateNumber">Plate Number *</Label>
                  <Input
                    id="plateNumber"
                    value={plateNumber}
                    onChange={e => setPlateNumber(e.target.value)}
                    placeholder="e.g. GW-8821-23"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="capacity">Capacity (Seats) *</Label>
                  <Input
                    id="capacity"
                    type="number"
                    value={capacity}
                    onChange={e => setCapacity(e.target.value)}
                    placeholder="30"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="model">Model / Make</Label>
                <Input
                  id="model"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="e.g. Toyota Coaster 2022"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="vehicleColor">Accent Color</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="vehicleColor"
                      type="color"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="w-12 h-10 p-0 cursor-pointer rounded-lg overflow-hidden border-0"
                    />
                    <span className="font-mono text-xs font-bold uppercase">{color}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="status">Fleet Status</Label>
                  <Select value={status} onValueChange={setStatus as any}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="instructor">Assign Instructor (Teacher)</Label>
                <Select value={instructorId} onValueChange={setInstructorId}>
                  <SelectTrigger id="instructor">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {teachers.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.fullName || t.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DialogBody>

            <DialogFooter className="gap-2 bg-slate-50 p-4 border-t rounded-b-lg mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
                className="h-9 rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primaryAction"
                disabled={submitting}
                className="h-9 rounded-lg font-semibold"
              >
                {submitting ? 'Saving...' : editingVehicle ? 'Save Changes' : 'Register Vehicle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="h-5 w-5" /> Decommission Fleet Unit
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-2 py-2">
            <p className="text-sm text-slate-600">
              Are you sure you want to remove <span className="font-bold text-slate-800">"{vehicleToDelete?.vehicle_name}"</span> (Plate: {vehicleToDelete?.plate_number}) from active registry?
            </p>
            <p className="text-xs text-slate-400">
              This unit will be deleted. Any active routes that are currently assigned to this vehicle will be unassigned.
            </p>
          </DialogBody>
          <DialogFooter className="gap-2 bg-slate-50 p-4 border-t rounded-b-lg">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
              className="h-9 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="h-9 rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? 'Removing...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransportVehicles;
