export interface AssessmentScore {
  assessmentId: number;
  componentId: number | null;
  isExam: boolean;
  maxMarks: number;
  rawScore: number;
}

export interface GradeConfigComponent {
  id: number;
  name: string;
  weightInClassScore: number;
}

export interface GradeConfig {
  classScoreWeight: number;
  examWeight: number;
  components: GradeConfigComponent[];
  boundaries: { gradeLabel: string; minPercent: number; maxPercent: number; remark: string }[];
}

export interface GradeResult {
  classScorePercent: number;
  examPercent: number;
  totalPercent: number;
  gradeLabel: string;
  remark: string;
}

export function calculateGrade(scores: AssessmentScore[], config: GradeConfig): GradeResult {
  const examScores = scores.filter((s) => s.isExam);
  const componentScores = scores.filter((s) => !s.isExam && s.componentId !== null);

  let examPercent = 0;
  if (examScores.length > 0) {
    const examFraction =
      examScores.reduce((sum, s) => sum + (s.maxMarks > 0 ? s.rawScore / s.maxMarks : 0), 0) /
      examScores.length;
    examPercent = examFraction * config.examWeight;
  }

  let classScorePercent = 0;
  const totalComponentWeights = config.components.reduce(
    (sum, c) => sum + (Number(c.weightInClassScore) > 0 ? Number(c.weightInClassScore) : 0),
    0
  );
  if (totalComponentWeights > 0) {
    for (const component of config.components) {
      const instancesForComponent = componentScores.filter((s) => s.componentId === component.id);
      if (instancesForComponent.length === 0) continue;
      const avgFraction =
        instancesForComponent.reduce(
          (sum, s) => sum + (s.maxMarks > 0 ? s.rawScore / s.maxMarks : 0),
          0
        ) / instancesForComponent.length;
      const share = Number(component.weightInClassScore) / totalComponentWeights;
      classScorePercent += avgFraction * share * config.classScoreWeight;
    }
  }

  const totalPercent = Math.round((classScorePercent + examPercent) * 100) / 100;

  const boundary = [...config.boundaries]
    .sort((a, b) => b.minPercent - a.minPercent)
    .find((b) => totalPercent >= b.minPercent && totalPercent <= b.maxPercent);

  return {
    classScorePercent: Math.round(classScorePercent * 100) / 100,
    examPercent: Math.round(examPercent * 100) / 100,
    totalPercent,
    gradeLabel: boundary?.gradeLabel ?? 'F9',
    remark: boundary?.remark ?? 'Fail',
  };
}

export function calculatePositions(
  studentResults: { studentId: number; totalPercent: number }[]
): Map<number, number> {
  const sorted = [...studentResults].sort((a, b) => b.totalPercent - a.totalPercent);
  const positionMap = new Map<number, number>();
  sorted.forEach((r, index) => {
    if (index > 0 && sorted[index - 1].totalPercent === r.totalPercent) {
      positionMap.set(r.studentId, positionMap.get(sorted[index - 1].studentId)!);
    } else {
      positionMap.set(r.studentId, index + 1);
    }
  });
  return positionMap;
}
