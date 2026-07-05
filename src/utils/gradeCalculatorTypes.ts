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
