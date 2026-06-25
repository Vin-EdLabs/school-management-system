import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  SubjectClassGroupedByClass,
  SubjectClassGroupedBySubject,
} from '@/types/teacherSubjectClass';
import { BookOpen, GraduationCap } from 'lucide-react';

type Props = {
  bySubject?: SubjectClassGroupedBySubject[];
  byClass?: SubjectClassGroupedByClass[];
  layout?: 'both' | 'by-class' | 'by-subject';
  emptyMessage?: string;
};

const TeacherSubjectClassDisplay: React.FC<Props> = ({
  bySubject = [],
  byClass = [],
  layout = 'both',
  emptyMessage = 'No subject-class assignments yet.',
}) => {
  const hasData = bySubject.length > 0 || byClass.length > 0;

  if (!hasData) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      {(layout === 'both' || layout === 'by-class') && byClass.length > 0 ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-600" />
              By class
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 space-y-3">
            {byClass.map((row) => (
              <div
                key={row.class_id}
                className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
              >
                <p className="text-sm font-semibold text-foreground">{row.class_name}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {row.subjects.map((s) => (
                    <Badge key={`${row.class_id}-${s.subject_id}`} variant="secondary">
                      {s.subject_name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {(layout === 'both' || layout === 'by-subject') && bySubject.length > 0 ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-600" />
              By subject
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 space-y-3">
            {bySubject.map((row) => (
              <div
                key={row.subject_id}
                className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
              >
                <p className="text-sm font-semibold text-foreground">{row.subject_name}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {row.classes.map((c) => (
                    <Badge key={`${row.subject_id}-${c.class_id}`} variant="outline">
                      {c.class_name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default TeacherSubjectClassDisplay;
