import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { decimal } from './core';
import { payslipTemplateSchema, type PayslipTemplate } from '../lib/payslip-template';
export type SalaryDetails = {
  template?: PayslipTemplate;
  employeeName: string;
  employeeAddress: string;
  employeeContact: string;
  companyName: string;
  companyAddress: string;
  companyContact: string;
  signatory: string;
  designation: string;
  month: string;
  earnings: { label: string; amount: number }[];
  deductionLabel: string;
  deductionMinor: number;
  grossMinor: number;
  netMinor: number;
};
export async function salaryPdf(details: SalaryDetails): Promise<Uint8Array> {
  const template = payslipTemplateSchema.parse(details.template || {});
  const pdf = await PDFDocument.create(),
    page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.registerFontkit(fontkit);
  const unicode = /[^\x20-\x7e]/.test(JSON.stringify(details))
    ? await pdf.embedFont(await readFile(path.join(process.cwd(), 'public/fonts/NotoSansSC.ttf')), {
        subset: true,
      })
    : null;
  const colour = (hex: string) =>
    rgb(
      ...([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
        number,
        number,
        number,
      ]),
    );
  const light = (hex: string) => {
    const channels = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179;
  };
  const legacy = !details.template;
  const ink = legacy
      ? rgb(0.27, 0.27, 0.27)
      : light(template.background)
        ? rgb(0.12, 0.12, 0.12)
        : rgb(1, 1, 1),
    paper = legacy ? rgb(0.956, 0.956, 0.969) : colour(template.background),
    accent = legacy ? ink : colour(template.accent),
    accentText = legacy ? paper : light(template.accent) ? rgb(0, 0, 0) : rgb(1, 1, 1);
  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: paper });
  page.drawRectangle({ x: 24, y: 685, width: 24, height: 157, color: accent });
  function text(
    value: string,
    x: number,
    y: number,
    size = 11,
    heavy = false,
    maxWidth?: number,
    color = ink,
  ) {
    const font = unicode && /[^\x20-\x7e]/.test(value) ? unicode : heavy ? bold : regular;
    let s = size;
    if (maxWidth) while (font.widthOfTextAtSize(value, s) > maxWidth && s > 7) s -= 0.25;
    if (maxWidth && font.widthOfTextAtSize(value, s) > maxWidth)
      throw new Error('Text exceeds the available template width.');
    page.drawText(value, { x, y, size: s, font, color });
  }
  // Radial mark and geometric title follow the supplied monochrome reference.
  if (template.logo) {
    const logo = await pdf.embedPng(Buffer.from(template.logo.split(',')[1], 'base64'));
    const scaled = logo.scaleToFit(template.logoSize, template.logoSize);
    page.drawImage(logo, { x: 85 - scaled.width / 2, y: 742 - scaled.height / 2, ...scaled });
  } else
    for (let i = 0; i < 36; i++) {
      const a = (i * Math.PI) / 18;
      page.drawLine({
        start: { x: 85 + Math.cos(a) * 5, y: 742 + Math.sin(a) * 5 },
        end: { x: 85 + Math.cos(a) * 25, y: 742 + Math.sin(a) * 25 },
        thickness: 0.8,
        color: accent,
      });
    }
  text(template.title, 128, 721, 49, true, 400);
  if (legacy) page.drawRectangle({ x: 478, y: 729, width: 11, height: 11, color: ink });
  text('Employee information', 62, 670, 9, true);
  text(details.employeeName, 62, 648, 20, false, 268);
  text(details.employeeAddress, 62, 630, 9, false, 268);
  text(details.employeeContact, 62, 615, 9, false, 268);
  text(details.companyName, 350, 670, 10, true, 183);
  text(details.companyAddress, 350, 653, 9, false, 183);
  text(details.companyContact, 350, 637, 9, false, 183);
  text(`Pay period: ${details.month}`, 350, 615, 10, true);
  const x = 62,
    w = 471,
    split = 355,
    top = 582,
    header = 47,
    rowHeight = 57;
  const rows = [
    ...details.earnings,
    ...(details.deductionMinor > 0
      ? [{ label: details.deductionLabel || 'Deductions', amount: -details.deductionMinor }]
      : []),
  ];
  page.drawRectangle({ x, y: top - header, width: w, height: header, color: accent });
  text('Description', x + 14, top - 30, 13, false, undefined, accentText);
  text('Amount (MYR)', split + 14, top - 30, 13, false, undefined, accentText);
  for (const [i, row] of rows.entries()) {
    const y = top - header - (i + 1) * rowHeight;
    page.drawRectangle({ x, y, width: w, height: rowHeight, borderColor: ink, borderWidth: 1 });
    text(row.label, x + 14, y + 23, 12, false, split - x - 28);
    text(
      `${row.amount < 0 ? '-' : ''}RM ${decimal(Math.abs(row.amount))}`,
      split + 14,
      y + 23,
      12,
      false,
      w - (split - x) - 28,
    );
  }
  const bottom = top - header - rows.length * rowHeight;
  page.drawLine({
    start: { x: split, y: top },
    end: { x: split, y: bottom },
    thickness: 1,
    color: ink,
  });
  if (template.showSignature) {
    page.drawLine({
      start: { x: 62, y: bottom - 61 },
      end: { x: 216, y: bottom - 61 },
      thickness: 0.8,
      color: ink,
    });
    text(details.signatory || 'Authorised signatory', 62, bottom - 78, 11, false, 158);
    text(details.designation, 62, bottom - 94, 10, false, 158);
  }
  text('Gross earnings', 256, bottom - 30, 9);
  text(`RM ${decimal(details.grossMinor)}`, 256, bottom - 49, 16, true, 142);
  text('Net pay', 256, bottom - 74, 9);
  text(`RM ${decimal(details.netMinor)}`, 256, bottom - 95, 18, true, 142);
  if (template.footer) {
    page.drawRectangle({ x: 422, y: 0, width: 174, height: bottom - 24, color: accent });
    const words = template.footer.split(' '),
      halfway = Math.ceil(words.length / 2);
    let lines = [words.slice(0, halfway).join(' '), words.slice(halfway).join(' ')];
    if (lines.some((line) => Array.from(line).length > 16)) {
      const chars = Array.from(template.footer);
      lines = [chars.slice(0, 16).join(''), chars.slice(16, 32).join(''), chars.slice(32).join('')];
    }
    lines.forEach((line, i) => text(line, 442, bottom - 61 - i * 30, 27, false, 134, accentText));
  }
  text('Generated salary statement | MYR', 62, 27, 8);
  pdf.setTitle(`Salary Slip - ${details.employeeName} - ${details.month}`);
  return pdf.save();
}
