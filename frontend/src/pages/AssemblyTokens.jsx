import React, { useCallback, useEffect, useState } from 'react';
import { AssemblyTokenAPI, UsersAPI } from '../services/api';
import { Modal } from '../components/Modal';
import { ActionButton, Button, Card, DataTable, FormField, Input, Page, PageHeader, Placeholder, Select } from '../components/ui';
import { useConfirm, useToast } from '../contexts/UIContext';
import { formatDateTime, maskSecret } from '../utils/format';

const EMPTY_FORM = { user_id: '', api_key: '' };

const AssemblyTokens = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [tokens, setTokens] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingToken, setEditingToken] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState({});

  const loadTokens = useCallback(async () => {
    try {
      setLoading(true);
      const data = await AssemblyTokenAPI.getAll();
      setTokens(data.tokens || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await UsersAPI.getAll();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, []);

  useEffect(() => {
    loadTokens();
    loadUsers();
  }, [loadTokens, loadUsers]);

  const openAdd = () => {
    setEditingToken(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (token) => {
    setEditingToken(token);
    setForm({ user_id: String(token.user_id), api_key: token.api_key });
    setModalOpen(true);
  };

  const updateForm = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSave = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      const userId = Number(form.user_id);
      const apiKey = form.api_key.trim();
      if (editingToken) {
        await AssemblyTokenAPI.update(editingToken.id, userId, apiKey);
        toast.success('Assembly token updated');
      } else {
        await AssemblyTokenAPI.create(userId, apiKey);
        toast.success('Assembly token added');
      }
      setModalOpen(false);
      loadTokens();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (token) => {
    const owner = token.user_name || token.user_email || 'Unknown user';
    const ok = await confirm({
      title: 'Delete assembly token',
      message: `Delete the assembly token for ${owner}?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await AssemblyTokenAPI.delete(token.id);
      toast.success('Assembly token deleted');
      loadTokens();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const toggleReveal = (id) => setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'user_name', label: 'User', render: (token) => token.user_name || <Placeholder>N/A</Placeholder> },
    { key: 'user_email', label: 'Email', render: (token) => token.user_email || <Placeholder>N/A</Placeholder> },
    {
      key: 'api_key',
      label: 'API Key',
      render: (token) => (
        <div className="flex items-center gap-2">
          <code className="font-mono text-xs">{revealed[token.id] ? token.api_key : maskSecret(token.api_key)}</code>
          <button
            type="button"
            onClick={() => toggleReveal(token.id)}
            className="text-xs text-blue-600 hover:text-blue-900"
            aria-label={revealed[token.id] ? 'Hide API key' : 'Show API key'}
          >
            {revealed[token.id] ? 'Hide' : 'Show'}
          </button>
        </div>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      className: 'whitespace-nowrap text-gray-500',
      render: (token) => formatDateTime(token.created_at),
    },
    {
      key: 'updated_at',
      label: 'Updated',
      className: 'whitespace-nowrap text-gray-500',
      render: (token) => (token.updated_at ? formatDateTime(token.updated_at) : <Placeholder>N/A</Placeholder>),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (token) => (
        <div className="flex gap-3">
          <ActionButton onClick={() => openEdit(token)}>Edit</ActionButton>
          <ActionButton color="danger" onClick={() => handleDelete(token)}>Delete</ActionButton>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Assembly Tokens"
        description="AssemblyAI API keys assigned to users of the client application"
        actions={
          <>
            <Button variant="secondary" onClick={loadTokens}>Refresh</Button>
            <Button onClick={openAdd}>+ Add Assembly Token</Button>
          </>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={tokens}
          rowKey={(token) => token.id}
          loading={loading}
          loadingLabel="Loading assembly tokens…"
          emptyMessage="No assembly tokens yet"
        />
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingToken ? 'Edit Assembly Token' : 'Add Assembly Token'} size="sm">
        <form onSubmit={handleSave}>
          <FormField label="User" htmlFor="token-user" required hint="Select the user this assembly token belongs to.">
            <Select id="token-user" required value={form.user_id} onChange={updateForm('user_id')}>
              <option value="">Select a user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="API Key" htmlFor="token-key" required hint="Enter the AssemblyAI API key for this user.">
            <Input
              id="token-key"
              required
              value={form.api_key}
              onChange={updateForm('api_key')}
              placeholder="Enter assembly API key"
              autoComplete="off"
            />
          </FormField>
          <Button type="submit" className="w-full" loading={saving}>
            {editingToken ? 'Update Assembly Token' : 'Add Assembly Token'}
          </Button>
        </form>
      </Modal>
    </Page>
  );
};

export default AssemblyTokens;
