import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminAuthAPI, AllowedEmailAPI, UsersAPI, getUser } from '../services/api';
import { Modal } from '../components/Modal';
import { ActionButton, Badge, Button, Card, DataTable, FormField, Input, Page, PageHeader, Placeholder } from '../components/ui';
import { useConfirm, useToast } from '../contexts/UIContext';
import { formatDate } from '../utils/format';

const EMPTY_FORM = { name: '', email: '', password: '', confirmPassword: '', registration_ip: '' };

const Users = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const currentUser = getUser();

  const [users, setUsers] = useState([]);
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await UsersAPI.getAll();
      setUsers(data.users || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadAllowedEmails = useCallback(async () => {
    try {
      const data = await AllowedEmailAPI.getAll();
      setAllowedEmails(data.emails || []);
    } catch (error) {
      console.error('Error loading allowed emails:', error);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadAllowedEmails();
  }, [loadUsers, loadAllowedEmails]);

  const allowedIdByEmail = useMemo(
    () => new Map(allowedEmails.map((item) => [item.email.toLowerCase(), item.id])),
    [allowedEmails]
  );

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (user) => (user.name || '').toLowerCase().includes(term) || user.email.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  const isCurrentUser = (user) => Boolean(currentUser && (user.id === currentUser.id || user.email === currentUser.email));
  const isAllowed = (user) => allowedIdByEmail.has(user.email.toLowerCase());

  const openAdd = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({ ...EMPTY_FORM, name: user.name, email: user.email, registration_ip: user.registration_ip || '' });
    setModalOpen(true);
  };

  const updateForm = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSave = async (event) => {
    event.preventDefault();
    if (!editingUser && form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setSaving(true);
      if (editingUser) {
        await UsersAPI.update(editingUser.id, {
          name: form.name,
          email: form.email,
          registration_ip: form.registration_ip || null,
        });
        toast.success('User updated');
      } else {
        await AdminAuthAPI.register(form.name, form.email, form.password, form.confirmPassword);
        toast.success('User created');
      }
      setModalOpen(false);
      loadUsers();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBlock = async (user) => {
    if (isCurrentUser(user)) {
      toast.warning('You cannot block or unblock yourself.');
      return;
    }
    const blocking = user.blocked === 1;
    const ok = await confirm({
      title: blocking ? 'Block user' : 'Unblock user',
      message: `${blocking ? 'Block' : 'Unblock'} ${user.email}?`,
      confirmLabel: blocking ? 'Block' : 'Unblock',
      danger: blocking,
    });
    if (!ok) return;

    try {
      await UsersAPI.toggleBlock(user.id, blocking ? 0 : 1);
      toast.success(`User ${blocking ? 'blocked' : 'unblocked'}`);
      loadUsers();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (user) => {
    if (isCurrentUser(user)) {
      toast.warning('You cannot delete yourself.');
      return;
    }
    const ok = await confirm({
      title: 'Delete user',
      message: `Permanently delete ${user.email}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await UsersAPI.delete(user.id);
      toast.success('User deleted');
      loadUsers();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleToggleAllowed = async (user) => {
    const allowedId = allowedIdByEmail.get(user.email.toLowerCase());
    try {
      if (allowedId) {
        await AllowedEmailAPI.delete(allowedId);
        toast.success(`${user.email} removed from the allowed list`);
      } else {
        await AllowedEmailAPI.create(user.email);
        toast.success(`${user.email} added to the allowed list`);
      }
      loadAllowedEmails();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    {
      key: 'name',
      label: 'Name',
      render: (user) => (
        <span className="flex items-center gap-2">
          {user.name}
          {isCurrentUser(user) && <Badge color="green">You</Badge>}
        </span>
      ),
    },
    { key: 'email', label: 'Email' },
    {
      key: 'registration_ip',
      label: 'Registration IP',
      className: 'whitespace-nowrap text-gray-500',
      render: (user) => user.registration_ip || <Placeholder />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          <Badge color={user.blocked === 1 ? 'green' : 'red'}>{user.blocked === 1 ? 'Active' : 'Blocked'}</Badge>
          {user.role === 'admin' && <Badge color="purple">Admin</Badge>}
          {isAllowed(user) && <Badge color="blue">Email allowed</Badge>}
        </div>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      className: 'whitespace-nowrap text-gray-500',
      render: (user) => formatDate(user.created_at),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (user) => {
        const self = isCurrentUser(user);
        const allowed = isAllowed(user);
        return (
          <div className="flex flex-wrap gap-3">
            <ActionButton onClick={() => openEdit(user)}>Edit</ActionButton>
            <ActionButton color={allowed ? 'danger' : 'success'} onClick={() => handleToggleAllowed(user)}>
              {allowed ? 'Deny Email' : 'Allow Email'}
            </ActionButton>
            <ActionButton
              color="warning"
              onClick={() => handleToggleBlock(user)}
              disabled={self}
              title={self ? 'You cannot block yourself' : undefined}
            >
              {user.blocked === 1 ? 'Block' : 'Unblock'}
            </ActionButton>
            <ActionButton
              color="danger"
              onClick={() => handleDelete(user)}
              disabled={self}
              title={self ? 'You cannot delete yourself' : undefined}
            >
              Delete
            </ActionButton>
          </div>
        );
      },
    },
  ];

  return (
    <Page>
      <PageHeader
        title="User Management"
        description="Accounts, access status and login allow-list"
        actions={
          <>
            <Button variant="secondary" onClick={loadUsers}>Refresh</Button>
            <Button onClick={openAdd}>+ Add User</Button>
          </>
        }
      />

      <Card>
        <div className="mb-4">
          <Input
            type="search"
            placeholder="Search by name or email…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search users"
          />
        </div>

        <DataTable
          columns={columns}
          rows={filteredUsers}
          rowKey={(user) => user.id}
          loading={loading}
          loadingLabel="Loading users…"
          emptyMessage={searchTerm ? 'No users match your search' : 'No users found'}
        />
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingUser ? 'Edit User' : 'Add User'} size="sm">
        <form onSubmit={handleSave}>
          <FormField label="Name" htmlFor="user-name" required>
            <Input id="user-name" required value={form.name} onChange={updateForm('name')} />
          </FormField>
          <FormField label="Email" htmlFor="user-email" required>
            <Input id="user-email" type="email" required value={form.email} onChange={updateForm('email')} />
          </FormField>

          {editingUser ? (
            <FormField label="Registration IP" htmlFor="user-ip" hint="Leave empty to allow login from any IP">
              <Input id="user-ip" value={form.registration_ip} onChange={updateForm('registration_ip')} placeholder="192.168.1.100" />
            </FormField>
          ) : (
            <>
              <FormField label="Password" htmlFor="user-password" required>
                <Input
                  id="user-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={updateForm('password')}
                />
              </FormField>
              <FormField label="Confirm Password" htmlFor="user-password-confirm" required>
                <Input
                  id="user-password-confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={updateForm('confirmPassword')}
                />
              </FormField>
              <p className="mb-4 rounded-md bg-blue-50 p-3 text-xs text-blue-800">
                Users created from the dashboard receive the admin role.
              </p>
            </>
          )}

          <Button type="submit" className="w-full" loading={saving}>
            {editingUser ? 'Update User' : 'Add User'}
          </Button>
        </form>
      </Modal>
    </Page>
  );
};

export default Users;
