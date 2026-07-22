import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useData } from '@/contexts/DataContext';
import ClassTimetableBuilder from './ClassTimetableBuilder';
import { classDisplayName, timetableNativeSelectClass } from './timetableUtils';
import ExamTimetableView from './ExamTimetableView';

export default function TimetableOverview({ readOnly = true }: { readOnly?: boolean }) {
  const { classes } = useData();
  const [classId, setClassId] = useState(String(classes[0]?.id || ''));

  return (
    <Tabs defaultValue="class">
      <TabsList>
        <TabsTrigger value="class">All classes — class timetable</TabsTrigger>
        <TabsTrigger value="exam">All classes — exam timetable</TabsTrigger>
      </TabsList>
      <TabsContent value="class" className="mt-4 space-y-4">
        <div className="max-w-sm">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Switch class</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={timetableNativeSelectClass}>
            {classes.map((c) => <option key={c.id} value={c.id}>{classDisplayName(c)}</option>)}
          </select>
        </div>
        {classId ? (
          <ClassTimetableBuilder
            canEdit={!readOnly}
            readOnly={readOnly}
            fixedClassId={parseInt(classId, 10)}
          />
        ) : null}
      </TabsContent>
      <TabsContent value="exam" className="mt-4">
        <ExamTimetableView canEdit={!readOnly} readOnly={readOnly} showClassFilter groupAllClasses />
      </TabsContent>
    </Tabs>
  );
}
