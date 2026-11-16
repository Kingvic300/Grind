import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { type ImportResult, useHackathonsIn, useImportHackathons, useSpaces } from '../lib/hooks';
import { useSpaceId } from '../lib/space';
import { type FieldKey, FIELDS, type PreparedRow, type Sheet, displayCell, downloadTemplate, guessMapping, prepareRows, readSheet } from '../lib/spreadsheet';
import { formatRange } from '../lib/time';
import { STATUS_LABEL } from '../lib/types';
import { IconCheck, IconClose, IconSheet, IconUpload } from './Icons';
import { Bone, Spinner } from './Loading';

type Step = { kind: 'pick' } | { kind: 'review'; sheet: Sheet } | { kind: 'done'; result: ImportResult; rows: PreparedRow[]; target: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** First cell in a column with something in it, to show next to the header. */
function sample(sheet: Sheet, col: number, key: FieldKey | null) {
  const v = sheet.rows.find((r) => r.cells[col] != null && String(r.cells[col]).trim() !== '')?.cells[col] ?? null;
  return displayCell(sheet, v, key).slice(0, 60);
}

/** Button that opens the import dialog. */
export function ImportButton({ className = 'btn btn-outline', label = 'Import' }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <IconUpload /> {label}
      </button>
      {open && <ImportDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** Import hackathons from an .xlsx, .xls or .csv file into the private list or a team. */
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { spaceId } = useSpaceId();
  const spaces = useSpaces();
  const [target, setTarget] = useState<string | null>(spaceId);
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [mapping, setMapping] = useState<(FieldKey | null)[]>([]);
  const [reading, setReading] = useState(false);
  const [template, setTemplate] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const existing = useHackathonsIn(target);
  const run = useImportHackathons();

  // showModal gives a focus trap and Esc-to-close for free.
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const targetName = target ? (spaces.data?.find((s) => s.id === target)?.name ?? 'this team') : 'your private list';

  const rows = useMemo(
    () => (step.kind === 'review' ? prepareRows(step.sheet, mapping, (existing.data ?? []).map((h) => h.name)) : []),
    [step, mapping, existing.data],
  );
  const ready = rows.filter((r) => !r.skip);
  const flagged = rows.filter((r) => r.skip || r.warnings.length);
  const hasName = mapping.includes('name');

  const open = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setReading(true);
    try {
      const sheet = await readSheet(file);
      setMapping(guessMapping(sheet.headers));
      setStep({ kind: 'review', sheet });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
      if (input.current) input.current.value = '';
    }
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void open(e.dataTransfer.files[0]);
  };

  const getTemplate = async () => {
    setTemplate(true);
    try {
      await downloadTemplate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTemplate(false);
    }
  };

  // Only one column can fill each field, so choosing a field takes it away from any other column.
  const assign = (col: number, key: FieldKey | null) =>
    setMapping((m) => m.map((k, i) => (i === col ? key : k === key ? null : k)));

  const submit = () => {
    setError('');
    run.mutate(
      { spaceId: target, rows: ready.map((r) => r.input) },
      {
        onSuccess: (result) => setStep({ kind: 'done', result, rows: ready, target: targetName }),
        onError: (e) => setError(e.message),
      },
    );
  };

  const busy = reading || run.isPending;

  return (
    <dialog
      ref={dialog}
      className="modal"
      onClose={onClose}
      onCancel={(e) => run.isPending && e.preventDefault()}
      onClick={(e) => e.target === dialog.current && !run.isPending && onClose()}
      aria-labelledby="import-title"
    >
      <div className="modal-panel">
        <header className="drawer-head">
          <h2 id="import-title">{step.kind === 'done' ? 'Import finished' : 'Import from a spreadsheet'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} disabled={run.isPending} aria-label="Close">
            <IconClose />
          </button>
        </header>

        <div className="drawer-body import-body">
          {step.kind !== 'done' && (
            <label className="field import-target" htmlFor="import-target">
              <span>Import into</span>
              <select id="import-target" value={target ?? ''} disabled={busy} onChange={(e) => setTarget(e.target.value || null)}>
                <option value="">Private list</option>
                {spaces.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}

          {step.kind === 'pick' && (
            <>

              {reading ? (
                <div className="dropzone is-reading" role="status" aria-live="polite">
                  <span className="sr-only">Reading your file</span>
                  <Bone className="sk-line" style={{ width: 180, height: 18 }} />
                  <Bone className="sk-line" style={{ width: 260 }} />
                  <Bone className="sk-line" style={{ width: 220 }} />
                </div>
              ) : (
                <label
                  className={`dropzone${over ? ' is-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={() => setOver(false)}
                  onDrop={drop}
                >
                  <input
                    ref={input}
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    onChange={(e) => void open(e.target.files?.[0])}
                  />
                  <IconSheet />
                  <strong>Drop a file here, or choose one</strong>
                  <span>Excel (.xlsx, .xls) or CSV, up to 1,000 rows. The first row should be column names.</span>
                </label>
              )}

              <p className="hint">
                Grind matches columns like Name, Start date, Submission deadline and Status by their names, and you can fix the match on the next step.
                Rows with a name already in the list are skipped.
              </p>
              {error && <p className="form-error" role="alert">{error}</p>}
            </>
          )}

          {step.kind === 'review' && (
            <>
              <div className="import-file">
                <IconSheet />
                <div>
                  <strong>{step.sheet.fileName}</strong>
                  <span>{plural(step.sheet.rows.length, 'row')}, {plural(step.sheet.headers.length, 'column')}</span>
                </div>
              </div>

              <section className="import-section" aria-labelledby="import-columns">
                <h3 id="import-columns">Match columns</h3>
                <div className="table-wrap">
                  <table className="table import-table">
                    <thead>
                      <tr><th>Column in your file</th><th className="col-sample">Example</th><th>Grind field</th></tr>
                    </thead>
                    <tbody>
                      {step.sheet.headers.map((header, col) => (
                        <tr key={col} className={mapping[col] ? '' : 'is-skipped'}>
                          <td><b>{header}</b></td>
                          <td className="col-sample">{sample(step.sheet, col, mapping[col]) || <span className="muted">Empty</span>}</td>
                          <td>
                            <select
                              className="import-select"
                              aria-label={`Grind field for ${header}`}
                              value={mapping[col] ?? ''}
                              onChange={(e) => assign(col, (e.target.value || null) as FieldKey | null)}
                            >
                              <option value="">Do not import</option>
                              {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!hasName && <p className="form-error" role="alert">Choose which column holds the hackathon name. Every hackathon needs one.</p>}
              </section>

              {hasName && (
                <section className="import-section" aria-labelledby="import-preview">
                  <h3 id="import-preview">Preview</h3>
                  {existing.isPending ? (
                    <div role="status" aria-live="polite" className="import-summary">
                      <span className="sr-only">Checking the list for duplicates</span>
                      <Bone style={{ width: 140, height: 28, borderRadius: 999 }} />
                      <Bone style={{ width: 120, height: 28, borderRadius: 999 }} />
                    </div>
                  ) : (
                    <div className="import-summary">
                      <span className="is-ok">{plural(ready.length, 'hackathon')} ready</span>
                      {rows.length > ready.length && <span>{plural(rows.length - ready.length, 'row')} skipped</span>}
                      {ready.some((r) => r.warnings.length) && <span>{plural(ready.filter((r) => r.warnings.length).length, 'row')} with notes</span>}
                    </div>
                  )}

                  {ready.length > 0 && (
                    <div className="table-wrap">
                      <table className="table import-table">
                        <thead><tr><th>Row</th><th>Hackathon</th><th>Status</th><th className="col-sample">Dates</th></tr></thead>
                        <tbody>
                          {ready.slice(0, 5).map((r) => (
                            <tr key={r.rowNumber}>
                              <td className="muted">{r.rowNumber}</td>
                              <td><b>{r.input.name}</b>{r.input.organizer && <span className="row-sub"> {r.input.organizer}</span>}</td>
                              <td>{STATUS_LABEL[r.input.status ?? 'INTERESTED']}</td>
                              <td className="col-sample">{formatRange(r.input.startDate ?? null, r.input.endDate ?? null)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {ready.length > 5 && <p className="hint">And {plural(ready.length - 5, 'more')}.</p>}

                  {flagged.length > 0 && (
                    <details className="import-issues">
                      <summary>{plural(flagged.length, 'row')} to look at</summary>
                      <ul>
                        {flagged.slice(0, 200).map((r) => (
                          <li key={r.rowNumber}>
                            <div><b>Row {r.rowNumber}</b>{r.input.name && <> · {r.input.name}</>}</div>
                            {r.skip ? <span className="is-skip"> Skipped: {r.skip}</span> : null}
                            {r.warnings.map((w) => <span key={w}>{w}</span>)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </section>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
            </>
          )}

          {step.kind === 'done' && (
            <div className="import-done">
              <span className="import-done-mark" aria-hidden="true"><IconCheck /></span>
              <h3>{step.result.created ? `Added ${plural(step.result.created, 'hackathon')} to ${step.target}.` : `Nothing new was added to ${step.target}.`}</h3>
              {step.result.skipped.length > 0 && (
                <>
                  <p className="muted">{plural(step.result.skipped.length, 'row was', 'rows were')} skipped.</p>
                  <ul className="import-skipped">
                    {step.result.skipped.map((s) => (
                      <li key={s.index}>
                        <div><b>Row {step.rows[s.index]?.rowNumber ?? s.index + 1}</b>{s.name && <> · {s.name}</>}</div>
                        <span>{s.reason}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <footer className="drawer-foot">
          <div className="drawer-actions import-actions">
            {step.kind === 'pick' && (
              <>
                <button type="button" className="btn btn-quiet" onClick={getTemplate} disabled={template}>
                  {template && <Spinner />}Download template
                </button>
                <button type="button" className="btn btn-ink" onClick={() => input.current?.click()} disabled={busy}>
                  {reading && <Spinner />}Choose file
                </button>
              </>
            )}
            {step.kind === 'review' && (
              <>
                <button type="button" className="btn btn-quiet" onClick={() => { setError(''); setStep({ kind: 'pick' }); }} disabled={busy}>
                  Choose another file
                </button>
                <button type="button" className="btn btn-accent" onClick={submit} disabled={busy || !hasName || !ready.length || existing.isPending}>
                  {run.isPending && <Spinner />}
                  {ready.length ? `Import ${plural(ready.length, 'hackathon')}` : 'Nothing to import'}
                </button>
              </>
            )}
            {step.kind === 'done' && <button type="button" className="btn btn-ink" onClick={onClose}>Done</button>}
          </div>
        </footer>
      </div>
    </dialog>
  );
}
