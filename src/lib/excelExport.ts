import ExcelJS from 'exceljs';
import { getISTYMD } from './dateUtils';
import { saveAs } from 'file-saver';
import { CASubject, TimetableSlot } from '../types';
import { parseSlotHours } from '../utils/timeUtils';

export interface ExportSummaryStats {
  targetHours?: number;
  progress?: number;
  daysLeft?: number;
}

/**
 * Helper to apply fill, font, alignment, and border styling across a range of cells in ExcelJS
 */
function styleCellRange(
  ws: ExcelJS.Worksheet,
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  options: {
    fillHex?: string;
    font?: Partial<ExcelJS.Font>;
    alignment?: Partial<ExcelJS.Alignment>;
    borderHex?: string;
    borderStyle?: ExcelJS.BorderStyle;
    doubleBottomBorder?: boolean;
    numFmt?: string;
  }
) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = ws.getCell(r, c);

      if (options.fillHex) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF' + options.fillHex.replace('#', '') }
        };
      }

      if (options.font) {
        cell.font = { ...cell.font, ...options.font };
      }

      if (options.alignment) {
        cell.alignment = { ...cell.alignment, ...options.alignment };
      }

      if (options.numFmt) {
        cell.numFmt = options.numFmt;
      }

      if (options.borderHex) {
        const borderHexClean = options.borderHex.replace('#', '');
        const style = options.borderStyle || 'thin';

        const borderDef: Partial<ExcelJS.Borders> = {
          top: { style, color: { argb: 'FF' + borderHexClean } },
          left: { style, color: { argb: 'FF' + borderHexClean } },
          bottom: options.doubleBottomBorder
            ? { style: 'double', color: { argb: 'FF' + borderHexClean } }
            : { style, color: { argb: 'FF' + borderHexClean } },
          right: { style, color: { argb: 'FF' + borderHexClean } }
        };

        cell.border = borderDef;
      }
    }
  }
}

/**
 * Primary Export Utility: Generates a highly stylized Executive Dashboard & Timetable Workbook
 */
export async function exportTimetableDashboardToExcel(
  timetableData: TimetableSlot[] = [],
  summaryStats?: ExportSummaryStats,
  subjects?: CASubject[],
  studyLogs?: any[]
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Piyaa CA Final Study Companion';
  wb.lastModifiedBy = 'Piyaa CA Final Study Companion';
  wb.created = new Date();

  // -------------------------------------------------------------------
  // SHEET 1: "Daily AI Timetable" (Executive Study Dashboard)
  // -------------------------------------------------------------------
  const ws = wb.addWorksheet('Daily AI Timetable', {
    views: [{ showGridLines: true }]
  });

  // Explicit Column Widths
  ws.columns = [
    { key: 'slotTime', width: 22 },
    { key: 'subject', width: 28 },
    { key: 'slotType', width: 18 },
    { key: 'topicDetails', width: 45 },
    { key: 'duration', width: 16 },
    { key: 'status', width: 16 },
    { key: 'category', width: 18 }
  ];

  // 1. Executive Title Block (Rows 1 & 2)
  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'CA FINAL DAILY STUDY PLAN & TIMETABLE DASHBOARD';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Dark Slate #1E293B
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  ws.mergeCells('A2:G2');
  const subTitleCell = ws.getCell('A2');
  const dateToday = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  subTitleCell.value = `Generated On: ${dateToday} | Target Exam: November 2026 | Powered by Piyaa Companion`;
  subTitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFCBD5E1' } };
  subTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' } // Deeper Dark Slate #0F172A
  };
  subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  // Calculate high level defaults for stats if not passed
  const totalChaptersCount = subjects?.reduce((sum, s) => sum + (s.topics?.length || 0), 0) || 120;
  const completedChaptersCount = subjects?.reduce((sum, s) => sum + (s.topics?.filter(t => t.completed)?.length || 0), 0) || 50;
  const computedProgress = totalChaptersCount > 0 ? Math.round((completedChaptersCount / totalChaptersCount) * 100) : 42;

  const examTargetDate = new Date('2026-11-01').getTime();
  const todayDate = new Date().getTime();
  const computedDaysLeft = Math.max(0, Math.ceil((examTargetDate - todayDate) / (1000 * 60 * 60 * 24)));

  const targetHoursVal = summaryStats?.targetHours ?? 8.0;
  const progressVal = summaryStats?.progress ?? computedProgress;
  const daysLeftVal = summaryStats?.daysLeft ?? computedDaysLeft;

  // 2. KPI Summary Cards (Rows 3 & 4)
  ws.getRow(3).height = 18;
  ws.getRow(4).height = 26;

  // Card 1: Target Study Hours (A3:B4)
  ws.mergeCells('A3:B3');
  ws.mergeCells('A4:B4');
  ws.getCell('A3').value = 'TARGET STUDY HOURS';
  ws.getCell('A4').value = `${targetHoursVal.toFixed(1)} Hrs`;

  // Card 2: Study Hours Achieved (C3:D4) - Using Excel SUMIF Formula
  const lastDataRow = timetableData.length > 0 ? 7 + timetableData.length : 8;
  ws.mergeCells('C3:D3');
  ws.mergeCells('C4:D4');
  ws.getCell('C3').value = 'STUDY HOURS ACHIEVED';
  
  // Compute initial fallback result for formula cell
  const initialStudySum = timetableData.reduce((acc, slot) => {
    const isBreak = slot.category === 'break' || slot.subject.toLowerCase().includes('break');
    return acc + (isBreak ? 0 : parseSlotHours(slot.time));
  }, 0);

  ws.getCell('C4').value = {
    formula: `SUMIF(C8:C${lastDataRow}, "STUDY", E8:E${lastDataRow})`,
    result: initialStudySum
  };

  // Card 3: Active Syllabus Progress (E3:F4)
  ws.mergeCells('E3:F3');
  ws.mergeCells('E4:F4');
  ws.getCell('E3').value = 'SYLLABUS PROGRESS';
  ws.getCell('E4').value = `${progressVal}%`;

  // Card 4: Days Left for Exam (G3:G4)
  ws.getCell('G3').value = 'DAYS TO EXAM';
  ws.getCell('G4').value = `${daysLeftVal} Days`;

  // Apply styling to KPI Label Rows (Row 3)
  styleCellRange(ws, 1, 3, 7, 3, {
    fillHex: 'F1F5F9', // Light Slate Gray
    font: { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF475569' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    borderHex: 'CBD5E1'
  });

  // Apply styling to KPI Value Rows (Row 4)
  styleCellRange(ws, 1, 4, 7, 4, {
    fillHex: 'F8FAFC',
    font: { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF065F46' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    borderHex: 'CBD5E1'
  });

  // Blank spacing row (Row 5 & 6)
  ws.getRow(5).height = 8;
  ws.getRow(6).height = 10;

  // 3. Timetable Schedule Table Headers (Row 7)
  const headers = [
    'Slot Time Range',
    'Subject / Activity',
    'Slot Type (STUDY/BREAK)',
    'Chapter & Topic Details',
    'Duration (Hrs)',
    'Status',
    'ABC Category'
  ];

  const headerRow = ws.getRow(7);
  headerRow.height = 28;
  headers.forEach((h, idx) => {
    headerRow.getCell(idx + 1).value = h;
  });

  styleCellRange(ws, 1, 7, 7, 7, {
    fillHex: '065F46', // Dark Emerald Green #065F46
    font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    borderHex: '044E3B',
    borderStyle: 'medium'
  });

  // 4. Timetable Data Rows (Rows 8 onwards)
  let currentRow = 8;
  timetableData.forEach((slot) => {
    const isBreak = slot.category === 'break' || slot.subject.toLowerCase().includes('break');
    const slotType = isBreak ? 'BREAK' : 'STUDY';
    const duration = parseSlotHours(slot.time);

    const row = ws.getRow(currentRow);
    row.height = 24;

    row.getCell(1).value = slot.time;
    row.getCell(2).value = slot.subject;
    row.getCell(3).value = slotType;
    row.getCell(4).value = slot.activity;
    row.getCell(5).value = duration;
    row.getCell(6).value = slot.completed ? '✅ Completed' : '⏳ Pending';
    row.getCell(7).value = slot.category ? slot.category.toUpperCase() : 'STANDARD';

    // Alignment
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

    // Format Duration column
    row.getCell(5).numFmt = '0.00';

    // Color Tints
    const bgHex = isBreak ? 'FFFBEB' : 'ECFDF5'; // Light Amber (#FFFBEB) vs Light Emerald (#ECFDF5)
    styleCellRange(ws, 1, currentRow, 7, currentRow, {
      fillHex: bgHex,
      font: { name: 'Calibri', size: 10, bold: slotType === 'STUDY' },
      borderHex: 'CBD5E1'
    });

    currentRow++;
  });

  // Handle case when timetableData is empty
  if (timetableData.length === 0) {
    const row = ws.getRow(currentRow);
    row.height = 24;
    row.getCell(1).value = '07:00 AM - 09:00 AM';
    row.getCell(2).value = 'FR - Financial Reporting';
    row.getCell(3).value = 'STUDY';
    row.getCell(4).value = 'Ind AS 115 Revenue & Revision';
    row.getCell(5).value = 2.0;
    row.getCell(6).value = '⏳ Pending';
    row.getCell(7).value = 'STUDY';
    
    styleCellRange(ws, 1, currentRow, 7, currentRow, {
      fillHex: 'ECFDF5',
      font: { name: 'Calibri', size: 10 },
      borderHex: 'CBD5E1'
    });
    currentRow++;
  }

  // 5. Auto-Calculated Summary Footer Row
  const footerRowIndex = currentRow;
  const footerRow = ws.getRow(footerRowIndex);
  footerRow.height = 26;

  footerRow.getCell(1).value = 'TOTALS & METRICS';
  footerRow.getCell(4).value = 'Total Scheduled Hours:';
  
  // Native Excel SUM formula
  footerRow.getCell(5).value = {
    formula: `SUM(E8:E${footerRowIndex - 1})`,
    result: timetableData.reduce((acc, slot) => acc + parseSlotHours(slot.time), 0)
  };

  styleCellRange(ws, 1, footerRowIndex, 7, footerRowIndex, {
    fillHex: 'F1F5F9',
    font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } },
    alignment: { vertical: 'middle' },
    borderHex: '0F172A',
    borderStyle: 'thin',
    doubleBottomBorder: true,
    numFmt: '0.00'
  });

  footerRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  footerRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
  footerRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };

  // 6. Enable Auto-Filter on Table Headers (Row 7)
  ws.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: 7, column: 7 }
  };

  // -------------------------------------------------------------------
  // SHEET 2: "📚 Detailed Syllabus Matrix" (If Subjects Provided)
  // -------------------------------------------------------------------
  if (subjects && subjects.length > 0) {
    const wsSyllabus = wb.addWorksheet('📚 Detailed Syllabus', {
      views: [{ showGridLines: true }]
    });

    wsSyllabus.columns = [
      { key: 'code', width: 14 },
      { key: 'name', width: 32 },
      { key: 'topic', width: 45 },
      { key: 'rev1', width: 14 },
      { key: 'rev2', width: 14 },
      { key: 'rev3', width: 14 },
      { key: 'ldr', width: 14 }
    ];

    wsSyllabus.mergeCells('A1:G1');
    const sTitle = wsSyllabus.getCell('A1');
    sTitle.value = 'CA FINAL FULL SYLLABUS & REVISION MATRIX';
    sTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    sTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    sTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    wsSyllabus.getRow(1).height = 28;

    const sHeaders = ['Subject Code', 'Subject Name', 'Chapter / Topic Title', 'Rev 1 (R1)', 'Rev 2 (R2)', 'Rev 3 (LDR)', 'LDR Star'];
    const sHeaderRow = wsSyllabus.getRow(3);
    sHeaderRow.height = 24;
    sHeaders.forEach((h, i) => { sHeaderRow.getCell(i + 1).value = h; });

    styleCellRange(wsSyllabus, 1, 3, 7, 3, {
      fillHex: '1E293B',
      font: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      borderHex: '0F172A'
    });

    let sRow = 4;
    subjects.forEach(subj => {
      subj.topics?.forEach(topic => {
        const r = wsSyllabus.getRow(sRow);
        r.height = 20;
        r.getCell(1).value = subj.code;
        r.getCell(2).value = subj.name;
        r.getCell(3).value = topic.title;
        r.getCell(4).value = topic.rev1 ? '✅ Done' : '⏳ Pending';
        r.getCell(5).value = topic.rev2 ? '✅ Done' : '-';
        r.getCell(6).value = topic.rev3 ? '✅ Done' : '-';
        r.getCell(7).value = topic.ldr ? '★ Starred' : '-';

        styleCellRange(wsSyllabus, 1, sRow, 7, sRow, {
          fillHex: topic.rev1 ? 'F0FDF4' : 'FFFFFF',
          font: { name: 'Calibri', size: 10 },
          borderHex: 'E2E8F0'
        });
        sRow++;
      });
    });

    wsSyllabus.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 7 } };
  }

  // -------------------------------------------------------------------
  // GENERATE AND SAVE EXCEL WORKBOOK
  // -------------------------------------------------------------------
  const buffer = await wb.xlsx.writeBuffer();
  const dateStr = getISTYMD();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `CA_Final_Study_Dashboard_${dateStr}.xlsx`);
}

/**
 * Backward compatibility wrapper so existing Header calls work seamlessly
 */
export function exportToExcel(subjects: CASubject[], timetable: TimetableSlot[], studyLogs: any[] = []) {
  const totalChapters = subjects.reduce((sum, s) => sum + (s.topics?.length || 0), 0);
  const rev1Chapters = subjects.reduce((sum, s) => sum + (s.topics?.filter(t => t.rev1)?.length || 0), 0);
  const progressPercent = totalChapters > 0 ? Math.round((rev1Chapters / totalChapters) * 100) : 42;

  exportTimetableDashboardToExcel(
    timetable,
    { targetHours: 8.0, progress: progressPercent, daysLeft: 88 },
    subjects,
    studyLogs
  );
}
