'use client';

import { useState } from 'react';
import {
  defaultPayslipTemplate,
  payslipTemplateSchema,
  workspacePayslipTemplate,
  type PayslipTemplate,
} from '@/lib/payslip-template';
import { PdfPreview } from './pdf-preview';

export function PayslipTemplateSettings({
  companyId,
  initial,
  onSave,
}: {
  companyId: string;
  initial: unknown;
  onSave: (data: Record<string, unknown>) => Promise<unknown>;
}) {
  const [template, setTemplate] = useState(() => workspacePayslipTemplate(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<Uint8Array | null>(null);
  function change(patch: Partial<PayslipTemplate>) {
    setTemplate((t) => ({ ...t, ...patch }));
    setPreview(null);
    setMessage('Unsaved changes. Preview or save your template.');
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1_048_576)
        throw new Error('Choose a PNG or JPEG logo up to 1 MB.');
      const logo = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read this file.'));
        reader.readAsDataURL(file);
      });
      change({ logo });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Logo upload failed.');
    } finally {
      setBusy(false);
    }
  }
  async function submit(isPreview: boolean) {
    setBusy(true);
    setMessage('');
    try {
      const valid = payslipTemplateSchema.parse(template);
      if (isPreview) {
        const response = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'salary.template.preview', companyId, ...valid }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Preview failed.');
        setPreview(Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0)));
        setMessage('Sample preview — no payslip has been created. Save to use this design.');
      } else {
        await onSave(valid);
        setMessage('Template saved. New payslips will use this design.');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not update the template.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="payslip-template-editor">
      <p>
        Choose the appearance of new salary slips. Previously saved payslips keep their original
        design.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <label>
              Heading
              <input
                required
                maxLength={24}
                value={template.title}
                onChange={(e) => change({ title: e.target.value })}
              />
            </label>
            <label>
              Footer message
              <input
                maxLength={40}
                value={template.footer}
                onChange={(e) => change({ footer: e.target.value })}
                placeholder="Leave empty to hide footer block"
              />
            </label>
            <label>
              Accent colour
              <input
                type="color"
                value={template.accent}
                onChange={(e) => change({ accent: e.target.value })}
              />
            </label>
            <label>
              Page colour
              <input
                type="color"
                value={template.background}
                onChange={(e) => change({ background: e.target.value })}
              />
            </label>
            <label>
              Company logo (PNG/JPEG, up to 1 MB)
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            <label>
              Logo size: {template.logoSize}
              <input
                type="range"
                min={32}
                max={64}
                value={template.logoSize}
                onChange={(e) => change({ logoSize: Number(e.target.value) })}
              />
            </label>
          </div>
          {template.logo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '16px 0' }}>
              {/* User-selected raster data only; server validates and normalises before saving. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={template.logo}
                alt="Payslip company logo"
                style={{ width: 80, height: 80, objectFit: 'contain' }}
              />
              <button
                type="button"
                className="button secondary"
                onClick={() => change({ logo: '' })}
              >
                Remove logo
              </button>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0' }}>
            <input
              type="checkbox"
              checked={template.showSignature}
              onChange={(e) => change({ showSignature: e.target.checked })}
              style={{ width: 'auto' }}
            />
            Show signature line
          </label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="submit" className="button primary">
              {busy ? 'Working…' : 'Save template'}
            </button>
            <button type="button" className="button secondary" onClick={() => void submit(true)}>
              Preview PDF
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => change(defaultPayslipTemplate)}
            >
              Reset to default
            </button>
          </div>
        </fieldset>
      </form>
      {message && <p role="status">{message}</p>}
      {preview && <PdfPreview data={preview} name="Sample payslip" />}
    </section>
  );
}
