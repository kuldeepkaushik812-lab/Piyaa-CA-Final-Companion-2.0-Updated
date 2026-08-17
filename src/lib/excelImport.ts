import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { TimetableSlot, SlotStatus } from '../types';
import { parseSlotHours, parseTimeToMinutes, formatMinutesToTimeStr, enforceNonOverlappingSlots, sanitizeAndMergeConsecutiveBreaks } from '../utils/timeUtils';
import { getISTYMD, addDaysToYMD, getISTDate } from './dateUtils';

export interface ParsedDaySchedule {
  dateStr: string;
  dayName?: string;
  slots: TimetableSlot[];
  totalStudyHours: number;
  totalBreakHours: number;
  warnings: string[];
}

export interface ParsedImportResult {
  days: Record<string, ParsedDaySchedule>;
  totalDatesCount: number;
  totalSlotsCount: number;
  totalStudyHours: number;
  totalBreakHours: number;
  globalWarnings: string[];
  sampleDates: string[];
}

/**
 * Standard Cell Styling Helper for ExcelJS Template Generation
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
 * Generates and downloads a Day Timetable Excel Template (.xlsx)
 */
export async function downloadDayTimetableTemplate(targetDateStr?: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Piyaa CA Final Study Companion';
  wb.created = new Date();

  const ws = wb.addWorksheet('Custom Day Timetable', { views: [{ showGridLines: true }] });
  const dateStr = targetDateStr || getISTYMD();

  ws.columns = [
    { key: 'date', width: 16 },
    { key: 'time', width: 24 },
    { key: 'subject', width: 28 },
    { key: 'activity', width: 44 },
    { key: 'category', width: 16 },
    { key: 'duration', width: 16 },
    { key: 'status', width: 16 }
  ];

  // Header Title Block
  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'CA FINAL CUSTOM 1-DAY TIMETABLE TEMPLATE';
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:G2');
  const subCell = ws.getCell('A2');
  subCell.value = `Target Date: ${dateStr} | Fill in your slots and upload via 'Import Excel' in the App`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFCBD5E1' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  // Table Headers
  const headers = ['Date (YYYY-MM-DD)', 'Time Range (e.g. 07:00 AM - 09:30 AM)', 'Subject / Paper', 'Chapter & Topic Details', 'Category (STUDY/BREAK)', 'Duration (Hrs)', 'Status'];
  const hRow = ws.getRow(4);
  hRow.height = 26;
  headers.forEach((h, i) => { hRow.getCell(i + 1).value = h; });

  styleCellRange(ws, 1, 4, 7, 4, {
    fillHex: '0F172A',
    font: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    borderHex: '334155'
  });

  // Sample Day Slots
  const sampleSlots = [
    { time: '06:30 AM - 07:00 AM', subject: 'Morning Routine', activity: 'Meditation, Hydration & Daily Plan', category: 'BREAK', duration: 0.5, status: 'PENDING' },
    { time: '07:00 AM - 09:30 AM', subject: 'Financial Reporting (FR)', activity: 'Ind AS 115 Revenue & Question Bank', category: 'STUDY', duration: 2.5, status: 'PENDING' },
    { time: '09:30 AM - 10:00 AM', subject: 'Breakfast Break', activity: 'Healthy Meal & Short Walk', category: 'BREAK', duration: 0.5, status: 'PENDING' },
    { time: '10:00 AM - 01:00 PM', subject: 'Advanced Financial Management (AFM)', activity: 'Portfolio Management & Forex Derivatives', category: 'STUDY', duration: 3.0, status: 'PENDING' },
    { time: '01:00 PM - 02:00 PM', subject: 'Lunch & Power Nap', activity: 'Lunch Break + 20min Quick Recharge', category: 'BREAK', duration: 1.0, status: 'PENDING' },
    { time: '02:00 PM - 05:00 PM', subject: 'Direct Tax Laws (DT)', activity: 'Corporate Taxation & Transfer Pricing', category: 'STUDY', duration: 3.0, status: 'PENDING' },
    { time: '05:00 PM - 05:30 PM', subject: 'Evening Tea Break', activity: 'Snack & Stretch', category: 'BREAK', duration: 0.5, status: 'PENDING' },
    { time: '05:30 PM - 08:30 PM', subject: 'Advanced Auditing (Audit)', activity: 'SA 200 Series & Professional Ethics Revision', category: 'STUDY', duration: 3.0, status: 'PENDING' },
    { time: '08:30 PM - 09:30 PM', subject: 'Dinner Break', activity: 'Dinner & Family Time', category: 'BREAK', duration: 1.0, status: 'PENDING' },
    { time: '09:30 PM - 11:00 PM', subject: 'Indirect Tax (IDT)', activity: 'Input Tax Credit (ITC) Rules & Case Studies', category: 'STUDY', duration: 1.5, status: 'PENDING' },
  ];

  let rIdx = 5;
  sampleSlots.forEach(s => {
    const row = ws.getRow(rIdx);
    row.height = 22;
    row.getCell(1).value = dateStr;
    row.getCell(2).value = s.time;
    row.getCell(3).value = s.subject;
    row.getCell(4).value = s.activity;
    row.getCell(5).value = s.category;
    row.getCell(6).value = s.duration;
    row.getCell(7).value = s.status;

    const isBreak = s.category === 'BREAK';
    styleCellRange(ws, 1, rIdx, 7, rIdx, {
      fillHex: isBreak ? 'FFFBEB' : 'F0FDF4',
      font: { name: 'Calibri', size: 10, bold: !isBreak },
      borderHex: 'CBD5E1'
    });
    rIdx++;
  });

  // Footer Totals Row
  const footerRow = ws.getRow(rIdx);
  footerRow.height = 24;
  footerRow.getCell(1).value = 'TOTALS';
  footerRow.getCell(4).value = 'Total Scheduled Study Hours:';
  footerRow.getCell(6).value = {
    formula: `SUMIF(E5:E${rIdx - 1}, "STUDY", F5:F${rIdx - 1})`,
    result: 13.0
  };
  styleCellRange(ws, 1, rIdx, 7, rIdx, {
    fillHex: 'F1F5F9',
    font: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } },
    borderHex: '0F172A',
    doubleBottomBorder: true
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `CA_Final_Day_Timetable_Template_${dateStr}.xlsx`);
}

/**
 * Generates and downloads a 7-Day (Weekly) Timetable Excel Template (.xlsx)
 */
export async function downloadWeekTimetableTemplate(startDateStr?: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Piyaa CA Final Study Companion';
  wb.created = new Date();

  const ws = wb.addWorksheet('Weekly Timetable (7 Days)', { views: [{ showGridLines: true }] });
  const start = startDateStr || getISTYMD();

  ws.columns = [
    { key: 'date', width: 16 },
    { key: 'day', width: 14 },
    { key: 'time', width: 24 },
    { key: 'subject', width: 28 },
    { key: 'activity', width: 44 },
    { key: 'category', width: 16 },
    { key: 'duration', width: 14 },
    { key: 'status', width: 14 }
  ];

  // Header Title Block
  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'CA FINAL 7-DAY (WEEKLY) TIMETABLE TEMPLATE';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  ws.mergeCells('A2:H2');
  const subCell = ws.getCell('A2');
  subCell.value = `Starting Week: ${start} to ${addDaysToYMD(start, 6)} | You can customize any day's subject & chapters`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFCBD5E1' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  // Table Headers
  const headers = ['Date (YYYY-MM-DD)', 'Day of Week', 'Time Range', 'Subject / Paper', 'Chapter & Topic Details', 'Category', 'Duration (Hrs)', 'Status'];
  const hRow = ws.getRow(4);
  hRow.height = 26;
  headers.forEach((h, i) => { hRow.getCell(i + 1).value = h; });

  styleCellRange(ws, 1, 4, 8, 4, {
    fillHex: '065F46',
    font: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    borderHex: '044E3B'
  });

  const subjectRotation = [
    { s1: 'Financial Reporting (FR)', a1: 'Ind AS 115 Revenue Recognition', s2: 'Direct Tax Laws (DT)', a2: 'Profits & Gains of Business or Profession (PGBP)' },
    { s1: 'Financial Reporting (FR)', a1: 'Ind AS 116 Leases & Ind AS 109 Financial Instruments', s2: 'Direct Tax Laws (DT)', a2: 'Capital Gains & Minimum Alternate Tax (MAT)' },
    { s1: 'Advanced Financial Management (AFM)', a1: 'Security Valuation & Portfolio Theory', s2: 'Indirect Tax Laws (IDT)', a2: 'Input Tax Credit (ITC) & Value of Supply' },
    { s1: 'Advanced Financial Management (AFM)', a1: 'Forex Risk Management & International Finance', s2: 'Indirect Tax Laws (IDT)', a2: 'Place of Supply, Refunds & Customs Valuation' },
    { s1: 'Advanced Auditing (Audit)', a1: 'Audit of Listed Entities, SA 700 Series', s2: 'Direct Tax Laws (DT)', a2: 'International Taxation & DTAA Provisions' },
    { s1: 'Advanced Auditing (Audit)', a1: 'Professional Ethics & Quality Management (SQC 1)', s2: 'Financial Reporting (FR)', a2: 'Consolidated Financial Statements (Ind AS 110)' },
    { s1: 'Integrated Business Solutions (IBS)', a1: 'Multi-Disciplinary Case Studies 1-5', s2: 'Full Week Revision & Mock Test', a2: 'Weekly Retrospective & 100-Mark MTP Evaluation' },
  ];

  let rIdx = 5;
  for (let d = 0; d < 7; d++) {
    const dayDate = addDaysToYMD(start, d);
    const dayName = new Date(dayDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long' });
    const rot = subjectRotation[d];

    const daySlots = [
      { time: '07:00 AM - 10:00 AM', subject: rot.s1, activity: rot.a1, category: 'STUDY', dur: 3.0 },
      { time: '10:00 AM - 10:30 AM', subject: 'Morning Break', activity: 'Breakfast & Refreshment', category: 'BREAK', dur: 0.5 },
      { time: '10:30 AM - 01:30 PM', subject: rot.s1, activity: `${rot.s1} - Practical Questions & Past Exam RTPs`, category: 'STUDY', dur: 3.0 },
      { time: '01:30 PM - 02:30 PM', subject: 'Lunch Break', activity: 'Lunch & Relax', category: 'BREAK', dur: 1.0 },
      { time: '02:30 PM - 05:30 PM', subject: rot.s2, activity: rot.a2, category: 'STUDY', dur: 3.0 },
      { time: '05:30 PM - 06:00 PM', subject: 'Evening Walk', activity: 'Tea & Walk', category: 'BREAK', dur: 0.5 },
      { time: '06:00 PM - 09:00 PM', subject: rot.s2, activity: `${rot.s2} - MCQs, Case Scenarios & Daily Log`, category: 'STUDY', dur: 3.0 },
    ];

    daySlots.forEach(s => {
      const row = ws.getRow(rIdx);
      row.height = 20;
      row.getCell(1).value = dayDate;
      row.getCell(2).value = dayName;
      row.getCell(3).value = s.time;
      row.getCell(4).value = s.subject;
      row.getCell(5).value = s.activity;
      row.getCell(6).value = s.category;
      row.getCell(7).value = s.dur;
      row.getCell(8).value = 'PENDING';

      const isBreak = s.category === 'BREAK';
      styleCellRange(ws, 1, rIdx, 8, rIdx, {
        fillHex: isBreak ? 'FFFBEB' : (d % 2 === 0 ? 'F0FDF4' : 'F8FAFC'),
        font: { name: 'Calibri', size: 10 },
        borderHex: 'CBD5E1'
      });
      rIdx++;
    });
  }

  // Auto-Filter
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 8 } };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `CA_Final_Weekly_Timetable_Template_${start}.xlsx`);
}

/**
 * Generates and downloads a Full Month / Multi-Week Timetable Excel Template (.xlsx)
 */
export async function downloadMonthTimetableTemplate(startDateStr?: string, daysCount: number = 30) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Piyaa CA Final Study Companion';
  wb.created = new Date();

  const ws = wb.addWorksheet('Monthly Timetable Plan', { views: [{ showGridLines: true }] });
  const start = startDateStr || getISTYMD();

  ws.columns = [
    { key: 'date', width: 16 },
    { key: 'day', width: 14 },
    { key: 'time', width: 24 },
    { key: 'subject', width: 30 },
    { key: 'activity', width: 45 },
    { key: 'category', width: 16 },
    { key: 'duration', width: 14 },
    { key: 'status', width: 14 }
  ];

  // Header Title Block
  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'CA FINAL MONTHLY (30-DAY) MASTER TIMETABLE TEMPLATE';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  ws.mergeCells('A2:H2');
  const subCell = ws.getCell('A2');
  subCell.value = `Date Range: ${start} to ${addDaysToYMD(start, daysCount - 1)} (${daysCount} Days Master Plan)`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFCBD5E1' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  // Table Headers
  const headers = ['Date (YYYY-MM-DD)', 'Day of Week', 'Time Range', 'Subject / Paper', 'Chapter & Topic Details', 'Category', 'Duration (Hrs)', 'Status'];
  const hRow = ws.getRow(4);
  hRow.height = 26;
  headers.forEach((h, i) => { hRow.getCell(i + 1).value = h; });

  styleCellRange(ws, 1, 4, 8, 4, {
    fillHex: '0F172A',
    font: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    borderHex: '334155'
  });

  const subjectRotation = [
    { subj: 'Financial Reporting (FR)', topic: 'Ind AS Standards & Comprehensive Practice' },
    { subj: 'Financial Reporting (FR)', topic: 'Business Combinations & Consolidation' },
    { subj: 'Advanced Financial Management (AFM)', topic: 'Portfolio & Derivatives Strategy' },
    { subj: 'Advanced Financial Management (AFM)', topic: 'Forex, Interest Rate Risk & Mutual Funds' },
    { subj: 'Advanced Auditing (Audit)', topic: 'Standards on Auditing (SAs) & Audit Report' },
    { subj: 'Advanced Auditing (Audit)', topic: 'Professional Ethics & Internal Audit' },
    { subj: 'Direct Tax Laws (DT)', topic: 'Corporate Tax, PGBP & Capital Gains' },
    { subj: 'Direct Tax Laws (DT)', topic: 'International Tax, Transfer Pricing & Assessments' },
    { subj: 'Indirect Tax Laws (IDT)', topic: 'GST ITC, Supply, Place of Supply & Refunds' },
    { subj: 'Indirect Tax Laws (IDT)', topic: 'Customs Valuation, FTP & Advance Rulings' },
  ];

  let rIdx = 5;
  for (let d = 0; d < daysCount; d++) {
    const dayDate = addDaysToYMD(start, d);
    const dayName = new Date(dayDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short' });
    const rot = subjectRotation[d % subjectRotation.length];

    const daySlots = [
      { time: '07:00 AM - 10:30 AM', subject: rot.subj, activity: `${rot.topic} - Part 1`, category: 'STUDY', dur: 3.5 },
      { time: '10:30 AM - 11:00 AM', subject: 'Break', activity: 'Breakfast & Rest', category: 'BREAK', dur: 0.5 },
      { time: '11:00 AM - 02:00 PM', subject: rot.subj, activity: `${rot.topic} - Part 2 (ICAI Study Material & RTP)`, category: 'STUDY', dur: 3.0 },
      { time: '02:00 PM - 03:00 PM', subject: 'Lunch Break', activity: 'Lunch & Power Nap', category: 'BREAK', dur: 1.0 },
      { time: '03:00 PM - 06:30 PM', subject: subjectRotation[(d + 3) % subjectRotation.length].subj, activity: `${subjectRotation[(d + 3) % subjectRotation.length].topic}`, category: 'STUDY', dur: 3.5 },
      { time: '06:30 PM - 07:00 PM', subject: 'Evening Break', activity: 'Tea & Walk', category: 'BREAK', dur: 0.5 },
      { time: '07:00 PM - 09:30 PM', subject: 'Daily Revision / MTP', activity: 'Summary Notes, Flashcards & Self-Test', category: 'STUDY', dur: 2.5 },
    ];

    daySlots.forEach(s => {
      const row = ws.getRow(rIdx);
      row.height = 19;
      row.getCell(1).value = dayDate;
      row.getCell(2).value = dayName;
      row.getCell(3).value = s.time;
      row.getCell(4).value = s.subject;
      row.getCell(5).value = s.activity;
      row.getCell(6).value = s.category;
      row.getCell(7).value = s.dur;
      row.getCell(8).value = 'PENDING';

      const isBreak = s.category === 'BREAK';
      styleCellRange(ws, 1, rIdx, 8, rIdx, {
        fillHex: isBreak ? 'FFFBEB' : (d % 2 === 0 ? 'FFFFFF' : 'F8FAFC'),
        font: { name: 'Calibri', size: 9.5 },
        borderHex: 'E2E8F0'
      });
      rIdx++;
    });
  }

  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 8 } };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `CA_Final_Monthly_Master_Timetable_${start}.xlsx`);
}

/**
 * Normalizes any string representation of a Date into 'YYYY-MM-DD'
 */
export function normalizeDateString(rawDate: any, fallbackDateStr: string): string {
  if (!rawDate) return fallbackDateStr;

  // If it's a JavaScript Date object
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    return getISTYMD(rawDate);
  }

  // If it's an Excel numeric serial date (e.g. 45230)
  if (typeof rawDate === 'number' && rawDate > 20000 && rawDate < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(rawDate));
    return getISTYMD(epoch);
  }

  const str = String(rawDate).trim();
  if (!str) return fallbackDateStr;

  // Format 1: YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const parts = str.split('-').map(Number);
    const y = parts[0];
    const m = String(parts[1]).padStart(2, '0');
    const d = String(parts[2]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Format 2: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = String(dmyMatch[1]).padStart(2, '0');
    const m = String(dmyMatch[2]).padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Format 3: MM/DD/YYYY or YYYY/MM/DD
  const ymdSlashMatch = str.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (ymdSlashMatch) {
    const y = ymdSlashMatch[1];
    const m = String(ymdSlashMatch[2]).padStart(2, '0');
    const d = String(ymdSlashMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Try Native Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2020 && parsed.getFullYear() <= 2040) {
    return getISTYMD(parsed);
  }

  return fallbackDateStr;
}

/**
 * Intelligent Cell Value Extractor from ExcelJS Row
 */
function getRowValue(row: ExcelJS.Row, colIdx: number): string {
  if (!colIdx || colIdx <= 0) return '';
  const cell = row.getCell(colIdx);
  if (cell.value === null || cell.value === undefined) return '';

  if (typeof cell.value === 'object') {
    if ('result' in cell.value && cell.value.result !== undefined) {
      return String(cell.value.result).trim();
    }
    if ('text' in cell.value && cell.value.text !== undefined) {
      return String(cell.value.text).trim();
    }
    if (cell.value instanceof Date) {
      return getISTYMD(cell.value);
    }
  }

  return String(cell.value).trim();
}

/**
 * Comprehensive Parser for Excel Timetable Workbooks (.xlsx / .xls)
 */
export async function parseExcelTimetableWorkbook(
  file: File,
  targetFallbackDate: string = getISTYMD(),
  defaultScopeMode: 'DAY' | 'WEEK' | 'MONTH' | 'AUTO' = 'AUTO'
): Promise<ParsedImportResult> {
  const wb = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await wb.xlsx.load(arrayBuffer);

  const parsedDays: Record<string, ParsedDaySchedule> = {};
  const globalWarnings: string[] = [];

  // Iterate over all worksheets
  wb.worksheets.forEach((ws) => {
    if (ws.rowCount < 2) return;

    // Detect Header Row & Columns
    let headerRowIndex = -1;
    let colDate = -1;
    let colTime = -1;
    let colStartTime = -1;
    let colEndTime = -1;
    let colSubject = -1;
    let colActivity = -1;
    let colCategory = -1;
    let colDuration = -1;
    let colStatus = -1;

    // Scan first 10 rows to find header
    for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
      const row = ws.getRow(r);
      let matches = 0;

      row.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').toLowerCase().trim();
        if (val.includes('date') || val.includes('day')) { colDate = colNumber; matches++; }
        else if (val.includes('time range') || val.includes('slot time') || (val.includes('time') && !val.includes('start') && !val.includes('end'))) { colTime = colNumber; matches++; }
        else if (val.includes('start time') || val.includes('from time') || val === 'start' || val === 'from') { colStartTime = colNumber; matches++; }
        else if (val.includes('end time') || val.includes('to time') || val === 'end' || val === 'to') { colEndTime = colNumber; matches++; }
        else if (val.includes('subject') || val.includes('paper') || val.includes('course')) { colSubject = colNumber; matches++; }
        else if (val.includes('activity') || val.includes('chapter') || val.includes('topic') || val.includes('task') || val.includes('details')) { colActivity = colNumber; matches++; }
        else if (val.includes('category') || val.includes('type') || val.includes('slot type')) { colCategory = colNumber; matches++; }
        else if (val.includes('duration') || val.includes('hours') || val.includes('hrs')) { colDuration = colNumber; matches++; }
        else if (val.includes('status')) { colStatus = colNumber; matches++; }
      });

      if (matches >= 2 && (colSubject > 0 || colTime > 0 || colActivity > 0)) {
        headerRowIndex = r;
        break;
      }
    }

    // If no explicit header row was identified, assign sensible defaults
    if (headerRowIndex === -1) {
      headerRowIndex = 1;
      colDate = 1;
      colTime = 2;
      colSubject = 3;
      colActivity = 4;
      colCategory = 5;
      colDuration = 6;
      colStatus = 7;
    }

    // Process data rows
    let rollingTimeMin = 420; // 07:00 AM

    for (let r = headerRowIndex + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const firstCellVal = getRowValue(row, 1);
      if (firstCellVal.toUpperCase().startsWith('TOTAL') || firstCellVal.toUpperCase().startsWith('NOTE')) {
        continue;
      }

      const subjectVal = colSubject > 0 ? getRowValue(row, colSubject) : '';
      const activityVal = colActivity > 0 ? getRowValue(row, colActivity) : '';
      let timeVal = colTime > 0 ? getRowValue(row, colTime) : '';
      const startTimeVal = colStartTime > 0 ? getRowValue(row, colStartTime) : '';
      const endTimeVal = colEndTime > 0 ? getRowValue(row, colEndTime) : '';
      const rawDateVal = colDate > 0 ? getRowValue(row, colDate) : '';
      const rawCatVal = colCategory > 0 ? getRowValue(row, colCategory) : '';
      const rawStatusVal = colStatus > 0 ? getRowValue(row, colStatus) : '';
      const rawDurVal = colDuration > 0 ? parseFloat(getRowValue(row, colDuration)) : NaN;

      // Skip completely empty rows
      if (!subjectVal && !activityVal && !timeVal && !startTimeVal) {
        continue;
      }

      // Resolve Date
      let rowDateStr = normalizeDateString(rawDateVal, targetFallbackDate);

      // Handle sheet named as a date e.g. "2026-08-18" or "Monday"
      if (!rawDateVal && ws.name && /^\d{4}-\d{2}-\d{2}$/.test(ws.name)) {
        rowDateStr = ws.name;
      }

      // Resolve Time Range
      if (!timeVal && startTimeVal && endTimeVal) {
        timeVal = `${startTimeVal} - ${endTimeVal}`;
      } else if (!timeVal && startTimeVal && !isNaN(rawDurVal) && rawDurVal > 0) {
        const startMin = parseTimeToMinutes(startTimeVal);
        const endMin = startMin + Math.round(rawDurVal * 60);
        timeVal = `${formatMinutesToTimeStr(startMin)} - ${formatMinutesToTimeStr(endMin)}`;
      } else if (!timeVal) {
        const durHours = !isNaN(rawDurVal) && rawDurVal > 0 ? rawDurVal : 1.5;
        const durMin = Math.round(durHours * 60);
        timeVal = `${formatMinutesToTimeStr(rollingTimeMin)} - ${formatMinutesToTimeStr(rollingTimeMin + durMin)}`;
        rollingTimeMin += durMin;
      }

      // Determine Category
      let category: 'study' | 'break' | 'revision' | 'mock' | 'na' = 'study';
      const catLower = (rawCatVal || '').toLowerCase();
      const subjLower = (subjectVal || '').toLowerCase();
      const actLower = (activityVal || '').toLowerCase();

      if (catLower.includes('break') || subjLower.includes('break') || actLower.includes('break') || subjLower.includes('lunch') || subjLower.includes('dinner') || subjLower.includes('nap')) {
        category = 'break';
      } else if (catLower.includes('mock') || subjLower.includes('mock') || actLower.includes('mock') || actLower.includes('mtp')) {
        category = 'mock';
      } else if (catLower.includes('revision') || subjLower.includes('revision') || actLower.includes('revision') || actLower.includes('ldr')) {
        category = 'revision';
      } else if (catLower.includes('na') || subjLower.includes('na')) {
        category = 'na';
      }

      // Status
      let status: SlotStatus = 'PENDING';
      const stLower = (rawStatusVal || '').toLowerCase();
      if (stLower.includes('done') || stLower.includes('complete')) {
        status = 'COMPLETED';
      } else if (stLower.includes('progress')) {
        status = 'IN_PROGRESS';
      }

      const durHours = !isNaN(rawDurVal) && rawDurVal > 0 ? rawDurVal : parseSlotHours(timeVal);

      const slot: TimetableSlot = {
        id: `import-slot-${rowDateStr}-${r}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        time: timeVal,
        subject: subjectVal || (category === 'break' ? 'Scheduled Break' : 'General Study'),
        activity: activityVal || (category === 'break' ? 'Rest & Recharge' : 'Standard Study Session'),
        category,
        status,
        completed: status === 'COMPLETED',
        progress: status === 'COMPLETED' ? 100 : 0,
        totalDurationHours: Number(durHours.toFixed(2)),
        studiedDurationHours: status === 'COMPLETED' ? Number(durHours.toFixed(2)) : 0
      };

      if (!parsedDays[rowDateStr]) {
        parsedDays[rowDateStr] = {
          dateStr: rowDateStr,
          slots: [],
          totalStudyHours: 0,
          totalBreakHours: 0,
          warnings: []
        };
      }

      parsedDays[rowDateStr].slots.push(slot);
    }
  });

  // Post-Process & Align Non-Overlapping Timetable for each day
  let totalSlots = 0;
  let totalStudy = 0;
  let totalBreak = 0;

  const sortedDateKeys = Object.keys(parsedDays).sort();

  sortedDateKeys.forEach((dateKey) => {
    const day = parsedDays[dateKey];
    const cleanedSlots = enforceNonOverlappingSlots(day.slots);
    day.slots = cleanedSlots;

    day.totalStudyHours = cleanedSlots.reduce((acc, s) => s.category !== 'break' && s.category !== 'na' && s.status !== 'NA' ? acc + parseSlotHours(s.time) : acc, 0);
    day.totalBreakHours = cleanedSlots.reduce((acc, s) => s.category === 'break' ? acc + parseSlotHours(s.time) : acc, 0);

    totalSlots += cleanedSlots.length;
    totalStudy += day.totalStudyHours;
    totalBreak += day.totalBreakHours;
  });

  return {
    days: parsedDays,
    totalDatesCount: sortedDateKeys.length,
    totalSlotsCount: totalSlots,
    totalStudyHours: Number(totalStudy.toFixed(1)),
    totalBreakHours: Number(totalBreak.toFixed(1)),
    globalWarnings,
    sampleDates: sortedDateKeys
  };
}
