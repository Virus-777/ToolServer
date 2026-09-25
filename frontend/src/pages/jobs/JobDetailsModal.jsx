import React from 'react';
import { Modal } from '../../components/Modal';
import { Badge, Button, Placeholder } from '../../components/ui';
import { formatDate, formatDateTime } from '../../utils/format';
import { getIndustryColor, getIndustryLabel } from './constants';

const Field = ({ label, children }) => (
  <div>
    <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</dt>
    <dd className="mt-1 text-sm text-gray-900">{children}</dd>
  </div>
);

const TextBlock = ({ value, placeholder }) =>
  value ? (
    <pre className="whitespace-pre-wrap break-words rounded-md bg-gray-50 p-3 font-sans text-sm text-gray-800">{value}</pre>
  ) : (
    <Placeholder>{placeholder}</Placeholder>
  );

/** Read-only view of every job field, including the full summary and description. */
const JobDetailsModal = ({ job, onClose, onEdit }) => (
  <Modal
    isOpen={Boolean(job)}
    onClose={onClose}
    title={job ? `Job #${job.id}` : ''}
    size="lg"
    footer={
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {onEdit && <Button onClick={() => onEdit(job)}>Edit</Button>}
      </div>
    }
  >
    {job && (
      <dl className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Title">{job.title}</Field>
          <Field label="Company">{job.company || <Placeholder />}</Field>
          <Field label="Industry"><Badge color={getIndustryColor(job.industry)}>{getIndustryLabel(job.industry)}</Badge></Field>
          <Field label="Date">{formatDate(job.date)}</Field>
          <Field label="Tech Stack">{job.tech || <Placeholder>Not specified</Placeholder>}</Field>
          <Field label="URL">
            {job.url ? (
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="break-all text-blue-600 hover:text-blue-900">
                {job.url}
              </a>
            ) : (
              <Placeholder>No URL</Placeholder>
            )}
          </Field>
        </div>
        <Field label="Summary"><TextBlock value={job.summary} placeholder="No summary" /></Field>
        <Field label="Description"><TextBlock value={job.description} placeholder="No description" /></Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-gray-500">
          <Field label="Created">{formatDateTime(job.created_at)}</Field>
          <Field label="Updated">{formatDateTime(job.updated_at) || <Placeholder>N/A</Placeholder>}</Field>
        </div>
      </dl>
    )}
  </Modal>
);

export default JobDetailsModal;
