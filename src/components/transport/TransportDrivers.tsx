import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Edit2, Trash2, Search, Info, User, AlertCircle } from 'lucide-react';

interface TransportDriver {
  id: number;
  full_name: string;
  phone: string | null;
  license_number: string | null;
  email: string | null;
  notes: string | null;
  status: 'active' | 'inactive';
  vehicle_id?: string | null;
  vehicle_name?: string | null;
  plate_number?: string | null;
  route_names?: string | null;
  route_count?: number;
}

interface VehicleOption {
  id: string;
  vehicle_name: string;
  plate_number: string;
  status: string;
}

export const TransportDrivers: React.FC = () => {
  const [drivers, setDrivers] = useState<TransportDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [listSearch, setListSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<TransportDriver | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [vehicleId, setVehicleId] = useState('none');
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<TransportDriver | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const data = await apiService.get<TransportDriver[]>('/transport/drivers');
      setDrivers(data);
    } catch (err) {
      console.error('Failed to fetch drivers:', err);
      toast({ title: 'Error', description: 'Failed to load drivers.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDrivers();
    void (async () => {
      try {
        const data = await apiService.get<VehicleOption[]>('/transport/vehicles');
        setVehicles(data.filter(v => v.status === 'active'));
      } catch {
        /* optional */
      }
    })();
  }, []);

  const filteredDrivers = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter(
      d =>
        d.full_name.toLowerCase().includes(q) ||
        (d.phone && d.phone.toLowerCase().includes(q)) ||
        (d.license_number && d.license_number.toLowerCase().includes(q)) ||
        (d.route_names && d.route_names.toLowerCase().includes(q)) ||
        (d.vehicle_name && d.vehicle_name.toLowerCase().includes(q))
    );
  }, [drivers, listSearch]);

  const resetForm = () => {
    setFullName('');
    setPhone('');
    setLicenseNumber('');
    setEmail('');
    setNotes('');
    setStatus('active');
    setVehicleId('none');
  };

  const handleOpenAdd = () => {
    setEditingDriver(null);
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (driver: TransportDriver) => {
    setEditingDriver(driver);
    setFullName(driver.full_name);
    setPhone(driver.phone || '');
    setLicenseNumber(driver.license_number || '');
    setEmail(driver.email || '');
    setNotes(driver.notes || '');
    setStatus(driver.status);
    setVehicleId(driver.vehicle_id || 'none');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: 'Validation', description: 'Driver name is required.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        license_number: licenseNumber.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
        status,
        vehicle_id: vehicleId !== 'none' ? vehicleId : null,
      };

      if (editingDriver) {
        await apiService.put(`/transport/drivers/${editingDriver.id}`, payload);
        toast({ title: 'Driver updated', description: `${fullName.trim()} saved.` });
      } else {
        await apiService.post('/transport/drivers', payload);
        toast({ title: 'Driver added', description: `${fullName.trim()} is now available for route assignment.` });
      }

      setDialogOpen(false);
      setEditingDriver(null);
      resetForm();
      await loadDrivers();
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.message || 'Could not save driver.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!driverToDelete) return;
    setDeleting(true);
    try {
      await apiService.delete(`/transport/drivers/${driverToDelete.id}`);
      toast({ title: 'Driver removed', description: `${driverToDelete.full_name} deleted.` });
      setDeleteConfirmOpen(false);
      setDriverToDelete(null);
      await loadDrivers();
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.message || 'Could not delete driver.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-white">Drivers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Register bus drivers here. Assign them to routes under Transport → Routes.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search drivers..."
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
              className="pl-9 h-9 rounded-xl"
            />
          </div>
          <Button type="button" variant="primaryAction" size="sm" className="h-9 rounded-xl" onClick={handleOpenAdd}>
            <Plus className="h-4 w-4 mr-2" /> Add driver
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-start rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm text-indigo-950/80">
        <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
        <p>
          Add drivers and assign each one a bus. One bus can serve many routes but is counted once in the fleet.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-800 hover:bg-slate-800">
              <TableHead className="font-semibold text-white">Driver name</TableHead>
              <TableHead className="font-semibold text-white">Phone</TableHead>
              <TableHead className="font-semibold text-white">License</TableHead>
              <TableHead className="font-semibold text-white">Assigned bus</TableHead>
              <TableHead className="font-semibold text-white">Routes</TableHead>
              <TableHead className="font-semibold text-white">Status</TableHead>
              <TableHead className="font-semibold text-white text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(7)].map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full max-w-[120px]" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredDrivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-36 text-center">
                  <User className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    {drivers.length === 0 ? 'No drivers yet. Click Add driver to register your first driver.' : 'No drivers match your search.'}
                  </p>
                  {drivers.length === 0 && (
                    <Button type="button" variant="primaryAction" size="sm" className="mt-3 rounded-xl" onClick={handleOpenAdd}>
                      Add first driver
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredDrivers.map(driver => (
                <TableRow key={driver.id} className="hover:bg-slate-50/80 even:bg-slate-50/30">
                  <TableCell className="py-3">
                    <p className="text-sm font-semibold text-slate-900">{driver.full_name}</p>
                    {driver.email && <p className="text-[11px] text-slate-500">{driver.email}</p>}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{driver.phone || '—'}</TableCell>
                  <TableCell className="py-3 text-sm font-mono text-slate-600">{driver.license_number || '—'}</TableCell>
                  <TableCell className="py-3 text-sm">
                    {driver.vehicle_name ? (
                      <div>
                        <span className="font-medium text-slate-800">{driver.vehicle_name}</span>
                        {driver.plate_number && (
                          <span className="block text-[11px] font-mono text-slate-500">{driver.plate_number}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-xs">No bus</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-sm">
                    {driver.route_names ? (
                      <span className="font-medium text-slate-800" title={driver.route_names}>
                        {driver.route_count && driver.route_count > 1
                          ? `${driver.route_count} routes`
                          : driver.route_names}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-xs">Not assigned</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${driver.status === 'active' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-slate-500 border-slate-200'}`}
                    >
                      {driver.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0 rounded-lg" onClick={() => handleOpenEdit(driver)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0 rounded-lg text-rose-600 border-rose-200 hover:bg-rose-50"
                        onClick={() => { setDriverToDelete(driver); setDeleteConfirmOpen(true); }}
                      >
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

      <Dialog open={dialogOpen} onOpenChange={open => { if (!open && !submitting) { setDialogOpen(false); setEditingDriver(null); } }}>
        <DialogContent className="max-w-3xl w-full min-h-[calc(90vh-4rem)]">
          <DialogHeader>
            <DialogTitle>{editingDriver ? 'Edit driver' : 'Add driver'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <DialogBody className="space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="driverName">Full name *</Label>
                <Input id="driverName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Kwame Mensah" required />
              </div>
              <div className="space-y-2">
                <Label>Assigned bus</Label>
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger><SelectValue placeholder="No bus assigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No bus</SelectItem>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.vehicle_name} ({v.plate_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500">One bus per driver. The same bus can run on multiple routes.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverPhone">Phone</Label>
                <Input id="driverPhone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 024 123 4567" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverLicense">License number</Label>
                <Input id="driverLicense" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="Driving license ID" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverEmail">Email</Label>
                <Input id="driverEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverNotes">Notes</Label>
                <Input id="driverNotes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={v => setStatus(v as 'active' | 'inactive')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DialogBody>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" disabled={submitting} onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primaryAction" disabled={submitting}>
                {submitting ? 'Saving…' : editingDriver ? 'Save changes' : 'Add driver'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={open => { if (!open && !deleting) { setDeleteConfirmOpen(false); setDriverToDelete(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <AlertCircle className="h-5 w-5" /> Delete driver?
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-slate-600">
              Remove <strong>{driverToDelete?.full_name}</strong>? Any route using this driver will be unassigned.
            </p>
          </DialogBody>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransportDrivers;
