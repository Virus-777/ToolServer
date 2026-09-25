import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfigAPI } from '../services/api';
import { Modal } from '../components/Modal';
import { ActionButton, Badge, Button, Card, DataTable, Input, LoadingState, Page, PageHeader, Placeholder } from '../components/ui';
import { useConfirm, useToast } from '../contexts/UIContext';
import { formatDateTime } from '../utils/format';

const PREVIEW_LIMIT = 1500;

/** Long text block with an expand toggle for very large values (resumes, prompts). */
const TextBlock = ({ value }) => {
  const [expanded, setExpanded] = useState(false);

  if (!value) {
    return (
      <div className="rounded-md bg-gray-50 p-4 text-sm">
        <Placeholder />
      </div>
    );
  }

  const isLong = value.length > PREVIEW_LIMIT;
  const shown = expanded || !isLong ? value : `${value.slice(0, PREVIEW_LIMIT)}…`;

  return (
    <div className="rounded-md bg-gray-50 p-4">
      <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-800">{shown}</pre>
      {isLong && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 text-sm font-medium text-primary hover:text-primary-dark">
          {expanded ? 'Show less' : `Show all (${value.length.toLocaleString()} characters)`}
        </button>
      )}
    </div>
  );
};

const Configs = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewEmail, setViewEmail] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ConfigAPI.getAllConfigs();
      setConfigs(data.configs || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const filteredConfigs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return configs;
    return configs.filter((config) => config.user_email.toLowerCase().includes(term));
  }, [configs, searchTerm]);

  const handleView = async (userEmail) => {
    setViewEmail(userEmail);
    setSelectedConfig(null);
    setLoadingConfig(true);
    try {
      const data = await ConfigAPI.getConfig(userEmail);
      setSelectedConfig(data.config);
    } catch (error) {
      toast.error(`Failed to load configuration: ${error.message}`);
      setViewEmail(null);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleDelete = async (userEmail) => {
    const ok = await confirm({
      title: 'Delete configuration',
      message: `Delete the configuration for ${userEmail}? The user will have to set up their prompt, resume and paths again.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await ConfigAPI.delete(userEmail);
      toast.success('Configuration deleted');
      loadConfigs();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const yesNo = (value) => <Badge color={value ? 'green' : 'gray'}>{value ? 'Yes' : 'No'}</Badge>;

  const columns = [
    { key: 'user_email', label: 'User Email', className: 'whitespace-nowrap font-medium text-gray-900' },
    { key: 'prompt', label: 'Prompt', render: (config) => yesNo(config.prompt) },
    { key: 'resume', label: 'Resume', render: (config) => yesNo(config.resume) },
    {
      key: 'template_path',
      label: 'Template Path',
      className: 'max-w-xs break-all text-gray-500',
      render: (config) => config.template_path || <Placeholder />,
    },
    {
      key: 'folder_path',
      label: 'Folder Path',
      className: 'max-w-xs break-all text-gray-500',
      render: (config) => config.folder_path || <Placeholder />,
    },
    {
      key: 'updated_at',
      label: 'Last Updated',
      className: 'whitespace-nowrap text-gray-500',
      render: (config) => formatDateTime(config.updated_at),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (config) => (
        <div className="flex gap-3">
          <ActionButton onClick={() => handleView(config.user_email)}>View</ActionButton>
          <ActionButton color="danger" onClick={() => handleDelete(config.user_email)}>Delete</ActionButton>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="User Configurations"
        description="Prompts, resumes, templates and folders configured by each user of the client application"
        actions={<Button variant="secondary" onClick={loadConfigs}>Refresh</Button>}
      />

      <Card>
        <div className="mb-4">
          <Input
            type="search"
            placeholder="Search by email…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search configurations"
          />
        </div>

        <DataTable
          columns={columns}
          rows={filteredConfigs}
          rowKey={(config) => config.user_email}
          loading={loading}
          loadingLabel="Loading configurations…"
          emptyMessage={searchTerm ? 'No configurations match your search' : 'No configurations found'}
        />
      </Card>

      <Modal isOpen={Boolean(viewEmail)} onClose={() => setViewEmail(null)} title={`Configuration for ${viewEmail || ''}`} size="lg">
        {loadingConfig ? (
          <LoadingState label="Loading configuration…" />
        ) : selectedConfig ? (
          <div className="space-y-6">
            <section>
              <h3 className="mb-2 font-semibold text-gray-900">📝 Prompt</h3>
              <TextBlock value={selectedConfig.prompt} />
            </section>
            <section>
              <h3 className="mb-2 font-semibold text-gray-900">📄 Resume</h3>
              <TextBlock value={selectedConfig.resume} />
            </section>
            <section>
              <h3 className="mb-2 font-semibold text-gray-900">📋 Template Path</h3>
              <div className="break-all rounded-md bg-gray-50 p-4 text-sm">{selectedConfig.template_path || <Placeholder />}</div>
            </section>
            <section>
              <h3 className="mb-2 font-semibold text-gray-900">📁 Folder Path</h3>
              <div className="break-all rounded-md bg-gray-50 p-4 text-sm">{selectedConfig.folder_path || <Placeholder />}</div>
            </section>
            <section>
              <h3 className="mb-2 font-semibold text-gray-900">🕒 Timestamps</h3>
              <div className="space-y-1 rounded-md bg-gray-50 p-4 text-sm">
                <p><strong>Created:</strong> {formatDateTime(selectedConfig.created_at) || <Placeholder />}</p>
                <p><strong>Updated:</strong> {formatDateTime(selectedConfig.updated_at) || <Placeholder />}</p>
              </div>
            </section>
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">No configuration data</div>
        )}
      </Modal>
    </Page>
  );
};

export default Configs;
