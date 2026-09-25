import React, { useCallback, useEffect, useState } from 'react';
import { BlockListAPI } from '../../services/api';
import { Modal } from '../../components/Modal';
import { ActionButton, Button, Card, DataTable, FormField, Input, Placeholder } from '../../components/ui';
import { useConfirm, useToast } from '../../contexts/UIContext';
import { formatDate, truncate } from '../../utils/format';

const EMPTY_FORM = { company_name: '', url: '' };

const BlockListTab = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await BlockListAPI.getAll();
      setItems(data.items || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const openAdd = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({ company_name: item.company_name || '', url: item.url || '' });
    setModalOpen(true);
  };

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSave = async (event) => {
    event.preventDefault();
    const companyName = form.company_name.trim();
    const url = form.url.trim();
    if (!companyName && !url) {
      toast.error('Provide a company name or a URL');
      return;
    }

    try {
      setSaving(true);
      if (editingItem) {
        await BlockListAPI.update(editingItem.id, companyName, url);
        toast.success('Block list item updated');
      } else {
        await BlockListAPI.create(companyName, url);
        toast.success('Block list item added');
      }
      setModalOpen(false);
      loadItems();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: 'Delete block list item',
      message: `Stop blocking ${item.company_name || item.url}?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await BlockListAPI.delete(item.id);
      toast.success('Block list item deleted');
      loadItems();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    {
      key: 'company_name',
      label: 'Company Name',
      render: (item) => item.company_name || <Placeholder>Not specified</Placeholder>,
    },
    {
      key: 'url',
      label: 'URL',
      className: 'max-w-md text-gray-500',
      render: (item) =>
        item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="break-all text-blue-600 hover:text-blue-900" title={item.url}>
            {truncate(item.url, 60)}
          </a>
        ) : (
          <Placeholder>Not specified</Placeholder>
        ),
    },
    {
      key: 'created_at',
      label: 'Created',
      className: 'whitespace-nowrap text-gray-500',
      render: (item) => formatDate(item.created_at),
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
    <>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={loadItems}>🔄 Refresh</Button>
        <Button onClick={openAdd}>+ Add Block List Item</Button>
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(item) => item.id}
          loading={loading}
          loadingLabel="Loading block list…"
          emptyMessage="No blocked companies or URLs yet"
        />
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingItem ? 'Edit Block List Item' : 'Add Block List Item'} size="sm">
        <form onSubmit={handleSave}>
          <FormField label="Company Name" htmlFor="block-company" hint="Leave empty if blocking by URL only">
            <Input id="block-company" value={form.company_name} onChange={update('company_name')} placeholder="Company name to block" autoFocus />
          </FormField>
          <FormField label="URL" htmlFor="block-url" hint="Leave empty if blocking by company name only">
            <Input id="block-url" type="url" value={form.url} onChange={update('url')} placeholder="https://example.com" />
          </FormField>
          <p className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
            At least one of company name or URL must be provided. URLs are normalised before they are stored.
          </p>
          <Button type="submit" className="w-full" loading={saving}>
            {editingItem ? 'Update Block List Item' : 'Add Block List Item'}
          </Button>
        </form>
      </Modal>
    </>
  );
};

export default BlockListTab;
