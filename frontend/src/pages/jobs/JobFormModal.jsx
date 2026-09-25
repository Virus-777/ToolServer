import React, { useEffect, useState } from 'react';
import { JobsAPI } from '../../services/api';
import { Modal } from '../../components/Modal';
import { Button, FormField, Input, Select, Textarea } from '../../components/ui';
import { useToast } from '../../contexts/UIContext';
import { todayISO, toISODate } from '../../utils/format';
import { INDUSTRY_OPTIONS } from './constants';

const emptyForm = (industry) => ({
  title: '',
  company: '',
  industry,
  date: todayISO(),
  tech: '',
  url: '',
  summary: '',
  description: '',
});

const formFromJob = (job) => ({
  title: job.title || '',
  company: job.company || '',
  industry: Number(job.industry) === 1 ? 1 : 0,
  // `date` is a plain YYYY-MM-DD string; never run it through Date() or it shifts by the UTC offset
  date: toISODate(job.date),
  tech: job.tech || '',
  url: job.url || '',
  summary: job.summary || '',
  description: job.description || '',
});

/**
 * Create / edit dialog. Pass `job` to edit, `null` to create.
 * `defaultIndustry` pre-selects the industry for new jobs (mirrors the active filter).
 */
const JobFormModal = ({ isOpen, onClose, job, defaultIndustry = 0, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState(() => emptyForm(defaultIndustry));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(job ? formFromJob(job) : emptyForm(defaultIndustry));
    }
  }, [isOpen, job, defaultIndustry]);

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      title: form.title.trim(),
      company: form.company.trim(),
      url: form.url.trim(),
      summary: form.summary.trim(),
      industry: Number(form.industry),
    };

    try {
      setSaving(true);
      if (job) {
        await JobsAPI.update(job.id, payload);
        toast.success('Job updated');
      } else {
        await JobsAPI.create(payload);
        toast.success('Job added');
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={job ? `Edit Job #${job.id}` : 'Add New Job'}>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <FormField label="Title" htmlFor="job-title" required>
            <Input id="job-title" required value={form.title} onChange={update('title')} placeholder="Senior Developer" autoFocus />
          </FormField>
          <FormField label="Company" htmlFor="job-company" required>
            <Input id="job-company" required value={form.company} onChange={update('company')} placeholder="Tech Corp" />
          </FormField>
          <FormField label="Industry" htmlFor="job-industry" required>
            <Select id="job-industry" required value={form.industry} onChange={update('industry')}>
              {INDUSTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Date" htmlFor="job-date" required>
            <Input id="job-date" type="date" required value={form.date} onChange={update('date')} />
          </FormField>
          <FormField label="Tech Stack" htmlFor="job-tech">
            <Input id="job-tech" value={form.tech} onChange={update('tech')} placeholder="React, Node.js, PostgreSQL" />
          </FormField>
          <FormField label="URL" htmlFor="job-url">
            <Input id="job-url" type="url" value={form.url} onChange={update('url')} placeholder="https://example.com/job/123" />
          </FormField>
        </div>

        <FormField label="Summary" htmlFor="job-summary" hint="Short digest of the posting shown in the jobs table and exports.">
          <Textarea id="job-summary" rows={3} value={form.summary} onChange={update('summary')} placeholder="Two or three sentences about the role…" />
        </FormField>

        <FormField label="Description" htmlFor="job-description">
          <Textarea id="job-description" rows={6} value={form.description} onChange={update('description')} placeholder="Full job description…" />
        </FormField>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{job ? 'Update Job' : 'Add Job'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default JobFormModal;
