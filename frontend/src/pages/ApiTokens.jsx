import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiTokensAPI, JobsAPI } from '../services/api';
import { Modal } from '../components/Modal';
import { ActionButton, Badge, Button, Card, DataTable, FormField, Input, Page, PageHeader, Placeholder, Select } from '../components/ui';
import { useConfirm, useToast } from '../contexts/UIContext';
import { copyToClipboard, formatDateTime } from '../utils/format';

const EXPIRY_OPTIONS = [
  { value: '', label: 'Never expires' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '1 year' },
];

const EMPTY_FORM = { name: '', expires_in_days: '' };

const STATUS_BADGE = {
  active: { color: 'green', label: 'Active' },
  revoked: { color: 'red', label: 'Revoked' },
  expired: { color: 'amber', label: 'Expired' },
};

const StatusBadge = ({ status }) => {
  const badge = STATUS_BADGE[status] || { color: 'gray', label: status };
  return <Badge color={badge.color}>{badge.label}</Badge>;
};

/** One-time reveal of a freshly generated token, with copy and usage example. */
const GeneratedToken = ({ token, apiToken, onDone }) => {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const jobsUrl = JobsAPI.absoluteUrl('/jobs');

  const copy = async () => {
    await copyToClipboard(token);
    setCopied(true);
    toast.success('Token copied to clipboard');
  };

  return (
    <div>
      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Copy this token now. For security it is stored hashed and <strong>cannot be shown again</strong>.
      </div>

      <FormField label={`Token for "${apiToken.name}"`} htmlFor="generated-token">
        <div className="flex gap-2">
          <Input id="generated-token" readOnly value={token} className="font-mono text-xs" onFocus={(event) => event.target.select()} />
          <Button variant={copied ? 'secondary' : 'primary'} onClick={copy} className="shrink-0">
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </FormField>

      <FormField label="Usage" hint="Send the token in the Authorization header (or as X-API-Key).">
        <pre className="overflow-x-auto rounded-md bg-slate-800 p-3 text-xs text-slate-100">
{`curl -H "Authorization: Bearer ${token}" \\
  "${jobsUrl}?date=YYYY-MM-DD&page=1&limit=50"`}
        </pre>
      </FormField>

      <Button className="w-full" onClick={onDone}>Done</Button>
    </div>
  );
};

const ApiTokens = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState(null);

  const loadTokens = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ApiTokensAPI.getAll();
      setTokens(data.tokens || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const activeCount = useMemo(() => tokens.filter((token) => token.status === 'active').length, [tokens]);

  const openGenerate = () => {
    setForm(EMPTY_FORM);
    setGenerated(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setGenerated(null);
  };

  const updateForm = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleGenerate = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      const data = await ApiTokensAPI.create({
        name: form.name.trim(),
        expires_in_days: form.expires_in_days ? Number(form.expires_in_days) : undefined,
      });
      setGenerated({ token: data.token, apiToken: data.api_token });
      toast.success('API token generated');
      loadTokens();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (token) => {
    const ok = await confirm({
      title: 'Revoke API token',
      message: `Revoke "${token.name}"? Applications using this token will immediately lose access to the job list.`,
      confirmLabel: 'Revoke',
      danger: true,
    });
    if (!ok) return;

    try {
      await ApiTokensAPI.revoke(token.id);
      toast.success('API token revoked');
      loadTokens();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (token) => {
    const ok = await confirm({
      title: 'Delete API token',
      message: `Delete "${token.name}"? ${token.status === 'active' ? 'Applications using this token will immediately lose access. ' : ''}This removes the record permanently.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await ApiTokensAPI.delete(token.id);
      toast.success('API token deleted');
      loadTokens();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    { key: 'name', label: 'Name', className: 'font-medium text-gray-900' },
    {
      key: 'token_prefix',
      label: 'Token',
      render: (token) => <code className="font-mono text-xs text-gray-700">{token.token_prefix}…</code>,
    },
    { key: 'status', label: 'Status', render: (token) => <StatusBadge status={token.status} /> },
    {
      key: 'created_by',
      label: 'Created by',
      render: (token) => token.created_by_name || token.created_by_email || <Placeholder>N/A</Placeholder>,
    },
    {
      key: 'created_at',
      label: 'Created',
      className: 'whitespace-nowrap text-gray-500',
      render: (token) => formatDateTime(token.created_at),
    },
    {
      key: 'expires_at',
      label: 'Expires',
      className: 'whitespace-nowrap text-gray-500',
      render: (token) => (token.expires_at ? formatDateTime(token.expires_at) : <Placeholder>Never</Placeholder>),
    },
    {
      key: 'last_used_at',
      label: 'Last used',
      className: 'whitespace-nowrap text-gray-500',
      render: (token) => (token.last_used_at ? formatDateTime(token.last_used_at) : <Placeholder>Never</Placeholder>),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (token) => (
        <div className="flex gap-3">
          {token.status === 'active' && (
            <ActionButton color="warning" onClick={() => handleRevoke(token)}>Revoke</ActionButton>
          )}
          <ActionButton color="danger" onClick={() => handleDelete(token)}>Delete</ActionButton>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="API Tokens"
        description="Tokens that let applications without a user login read the job list (GET /api/jobs and /api/jobs/today). Signed-in users need no token."
        actions={
          <>
            <Button variant="secondary" onClick={loadTokens}>Refresh</Button>
            <Button onClick={openGenerate}>+ Generate Token</Button>
          </>
        }
      />

      <Card className="mb-6">
        <DataTable
          columns={columns}
          rows={tokens}
          rowKey={(token) => token.id}
          loading={loading}
          loadingLabel="Loading API tokens…"
          emptyMessage="No API tokens yet. Generate one to give another application access to the job list."
        />
        {!loading && tokens.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            {activeCount} active of {tokens.length} token{tokens.length === 1 ? '' : 's'}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-base font-semibold text-gray-900">How to use a token</h2>
        <p className="mb-3 text-sm text-gray-600">
          Send the token with every request to the job list endpoints. Either header works.
        </p>
        <pre className="overflow-x-auto rounded-md bg-slate-800 p-3 text-xs text-slate-100">
{`# Job list (filters: date, industry, search, page, limit, orderDirection)
curl -H "Authorization: Bearer <token>" "${JobsAPI.absoluteUrl('/jobs')}?date=YYYY-MM-DD"

# Today's jobs
curl -H "X-API-Key: <token>" "${JobsAPI.absoluteUrl('/jobs/today')}"`}
        </pre>
        <p className="mt-3 text-xs text-gray-500">
          The full token is only shown once, right after it is generated. Revoke a token to disable it without deleting its record.
        </p>
      </Card>

      <Modal isOpen={modalOpen} onClose={closeModal} title={generated ? 'Token generated' : 'Generate API Token'} size="md">
        {generated ? (
          <GeneratedToken token={generated.token} apiToken={generated.apiToken} onDone={closeModal} />
        ) : (
          <form onSubmit={handleGenerate}>
            <FormField label="Name" htmlFor="api-token-name" required hint="Which application or person will use this token, e.g. “Job scraper”.">
              <Input
                id="api-token-name"
                required
                maxLength={100}
                value={form.name}
                onChange={updateForm('name')}
                placeholder="e.g. Job scraper"
                autoComplete="off"
                autoFocus
              />
            </FormField>
            <FormField label="Expiration" htmlFor="api-token-expiry" hint="The token stops working after this period. You can revoke it at any time.">
              <Select id="api-token-expiry" value={form.expires_in_days} onChange={updateForm('expires_in_days')}>
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </FormField>
            <Button type="submit" className="w-full" loading={saving}>Generate Token</Button>
          </form>
        )}
      </Modal>
    </Page>
  );
};

export default ApiTokens;
