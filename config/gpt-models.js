'use strict';

/**
 * Catalog of models selectable from the dashboard.
 *
 * Prices are USD per 1M tokens (standard tier) as published on
 * https://developers.openai.com/api/docs/pricing. `description` is derived from
 * `pricing` so the API response keeps its original shape ({ id, name, description })
 * while newer clients can use the structured `pricing` and `family` fields.
 */
const CATALOG = [
    // GPT-6 series
    { id: 'gpt-6-astra', name: 'GPT-6 Astra', family: 'GPT-6', pricing: { input: 10, cached: 1, output: 50 } },
    { id: 'gpt-6-sol', name: 'GPT-6 Sol', family: 'GPT-6', pricing: { input: 2, cached: 0.2, output: 10 } },
    { id: 'gpt-6-luna', name: 'GPT-6 Luna', family: 'GPT-6', pricing: { input: 0.1, cached: 0.01, output: 0.5 } },

    // GPT-5.6 series
    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', family: 'GPT-5.6', pricing: { input: 4, cached: 0.4, output: 20 } },
    { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', family: 'GPT-5.6', pricing: { input: 2, cached: 0.2, output: 12 } },
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', family: 'GPT-5.6', pricing: { input: 0.2, cached: 0.02, output: 1.2 } },

    // GPT-5.5 / 5.4
    { id: 'gpt-5.5', name: 'GPT-5.5', family: 'GPT-5.5', pricing: { input: 5, cached: 0.5, output: 30 } },
    { id: 'gpt-5.4', name: 'GPT-5.4', family: 'GPT-5.4', pricing: { input: 2.5, cached: 0.25, output: 15 } },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', family: 'GPT-5.4', pricing: { input: 0.75, cached: 0.075, output: 4.5 } },
    { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', family: 'GPT-5.4', pricing: { input: 0.2, cached: 0.02, output: 1.25 } },

    // GPT-5.2 / 5.1 / 5
    { id: 'gpt-5.2', name: 'GPT-5.2', family: 'GPT-5.2', pricing: { input: 1.75, cached: 0.175, output: 14 } },
    { id: 'gpt-5.1', name: 'GPT-5.1', family: 'GPT-5.1', pricing: { input: 1.25, cached: 0.125, output: 10 } },
    { id: 'gpt-5', name: 'GPT-5', family: 'GPT-5', pricing: { input: 1.25, cached: 0.125, output: 10 } },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', family: 'GPT-5', pricing: { input: 0.25, cached: 0.025, output: 2 } },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano', family: 'GPT-5', pricing: { input: 0.05, cached: 0.005, output: 0.4 } },

    // Chat-tuned snapshots
    { id: 'gpt-5.2-chat-latest', name: 'GPT-5.2 Chat Latest', family: 'Chat Latest', pricing: { input: 1.75, cached: 0.175, output: 14 } },
    { id: 'gpt-5.1-chat-latest', name: 'GPT-5.1 Chat Latest', family: 'Chat Latest', pricing: { input: 1.25, cached: 0.125, output: 10 } },
    { id: 'gpt-5-chat-latest', name: 'GPT-5 Chat Latest', family: 'Chat Latest', pricing: { input: 1.25, cached: 0.125, output: 10 } },

    // Models served by the local Ollama gateway
    { id: 'gpt-oss:120b-cloud', name: 'GPT-OSS 120B Cloud', family: 'Ollama', description: '120B parameter model for cloud use on ollama' },
    { id: 'kimi-k2.5:cloud', name: 'Kimi K2.5 Cloud', family: 'Ollama', description: 'Kimi K2.5 model for cloud use on ollama' },
];

/** Format a USD amount keeping sub-cent precision (e.g. $0.075). */
function formatUsd(amount) {
    const threeDecimals = amount.toFixed(3);
    return `$${threeDecimals.endsWith('0') ? amount.toFixed(2) : threeDecimals}`;
}

function describePricing(pricing) {
    return `Input ${formatUsd(pricing.input)} | Cached ${formatUsd(pricing.cached)} | Output ${formatUsd(pricing.output)}`;
}

const GPT_MODELS = Object.freeze(CATALOG.map((entry) => Object.freeze({
    ...entry,
    description: entry.description || describePricing(entry.pricing),
})));

const findModel = (id) => GPT_MODELS.find((entry) => entry.id === id) || null;

module.exports = {
    GPT_MODELS,
    findModel,
    formatUsd,
};
