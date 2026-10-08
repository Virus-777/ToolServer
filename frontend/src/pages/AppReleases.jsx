import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppReleasesAPI } from '../services/api';
import { Modal } from '../components/Modal';
import { ActionButton, Badge, Button, Card, DataTable, FormField, Input, Page, PageHeader, Placeholder, Select, Textarea } from '../components/ui';
import { useConfirm, useToast } from '../contexts/UIContext';
import { copyToClipboard, formatBytes, formatDateTime, truncate } from '../utils/format';

/**
 * Releases of the RobustTailor desktop app (Tauri updater).
 * Mirrors controllers/app-release.controller.js: upload a signed NSIS installer,
 * publish / unpublish, edit notes, and preview what the updater will receive.
 */

const APP_NAME = 'RobustTailor';
const TARGETS = ['windows'];
const ARCHS = [
  { value: 'x86_64', suffix: 'x64', label: 'x86_64 (64-bit Intel/AMD)' },
  { value: 'aarch64', suffix: 'arm64', label: 'aarch64 (ARM64)' },
];
const NOTES_MAX = 4000;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
const EMPTY_UPLOAD_FORM = {
  version: '',
  target: 'windows',
  arch: 'x86_64',
  notes: '',
  pubDate: '',
  published: true,
  installer: null,
  signatureFile: null,
  signatureText: '',
};

const installerName = (version, arch) =>
  `${APP_NAME}_${version || '<version>'}_${ARCHS.find((item) => item.value === arch)?.suffix || 'x64'}-setup.exe`;

/** datetime-local value (local time) -> RFC 3339 UTC without milliseconds. */
const localToRfc3339 = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

const CopyButton = ({ text, label = 'Copy', copiedMessage = 'Copied to clipboard' }) => {
  const toast = useToast();
  return (
    <ActionButton
      color="neutral"
      className="text-xs"
      onClick={async () => {
        await copyToClipboard(text);
        toast.success(copiedMessage);
      }}
    >
      {label}
    </ActionButton>
  );
};

const Checkbox = ({ id, checked, onChange, disabled, label, hint }) => (
  <label htmlFor={id} className="flex items-start gap-2 text-sm text-gray-700">
    <input
      id={id}
      type="checkbox"
      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      disabled={disabled}
    />
    <span>
      {label}
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </span>
  </label>
);

const ProgressBar = ({ percent }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
    <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${percent}%` }} />
  </div>
);

const FILE_INPUT_CLASS =
  'block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20 disabled:opacity-50';

/** What the installed app currently receives from the updater endpoint. */
const CurrentReleaseCard = ({ release, onPreview }) => {
  const [simulatedVersion, setSimulatedVersion] = useState('0.0.0');
  const endpoint = AppReleasesAPI.updateCheckUrl('windows', 'x86_64', simulatedVersion || '0.0.0');

  return (
    <Card className="mb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium uppercase tracking-wider text-gray-500">Published to windows-x86_64</p>
          {release ? (
            <>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-3xl font-bold text-gray-900">v{release.version}</span>
                <Badge color="green">Latest</Badge>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {release.pub_date ? `Release date ${formatDateTime(release.pub_date)}` : `Uploaded ${formatDateTime(release.created_at)}`} ·{' '}
                {release.file_name} ({formatBytes(release.size)})
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>SHA-256</span>
                <code className="break-all font-mono text-gray-700">{release.sha256}</code>
                <CopyButton text={release.sha256} copiedMessage="Checksum copied" />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>Installer URL</span>
                <a href={release.url} className="break-all font-mono text-primary hover:text-primary-dark">{release.url}</a>
                <CopyButton text={release.url} copiedMessage="Installer URL copied" />
              </div>
            </>
          ) : (
            <p className="mt-1 text-gray-600">
              No published release. The desktop app receives <code>204 No Content</code> from the update check until one is published.
            </p>
          )}
        </div>

        <div className="w-full rounded-md bg-gray-50 p-4 text-sm lg:max-w-lg">
          <p className="mb-2 font-medium text-gray-700">Updater endpoint</p>
          <div className="mb-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-gray-700" title={endpoint}>{endpoint}</code>
            <CopyButton text={endpoint} copiedMessage="Endpoint URL copied" />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="simulate-version" className="whitespace-nowrap text-xs text-gray-600">Installed version</label>
            <Input
              id="simulate-version"
              size="sm"
              value={simulatedVersion}
              onChange={(event) => setSimulatedVersion(event.target.value.trim())}
              placeholder="2.0.0"
              spellCheck={false}
            />
            <Button size="sm" variant="secondary" onClick={() => onPreview(simulatedVersion || '0.0.0')}>Preview manifest</Button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            The app calls this URL with its own version. It gets the newest published release that is newer, or 204 when it is up to date.
          </p>
        </div>
      </div>
    </Card>
  );
};

const AppReleases = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_UPLOAD_FORM);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(null);

  const [editing, setEditing] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [viewing, setViewing] = useState(null);
  const [preview, setPreview] = useState(null);

  const current = releases.find((release) => release.published && release.platform === 'windows-x86_64') || null;

  const loadReleases = useCallback(async () => {
    try {
      setLoading(true);
      const data = await AppReleasesAPI.getAll();
      setReleases(data.releases || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadReleases();
  }, [loadReleases]);

  // Abort an in-flight upload if the page is left
  useEffect(() => () => abortRef.current?.abort(), []);

  /* ---------- upload ---------- */

  const openUpload = () => {
    setForm(EMPTY_UPLOAD_FORM);
    setProgress(0);
    setUploadOpen(true);
  };

  const closeUpload = () => {
    if (uploading) return; // use "Cancel upload" to abort
    setUploadOpen(false);
  };

  const setField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  const version = form.version.trim().replace(/^v/i, '');
  const expectedInstaller = installerName(version, form.arch);
  const installerMismatch = form.installer && version && form.installer.name !== expectedInstaller;

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!SEMVER_PATTERN.test(version)) {
      toast.error('Version must be a semver string, e.g. 2.1.0 or 2.1.0-beta.1');
      return;
    }
    if (!form.installer) {
      toast.error('Select the installer file');
      return;
    }
    if (form.installer.name !== expectedInstaller) {
      toast.error(`Installer file name must be ${expectedInstaller}`);
      return;
    }
    if (form.installer.size < 1024 * 1024) {
      toast.error('Installer is too small to be a valid build (minimum 1 MB)');
      return;
    }
    if (!form.signatureFile && !form.signatureText.startsWith('untrusted comment:')) {
      toast.error('Provide the .sig file or paste its full content (it starts with "untrusted comment:")');
      return;
    }
    if (form.notes.length > NOTES_MAX) {
      toast.error(`Notes must be at most ${NOTES_MAX} characters`);
      return;
    }
    if (releases.some((release) => release.version === version && release.target === form.target && release.arch === form.arch)) {
      toast.error(`Version ${version} already exists for ${form.target}-${form.arch}`);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setUploading(true);
      setProgress(0);
      const data = await AppReleasesAPI.upload(
        {
          version,
          target: form.target,
          arch: form.arch,
          notes: form.notes,
          pub_date: localToRfc3339(form.pubDate),
          published: form.published,
          installer: form.installer,
          signatureFile: form.signatureFile,
          signatureText: form.signatureText,
        },
        { onProgress: setProgress, signal: controller.signal }
      );
      toast.success(data.message || `Version ${version} uploaded`);
      setUploadOpen(false);
      loadReleases();
    } catch (error) {
      if (error.data?.aborted) {
        toast.info('Upload cancelled');
      } else {
        toast.error(error.message);
      }
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  /* ---------- publish / notes / delete ---------- */

  const togglePublished = async (release) => {
    if (release.published) {
      const ok = await confirm({
        title: `Unpublish v${release.version}`,
        message: 'Installed apps will no longer be offered this version. The installer stays available at its URL.',
        confirmLabel: 'Unpublish',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      setBusyId(release.id);
      await AppReleasesAPI.patch(release.id, { published: !release.published });
      toast.success(`Version ${release.version} ${release.published ? 'unpublished' : 'published'}`);
      loadReleases();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (release) => {
    setEditing(release);
    setEditNotes(release.notes || '');
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    if (editNotes.length > NOTES_MAX) {
      toast.error(`Notes must be at most ${NOTES_MAX} characters`);
      return;
    }
    try {
      setSaving(true);
      await AppReleasesAPI.patch(editing.id, { notes: editNotes.trim() });
      toast.success('Release notes updated');
      setEditing(null);
      loadReleases();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (release) => {
    const ok = await confirm({
      title: `Delete v${release.version}`,
      message: `This removes the release record and ${release.file_name} from the server. Apps that already downloaded it are unaffected.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await AppReleasesAPI.delete(release.id);
      toast.success(`Version ${release.version} deleted`);
      loadReleases();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handlePreview = async (simulatedVersion) => {
    try {
      const manifest = await AppReleasesAPI.checkUpdate('windows', 'x86_64', simulatedVersion);
      setPreview({ version: simulatedVersion, manifest });
    } catch (error) {
      toast.error(error.message);
    }
  };

  /* ---------- table ---------- */

  const columns = [
    {
      key: 'version',
      label: 'Version',
      render: (release) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">v{release.version}</span>
          {current && current.id === release.id && <Badge color="green">Latest</Badge>}
          {!release.published && <Badge color="gray">Unpublished</Badge>}
          {release.version.includes('-') && <Badge color="amber">Pre-release</Badge>}
        </div>
      ),
    },
    { key: 'platform', label: 'Platform', render: (release) => <code className="text-xs">{release.platform}</code> },
    {
      key: 'file_name',
      label: 'Installer',
      className: 'text-gray-900',
      render: (release) => (
        <div className="min-w-0 max-w-xs">
          <a href={release.url} className="block truncate text-primary hover:text-primary-dark" title={release.url}>{release.file_name}</a>
          <p className="text-xs text-gray-500">{formatBytes(release.size)}</p>
        </div>
      ),
    },
    {
      key: 'sha256',
      label: 'SHA-256',
      render: (release) => (
        <div className="flex items-center gap-2">
          <code className="font-mono text-xs text-gray-700" title={release.sha256}>{release.sha256.slice(0, 12)}…</code>
          <CopyButton text={release.sha256} copiedMessage="Checksum copied" />
        </div>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      className: 'text-gray-700',
      render: (release) =>
        release.notes ? (
          <button type="button" onClick={() => setViewing(release)} className="max-w-xs truncate text-left hover:text-primary" title="View release notes">
            {truncate(release.notes.replace(/\s+/g, ' '), 50)}
          </button>
        ) : (
          <Placeholder>No notes</Placeholder>
        ),
    },
    {
      key: 'pub_date',
      label: 'Release date',
      className: 'whitespace-nowrap text-gray-500',
      render: (release) => (release.pub_date ? formatDateTime(release.pub_date) : <Placeholder>—</Placeholder>),
    },
    {
      key: 'created_at',
      label: 'Uploaded',
      className: 'whitespace-nowrap text-gray-500',
      render: (release) => formatDateTime(release.created_at),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (release) => (
        <div className="flex gap-3">
          <ActionButton
            color={release.published ? 'warning' : 'success'}
            disabled={busyId === release.id}
            onClick={() => togglePublished(release)}
          >
            {release.published ? 'Unpublish' : 'Publish'}
          </ActionButton>
          <ActionButton onClick={() => openEdit(release)}>Notes</ActionButton>
          {!release.published && (
            <ActionButton color="danger" onClick={() => handleDelete(release)}>Delete</ActionButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="App Releases"
        description={`Signed ${APP_NAME} desktop installers and the update feed the Tauri updater polls`}
        actions={
          <>
            <Button variant="secondary" onClick={loadReleases}>Refresh</Button>
            <Button onClick={openUpload}>+ Publish Release</Button>
          </>
        }
      />

      {!loading && <CurrentReleaseCard release={current} onPreview={handlePreview} />}

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">All releases</h2>
        <DataTable
          columns={columns}
          rows={releases}
          rowKey={(release) => release.id}
          loading={loading}
          loadingLabel="Loading releases…"
          emptyMessage="No releases uploaded yet"
        />
      </Card>

      {/* Upload */}
      <Modal isOpen={uploadOpen} onClose={closeUpload} title={`Publish ${APP_NAME} Release`} size="md">
        <form onSubmit={handleUpload}>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
            <FormField label="Version" htmlFor="release-version" required hint="Semver, e.g. 2.1.0 or 2.1.0-beta.1">
              <Input id="release-version" required value={form.version} onChange={setField('version')} placeholder="2.1.0" autoComplete="off" spellCheck={false} disabled={uploading} />
            </FormField>
            <FormField label="Target" htmlFor="release-target">
              <Select id="release-target" value={form.target} onChange={setField('target')} disabled={uploading}>
                {TARGETS.map((target) => <option key={target} value={target}>{target}</option>)}
              </Select>
            </FormField>
            <FormField label="Architecture" htmlFor="release-arch">
              <Select id="release-arch" value={form.arch} onChange={setField('arch')} disabled={uploading}>
                {ARCHS.map((arch) => <option key={arch.value} value={arch.value}>{arch.label}</option>)}
              </Select>
            </FormField>
          </div>

          <FormField
            label="Installer"
            htmlFor="release-installer"
            required
            hint={`Must be named ${expectedInstaller} (the NSIS installer written by the Tauri bundler).`}
          >
            <input
              id="release-installer"
              type="file"
              accept=".exe"
              required
              disabled={uploading}
              onChange={(event) => setForm((prev) => ({ ...prev, installer: event.target.files?.[0] || null }))}
              className={FILE_INPUT_CLASS}
            />
            {form.installer && (
              <p className={`mt-1 text-xs ${installerMismatch ? 'text-red-600' : 'text-gray-600'}`}>
                {form.installer.name} · {formatBytes(form.installer.size)}
                {installerMismatch && ' — name does not match the version/architecture'}
              </p>
            )}
          </FormField>

          <FormField
            label="Signature (.sig)"
            htmlFor="release-signature-file"
            required
            hint="The .sig file the bundler writes next to the installer, or paste its full content below. It is stored verbatim."
          >
            <input
              id="release-signature-file"
              type="file"
              accept=".sig,text/plain"
              disabled={uploading}
              onChange={(event) => setForm((prev) => ({ ...prev, signatureFile: event.target.files?.[0] || null }))}
              className={FILE_INPUT_CLASS}
            />
            {!form.signatureFile && (
              <Textarea
                id="release-signature-text"
                className="mt-2 font-mono text-xs"
                rows={4}
                value={form.signatureText}
                onChange={setField('signatureText')}
                placeholder={'untrusted comment: signature from tauri secret key\nRUQ…\ntrusted comment: timestamp:…\tfile:…\n…'}
                spellCheck={false}
                disabled={uploading}
              />
            )}
          </FormField>

          <FormField label="Release notes" htmlFor="release-notes" hint={`Markdown or plain text shown by the updater. ${form.notes.length}/${NOTES_MAX}`}>
            <Textarea id="release-notes" rows={5} value={form.notes} onChange={setField('notes')} placeholder={'## Changes\n- Faster PDF export\n- Fixed bold runs'} disabled={uploading} maxLength={NOTES_MAX} />
          </FormField>

          <FormField
            label="Release date"
            htmlFor="release-pub-date"
            hint={form.pubDate ? `Sent to the updater as ${localToRfc3339(form.pubDate)}` : 'Optional. Leave empty to omit pub_date from the manifest.'}
          >
            <Input id="release-pub-date" type="datetime-local" value={form.pubDate} onChange={setField('pubDate')} disabled={uploading} />
          </FormField>

          <div className="mb-5">
            <Checkbox
              id="release-published"
              checked={form.published}
              onChange={(checked) => setForm((prev) => ({ ...prev, published: checked }))}
              disabled={uploading}
              label="Publish immediately"
              hint="Unpublished releases are stored but never offered to installed apps."
            />
          </div>

          {uploading && (
            <div className="mb-4">
              <div className="mb-1 flex justify-between text-xs text-gray-600">
                <span>{progress < 100 ? 'Uploading…' : 'Processing on the server (checksum)…'}</span>
                <span>{progress}%</span>
              </div>
              <ProgressBar percent={progress} />
            </div>
          )}

          <div className="flex gap-2">
            {uploading ? (
              <Button type="button" variant="secondary" className="w-full" onClick={() => abortRef.current?.abort()}>Cancel upload</Button>
            ) : (
              <Button type="button" variant="secondary" className="w-full" onClick={closeUpload}>Close</Button>
            )}
            <Button type="submit" className="w-full" loading={uploading}>{uploading ? 'Uploading' : 'Upload Release'}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit notes */}
      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `Release notes · v${editing.version}` : ''} size="md">
        {editing && (
          <form onSubmit={handleEdit}>
            <FormField label="Notes" htmlFor="edit-notes" hint={`Markdown or plain text. ${editNotes.length}/${NOTES_MAX}`}>
              <Textarea id="edit-notes" rows={10} value={editNotes} onChange={(event) => setEditNotes(event.target.value)} maxLength={NOTES_MAX} />
            </FormField>
            <Button type="submit" className="w-full" loading={saving}>Save Notes</Button>
          </form>
        )}
      </Modal>

      {/* Notes viewer */}
      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing ? `Release notes · v${viewing.version}` : ''} size="md">
        {viewing && <pre className="whitespace-pre-wrap break-words rounded-md bg-gray-50 p-4 font-sans text-sm text-gray-800">{viewing.notes}</pre>}
      </Modal>

      {/* Manifest preview */}
      <Modal isOpen={Boolean(preview)} onClose={() => setPreview(null)} title={preview ? `Update check for an app on v${preview.version}` : ''} size="md">
        {preview && (
          preview.manifest ? (
            <>
              <p className="mb-3 text-sm text-gray-600">The updater receives <code>200 OK</code> with this manifest:</p>
              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-900 p-4 font-mono text-xs text-gray-100">
                {JSON.stringify(preview.manifest, null, 2)}
              </pre>
            </>
          ) : (
            <p className="text-sm text-gray-600">The updater receives <code>204 No Content</code>: an app on v{preview.version} is up to date.</p>
          )
        )}
      </Modal>
    </Page>
  );
};

export default AppReleases;
