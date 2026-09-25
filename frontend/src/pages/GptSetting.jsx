import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GPTAPI } from '../services/api';
import { Button, Card, FormField, Input, LoadingState, Page, PageHeader } from '../components/ui';
import { useToast } from '../contexts/UIContext';

const formatUsd = (amount) => {
  const threeDecimals = amount.toFixed(3);
  return `$${threeDecimals.endsWith('0') ? amount.toFixed(2) : threeDecimals}`;
};

/** Group models by family while preserving the catalog order. */
const groupByFamily = (models) => {
  const groups = new Map();
  models.forEach((model) => {
    const family = model.family || 'Other';
    if (!groups.has(family)) groups.set(family, []);
    groups.get(family).push(model);
  });
  return Array.from(groups, ([family, items]) => ({ family, models: items }));
};

const ModelCard = ({ model, selected, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(model.id)}
    aria-pressed={selected}
    className={`w-full rounded-lg border-2 p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      selected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/60 hover:bg-gray-50'
    }`}
  >
    <div className="mb-1 flex items-start justify-between gap-2">
      <h4 className="font-semibold text-gray-900">{model.name}</h4>
      {selected && <span className="text-xl leading-none text-primary" aria-hidden="true">✓</span>}
    </div>
    <code className="mb-3 block text-xs text-gray-500">{model.id}</code>
    {model.pricing ? (
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-gray-500">Input</dt>
          <dd className="font-medium text-gray-900">{formatUsd(model.pricing.input)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Cached</dt>
          <dd className="font-medium text-gray-900">{formatUsd(model.pricing.cached)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Output</dt>
          <dd className="font-medium text-gray-900">{formatUsd(model.pricing.output)}</dd>
        </div>
      </dl>
    ) : (
      <p className="text-sm text-gray-600">{model.description}</p>
    )}
  </button>
);

const GptSetting = () => {
  const toast = useToast();

  const [models, setModels] = useState([]);
  const [savedModel, setSavedModel] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingModel, setSavingModel] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [modelsData, selectedData, apiKeyData] = await Promise.all([
        GPTAPI.getAvailableModels(),
        GPTAPI.getSelectedModel(),
        GPTAPI.getApiKey(),
      ]);

      setModels(modelsData.models || []);
      setSavedModel(selectedData.selectedModel);
      setSelectedModel(selectedData.selectedModel);
      setApiKeyConfigured(Boolean(apiKeyData.isSet));
      setApiKey(apiKeyData.isSet ? apiKeyData.apiKey : '');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => groupByFamily(models), [models]);
  const savedModelInfo = models.find((model) => model.id === savedModel);
  const isDirty = selectedModel !== savedModel;

  const handleSaveModel = async () => {
    try {
      setSavingModel(true);
      const data = await GPTAPI.setSelectedModel(selectedModel);
      setSavedModel(selectedModel);
      toast.success(`Model set to ${data.modelName || selectedModel}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingModel(false);
    }
  };

  const handleSaveApiKey = async (event) => {
    event.preventDefault();
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      toast.error('Please enter an API key');
      return;
    }
    if (!trimmedKey.startsWith('sk-') || trimmedKey.length < 20) {
      toast.error('Invalid API key format: it must start with "sk-" and be at least 20 characters');
      return;
    }
    if (trimmedKey.includes('•')) {
      toast.warning('Paste the full API key, the masked value cannot be re-saved');
      return;
    }

    try {
      setSavingKey(true);
      await GPTAPI.saveApiKey(trimmedKey);
      toast.success('OpenAI API key saved');
      setApiKeyVisible(false);
      const keyData = await GPTAPI.getApiKey();
      setApiKeyConfigured(Boolean(keyData.isSet));
      setApiKey(keyData.isSet ? keyData.apiKey : '');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <Page>
      <PageHeader title="GPT Model" description="OpenAI credentials and the model used by the client application" />

      <Card className="mb-6">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">🔑 OpenAI API Key</h2>
        <p className="mb-4 text-sm text-gray-600">Required for the GPT models. The stored key is shown masked.</p>

        <form onSubmit={handleSaveApiKey}>
          <FormField
            label="API Key"
            htmlFor="openai-key"
            hint={apiKeyConfigured ? '✅ An API key is configured. Paste a new key to replace it.' : '⚠️ No API key configured yet.'}
          >
            <div className="flex gap-2">
              <Input
                id="openai-key"
                type={apiKeyVisible ? 'text' : 'password'}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
              />
              <Button type="button" variant="secondary" onClick={() => setApiKeyVisible(!apiKeyVisible)} aria-label={apiKeyVisible ? 'Hide API key' : 'Show API key'}>
                {apiKeyVisible ? 'Hide' : 'Show'}
              </Button>
            </div>
          </FormField>
          <Button type="submit" loading={savingKey}>💾 Save API Key</Button>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Model Selection</h2>
            <p className="text-sm text-gray-600">Prices are USD per 1M tokens (input / cached input / output).</p>
          </div>
          <div className="rounded-md bg-gray-50 px-4 py-2 text-sm">
            <span className="text-gray-600">Currently saved: </span>
            <span className="font-semibold text-primary">{savedModelInfo ? savedModelInfo.name : savedModel || '—'}</span>
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading available models…" />
        ) : models.length === 0 ? (
          <div className="py-8 text-center text-gray-500">No models available</div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.family}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">{group.family}</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.models.map((model) => (
                    <ModelCard key={model.id} model={model} selected={selectedModel === model.id} onSelect={setSelectedModel} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {isDirty && (
          <div className="sticky bottom-4 mt-6 flex flex-col gap-3 rounded-lg border border-primary/30 bg-white p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-gray-700">
              Switch to <strong>{models.find((model) => model.id === selectedModel)?.name || selectedModel}</strong>?
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setSelectedModel(savedModel)}>Cancel</Button>
              <Button onClick={handleSaveModel} loading={savingModel}>Save Selection</Button>
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
};

export default GptSetting;
