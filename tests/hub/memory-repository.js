'use strict';

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyUsageRange() {
  return {
    totalTokens: 0,
    costUsd: 0,
    clients: {},
    clientCosts: {},
    models: {},
    modelCosts: {},
    clientModels: {},
    clientModelCosts: {},
    eventCount: 0
  };
}

function addTokenCost(mapTokens, mapCosts, key, tokens, cost) {
  const id = String(key || '').trim() || 'unknown';
  mapTokens[id] = (mapTokens[id] || 0) + tokens;
  mapCosts[id] = (mapCosts[id] || 0) + cost;
}

class MemoryRepository {
  constructor() {
    this.devices = new Map();
    this.hiddenDevices = new Set();
    this.events = [];
    this.pricing = new Map();
    this.sessions = new Map();
  }

  async transaction(work) { return work(this); }

  async listDeviceRecords() {
    return [...this.devices.entries()]
      .filter(([deviceId]) => !this.hiddenDevices.has(deviceId))
      .map(([, record]) => clone(record));
  }

  async getDeviceRecord(deviceId) { return clone(this.devices.get(deviceId) || null); }

  async saveDevice(record) {
    this.devices.set(record.deviceId, clone(record));
    this.hiddenDevices.delete(record.deviceId);
  }

  async countDevices() { return this.devices.size - this.hiddenDevices.size; }

  async getPricing(models) {
    return new Map(models.filter(Boolean).map((model) => [model, clone(this.pricing.get(model))]).filter(([, item]) => item));
  }

  async listPricing() { return [...this.pricing.values()].map(clone).sort((a, b) => a.model.localeCompare(b.model)); }

  async upsertPricing(model, prices, source) {
    const item = {
      id: this.pricing.get(model)?.id || this.pricing.size + 1,
      model,
      ...prices,
      source,
      updatedAt: new Date().toISOString()
    };
    this.pricing.set(model, item);
    return clone(item);
  }

  async insertUsageEvents(deviceId, events) {
    for (const event of events) this.events.push({ id: this.events.length + 1, deviceId, ...clone(event) });
  }

  async replaceSessions(deviceId, summaries) {
    for (const key of [...this.sessions.keys()]) if (key.startsWith(`${deviceId}\u0000`)) this.sessions.delete(key);
    for (const summary of summaries) this.sessions.set(`${deviceId}\u0000${summary.client}\u0000${summary.sessionId}`, clone(summary));
  }

  async deleteDevice(deviceId) {
    const deleted = this.devices.has(deviceId) && !this.hiddenDevices.has(deviceId);
    if (deleted) this.hiddenDevices.add(deviceId);
    for (const key of [...this.sessions.keys()]) if (key.startsWith(`${deviceId}\u0000`)) this.sessions.delete(key);
    return deleted;
  }

  async renameDevice(previousDeviceId, nextDeviceId) {
    if (previousDeviceId === nextDeviceId && this.devices.has(previousDeviceId)) {
      return { renamed: true, deviceId: nextDeviceId, unchanged: true };
    }
    if (!this.devices.has(previousDeviceId)) return { renamed: false, reason: 'not_found' };
    if (this.devices.has(nextDeviceId)) return { renamed: false, reason: 'target_exists' };
    const record = this.devices.get(previousDeviceId);
    this.devices.set(nextDeviceId, { ...clone(record), deviceId: nextDeviceId });
    this.devices.delete(previousDeviceId);
    if (this.hiddenDevices.delete(previousDeviceId)) this.hiddenDevices.add(nextDeviceId);
    for (const event of this.events) if (event.deviceId === previousDeviceId) event.deviceId = nextDeviceId;
    const moved = [];
    for (const [key, value] of this.sessions) {
      if (!key.startsWith(`${previousDeviceId}\u0000`)) continue;
      moved.push([`${nextDeviceId}${key.slice(previousDeviceId.length)}`, value]);
      this.sessions.delete(key);
    }
    for (const [key, value] of moved) this.sessions.set(key, value);
    return { renamed: true, deviceId: nextDeviceId, previousDeviceId };
  }

  async listKnownModels() {
    return [...new Set(this.events.map((event) => event.model).filter((model) => model && model !== 'unknown'))].sort();
  }

  async aggregateUsageRange({ from, to }) {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    const result = emptyUsageRange();
    if (!(fromMs < toMs)) return result;
    for (const event of this.events) {
      const at = new Date(event.recordedAt).getTime();
      if (!(at >= fromMs && at < toMs)) continue;
      result.eventCount += 1;
      const tokens = Math.round(
        number(event.inputTokens)
        + number(event.outputTokens)
        + number(event.cacheReadTokens)
        + number(event.cacheWriteTokens)
      );
      const cost = number(event.costUsd);
      const client = String(event.client || 'unknown');
      const model = String(event.model || 'unknown');
      result.totalTokens += tokens;
      result.costUsd += cost;
      addTokenCost(result.clients, result.clientCosts, client, tokens, cost);
      addTokenCost(result.models, result.modelCosts, model, tokens, cost);
      if (!result.clientModels[client]) result.clientModels[client] = {};
      if (!result.clientModelCosts[client]) result.clientModelCosts[client] = {};
      result.clientModels[client][model] = (result.clientModels[client][model] || 0) + tokens;
      result.clientModelCosts[client][model] = (result.clientModelCosts[client][model] || 0) + cost;
    }
    return result;
  }
}

module.exports = { MemoryRepository };
