import React, { useCallback, useEffect, useState } from 'react';
import { AllowedEmailAPI } from '../services/api';
import { Modal } from '../components/Modal';
import { ActionButton, Button, Card, DataTable, FormField, Input, Page, PageHeader, Placeholder } from '../components/ui';
import { useConfirm, useToast } from '../contexts/UIContext';
import { formatDateTime } from '../utils/format';

const AllowedEmails = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState(null);
  const [emailValue, setEmailValue] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAllowedEmails = useCallback(async () => {
    try {
      setLoading(true);
      const data = await AllowedEmailAPI.getAll();
      setEmails(data.emails || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAllowedEmails();
  }, [loadAllowedEmails]);

  const openAdd = () => {
    setEditingEmail(null);
    setEmailValue('');
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingEmail(item);
    setEmailValue(item.email);
    setModalOpen(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      if (editingEmail) {
        await AllowedEmailAPI.update(editingEmail.id, emailValue.trim());
        toast.success('Allowed email updated');
      } else {
        await AllowedEmailAPI.create(emailValue.trim());
        toast.success('Allowed email added');
      }
      setModalOpen(false);
      loadAllowedEmails();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: 'Remove allowed email',
      message: `Remove ${item.email} from the allowed list? The user will no longer be able to log in.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;

    try {
      await AllowedEmailAPI.delete(item.id);
      toast.success('Allowed email removed');
      loadAllowedEmails();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'email', label: 'Email' },
    {
      key: 'created_at',
      label: 'Created',
      className: 'whitespace-nowrap text-gray-500',
      render: (item) => formatDateTime(item.created_at),
    },
    {
      key: 'updated_at',
      label: 'Updated',
      className: 'whitespace-nowrap text-gray-500',
      render: (item) => (item.updated_at ? formatDateTime(item.updated_at) : <Placeholder>N/A</Placeholder>),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item) => (
        <div className="flex gap-3">
          <ActionButton onClick={() => openEdit(item)}>Edit</ActionButton>
          <ActionButton color="danger" onClick={() => handleDelete(item)}>Delete</ActionButton>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Allowed Emails"
        description="Only users whose email is on this list can log in through the client application"
        actions={
          <>
            <Button variant="secondary" onClick={loadAllowedEmails}>Refresh</Button>
            <Button onClick={openAdd}>+ Add Allowed Email</Button>
          </>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={emails}
          rowKey={(item) => item.id}
          loading={loading}
          loadingLabel="Loading allowed emails…"
          emptyMessage="No allowed emails yet"
        />
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingEmail ? 'Edit Allowed Email' : 'Add Allowed Email'} size="sm">
        <form onSubmit={handleSave}>
          <FormField label="Email" htmlFor="allowed-email" required hint="Only users with emails in this list will be able to log in.">
            <Input
              id="allowed-email"
              type="email"
              required
              autoFocus
              value={emailValue}
              onChange={(event) => setEmailValue(event.target.value)}
              placeholder="user@example.com"
            />
          </FormField>
          <Button type="submit" className="w-full" loading={saving}>
            {editingEmail ? 'Update Allowed Email' : 'Add Allowed Email'}
          </Button>
        </form>
      </Modal>
    </Page>
  );
};

export default AllowedEmails;
