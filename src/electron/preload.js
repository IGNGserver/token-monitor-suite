'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tokenMonitor', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  clearSessionUsageArchive: () => ipcRenderer.invoke('sessionUsageArchive:clear'),
  lookupModelPricing: (modelId) => ipcRenderer.invoke('pricing:lookup', modelId),
  previewAppearance: (patch) => ipcRenderer.invoke('appearance:preview', patch),
  getStats: (options) => ipcRenderer.invoke('stats:get', options),
  getCustomRangeStats: (range) => ipcRenderer.invoke('stats:getCustomRange', range),
  getSessionDetail: (args) => ipcRenderer.invoke('session:getDetail', args),
  getStreamStatus: () => ipcRenderer.invoke('stream:status'),
  recoverNow: () => ipcRenderer.invoke('sync:recover'),
  getSyncHealth: () => ipcRenderer.invoke('sync:health'),
  getServiceStatus: (options) => ipcRenderer.invoke('serviceStatus:get', options),
  openDashboard: () => ipcRenderer.invoke('dashboard:open'),
  getDashboardHistory: () => ipcRenderer.invoke('dashboard:getHistory'),
  onDashboardHistoryChanged: (callback) => {
    const listener = () => { try { callback(); } catch (_) {} };
    ipcRenderer.on('dashboard:historyChanged', listener);
    return () => ipcRenderer.removeListener('dashboard:historyChanged', listener);
  },
  dashboard: {
    ready: () => ipcRenderer.send('dashboard:ready'),
    minimize: () => ipcRenderer.send('dashboard:minimize'),
    close: () => ipcRenderer.send('dashboard:close')
  },
  onStatsPush: (callback) => {
    const listener = (_event, payload) => { try { callback(payload); } catch (_) {} };
    ipcRenderer.on('stats:push', listener);
    return () => ipcRenderer.removeListener('stats:push', listener);
  },
  onSettingsPush: (callback) => {
    const listener = (_event, payload) => { try { callback(payload); } catch (_) {} };
    ipcRenderer.on('settings:push', listener);
    return () => ipcRenderer.removeListener('settings:push', listener);
  },
  onOpenSettings: (callback) => {
    const listener = () => { try { callback(); } catch (_) {} };
    ipcRenderer.on('settings:open', listener);
    return () => ipcRenderer.removeListener('settings:open', listener);
  },
  onOpenView: (callback) => {
    const listener = (_event, viewId) => { try { callback(viewId); } catch (_) {} };
    ipcRenderer.on('view:open', listener);
    return () => ipcRenderer.removeListener('view:open', listener);
  },
  onTokscalePush: (callback) => {
    const listener = (_event, payload) => { try { callback(payload); } catch (_) {} };
    ipcRenderer.on('tokscale:push', listener);
    return () => ipcRenderer.removeListener('tokscale:push', listener);
  },
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  openUserData: () => ipcRenderer.invoke('app:openUserData'),
  hubAccounts: {
    list: () => ipcRenderer.invoke('hubAccounts:list'),
    add: (request = {}) => ipcRenderer.invoke('hubAccounts:add', request),
    update: (id, patch = {}) => ipcRenderer.invoke('hubAccounts:update', id, patch),
    remove: (id) => ipcRenderer.invoke('hubAccounts:remove', id),
    refresh: (id) => ipcRenderer.invoke('hubAccounts:refresh', id)
  },
  exportNow: () => ipcRenderer.invoke('export:now'),
  pickExportDir: () => ipcRenderer.invoke('export:pickAutoDir'),
  getTokscaleStatus: () => ipcRenderer.invoke('tokscale:getStatus'),
  checkTokscaleNpm: () => ipcRenderer.invoke('tokscale:checkNpm'),
  downloadTokscaleFromNpm: () => ipcRenderer.invoke('tokscale:downloadFromNpm'),
  resetTokscaleToBundled: () => ipcRenderer.invoke('tokscale:resetToBundled'),
  getAppUpdateState: () => ipcRenderer.invoke('appUpdate:getState'),
  checkAppUpdateNow: () => ipcRenderer.invoke('appUpdate:checkNow'),
  downloadAppUpdate: () => ipcRenderer.invoke('appUpdate:download'),
  installAppUpdate: () => ipcRenderer.invoke('appUpdate:install'),
  dismissAppUpdate: (version) => ipcRenderer.invoke('appUpdate:dismiss', version),
  expandFloatingBubble: () => ipcRenderer.invoke('floatingBubble:expand'),
  moveFloatingBubble: (delta) => ipcRenderer.invoke('floatingBubble:move', delta),
  signalContentReady: () => ipcRenderer.send('window:contentReady'),
  setViewState: (patch) => ipcRenderer.send('window:viewState', patch),
  peekFloatingBubble: () => ipcRenderer.invoke('floatingBubble:peek'),
  collapseFloatingBubbleIfIdle: () => ipcRenderer.invoke('floatingBubble:collapseIfIdle'),
  setFloatingBubbleCollapsedSize: (size) => ipcRenderer.invoke('floatingBubble:setCollapsedSize', size),
  onFloatingBubbleState: (callback) => {
    const listener = (_event, payload) => { try { callback(payload); } catch (_) {} };
    ipcRenderer.on('floatingBubble:state', listener);
    return () => ipcRenderer.removeListener('floatingBubble:state', listener);
  },
  onAppUpdatePush: (callback) => {
    const listener = (_event, payload) => { try { callback(payload); } catch (_) {} };
    ipcRenderer.on('appUpdate:push', listener);
    return () => ipcRenderer.removeListener('appUpdate:push', listener);
  },
  setTrayIcons: (icons) => ipcRenderer.invoke('tray:setIcons', icons),
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close')
});
