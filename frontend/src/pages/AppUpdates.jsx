import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppUpdatesAPI } from '../services/api';
import { Modal } from '../components/Modal';
import { ActionButton, Badge, Button, Card, DataTable, FormField, Input, Page, PageHeader, Placeholder, Textarea } from '../components/ui';
import { useConfirm, useToast } from '../contexts/UIContext';
import { copyToClipboard, formatBytes, formatDateTime, truncate } from '../utils/format';

const APP_NAME = 'RobustTailor';
// Mirrors utils/version.utils.js on the server: 2 to 4 numeric segments
const VERSION_PATTERN = /^\d{1,6}(\.\d{1,6}){1,3}$/;
const EMPTY_UPLOAD_FORM = { version: '', changelog: '', mandatory: false, file: null };

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

const MandatoryCheckbox = ({ id, checked, onChange, disabled }) => (
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
      Mandatory update
      <span className="block text-xs text-gray-500">The client should install this version before it can be used.</span>
    </span>
  </label>
);

const ProgressBar = ({ percent }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
    <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${percent}%` }} />
  </div>
);

/** Summary of the release the client application currently receives from /latest. */
const LatestReleaseCard = ({ release, latestUrl }) => (
  <Card className="mb-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium uppercase tracking-wider text-gray-500">Current release</p>
        {release ? (
          <>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-3xl font-bold text-gray-900">v{release.version}</span>
              <Badge color="green">Latest</Badge>
              {release.mandatory && <Badge color="red">Mandatory</Badge>}
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Published {formatDateTime(release.published_at)} · {release.file_name} ({formatBytes(release.file_size)}) ·{' '}
              {release.download_count} download{release.download_count === 1 ? '' : 's'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>SHA-256</span>
              <code className="break-all font-mono text-gray-700">{release.sha256}</code>
              <CopyButton text={release.sha256} copiedMessage="Checksum copied" />
            </div>
          </>
        ) : (
          <p className="mt-1 text-gray-600">No release has been uploaded yet. The client receives 404 from the update endpoint until one is published.</p>
        )}
      </div>

      <div className="w-full rounded-md bg-gray-50 p-4 text-sm lg:max-w-md">
        <p className="mb-1 font-medium text-gray-700">Update endpoint for {APP_NAME}</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-gray-700" title={latestUrl}>{latestUrl}</code>
          <CopyButton text={latestUrl} copiedMessage="Endpoint URL copied" />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Returns the version, change log, checksum and download URL of the newest release. Append <code>?current=x.y.z</code> to
          get an <code>update_available</code> flag.
        </p>
        {release && (
          <a href={release.download_url} className="mt-3 inline-block text-xs font-medium text-primary hover:text-primary-dark">
            ⬇ Download v{release.version}
          </a>
        )}
      </div>
    </div>
  </Card>
);

const AppUpdates = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState(EMPTY_UPLOAD_FORM);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(null);
  const fileInputRef = useRef(null);

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ changelog: '', mandatory: false });
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState(null);

  const latest = updates[0] || null;
  const latestUrl = AppUpdatesAPI.latestUrl();

  const loadUpdates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await AppUpdatesAPI.getAll();
      setUpdates(data.updates || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUpdates();
  }, [loadUpdates]);

  // Abort an in-flight upload if the page is left
  useEffect(() => () => abortRef.current?.abort(), []);

  /* ---------- upload ---------- */

  const openUpload = () => {
    setUploadForm(EMPTY_UPLOAD_FORM);
    setProgress(0);
    setUploadOpen(true);
  };

  const closeUpload = () => {
    if (uploading) return; // use the Cancel button to abort
    setUploadOpen(false);
  };

  const updateUploadForm = (field) => (event) => setUploadForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleUpload = async (event) => {
    event.preventDefault();
    const version = uploadForm.version.trim().replace(/^v/i, '');

    if (!VERSION_PATTERN.test(version)) {
      toast.error('Version must be 2 to 4 numeric segments separated by dots, e.g. 1.2.0');
      return;
    }
    if (!uploadForm.file) {
      toast.error('Select the release file to upload');
      return;
    }
    if (updates.some((item) => item.version === version)) {
      toast.error(`Version ${version} already exists`);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setUploading(true);
      setProgress(0);
      const data = await AppUpdatesAPI.upload(
        { version, changelog: uploadForm.changelog.trim(), mandatory: uploadForm.mandatory, file: uploadForm.file },
        { onProgress: setProgress, signal: controller.signal }
      );
      toast.success(data.message || `Version ${version} uploaded`);
      setUploadOpen(false);
      loadUpdates();
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

  const cancelUpload = () => abortRef.current?.abort();

  /* ---------- edit ---------- */

  const openEdit = (release) => {
    setEditing(release);
    setEditForm({ changelog: release.changelog || '', mandatory: Boolean(release.mandatory) });
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      const data = await AppUpdatesAPI.update(editing.id, {
        changelog: editForm.changelog.trim(),
        mandatory: editForm.mandatory,
      });
      toast.success(data.message || 'Release updated');
      setEditing(null);
      loadUpdates();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- delete ---------- */

  const handleDelete = async (release) => {
    const isLatest = latest && latest.id === release.id;
    const ok = await confirm({
      title: `Delete version ${release.version}`,
      message: `This removes the release and its file (${release.file_name}) from the server.${
        isLatest && updates.length > 1 ? ` Clients will then receive v${updates[1].version} as the latest version.` : ''
      }${isLatest && updates.length === 1 ? ' No release will be available to clients afterwards.' : ''}`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      const data = await AppUpdatesAPI.delete(release.id);
      toast.success(data.message || 'Release deleted');
      loadUpdates();
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
          {latest && latest.id === release.id && <Badge color="green">Latest</Badge>}
          {release.mandatory && <Badge color="red">Mandatory</Badge>}
        </div>
      ),
    },
    {
      key: 'file_name',
      label: 'File',
      className: 'text-gray-900',
      render: (release) => (
        <div className="min-w-0 max-w-xs">
          <p className="truncate" title={release.file_name}>{release.file_name}</p>
          <p className="text-xs text-gray-500">{formatBytes(release.file_size)}</p>
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
      key: 'download_count',
      label: 'Downloads',
      className: 'whitespace-nowrap text-right text-gray-900',
      headerClassName: 'text-right',
    },
    {
      key: 'changelog',
      label: 'Change log',
      className: 'text-gray-700',
      render: (release) =>
        release.changelog ? (
          <button type="button" onClick={() => setViewing(release)} className="max-w-xs truncate text-left hover:text-primary" title="View change log">
            {truncate(release.changelog.replace(/\s+/g, ' '), 60)}
          </button>
        ) : (
          <Placeholder>No notes</Placeholder>
        ),
    },
    {
      key: 'published_at',
      label: 'Published',
      className: 'whitespace-nowrap text-gray-500',
      render: (release) => formatDateTime(release.published_at),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (release) => (
        <div className="flex gap-3">
          <ActionButton onClick={() => openEdit(release)}>Edit</ActionButton>
          <a href={release.download_url} className="text-sm font-medium text-green-600 hover:text-green-900">Download</a>
          <ActionButton color="danger" onClick={() => handleDelete(release)}>Delete</ActionButton>
        </div>
      ),
    },
  ];

  const selectedFile = uploadForm.file;

  return (
    <Page>
      <PageHeader
        title="App Updates"
        description={`Releases of the ${APP_NAME} client application and the update feed it polls`}
        actions={
          <>
            <Button variant="secondary" onClick={loadUpdates}>Refresh</Button>
            <Button onClick={openUpload}>+ Upload New Version</Button>
          </>
        }
      />

      {!loading && <LatestReleaseCard release={latest} latestUrl={latestUrl} />}

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">All versions</h2>
        <DataTable
          columns={columns}
          rows={updates}
          rowKey={(release) => release.id}
          loading={loading}
          loadingLabel="Loading releases…"
          emptyMessage="No versions uploaded yet"
        />
      </Card>

      {/* Upload */}
      <Modal isOpen={uploadOpen} onClose={closeUpload} title={`Upload ${APP_NAME} Version`} size="md">
        <form onSubmit={handleUpload}>
          <FormField label="Version" htmlFor="release-version" required hint={latest ? `Current latest is v${latest.version}. The newest version number is what clients receive.` : 'Numeric segments separated by dots, e.g. 1.2.0'}>
            <Input
              id="release-version"
              required
              value={uploadForm.version}
              onChange={updateUploadForm('version')}
              placeholder="1.2.0"
              autoComplete="off"
              spellCheck={false}
              disabled={uploading}
            />
          </FormField>

          <FormField label="Release file" htmlFor="release-file" required hint="Installer or archive the client downloads (e.g. .exe, .msi, .zip).">
            <input
              id="release-file"
              ref={fileInputRef}
              type="file"
              required
              disabled={uploading}
              onChange={(event) => setUploadForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20 disabled:opacity-50"
            />
            {selectedFile && (
              <p className="mt-1 text-xs text-gray-600">
                {selectedFile.name} · {formatBytes(selectedFile.size)}
              </p>
            )}
          </FormField>

          <FormField label="Change log" htmlFor="release-changelog" hint="Shown to users before they install the update. Plain text, one change per line works well.">
            <Textarea
              id="release-changelog"
              rows={6}
              value={uploadForm.changelog}
              onChange={updateUploadForm('changelog')}
              placeholder={'- Fixed ...\n- Added ...'}
              disabled={uploading}
            />
          </FormField>

          <div className="mb-5">
            <MandatoryCheckbox
              id="release-mandatory"
              checked={uploadForm.mandatory}
              onChange={(checked) => setUploadForm((prev) => ({ ...prev, mandatory: checked }))}
              disabled={uploading}
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
              <Button type="button" variant="secondary" className="w-full" onClick={cancelUpload}>Cancel upload</Button>
            ) : (
              <Button type="button" variant="secondary" className="w-full" onClick={closeUpload}>Close</Button>
            )}
            <Button type="submit" className="w-full" loading={uploading}>
              {uploading ? 'Uploading' : 'Upload Version'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit notes / mandatory flag */}
      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `Edit v${editing.version}` : ''} size="md">
        {editing && (
          <form onSubmit={handleEdit}>
            <p className="mb-4 text-sm text-gray-600">
              File: <span className="font-medium text-gray-900">{editing.file_name}</span> ({formatBytes(editing.file_size)}). The file and
              version number cannot be changed; upload a new version instead.
            </p>
            <FormField label="Change log" htmlFor="edit-changelog">
              <Textarea
                id="edit-changelog"
                rows={8}
                value={editForm.changelog}
                onChange={(event) => setEditForm((prev) => ({ ...prev, changelog: event.target.value }))}
              />
            </FormField>
            <div className="mb-5">
              <MandatoryCheckbox
                id="edit-mandatory"
                checked={editForm.mandatory}
                onChange={(checked) => setEditForm((prev) => ({ ...prev, mandatory: checked }))}
              />
            </div>
            <Button type="submit" className="w-full" loading={saving}>Save Changes</Button>
          </form>
        )}
      </Modal>

      {/* Change log viewer */}
      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing ? `Change log · v${viewing.version}` : ''} size="md">
        {viewing && (
          <>
            <p className="mb-3 text-xs text-gray-500">Published {formatDateTime(viewing.published_at)}</p>
            <pre className="whitespace-pre-wrap break-words rounded-md bg-gray-50 p-4 font-sans text-sm text-gray-800">{viewing.changelog}</pre>
          </>
        )}
      </Modal>
    </Page>
  );
};

export default AppUpdates;
