import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  BedDouble,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Users,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  detailDialogContentWideClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  boardingService,
  type BoardingBed,
  type BoardingDorm,
  type BoardingGender,
  type BoardingRoom,
} from '@/services/boardingService';
import BoardingDeleteConfirmDialog, {
  type BoardingDeleteConfirmState,
} from '@/components/boarding/BoardingDeleteConfirmDialog';

type PendingDelete =
  | { kind: 'dorm'; dorm: BoardingDorm }
  | { kind: 'room'; room: BoardingRoom }
  | { kind: 'bed'; bed: BoardingBed; roomId: number };

interface BoardingDormitoriesProps {
  onNavigate?: (module: string) => void;
}

export const BoardingDormitories: React.FC<BoardingDormitoriesProps> = () => {
  const [dorms, setDorms] = useState<BoardingDorm[]>([]);
  const [roomsByDorm, setRoomsByDorm] = useState<Record<number, BoardingRoom[]>>({});
  const [bedsByRoom, setBedsByRoom] = useState<Record<number, BoardingBed[]>>({});
  const [expandedDorms, setExpandedDorms] = useState<Set<number>>(new Set());
  const [expandedRooms, setExpandedRooms] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const [dormDialogOpen, setDormDialogOpen] = useState(false);
  const [editingDorm, setEditingDorm] = useState<BoardingDorm | null>(null);
  const [dormName, setDormName] = useState('');
  const [dormGender, setDormGender] = useState<BoardingGender | 'none'>('none');
  const [savingDorm, setSavingDorm] = useState(false);

  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [roomDormId, setRoomDormId] = useState<number | null>(null);
  const [editingRoom, setEditingRoom] = useState<BoardingRoom | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomCapacity, setRoomCapacity] = useState('4');
  const [savingRoom, setSavingRoom] = useState(false);

  const [bedDialogOpen, setBedDialogOpen] = useState(false);
  const [bedRoomId, setBedRoomId] = useState<number | null>(null);
  const [bedNumber, setBedNumber] = useState('');
  const [savingBed, setSavingBed] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<BoardingDeleteConfirmState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDorms = useCallback(async () => {
    setLoading(true);
    try {
      const list = await boardingService.listDorms();
      setDorms(Array.isArray(list) ? list : []);
    } catch (e) {
      toast({ title: 'Failed to load dormitories', description: (e as Error).message, variant: 'destructive' });
      setDorms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDorms();
  }, [loadDorms]);

  const loadRooms = async (dormId: number) => {
    try {
      const rooms = await boardingService.listRooms(dormId);
      setRoomsByDorm((prev) => ({ ...prev, [dormId]: Array.isArray(rooms) ? rooms : [] }));
    } catch {
      setRoomsByDorm((prev) => ({ ...prev, [dormId]: [] }));
    }
  };

  const loadBeds = async (roomId: number) => {
    try {
      const beds = await boardingService.listBeds(roomId);
      setBedsByRoom((prev) => ({ ...prev, [roomId]: Array.isArray(beds) ? beds : [] }));
    } catch {
      setBedsByRoom((prev) => ({ ...prev, [roomId]: [] }));
    }
  };

  const toggleDorm = async (dormId: number) => {
    setExpandedDorms((prev) => {
      const next = new Set(prev);
      if (next.has(dormId)) next.delete(dormId);
      else {
        next.add(dormId);
        void loadRooms(dormId);
      }
      return next;
    });
  };

  const toggleRoom = async (roomId: number) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else {
        next.add(roomId);
        void loadBeds(roomId);
      }
      return next;
    });
  };

  const openCreateDorm = () => {
    setEditingDorm(null);
    setDormName('');
    setDormGender('none');
    setDormDialogOpen(true);
  };

  const openEditDorm = (dorm: BoardingDorm) => {
    setEditingDorm(dorm);
    setDormName(dorm.name);
    setDormGender(dorm.gender ?? 'none');
    setDormDialogOpen(true);
  };

  const saveDorm = async () => {
    if (!dormName.trim()) {
      toast({ title: 'Dorm name required', variant: 'destructive' });
      return;
    }
    setSavingDorm(true);
    try {
      const gender = dormGender === 'none' ? null : dormGender;
      if (editingDorm) {
        await boardingService.updateDorm(editingDorm.id, { name: dormName.trim(), gender });
      } else {
        await boardingService.createDorm({ name: dormName.trim(), gender });
      }
      toast({ title: editingDorm ? 'Dorm updated' : 'Dorm created' });
      setDormDialogOpen(false);
      await loadDorms();
    } catch (e) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSavingDorm(false);
    }
  };

  const requestDeleteDorm = (dorm: BoardingDorm) => {
    setPendingDelete({ kind: 'dorm', dorm });
    setDeleteConfirm({
      title: 'Delete dormitory?',
      description: 'This permanently removes the dorm and all of its rooms and beds. Students must be reassigned first.',
      subjectLabel: 'Dormitory',
      subjectValue: dorm.name,
      confirmLabel: 'Yes, delete dorm',
      warning: 'This action cannot be undone.',
    });
  };

  const requestDeleteRoom = (room: BoardingRoom) => {
    setPendingDelete({ kind: 'room', room });
    setDeleteConfirm({
      title: 'Delete room?',
      description: 'This removes the room and all beds inside it. Occupied beds will block deletion.',
      subjectLabel: 'Room',
      subjectValue: room.room_name,
      confirmLabel: 'Yes, delete room',
    });
  };

  const requestDeleteBed = (bed: BoardingBed, roomId: number) => {
    if (bed.is_occupied) {
      toast({ title: 'Cannot delete occupied bed', variant: 'destructive' });
      return;
    }
    setPendingDelete({ kind: 'bed', bed, roomId });
    setDeleteConfirm({
      title: 'Remove bed?',
      description: 'This removes the bed from the room. You can add it again later if needed.',
      subjectLabel: 'Bed',
      subjectValue: bed.bed_number,
      confirmLabel: 'Yes, remove bed',
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === 'dorm') {
        await boardingService.deleteDorm(pendingDelete.dorm.id);
        toast({ title: 'Dorm deleted' });
        await loadDorms();
      } else if (pendingDelete.kind === 'room') {
        await boardingService.deleteRoom(pendingDelete.room.id);
        toast({ title: 'Room deleted' });
        await loadRooms(pendingDelete.room.dorm_id);
        await loadDorms();
      } else {
        await boardingService.deleteBed(pendingDelete.bed.id);
        toast({ title: 'Bed removed' });
        await loadBeds(pendingDelete.roomId);
      }
      setDeleteConfirm(null);
      setPendingDelete(null);
    } catch (e) {
      toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const openCreateRoom = (dormId: number) => {
    setRoomDormId(dormId);
    setEditingRoom(null);
    setRoomName('');
    setRoomCapacity('4');
    setRoomDialogOpen(true);
  };

  const openEditRoom = (room: BoardingRoom) => {
    setRoomDormId(room.dorm_id);
    setEditingRoom(room);
    setRoomName(room.room_name);
    setRoomCapacity(String(room.capacity));
    setRoomDialogOpen(true);
  };

  const saveRoom = async () => {
    if (!roomDormId || !roomName.trim()) {
      toast({ title: 'Room name required', variant: 'destructive' });
      return;
    }
    const capacity = parseInt(roomCapacity, 10);
    if (!Number.isFinite(capacity) || capacity < 1) {
      toast({ title: 'Invalid capacity', variant: 'destructive' });
      return;
    }
    setSavingRoom(true);
    try {
      if (editingRoom) {
        await boardingService.updateRoom(editingRoom.id, { room_name: roomName.trim(), capacity });
      } else {
        await boardingService.createRoom(roomDormId, { room_name: roomName.trim(), capacity });
      }
      toast({ title: editingRoom ? 'Room updated' : 'Room created' });
      setRoomDialogOpen(false);
      await loadRooms(roomDormId);
      await loadDorms();
    } catch (e) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSavingRoom(false);
    }
  };

  const openCreateBed = (roomId: number) => {
    setBedRoomId(roomId);
    setBedNumber('');
    setBedDialogOpen(true);
  };

  const saveBed = async () => {
    if (!bedRoomId || !bedNumber.trim()) {
      toast({ title: 'Bed number required', variant: 'destructive' });
      return;
    }
    setSavingBed(true);
    try {
      await boardingService.createBed(bedRoomId, { bed_number: bedNumber.trim() });
      toast({ title: 'Bed added' });
      setBedDialogOpen(false);
      await loadBeds(bedRoomId);
      const room = Object.values(roomsByDorm).flat().find((r) => r.id === bedRoomId);
      if (room) await loadRooms(room.dorm_id);
      await loadDorms();
    } catch (e) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSavingBed(false);
    }
  };

  const genderBadge = (gender: BoardingGender | null | undefined) => {
    if (gender === 'boys') return 'bg-sky-100 text-sky-800 border-0';
    if (gender === 'girls') return 'bg-pink-100 text-pink-800 border-0';
    return 'bg-slate-100 text-slate-600 border-0';
  };

  const totalStats = useMemo(() => {
    const totalBeds = dorms.reduce((s, d) => s + (d.total_beds ?? 0), 0);
    const occupied = dorms.reduce((s, d) => s + (d.occupied_beds ?? 0), 0);
    return { totalBeds, occupied, vacant: Math.max(0, totalBeds - occupied) };
  }, [dorms]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dormitories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage dorm blocks, rooms, and bed assignments. {totalStats.occupied}/{totalStats.totalBeds} beds occupied.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void loadDorms()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button type="button" variant="primaryAction" size="sm" className="rounded-xl" onClick={openCreateDorm}>
            <Plus className="h-4 w-4 mr-2" />
            Add dorm
          </Button>
        </div>
      </div>

      {loading && dorms.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading dormitories…</div>
      ) : dorms.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-600">No dormitories yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first dorm to start assigning beds.</p>
            <Button type="button" variant="primaryAction" size="sm" onClick={openCreateDorm}>
              <Plus className="h-4 w-4 mr-2" />
              Add dorm
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {dorms.map((dorm) => {
            const expanded = expandedDorms.has(dorm.id);
            const rooms = roomsByDorm[dorm.id] ?? [];
            return (
              <Card key={dorm.id} className="border-slate-200/80 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="flex items-start gap-2 text-left min-w-0 flex-1"
                      onClick={() => void toggleDorm(dorm.id)}
                    >
                      {expanded ? (
                        <ChevronDown className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{dorm.name}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          <Badge className={genderBadge(dorm.gender)}>{dorm.gender ?? 'Mixed'}</Badge>
                          <Badge variant="outline" className="text-[10px]">
                            <BedDouble className="h-3 w-3 mr-1" />
                            {dorm.occupied_beds ?? 0}/{dorm.total_beds ?? 0} beds
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {dorm.room_count ?? rooms.length} rooms
                          </Badge>
                        </div>
                      </div>
                    </button>
                    <div className="flex gap-1 shrink-0">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDorm(dorm)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => requestDeleteDorm(dorm)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expanded ? (
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rooms</p>
                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => openCreateRoom(dorm.id)}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add room
                      </Button>
                    </div>

                    {rooms.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-xl">No rooms in this dorm</p>
                    ) : (
                      rooms.map((room) => {
                        const roomExpanded = expandedRooms.has(room.id);
                        const beds = bedsByRoom[room.id] ?? room.beds ?? [];
                        return (
                          <div key={room.id} className="rounded-xl border border-slate-200/80 overflow-hidden">
                            <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50/80 dark:bg-slate-900/40">
                              <button type="button" className="flex items-center gap-2 min-w-0 text-left flex-1" onClick={() => void toggleRoom(room.id)}>
                                {roomExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                                <span className="font-semibold text-sm truncate">{room.room_name}</span>
                                <Badge variant="outline" className="text-[10px] shrink-0">
                                  cap {room.capacity}
                                </Badge>
                              </button>
                              <div className="flex gap-1 shrink-0">
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRoom(room)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => requestDeleteRoom(room)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            {roomExpanded ? (
                              <div className="p-3 space-y-2">
                                <div className="flex justify-between items-center">
                                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">Bed grid</p>
                                  <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] rounded-md" onClick={() => openCreateBed(room.id)}>
                                    <Plus className="h-3 w-3 mr-1" />
                                    Bed
                                  </Button>
                                </div>
                                {beds.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-3">No beds configured</p>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {beds.map((bed) => (
                                      <div
                                        key={bed.id}
                                        className={cn(
                                          'relative rounded-lg border p-2.5 text-center text-xs transition-colors',
                                          bed.is_occupied
                                            ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800'
                                            : 'border-slate-200 bg-white hover:border-emerald-200'
                                        )}
                                      >
                                        <BedDouble className="h-4 w-4 mx-auto mb-1 opacity-70" />
                                        <p className="font-bold">{bed.bed_number}</p>
                                        {bed.is_occupied ? (
                                          <p className="text-[10px] truncate mt-0.5 flex items-center justify-center gap-0.5">
                                            <Users className="h-3 w-3" />
                                            {bed.student_name || 'Occupied'}
                                          </p>
                                        ) : (
                                          <p className="text-[10px] text-muted-foreground mt-0.5">Vacant</p>
                                        )}
                                        {!bed.is_occupied ? (
                                          <button
                                            type="button"
                                            className="absolute top-1 right-1 text-red-400 hover:text-red-600"
                                            onClick={() => requestDeleteBed(bed, room.id)}
                                            aria-label="Remove bed"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dorm dialog */}
      <Dialog open={dormDialogOpen} onOpenChange={setDormDialogOpen}>
        <DialogContent className={detailDialogContentWideClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle>{editingDorm ? 'Edit dormitory' : 'New dormitory'}</DialogTitle>
          </DialogHeader>
          <DialogBody className={cn(detailDialogBodyClass, 'space-y-4')}>
            <div>
              <Label htmlFor="dorm-name">Name</Label>
              <Input id="dorm-name" value={dormName} onChange={(e) => setDormName(e.target.value)} className="mt-1 rounded-xl" placeholder="e.g. North Block" />
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={dormGender} onValueChange={(v) => setDormGender(v as BoardingGender | 'none')}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="boys">Boys</SelectItem>
                  <SelectItem value="girls">Girls</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => setDormDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void saveDorm()} disabled={savingDorm}>
              {savingDorm ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room dialog */}
      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent className={detailDialogContentWideClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle>{editingRoom ? 'Edit room' : 'New room'}</DialogTitle>
          </DialogHeader>
          <DialogBody className={cn(detailDialogBodyClass, 'space-y-4')}>
            <div>
              <Label htmlFor="room-name">Room name</Label>
              <Input id="room-name" value={roomName} onChange={(e) => setRoomName(e.target.value)} className="mt-1 rounded-xl" placeholder="e.g. A1" />
            </div>
            <div>
              <Label htmlFor="room-cap">Capacity</Label>
              <Input id="room-cap" type="number" min={1} value={roomCapacity} onChange={(e) => setRoomCapacity(e.target.value)} className="mt-1 rounded-xl" />
            </div>
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => setRoomDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void saveRoom()} disabled={savingRoom}>
              {savingRoom ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bed dialog */}
      <Dialog open={bedDialogOpen} onOpenChange={setBedDialogOpen}>
        <DialogContent className={detailDialogContentWideClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle>Add bed</DialogTitle>
          </DialogHeader>
          <DialogBody className={detailDialogBodyClass}>
            <Label htmlFor="bed-num">Bed number</Label>
            <Input id="bed-num" value={bedNumber} onChange={(e) => setBedNumber(e.target.value)} className="mt-1 rounded-xl" placeholder="e.g. 1, A, Top bunk" />
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => setBedDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void saveBed()} disabled={savingBed}>
              {savingBed ? 'Saving…' : 'Add bed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BoardingDeleteConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirm(null);
            setPendingDelete(null);
          }
        }}
        state={deleteConfirm}
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
};

export default BoardingDormitories;
