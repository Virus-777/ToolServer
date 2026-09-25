import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HistoryAPI } from '../services/api';
import { Modal } from '../components/Modal';
import Pagination from '../components/Pagination';
import { ActionButton, Badge, Button, Card, DataTable, FormField, Input, Page, PageHeader, Placeholder, Select } from '../components/ui';
import { useToast } from '../contexts/UIContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatDateTime } from '../utils/format';

const ACTION_OPTIONS = [
  { value: 'sign_up', label: 'Sign Up' },
  { value: 'login', label: 'Login' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
];

const ENTITY_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'job', label: 'Job' },
  { value: 'block_list', label: 'Block List' },
  { value: 'setting', label: 'Setting' },
  { value: 'config', label: 'Config' },
  { value: 'allowed_email', label: 'Allowed Email' },
  { value: 'assembly_token', label: 'Assembly Token' },
];

const ACTION_COLORS = {
  sign_up: 'green',
  login: 'blue',
  create: 'purple',
  update: 'yellow',
  delete: 'red',
};

const formatMetadata = (metadata) => {
  if (!metadata) return null;
  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(metadata);
  }
};

const History = () => {
  const toast = useToast();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ user_id: '', action_type: '', entity_type: '' });
  const [selectedLog, setSelectedLog] = useState(null);
  const debouncedUserId = useDebouncedValue(filters.user_id, 400);
  const requestId = useRef(0);

  const loadHistory = useCallback(async () => {
    const id = ++requestId.current;
    try {
      setLoading(true);
      const data = await HistoryAPI.getAll({
        page,
        limit: pageSize,
        user_id: debouncedUserId || undefined,
        action_type: filters.action_type || undefined,
        entity_type: filters.entity_type || undefined,
      });
      if (id !== requestId.current) return; // a newer request has superseded this one
      setLogs(data.logs || []);
      setPagination(data.pagination);
    } catch (error) {
      if (id === requestId.current) toast.error(error.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, pageSize, debouncedUserId, filters.action_type, filters.entity_type, toast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({ ...prev, [field]: event.target.value }));
    setPage(1);
  };

  const columns = [
    { key: 'id', label: 'ID' },
    {
      key: 'user',
      label: 'User',
      render: (log) => log.user_email || (log.user_id ? `User #${log.user_id}` : <Placeholder>System</Placeholder>),
    },
    {
      key: 'action_type',
      label: 'Action',
      render: (log) => <Badge color={ACTION_COLORS[log.action_type] || 'gray'}>{log.action_type}</Badge>,
    },
    {
      key: 'entity_type',
      label: 'Entity',
      className: 'whitespace-nowrap text-gray-500',
      render: (log) => `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}`,
    },
    {
      key: 'description',
      label: 'Description',
      className: 'max-w-md truncate text-gray-600',
      render: (log) => (
        <span title={log.description || undefined}>{log.description || <Placeholder>No description</Placeholder>}</span>
      ),
    },
    {
      key: 'ip_address',
      label: 'IP Address',
      className: 'whitespace-nowrap text-gray-500',
      render: (log) => log.ip_address || <Placeholder>N/A</Placeholder>,
    },
    {
      key: 'created_at',
      label: 'Timestamp',
      className: 'whitespace-nowrap text-gray-500',
      render: (log) => formatDateTime(log.created_at),
    },
    {
      key: 'actions',
      label: '',
      render: (log) => <ActionButton onClick={() => setSelectedLog(log)}>Details</ActionButton>,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="History Logs"
        description="Audit trail of logins, registrations and every change made through the API"
        actions={<Button variant="secondary" onClick={loadHistory}>Refresh</Button>}
      />

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="User ID" htmlFor="history-user">
            <Input
              id="history-user"
              type="number"
              min="1"
              value={filters.user_id}
              onChange={handleFilterChange('user_id')}
              placeholder="Filter by user ID"
            />
          </FormField>
          <FormField label="Action Type" htmlFor="history-action">
            <Select id="history-action" value={filters.action_type} onChange={handleFilterChange('action_type')}>
              <option value="">All Actions</option>
              {ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Entity Type" htmlFor="history-entity">
            <Select id="history-entity" value={filters.entity_type} onChange={handleFilterChange('entity_type')}>
              <option value="">All Entities</option>
              {ENTITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </FormField>
        </div>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          rows={logs}
          rowKey={(log) => log.id}
          loading={loading}
          loadingLabel="Loading history…"
          emptyMessage="No history logs match the current filters"
        />

        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pageSize}
          pageSizeOptions={[20, 50, 100, 200]}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </Card>

      <Modal isOpen={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} title={`Log #${selectedLog?.id ?? ''}`} size="sm">
        {selectedLog && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-gray-500">User</dt>
              <dd>{selectedLog.user_email || (selectedLog.user_id ? `User #${selectedLog.user_id}` : 'System')}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Action</dt>
              <dd><Badge color={ACTION_COLORS[selectedLog.action_type] || 'gray'}>{selectedLog.action_type}</Badge></dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Entity</dt>
              <dd>{selectedLog.entity_type}{selectedLog.entity_id ? ` #${selectedLog.entity_id}` : ''}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Description</dt>
              <dd className="break-words">{selectedLog.description || <Placeholder>No description</Placeholder>}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">IP Address</dt>
              <dd>{selectedLog.ip_address || <Placeholder>N/A</Placeholder>}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Timestamp</dt>
              <dd>{formatDateTime(selectedLog.created_at)}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Metadata</dt>
              <dd>
                {selectedLog.metadata ? (
                  <pre className="mt-1 overflow-x-auto rounded-md bg-gray-50 p-3 font-mono text-xs">{formatMetadata(selectedLog.metadata)}</pre>
                ) : (
                  <Placeholder>None</Placeholder>
                )}
              </dd>
            </div>
          </dl>
        )}
      </Modal>
    </Page>
  );
};

export default History;
