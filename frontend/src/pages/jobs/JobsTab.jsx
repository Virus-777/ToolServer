import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { JobsAPI } from '../../services/api';
import Pagination from '../../components/Pagination';
import { ActionButton, Badge, Button, Card, DataTable, Input, Placeholder, Select } from '../../components/ui';
import { useConfirm, useToast } from '../../contexts/UIContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { addDaysISO, copyToClipboard, formatDate, singleLine, todayISO, truncate } from '../../utils/format';
import JobFormModal from './JobFormModal';
import JobDetailsModal from './JobDetailsModal';
import { DATE_RANGE, EXPORT_LIMIT, INDUSTRY_OPTIONS, getIndustryColor, getIndustryLabel } from './constants';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** "All dates" + one entry per day from +2 days back to -30 days. */
const buildDateOptions = () => {
  const today = todayISO();
  const options = [{ value: '', label: 'All dates' }];
  for (let offset = DATE_RANGE.daysAhead; offset >= -DATE_RANGE.daysBack; offset -= 1) {
    const iso = addDaysISO(offset);
    const [, month, day] = iso.split('-');
    let label = `${month}.${day}`;
    if (iso === today) label += ' · Today';
    else if (offset === 1) label += ' · Tomorrow';
    else if (offset === -1) label += ' · Yesterday';
    options.push({ value: iso, label });
  }
  return options;
};

const exportRows = (jobs, { includeDescription }) =>
  jobs.map((job) => ({
    'Job ID': job.id,
    Title: job.title,
    Company: job.company,
    Industry: getIndustryLabel(job.industry),
    'Tech Stack': job.tech || '',
    URL: job.url || '',
    Summary: singleLine(job.summary),
    ...(includeDescription ? { Description: singleLine(job.description) } : {}),
    Date: formatDate(job.date),
    'Created At': formatDate(job.created_at),
    'Updated At': job.updated_at ? formatDate(job.updated_at) : '',
  }));

const JobsTab = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [query, setQuery] = useState({ search: '', date: todayISO(), industry: '', page: 1, pageSize: 20 });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 400);
  const dateOptions = useMemo(buildDateOptions, []);
  const requestId = useRef(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [detailsJob, setDetailsJob] = useState(null);
  const [exporting, setExporting] = useState(false);

  /** Change filters and jump back to the first page in a single render. */
  const updateQuery = useCallback((patch) => {
    setQuery((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));
  }, []);

  // Apply the debounced search term (skips the initial render where nothing changed)
  useEffect(() => {
    setQuery((prev) => (prev.search === debouncedSearch ? prev : { ...prev, search: debouncedSearch, page: 1 }));
  }, [debouncedSearch]);

  const filterParams = useMemo(
    () => ({ date: query.date || undefined, industry: query.industry, search: query.search || undefined }),
    [query.date, query.industry, query.search]
  );

  const loadJobs = useCallback(async () => {
    const id = ++requestId.current;
    try {
      setLoading(true);
      const data = await JobsAPI.getAll({ ...filterParams, page: query.page, limit: query.pageSize, orderDirection: 'DESC' });
      if (id !== requestId.current) return; // superseded by a newer request
      setJobs(data.jobs || []);
      setPagination(data.pagination);
    } catch (error) {
      if (id === requestId.current) toast.error(error.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filterParams, query.page, query.pageSize, toast]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  /** Every job matching the current filters (for copy / export). */
  const fetchAllFiltered = async () => {
    const data = await JobsAPI.getAll({ ...filterParams, page: 1, limit: EXPORT_LIMIT, orderDirection: 'ASC' });
    return data.jobs || [];
  };

  const handleCopy = async () => {
    try {
      setExporting(true);
      const rows = exportRows(await fetchAllFiltered(), { includeDescription: true });
      if (rows.length === 0) {
        toast.info('No jobs to copy for the current filters.');
        return;
      }
      const headers = Object.keys(rows[0]);
      const tsv = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
        .map((line) => line.join('\t'))
        .join('\n');
      await copyToClipboard(tsv);
      toast.success(`Copied ${rows.length} job${rows.length === 1 ? '' : 's'} to the clipboard`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const rows = exportRows(await fetchAllFiltered(), { includeDescription: false });
      if (rows.length === 0) {
        toast.info('No jobs to export for the current filters.');
        return;
      }
      // Loaded on demand: the spreadsheet library is large and only needed here
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Jobs');
      XLSX.writeFile(workbook, `jobs_${query.date || todayISO()}.xlsx`);
      toast.success(`Exported ${rows.length} job${rows.length === 1 ? '' : 's'} to Excel`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  };

  const openAdd = () => {
    setEditingJob(null);
    setFormOpen(true);
  };

  const openEdit = (job) => {
    setDetailsJob(null);
    setEditingJob(job);
    setFormOpen(true);
  };

  const handleDelete = async (job) => {
    const ok = await confirm({
      title: 'Delete job',
      message: `Delete "${job.title}" at ${job.company}?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await JobsAPI.delete(job.id);
      toast.success('Job deleted');
      loadJobs();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeleteAll = async () => {
    if (!query.date) {
      toast.warning('Select a date first: "Delete All" removes every job for the selected date.');
      return;
    }
    const ok = await confirm({
      title: 'Delete all jobs for a date',
      message: `Delete ALL jobs dated ${query.date}? This cannot be undone.`,
      confirmLabel: 'Delete all',
      danger: true,
    });
    if (!ok) return;

    try {
      const result = await JobsAPI.deleteByDate(query.date);
      toast.success(result.message || 'Jobs deleted');
      updateQuery({ page: 1 });
      loadJobs();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    {
      key: 'title',
      label: 'Title',
      className: 'whitespace-nowrap font-medium text-gray-900',
      render: (job) => (
        <button type="button" onClick={() => setDetailsJob(job)} className="text-left hover:text-primary" title={job.title}>
          {truncate(job.title, 40) || <Placeholder>No title</Placeholder>}
        </button>
      ),
    },
    { key: 'company', label: 'Company', render: (job) => job.company || <Placeholder /> },
    {
      key: 'industry',
      label: 'Industry',
      render: (job) => <Badge color={getIndustryColor(job.industry)}>{getIndustryLabel(job.industry)}</Badge>,
    },
    {
      key: 'tech',
      label: 'Tech Stack',
      className: 'whitespace-nowrap text-gray-500',
      render: (job) => (job.tech ? <span title={job.tech}>{truncate(job.tech, 30)}</span> : <Placeholder>Not specified</Placeholder>),
    },
    {
      key: 'url',
      label: 'URL',
      render: (job) =>
        job.url ? (
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900" title={job.url}>
            🔗 View
          </a>
        ) : (
          <Placeholder>No URL</Placeholder>
        ),
    },
    {
      key: 'summary',
      label: 'Summary',
      className: 'max-w-xs text-gray-600',
      render: (job) => (job.summary ? <span title={job.summary}>{truncate(job.summary, 80)}</span> : <Placeholder>No summary</Placeholder>),
    },
    {
      key: 'description',
      label: 'Description',
      className: 'max-w-xs text-gray-500',
      render: (job) =>
        job.description ? <span title={job.description}>{truncate(job.description, 50)}</span> : <Placeholder>No description</Placeholder>,
    },
    { key: 'date', label: 'Date', className: 'whitespace-nowrap text-gray-500', render: (job) => formatDate(job.date) },
    {
      key: 'created_at',
      label: 'Created',
      className: 'whitespace-nowrap text-gray-500',
      render: (job) => formatDate(job.created_at),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (job) => (
        <div className="flex gap-3">
          <ActionButton color="neutral" onClick={() => setDetailsJob(job)}>View</ActionButton>
          <ActionButton onClick={() => openEdit(job)}>Edit</ActionButton>
          <ActionButton color="danger" onClick={() => handleDelete(job)}>Delete</ActionButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={handleCopy} loading={exporting}>📋 Copy Jobs</Button>
        <Button variant="secondary" onClick={handleExportExcel} loading={exporting}>📊 Save to Excel</Button>
        <Button onClick={openAdd}>+ Add Job</Button>
        <Button
          variant="danger"
          onClick={handleDeleteAll}
          disabled={!query.date}
          title={query.date ? `Delete all jobs for ${query.date}` : 'Select a date to enable'}
        >
          🗑️ Delete All
        </Button>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            type="search"
            placeholder="Search title, company, tech, summary…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && updateQuery({ search: searchInput })}
            className="min-w-[220px] flex-1"
            aria-label="Search jobs"
          />
          <Select value={query.date} onChange={(event) => updateQuery({ date: event.target.value })} fullWidth={false} aria-label="Filter by date">
            {dateOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <Select value={query.industry} onChange={(event) => updateQuery({ industry: event.target.value })} fullWidth={false} aria-label="Filter by industry">
            <option value="">All industries</option>
            {INDUSTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <Button variant="secondary" onClick={() => updateQuery({ date: '' })} disabled={!query.date}>Clear Date</Button>
          <Button variant="secondary" onClick={loadJobs}>🔄 Refresh</Button>
        </div>

        <DataTable
          columns={columns}
          rows={jobs}
          rowKey={(job) => job.id}
          loading={loading}
          loadingLabel="Loading jobs…"
          emptyMessage={query.search || query.date || query.industry !== '' ? 'No jobs match the current filters' : 'No jobs yet'}
        />

        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={query.pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={(page) => setQuery((prev) => ({ ...prev, page }))}
          onPageSizeChange={(pageSize) => updateQuery({ pageSize })}
        />
      </Card>

      <JobFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        job={editingJob}
        defaultIndustry={query.industry === '' ? 0 : Number(query.industry)}
        onSaved={loadJobs}
      />

      <JobDetailsModal job={detailsJob} onClose={() => setDetailsJob(null)} onEdit={openEdit} />
    </>
  );
};

export default JobsTab;
