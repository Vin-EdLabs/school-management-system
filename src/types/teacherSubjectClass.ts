export type SubjectClassPairPayload = {
  subject_id: number;
  class_id: number;
};

export type SubjectClassGroupedBySubject = {
  subject_id: number;
  subject_name: string;
  classes: Array<{ class_id: number; class_name: string }>;
};

export type SubjectClassGroupedByClass = {
  class_id: number;
  class_name: string;
  subjects: Array<{ subject_id: number; subject_name: string }>;
};

export type TeacherSubjectClassesResponse = {
  by_subject: SubjectClassGroupedBySubject[];
  by_class: SubjectClassGroupedByClass[];
  pairs: Array<{
    subject_id: number;
    subject_name: string;
    class_id: number;
    class_name: string;
  }>;
};

/** subjectId -> list of classIds assigned for that subject */
export type SubjectClassMap = Record<string, string[]>;

export function groupedToSubjectClassMap(
  grouped: TeacherSubjectClassesResponse | null | undefined
): { selectedSubjectIds: string[]; subjectClassMap: SubjectClassMap } {
  const subjectClassMap: SubjectClassMap = {};
  const selectedSubjectIds: string[] = [];

  for (const row of grouped?.by_subject || []) {
    const sid = String(row.subject_id);
    selectedSubjectIds.push(sid);
    subjectClassMap[sid] = row.classes.map((c) => String(c.class_id));
  }

  return { selectedSubjectIds, subjectClassMap };
}

export function flattenSubjectClassMap(subjectClassMap: SubjectClassMap): SubjectClassPairPayload[] {
  const out: SubjectClassPairPayload[] = [];
  const seen = new Set<string>();

  for (const [subjectId, classIds] of Object.entries(subjectClassMap)) {
    const sid = parseInt(subjectId, 10);
    if (!Number.isFinite(sid)) continue;
    for (const classId of classIds) {
      if (!classId) continue;
      const cid = parseInt(classId, 10);
      if (!Number.isFinite(cid)) continue;
      const key = `${sid}:${cid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ subject_id: sid, class_id: cid });
    }
  }
  return out;
}

export function deriveSubjectNamesFromMap(
  subjectClassMap: SubjectClassMap,
  subjects: Array<{ id: string; name: string }>
): string[] {
  const names = Object.keys(subjectClassMap)
    .map((id) => subjects.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}
