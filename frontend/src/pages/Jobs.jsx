import React, { useState } from 'react';
import { Page, PageHeader, Tabs } from '../components/ui';
import JobsTab from './jobs/JobsTab';
import BlockListTab from './jobs/BlockListTab';

const TABS = [
  { id: 'jobs', label: 'Jobs' },
  { id: 'blocklist', label: 'Block List' },
];

const Jobs = () => {
  const [activeTab, setActiveTab] = useState('jobs');

  return (
    <Page>
      <PageHeader title="Job Management" description="Daily job feed for the client application and the companies/URLs it must skip" />
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'jobs' ? <JobsTab /> : <BlockListTab />}
    </Page>
  );
};

export default Jobs;
