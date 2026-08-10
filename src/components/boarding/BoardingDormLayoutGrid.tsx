import React from 'react';
import { BedDouble, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DormLayoutSection } from '@/services/boardingService';
import { cn } from '@/lib/utils';

function formatGhs(n: number) {
  return `GHS ${Number(n || 0).toFixed(0)}`;
}

function DormColumn({ title, iconClass, sections }: { title: string; iconClass: string; sections: DormLayoutSection[] }) {
  return (
    <div className="space-y-4">
      <h3 className={cn('text-sm font-bold uppercase tracking-wider flex items-center gap-2', iconClass)}>
        {title}
      </h3>
      {sections.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-xl border border-dashed p-6 text-center">No dormitories configured.</p>
      ) : (
        sections.map((dorm) => (
          <Card key={dorm.dorm_id} className="rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b">
              <CardTitle className="text-sm">{dorm.dorm_name}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              {dorm.rooms.map((room) => (
                <div key={room.id}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{room.room_name}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {room.beds.map((bed) => (
                      <div
                        key={bed.id}
                        className={cn(
                          'rounded-xl border p-2.5 text-xs flex gap-2 min-h-[72px]',
                          bed.student
                            ? 'bg-card dark:bg-card border-border'
                            : 'bg-muted/40 border-dashed dark:bg-muted/20'
                        )}
                      >
                        <div className="shrink-0">
                          {bed.student?.passport_photo_url ? (
                            <img src={bed.student.passport_photo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                              {bed.student ? <User className="h-4 w-4 text-slate-400" /> : <BedDouble className="h-4 w-4 text-slate-300" />}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">Bed {bed.bed_number}</p>
                          {bed.student ? (
                            <>
                              <p className="truncate">{bed.student.first_name} {bed.student.last_name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{bed.student.class_name || '—'}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {bed.student.on_exeat ? <Badge className="text-[9px] h-4 px-1 bg-sky-100 text-sky-800 border-0">Exeat</Badge> : null}
                                {bed.student.in_sick_bay ? <Badge className="text-[9px] h-4 px-1 bg-violet-100 text-violet-800 border-0">Sick bay</Badge> : null}
                                {bed.student.outstanding > 0 ? <Badge className="text-[9px] h-4 px-1 bg-amber-100 text-amber-800 border-0">{formatGhs(bed.student.outstanding)}</Badge> : null}
                              </div>
                            </>
                          ) : (
                            <p className="text-muted-foreground italic">Vacant</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

export const BoardingDormLayoutGrid: React.FC<{
  layout?: { boys: DormLayoutSection[]; girls: DormLayoutSection[] };
}> = ({ layout }) => {
  if (!layout) return null;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <DormColumn title="Boys dormitory" iconClass="text-blue-700 dark:text-blue-300" sections={layout.boys} />
      <DormColumn title="Girls dormitory" iconClass="text-rose-700 dark:text-rose-300" sections={layout.girls} />
    </div>
  );
};

export default BoardingDormLayoutGrid;
