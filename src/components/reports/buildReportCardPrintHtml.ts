import type { TermReportStudent } from './termReportTypes';

export type ReportCardPrintInput = {
  schoolName: string;
  schoolLogoUrl?: string;
  className: string;
  currentTerm: string;
  currentYear: string;
  student: TermReportStudent;
  studentPhotoUrl?: string;
  totalStudents: number;
  subjects: string[];
  termReportStudents: TermReportStudent[];
  conduct: string;
  attitude: string;
  interest: string;
  attendance: string;
  attendanceOutOf: string;
  promotedTo: string;
  reopeningDate: string;
  teacherRemark: string;
  headmasterRemark: string;
  headmasterTitle?: string;
  classTeacherSig?: string;
  headTeacherSig?: string;
};

const positionSuffix = (n: number) =>
  n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;

const getGhanaianGradeInfo = (score: number) => {
  if (score >= 80) return { grade: 'A', remark: 'Excellent' };
  if (score >= 70) return { grade: 'B', remark: 'Very Good' };
  if (score >= 60) return { grade: 'C', remark: 'Good' };
  if (score >= 45) return { grade: 'D', remark: 'Credit' };
  if (score >= 35) return { grade: 'E', remark: 'Pass' };
  return { grade: 'F', remark: 'Fail' };
};

const getBECEGradeInfo = (score: number) => {
  if (score >= 80) return 1;
  if (score >= 70) return 2;
  if (score >= 60) return 3;
  if (score >= 45) return 4;
  if (score >= 40) return 5;
  if (score >= 35) return 6;
  if (score >= 30) return 7;
  if (score >= 25) return 8;
  return 9;
};

const calculateBECE = (subjectScores: Record<string, { score: number }>) => {
  const cores = { english: 9, science: 9, maths: 9, social: 9 };
  const electives: number[] = [];

  Object.entries(subjectScores || {}).forEach(([subj, info]) => {
    const sName = subj.toLowerCase();
    const g = getBECEGradeInfo(info?.score || 0);
    if (sName.includes('english')) cores.english = g;
    else if (sName.includes('science')) cores.science = g;
    else if (sName.includes('math')) cores.maths = g;
    else if (sName.includes('social')) cores.social = g;
    else electives.push(g);
  });

  electives.sort((a, b) => a - b);
  const bestElectives = electives.slice(0, 2);
  while (bestElectives.length < 2) bestElectives.push(9);

  return {
    cores,
    bestElectives,
    aggregate: cores.english + cores.science + cores.maths + cores.social + bestElectives.reduce((s, v) => s + v, 0),
  };
};

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fieldRow = (label: string, value: string) => `
  <div style="display:flex;align-items:center;margin-bottom:6px;font-size:11px;">
    <span style="font-weight:bold;min-width:130px;text-transform:uppercase;">${esc(label)}</span>
    <span style="flex:1;border-bottom:1px solid #000;font-weight:800;padding-left:8px;text-transform:uppercase;">${esc(value || '—')}</span>
  </div>`;

export function buildReportCardPrintHtml(input: ReportCardPrintInput): string {
  const { student, subjects, termReportStudents } = input;
  const bece = calculateBECE(student.subjectScores);

  const subjectRows = subjects.map((subj) => {
    const sScore = student.subjectScores[subj];
    const gr = sScore ? getGhanaianGradeInfo(sScore.score) : { grade: '', remark: '—' };
    const sortedList = [...termReportStudents].sort(
      (a, b) => (b.subjectScores[subj]?.score || 0) - (a.subjectScores[subj]?.score || 0)
    );
    let subPos = 1;
    for (let i = 0; i < sortedList.length; i++) {
      if (sortedList[i].studentId === student.studentId) break;
      if ((sortedList[i].subjectScores[subj]?.score || 0) > (sScore?.score || 0)) subPos++;
    }
    return `
      <tr>
        <td style="border:2px solid #000;padding:6px;font-weight:bold;text-align:left;text-transform:uppercase;">${esc(subj)}</td>
        <td style="border:2px solid #000;padding:6px;font-weight:bold;text-align:center;">${sScore ? sScore.classScore?.toFixed(1) : '—'}</td>
        <td style="border:2px solid #000;padding:6px;font-weight:bold;text-align:center;">${sScore ? sScore.examScore?.toFixed(1) : '—'}</td>
        <td style="border:2px solid #000;padding:6px;font-weight:800;text-align:center;">${sScore ? sScore.score?.toFixed(1) : '—'}</td>
        <td style="border:2px solid #000;padding:6px;font-weight:bold;text-align:center;">${gr.grade}</td>
        <td style="border:2px solid #000;padding:6px;font-weight:bold;text-align:center;">${sScore ? positionSuffix(subPos) : '—'}</td>
        <td style="border:2px solid #000;padding:6px;font-weight:bold;text-align:left;font-size:9px;text-transform:uppercase;">${esc(gr.remark)}</td>
      </tr>`;
  }).join('');

  const logoImg = input.schoolLogoUrl
    ? `<img src="${esc(input.schoolLogoUrl)}" alt="Logo" style="width:76px;height:76px;object-fit:contain;" />`
    : `<div style="width:76px;height:76px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;color:#94a3b8;">LOGO</div>`;

  const photoImg = input.studentPhotoUrl
    ? `<img src="${esc(input.studentPhotoUrl)}" alt="Student" style="width:76px;height:92px;object-fit:cover;" />`
    : `<div style="width:76px;height:92px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;color:#94a3b8;">PHOTO</div>`;

  const teacherSig = input.classTeacherSig
    ? `<img src="${esc(input.classTeacherSig)}" alt="Teacher signature" style="height:44px;object-fit:contain;" />`
    : '';
  const headSig = input.headTeacherSig
    ? `<img src="${esc(input.headTeacherSig)}" alt="Head signature" style="height:44px;object-fit:contain;" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Terminal Report - ${esc(student.firstName)} ${esc(student.lastName)}</title>
  <style>
    @page { margin: 8mm; size: A4 portrait; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: 'Times New Roman', Times, serif;
      color: #000;
      background: #fff;
      font-size: 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .card {
      max-width: 760px;
      margin: 0 auto;
      border: 2px solid #000;
      padding: 20px 24px;
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      border: 2px solid #000;
      background: #f8fafc;
      padding: 6px;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="card">
    <table style="margin-bottom:12px;">
      <tr>
        <td style="width:80px;vertical-align:middle;border:none;padding:0;">
          <div style="width:80px;height:80px;border:2px solid #000;overflow:hidden;display:flex;align-items:center;justify-content:center;">${logoImg}</div>
        </td>
        <td style="text-align:center;vertical-align:middle;border:none;padding:0 12px;">
          <h1 style="margin:0;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;">${esc(input.schoolName)}</h1>
        </td>
        <td style="width:80px;vertical-align:middle;text-align:right;border:none;padding:0;">
          <div style="width:80px;height:96px;border:2px solid #000;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;">${photoImg}</div>
        </td>
      </tr>
    </table>

    <div style="border:2px solid #000;text-align:center;font-weight:bold;text-transform:uppercase;letter-spacing:3px;padding:4px 24px;margin:8px auto 16px;max-width:280px;font-size:13px;">
      Terminal Report Sheet
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-bottom:14px;">
      ${fieldRow('Name:', `${student.firstName} ${student.lastName}`)}
      ${fieldRow('Basic:', input.className)}
      ${fieldRow('Academic Year:', input.currentYear)}
      ${fieldRow('Term:', input.currentTerm)}
      ${fieldRow('Position:', positionSuffix(student.position))}
      ${fieldRow('Total Marks:', String(student.grandTotal))}
      ${fieldRow('No. On Roll:', String(input.totalStudents))}
      ${fieldRow('Reopening Date:', input.reopeningDate)}
    </div>

    <table style="margin-bottom:14px;font-size:11px;">
      <thead>
        <tr>
          <th style="text-align:left;width:28%;">Subjects</th>
          <th>Class Score<br/>40%</th>
          <th>Exams Score<br/>60%</th>
          <th>Total Score<br/>100%</th>
          <th>Grade</th>
          <th>Position</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>${subjectRows}</tbody>
    </table>

    <div style="font-size:11px;margin-bottom:12px;">
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:6px;">
        <span style="font-weight:bold;text-transform:uppercase;min-width:100px;">Attendance:</span>
        <span style="border-bottom:1px solid #000;font-weight:bold;min-width:40px;text-align:center;padding:0 6px;">${esc(input.attendance || '—')}</span>
        <span style="font-weight:bold;text-transform:uppercase;">Out of:</span>
        <span style="border-bottom:1px solid #000;font-weight:bold;min-width:40px;text-align:center;padding:0 6px;">${esc(input.attendanceOutOf || '—')}</span>
        <span style="font-weight:bold;text-transform:uppercase;">Promoted to:</span>
        <span style="border-bottom:1px solid #000;font-weight:bold;flex:1;text-transform:uppercase;padding-left:6px;">${esc(input.promotedTo || '—')}</span>
      </div>
      ${fieldRow('Conduct:', input.conduct)}
      ${fieldRow('Attitude:', input.attitude)}
      ${fieldRow('Interest:', input.interest)}
      <div style="display:flex;align-items:flex-start;margin-bottom:6px;">
        <span style="font-weight:bold;text-transform:uppercase;min-width:180px;padding-top:2px;">Class Teacher's Remarks:</span>
        <span style="flex:1;border-bottom:1px solid #000;font-weight:bold;padding-left:8px;text-transform:uppercase;min-height:28px;">${esc(input.teacherRemark || '—')}</span>
      </div>
      <div style="display:flex;align-items:flex-start;">
        <span style="font-weight:bold;text-transform:uppercase;min-width:180px;padding-top:2px;">Headmaster's Remarks:</span>
        <span style="flex:1;border-bottom:1px solid #000;font-weight:bold;padding-left:8px;text-transform:uppercase;min-height:28px;">${esc(input.headmasterRemark || '—')}</span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:36px;text-align:center;font-size:10px;">
      <div>
        <div style="min-height:48px;display:flex;align-items:flex-end;justify-content:center;">${teacherSig}</div>
        <div style="border-top:1px solid #000;padding-top:4px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Class Teacher's Signature</div>
      </div>
      <div>
        <div style="min-height:48px;display:flex;align-items:flex-end;justify-content:center;">${headSig}</div>
        <div style="border-top:1px solid #000;padding-top:4px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">${esc(input.headmasterTitle || 'Headmaster')}'s Signature</div>
      </div>
    </div>

    <div style="border-top:1px solid #000;margin-top:16px;padding-top:10px;font-size:9px;">
      <p style="font-weight:800;text-align:center;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Grading Scale</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-weight:bold;">
        <div>Grade A — 80-100 — <em>Excellent</em></div>
        <div>Grade B — 70-79 — <em>Very Good</em></div>
        <div>Grade C — 60-69 — <em>Good</em></div>
        <div>Grade D — 45-59 — <em>Credit</em></div>
        <div>Grade E — 35-44 — <em>Pass</em></div>
        <div>Grade F — Below 35 — <em>Fail</em></div>
      </div>
    </div>

    <div style="border-top:1px solid #000;margin-top:12px;padding-top:10px;font-size:10px;">
      <p style="font-weight:800;text-align:center;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">BECE Aggregate Calculation</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <p style="font-weight:bold;text-decoration:underline;margin:0 0 4px;">Core Subjects:</p>
          <div>English — Grade ${bece.cores.english}</div>
          <div>Science — Grade ${bece.cores.science}</div>
          <div>Maths — Grade ${bece.cores.maths}</div>
          <div>Social — Grade ${bece.cores.social}</div>
        </div>
        <div>
          <p style="font-weight:bold;text-decoration:underline;margin:0 0 4px;">Best 2 Electives:</p>
          <div>Elective 1 — Grade ${bece.bestElectives[0]}</div>
          <div>Elective 2 — Grade ${bece.bestElectives[1]}</div>
        </div>
      </div>
      <p style="text-align:center;font-weight:800;text-transform:uppercase;margin:10px 0 0;">Aggregate: ${bece.aggregate}</p>
    </div>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
</body>
</html>`;
}

export function openReportCardPrintWindow(html: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
