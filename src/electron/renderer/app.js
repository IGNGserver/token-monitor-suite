'use strict';

const clientLabels = { claude: 'Claude Code', codex: 'Codex', hermes: 'Hermes', gemini: 'Gemini', cursor: 'Cursor', opencode: 'OpenCode', openclaw: 'OpenClaw', antigravity: 'Antigravity', cline: 'Cline', kimi: 'Kimi', qwen: 'Qwen', grok: 'Grok Build', copilot: 'GitHub Copilot', pi: 'Pi', zed: 'Zed', kilocode: 'Kilo Code', micode: 'MiMo Code', commandcode: 'Command Code', zcode: 'ZCode', kiro: 'Kiro', codebuddy: 'CodeBuddy', workbuddy: 'WorkBuddy', proma: 'Proma', qodercn: 'Qoder CN', reasonix: 'Reasonix', 'deepseek-harness': 'DeepSeek Harness', 'claude-desktop': 'Claude Desktop' };
const { clientColors, fallbackModelColors, modelVendorFor, modelColor } = window.TokenMonitorUsageCharts;
const motionPreferenceApi = window.TokenMonitorMotionPreference;
const windowsGlassApi = window.TokenMonitorWindowsGlass;
const macosGlassApi = window.TokenMonitorMacosGlass;
const macosGlassModeApi = window.TokenMonitorMacosGlassMode;
const glassRenderingApi = window.TokenMonitorGlassRendering;
const wslStatusPresentationApi = window.TokenMonitorWslStatusPresentation;
const reducedMotionMedia = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const systemDarkThemeMedia = window.matchMedia?.('(prefers-color-scheme: dark)');
const clientsWithIcon = new Set([
  'claude', 'codex', 'gemini', 'cursor', 'opencode', 'openclaw', 'hermes', 'antigravity', 'cline', 'kimi', 'qwen', 'grok', 'copilot', 'pi', 'zed', 'kilocode', 'micode', 'commandcode', 'zcode', 'kiro', 'codebuddy', 'workbuddy', 'proma', 'qodercn', 'reasonix', 'deepseek-harness', 'claude-desktop',
  'xai', 'openrouter', 'deepseek', 'meta', 'mistral', 'qwen', 'moonshot', 'zai', 'zaiteam', 'cohere', 'xiaomi', 'mimo', 'minimax', 'doubao', 'volcengine', 'qoder', 'ollama'
]);

function osIconFor(platform) {
  const prefix = String(platform || '').toLowerCase().split('-')[0];
  if (prefix === 'darwin') return 'apple';
  if (prefix === 'win32') return 'windows';
  if (prefix === 'linux' || prefix === 'freebsd' || prefix === 'openbsd') return 'linux';
  return null;
}

function iconKindFor(rowData, breakdown) {
  if (!toolIconsEnabled(state.settings?.showToolIcons)) return { kind: 'dot' };
  if (breakdown === 'device') {
    const os = osIconFor(rowData.platform);
    return os ? { kind: 'icon', iconClass: `row-icon-os-${os}` } : { kind: 'dot' };
  }
  if (breakdown === 'model') {
    const vendor = modelVendorFor(rowData.key);
    return vendor && clientsWithIcon.has(vendor)
      ? { kind: 'icon', iconClass: `row-icon-${vendor}` }
      : { kind: 'dot' };
  }
  if (breakdown === 'session') {
    return rowData.client && clientsWithIcon.has(rowData.client)
      ? { kind: 'icon', iconClass: `row-icon-${rowData.client}` }
      : { kind: 'dot' };
  }
  if (breakdown === 'project') return { kind: 'icon', iconClass: 'row-icon-project' };
  return clientsWithIcon.has(rowData.key)
    ? { kind: 'icon', iconClass: `row-icon-${rowData.key}` }
    : { kind: 'dot' };
}

const KNOWN_CLIENTS = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'hermes', label: 'Hermes' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'openclaw', label: 'OpenClaw' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'antigravity', label: 'Antigravity' },
  { id: 'cline', label: 'Cline' },
  { id: 'kimi', label: 'Kimi' },
  { id: 'qwen', label: 'Qwen' },
  { id: 'grok', label: 'Grok Build' },
  { id: 'copilot', label: 'GitHub Copilot' },
  { id: 'pi', label: 'Pi' },
  { id: 'zed', label: 'Zed' },
  { id: 'kilocode', label: 'Kilo Code' },
  { id: 'micode', label: 'MiMo Code' },
  { id: 'commandcode', label: 'Command Code' },
  { id: 'zcode', label: 'ZCode' },
  { id: 'kiro', label: 'Kiro' },
  { id: 'codebuddy', label: 'CodeBuddy' },
  { id: 'workbuddy', label: 'WorkBuddy' },
  { id: 'proma', label: 'Proma' },
  { id: 'qodercn', label: 'Qoder CN' },
  { id: 'reasonix', label: 'Reasonix' },
  { id: 'deepseek-harness', label: 'DeepSeek Harness' },
  { id: 'claude-desktop', label: 'Claude Desktop' }
];
const LIMIT_PROVIDERS = [
  { id: 'claude', label: 'Claude', settingsLabel: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'antigravity', label: 'Antigravity' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'minimax', label: 'Minimax' },
  { id: 'mimo', label: 'MiMo' },
  { id: 'grok', label: 'Grok' },
  { id: 'copilot', label: 'GitHub Copilot' },
  { id: 'kiro', label: 'Kiro' },
  { id: 'zai', label: 'GLM' },
  { id: 'zaiteam', label: 'GLM Team' },
  { id: 'volcengine', label: 'Volcengine' },
  { id: 'qoder', label: 'Qoder' },
  { id: 'kimi', label: 'Kimi' },
  { id: 'ollama', label: 'Ollama' }
];
const TRAY_ICON_VARIANTS = [
  { id: 'claude-brand', label: 'Claude', after: 'claude' },
  { id: 'chatgpt', label: 'ChatGPT', after: 'codex' }
];
const trayIconProviderIds = new Set([
  ...clientsWithIcon,
  ...TRAY_ICON_VARIANTS.map((provider) => provider.id)
]);
const TRAY_ICON_PROVIDERS = [
  ...KNOWN_CLIENTS.flatMap((provider) => [
    provider,
    ...TRAY_ICON_VARIANTS.filter((variant) => variant.after === provider.id)
  ]),
  ...LIMIT_PROVIDERS
]
  .filter((provider, index, providers) => (
    trayIconProviderIds.has(provider.id)
    && providers.findIndex((entry) => entry.id === provider.id) === index
  ));
const DEFAULT_LIMIT_PROVIDER_ORDER = LIMIT_PROVIDERS.map((provider) => provider.id).join(',');
const limitProviderOrderApi = window.TokenMonitorLimitProviderOrder;
const limitProviderPresentationApi = window.TokenMonitorLimitProviderPresentation;
const appUpdatePresentationApi = window.TokenMonitorAppUpdatePresentation;
const clientStatusPresentationApi = window.TokenMonitorClientStatusPresentation;
const serviceStatusPresentationApi = window.TokenMonitorServiceStatusPresentation;
const clientDisplayPreferencesApi = window.TokenMonitorClientDisplayPreferences;
const customPricingFormApi = window.TokenMonitorCustomPricingForm;
const viewDisplayPreferencesApi = window.TokenMonitorViewDisplayPreferences;
const preferenceDragSortApi = window.TokenMonitorPreferenceDragSort;
const homeOverviewApi = window.TokenMonitorHomeOverview;
const homeModulePreferencesApi = window.TokenMonitorHomeModulePreferences;
const { limitFillPercent, limitModeSuffix } = window.TokenMonitorLimitDisplayMode;
const i18n = window.TokenMonitorI18n;
const currencyApi = window.TokenMonitorCurrency;
const trayLayoutApi = window.TokenMonitorTrayLayout;
const sessionRowsApi = window.TokenMonitorSessionRows;
const breakdownRenderPolicyApi = window.TokenMonitorBreakdownRenderPolicy;
const {
  createAfterLayoutScheduler,
  isLargeSessionBreakdown,
  rowRenderFingerprint,
  shouldAnimateBreakdownRows,
  toolIconsEnabled
} = breakdownRenderPolicyApi;
const deviceBreakdownApi = window.TokenMonitorDeviceBreakdown;
const projectRowsApi = window.TokenMonitorProjectRows;
const sessionDetailApi = window.TokenMonitorSessionDetail;
const windowShortcutApi = window.TokenMonitorWindowShortcut;
const WINDOW_BEHAVIOR_VALUES = ['floating', 'normal', 'desktop'];
const WINDOW_BEHAVIOR_ICONS = { floating: '⇧', normal: '○', desktop: '⇩' };
const LIMIT_SOURCE_LABELS = { oauth: 'OAuth', cli: 'CLI', web: 'Web', rpc: 'RPC', local: 'Local', api: 'API' };
const LIMIT_CAPABILITY_TAG_KEYS = {
  Auto: 'settings.limits.capability.auto',
  'OAuth/CLI': 'settings.limits.capability.oauthCli',
  'CLI RPC': 'settings.limits.capability.cliRpc',
  'CLI/Web': 'settings.limits.capability.cliWeb',
  'App/CLI RPC': 'settings.limits.capability.appCliRpc',
  'Manual login': 'settings.limits.capability.manualLogin',
  Web: 'settings.limits.capability.web',
  'Web/API': 'settings.limits.capability.webApi',
  'App/CLI must be open': 'settings.limits.capability.appMustBeOpen',
  RPC: 'settings.limits.capability.rpc',
  'Local/Zen': 'settings.limits.capability.localZen',
  'Pay-as-you-go': 'settings.limits.capability.payg',
  Subscription: 'settings.limits.capability.subscription',
  'Token Plan': 'settings.limits.capability.tokenPlan',
  'Coding Plan': 'settings.limits.capability.codingPlan',
  'Membership/Coding Plan': 'settings.limits.capability.membershipCodingPlan',
  'API key': 'settings.limits.capability.apiKey',
  'AK/SK': 'settings.limits.capability.akSk',
  'GitHub OAuth': 'settings.limits.capability.githubOAuth',
  API: 'settings.limits.capability.api',
  'Add API key': 'settings.limits.status.addApiKey',
  'Update API key': 'settings.limits.status.updateApiKey',
  'Add credential': 'settings.limits.status.addCredential',
  'Update credential': 'settings.limits.status.updateCredential',
  Live: 'settings.limits.status.live',
  Linked: 'settings.limits.status.linked',
  'Sign in': 'settings.limits.status.signIn',
  'Open app or CLI': 'settings.limits.status.openApp',
  'No synced data': 'settings.limits.status.noSyncedData',
  Stale: 'settings.limits.status.stale',
  Disabled: 'settings.limits.status.disabled',
  'Sign in again': 'settings.limits.status.signInAgain',
  'Run grok login': 'settings.limits.status.runGrokLogin',
  'Run kiro-cli login': 'settings.limits.status.runKiroLogin',
  'Re-login': 'settings.limits.status.relogin',
  Limited: 'settings.limits.status.limited',
  'Usage API limited': 'settings.limits.status.usageApiLimited',
  Unavailable: 'settings.limits.status.unavailable',
  'Not set up': 'settings.limits.status.notSetUp',
  Error: 'settings.limits.status.error'
};
const deviceAccent = '#73bdf5';
const deviceStaleColor = '#8c97a7';
const baseBreakdownOrder = ['tool', 'device', 'model', 'project', 'session'];
const VIEW_DISPLAY_OPTIONS = [
  { id: 'home', labelKey: 'views.home' },
  { id: 'tool', labelKey: 'views.tool' },
  { id: 'status', labelKey: 'views.status' },
  { id: 'device', labelKey: 'views.device' },
  { id: 'model', labelKey: 'views.model' },
  { id: 'project', labelKey: 'views.project' },
  { id: 'session', labelKey: 'views.session' },
  { id: 'limits', labelKey: 'views.limits' },
  { id: 'trends', labelKey: 'views.trends' }
];
const viewPeriodValues = new Set(['today', 'month', 'allTime', 'custom']);
const customRangePickerApi = window.TokenMonitorCustomRangePicker;
const viewBreakdownValues = new Set(['home', ...baseBreakdownOrder, 'status', 'limits', 'trends']);
const HOME_MODULE_OPTIONS = [
  { id: 'limits', labelKey: 'home.limits', viewId: 'limits' },
  { id: 'tool', labelKey: 'home.tools', viewId: 'tool' },
  { id: 'device', labelKey: 'home.devices', viewId: 'device' },
  { id: 'model', labelKey: 'home.models', viewId: 'model' },
  { id: 'trends', labelKey: 'home.activity', viewId: 'trends' }
];
const VIEW_SWITCHER_LONG_PRESS_MS = 420;
const VIEW_SWITCHER_HOVER_CLOSE_MS = 160;
const VIEW_ICON_CLASSES = {
  home: 'view-icon-home',
  tool: 'view-icon-tool',
  status: 'view-icon-status',
  device: 'view-icon-device',
  model: 'view-icon-model',
  project: 'view-icon-project',
  session: 'view-icon-session',
  limits: 'view-icon-limits',
  trends: 'view-icon-trends'
};
const SERVICE_STATUS_PLACEHOLDERS = [
  { id: 'claude', label: 'Claude', pageUrl: 'https://status.claude.com' },
  { id: 'openai', label: 'OpenAI', pageUrl: 'https://status.openai.com' },
  { id: 'cursor', label: 'Cursor', pageUrl: 'https://status.cursor.com' },
  { id: 'deepseek', label: 'DeepSeek', pageUrl: 'https://status.deepseek.com' }
];
const SERVICE_PROVIDER_OPTIONS = SERVICE_STATUS_PLACEHOLDERS.map((entry) => ({ id: entry.id, label: entry.label }));
const TOKEN_MONITOR_REPOSITORY_URL = 'https://github.com/IGNGserver/token-monitor-suite';
const TOKEN_MONITOR_ISSUES_URL = `${TOKEN_MONITOR_REPOSITORY_URL}/issues/new/choose`;
const TOKEN_MONITOR_WSL_SQLITE_GUIDE_URL = `${TOKEN_MONITOR_REPOSITORY_URL}/blob/main/docs/wsl-sqlite-setup.md`;
const serviceStatusProviderPreferencesApi = window.TokenMonitorServiceStatusProviderPreferences;
const SETTINGS_SECTION_IDS = ['general', 'main', 'window', 'appearance', 'tools', 'limits', 'accounts', 'sync'];
const REFRESH_BUTTON_FEEDBACK_MS = 700;
const initialFloatingBubble = window.__TOKEN_MONITOR_INITIAL_FLOATING_BUBBLE__ || { collapsed: false, side: null };
const initialViewState = window.__TOKEN_MONITOR_INITIAL_VIEW_STATE__ || {};
let initialBreakdownPreferenceApplied = typeof initialViewState.breakdown === 'string';

function normalizeInitialViewValue(value, allowed, fallback) {
  const raw = String(value || '').trim();
  return allowed.has(raw) ? raw : fallback;
}

const state = { period: normalizeInitialViewValue(initialViewState.period, viewPeriodValues, 'today'), appUpdate: null, breakdown: normalizeInitialViewValue(initialViewState.breakdown, viewBreakdownValues, 'home'), viewSwitcherOpen: false, viewSwitcherHasOpened: false, limitDetailTooltipHasOpened: false, limitDetailTooltipActive: false, limitDetailTooltipRenderPending: false, settings: null, stats: null, syncHealth: null, recoveryResult: null, homeHistory: null, homeHistoryBusy: false, homeHistoryRequested: false, homeHistorySignature: '', homeHistoryRetries: 0, homeHistoryRetryTimer: null, homeActivityScrollLeft: null, homeActivityFollowEnd: true, homeActivityResizeObserver: null, homeScrollResetPending: true, serviceStatus: null, serviceStatusBusy: false, serviceProvidersExpanded: false, trendSettingsExpanded: false, trendsActivating: false, homeSettingsExpanded: false, homeLimitSettingsExpanded: false, serviceStatusTicker: null, refreshTimer: null, refreshBusy: false, refreshFeedbackTimer: null, currentTotal: 0, rowSignature: '', streamConnected: false, streamFailure: null, mode: 'idle', appInfo: null, tokscaleStatus: null, tokscaleCheck: null, tokscaleBusy: false, hubInfo: null, hubAccounts: [], hubAccountsBusy: false, hubAccountError: '', hubAccountExpanded: false, customPricingExpanded: false, floatingBubble: initialFloatingBubble, suppressInitialNumberAnimation: window.__TOKEN_MONITOR_SUPPRESS_INITIAL_NUMBER_ANIMATION__ === true, openSession: null, detailSort: 'time', recordingWindowShortcut: false, windowShortcutInvalid: false };
state.homeHistoryLoadedSignature = '';
state.homeHistoryRetrySignature = '';
state.homeReturnVisible = false;
state.appUpdateNotesPresentedVersion = '';
state.periodMotionActive = false;
state.customRange = null;
state.customRangeDraft = null;
state.customRangeOpen = false;
state.customRangeBusy = false;
state.customRangeError = '';
state.customRangeMonth = null;
state.animateBarsFromZero = false;
state.animateChartsOnRender = true;
let directBreakdownOverride = null;
state.projectSettingsExpanded = false;
state.homeActivitySettingsExpanded = false;
state.settingsSections = Object.fromEntries(SETTINGS_SECTION_IDS.map((id) => [id, false]));
const defaultAppearance = { glassOpacity: 68, glassBlur: 32, zoomFactor: 1, systemGlass: true, macosGlassStyle: macosGlassModeApi.MACOS_GLASS_LIQUID, reduceMotion: 'system', showLiveDot: true, showToolIcons: true, titleIconOnly: true, showCompactTotalTokens: false, settingsInTitlebar: false };
let preferenceDrag = null;
let viewSwitcherLongPressTimer = null;
let viewSwitcherLongPressTriggered = false;
let viewSwitcherHoverCloseTimer = null;
const els = {
  shell: document.querySelector('.shell'), status: document.getElementById('status'), liveDot: document.getElementById('liveDot'), totalTokens: document.getElementById('totalTokens'), totalTokensCompact: document.getElementById('totalTokensCompact'), usageEstimateBadge: document.getElementById('usageEstimateBadge'), cost: document.getElementById('cost'), homePanel: document.getElementById('homePanel'), breakdown: document.getElementById('breakdown'), serviceStatusPanel: document.getElementById('serviceStatusPanel'), limitsPanel: document.getElementById('limitsPanel'), trendsPanel: document.getElementById('trendsPanel'), viewSwitcher: document.getElementById('viewSwitcher'), pinButton: document.getElementById('pinButton'), utilityActions: document.getElementById('utilityActions'), settingsButton: document.getElementById('settingsButton'), settingsPanel: document.getElementById('settingsPanel'), languageInput: document.getElementById('languageInput'), currencyInput: document.getElementById('currencyInput'), currencyRateRow: document.getElementById('currencyRateRow'), currencyRateModeAuto: document.getElementById('currencyRateModeAuto'), currencyRateManualField: document.getElementById('currencyRateManualField'), currencyRateOverrideInput: document.getElementById('currencyRateOverrideInput'), currencyRateStatus: document.getElementById('currencyRateStatus'), hubUrlInput: document.getElementById('hubUrlInput'), secretInput: document.getElementById('secretInput'), deviceIdInput: document.getElementById('deviceIdInput'), showLimitSourceInput: document.getElementById('showLimitSourceInput'), maskLimitAccountEmailsInput: document.getElementById('maskLimitAccountEmailsInput'), showLimitUsedInput: document.getElementById('showLimitUsedInput'), liveDotInput: document.getElementById('liveDotInput'), toolIconsInput: document.getElementById('toolIconsInput'), floatingBubbleInput: document.getElementById('floatingBubbleInput'), floatingBubbleTriggerInput: document.getElementById('floatingBubbleTriggerInput'), floatingBubbleTriggerRow: document.getElementById('floatingBubbleTriggerRow'), floatingBubbleContentInput: document.getElementById('floatingBubbleContentInput'), floatingBubbleContentRow: document.getElementById('floatingBubbleContentRow'), floatingBubbleComposer: document.getElementById('floatingBubbleComposer'), floatingBubbleContent: document.getElementById('floatingBubbleContent'), discordRpcInput: document.getElementById('discordRpcInput'), windowBehaviorInput: document.getElementById('windowBehaviorInput'), showTrayIconInput: document.getElementById('showTrayIconInput'), showTrayProviderBadgeInput: document.getElementById('showTrayProviderBadgeInput'), trayModeInput: document.getElementById('trayModeInput'), trayContentInput: document.getElementById('trayContentInput'), trayComposer: document.getElementById('trayComposer'), windowToggleShortcutValue: document.getElementById('windowToggleShortcutValue'), windowToggleShortcutClearButton: document.getElementById('windowToggleShortcutClearButton'), windowToggleShortcutNote: document.getElementById('windowToggleShortcutNote'), glassInput: document.getElementById('glassInput'), blurInput: document.getElementById('blurInput'), zoomInput: document.getElementById('zoomInput'), resetGlassButton: document.getElementById('resetGlassButton'), resetDepthButton: document.getElementById('resetDepthButton'), resetZoomButton: document.getElementById('resetZoomButton'), saveSettingsButton: document.getElementById('saveSettingsButton'), clientDisplayList: document.getElementById('clientDisplayList'), wslScanInput: document.getElementById('wslScanInput'), wslScanRow: document.getElementById('wslScanRow'), wslPanel: document.getElementById('wslPanel'), openConfigButton: document.getElementById('openConfigButton'), exportAutoInput: document.getElementById('exportAutoInput'), exportAutoDetails: document.getElementById('exportAutoDetails'), exportAutoStatus: document.getElementById('exportAutoStatus'), exportDirLabel: document.getElementById('exportDirLabel'), exportPickDirButton: document.getElementById('exportPickDirButton'), exportIntervalInput: document.getElementById('exportIntervalInput'), exportNowButton: document.getElementById('exportNowButton'), refreshButton: document.getElementById('refreshButton'), minButton: document.getElementById('minButton'), closeButton: document.getElementById('closeButton'), floatingBubbleTab: document.getElementById('floatingBubbleTab')
};
Object.assign(els, {
  viewBackRow: document.getElementById('viewBackRow'),
  backHomeButton: document.getElementById('backHomeButton'),
  systemGlassInputs: Array.from(document.querySelectorAll('input[name="systemGlassOption"]')),
  floatingBubbleOptions: document.getElementById('floatingBubbleOptions'),
  trayIconOptions: document.getElementById('trayIconOptions'),
  trayOptions: document.getElementById('trayOptions'),
  hubModeOptions: document.getElementById('hubModeOptions'),
  hubClientFields: document.getElementById('hubClientFields'),
  hubAccountsSettingsToggle: document.getElementById('hubAccountsSettingsToggle'),
  hubAccountsSettingsDetails: document.getElementById('hubAccountsSettingsDetails'),
  hubAccountsStatus: document.getElementById('hubAccountsStatus'),
  hubAccountProvider: document.getElementById('hubAccountProvider'),
  hubAccountName: document.getElementById('hubAccountName'),
  hubAccountLabel: document.getElementById('hubAccountLabel'),
  hubAccountCredential: document.getElementById('hubAccountCredential'),
  hubAccountAddButton: document.getElementById('hubAccountAddButton'),
  hubAccountsRefreshButton: document.getElementById('hubAccountsRefreshButton'),
  hubAccountError: document.getElementById('hubAccountError'),
  hubAccountsList: document.getElementById('hubAccountsList'),
  secretPasteButton: document.getElementById('secretPasteButton'),
  allowInsecureHubHttpInput: document.getElementById('allowInsecureHubHttpInput'),
  syncClientStatus: document.getElementById('syncClientStatus'), syncHealthStatus: document.getElementById('syncHealthStatus'),
  syncUploadIntervalInput: document.getElementById('syncUploadIntervalInput'),
  collectionCadenceInput: document.getElementById('collectionCadenceInput'),
  collectionCadenceNote: document.getElementById('collectionCadenceNote'),
  sessionUsageArchiveInput: document.getElementById('sessionUsageArchiveInput'),
  sessionUsageArchiveStatus: document.getElementById('sessionUsageArchiveStatus'),
  reduceMotionInputs: Array.from(document.querySelectorAll('input[name="reduceMotionOption"]')),
  macosGlassRow: document.getElementById('macosGlassRow'),
  macosGlassInput: document.getElementById('macosGlassInput'),
  macosGlassNote: document.getElementById('macosGlassNote'),
  clearSessionUsageArchiveButton: document.getElementById('clearSessionUsageArchiveButton'),
  startupGroup: document.getElementById('startupGroup'),
  startAtLoginInput: document.getElementById('startAtLoginInput'),
  startInTrayInput: document.getElementById('startInTrayInput'),
  closeToTrayInput: document.getElementById('closeToTrayInput'),
  startupNote: document.getElementById('startupNote'),
  tokscaleGroup: document.getElementById('tokscaleGroup'),
  tokscaleInstalled: document.getElementById('tokscaleInstalled'),
  tokscaleBundledLine: document.getElementById('tokscaleBundledLine'),
  tokscaleBundled: document.getElementById('tokscaleBundled'),
  tokscaleNpm: document.getElementById('tokscaleNpm'),
  tokscaleMessage: document.getElementById('tokscaleMessage'),
  checkTokscaleButton: document.getElementById('checkTokscaleButton'),
  downloadTokscaleButton: document.getElementById('downloadTokscaleButton'),
  resetTokscaleButton: document.getElementById('resetTokscaleButton'),
  openTokscaleLinkButton: document.getElementById('openTokscaleLinkButton'),
  aboutVersion: document.getElementById('aboutVersion'),
  openRepositoryButton: document.getElementById('openRepositoryButton'),
  reportIssueButton: document.getElementById('reportIssueButton'),
  appUpdatePill: document.getElementById('appUpdatePill'),
  appUpdatePillAction: document.getElementById('appUpdatePillAction'),
  appUpdatePillLabel: document.getElementById('appUpdatePillLabel'),
  appUpdatePillRestart: document.getElementById('appUpdatePillRestart'),
  appUpdatePillRestartLabel: document.getElementById('appUpdatePillRestartLabel'),
  appUpdatePillDismiss: document.getElementById('appUpdatePillDismiss'),
  appUpdatePopover: document.getElementById('appUpdatePopover'),
  appUpdatePopoverTitle: document.getElementById('appUpdatePopoverTitle'),
  appUpdatePopoverBody: document.getElementById('appUpdatePopoverBody'),
  appUpdatePopoverAction: document.getElementById('appUpdatePopoverAction'),
  appUpdatePopoverRelease: document.getElementById('appUpdatePopoverRelease'),
  appUpdatePopoverClose: document.getElementById('appUpdatePopoverClose'),
  customRangeButton: document.getElementById('customRangeButton'),
  customRangePopover: document.getElementById('customRangePopover'),
  customRangeClose: document.getElementById('customRangeClose'),
  customRangePrevMonth: document.getElementById('customRangePrevMonth'),
  customRangeNextMonth: document.getElementById('customRangeNextMonth'),
  customRangeMonthLabel: document.getElementById('customRangeMonthLabel'),
  customRangeWeekdays: document.getElementById('customRangeWeekdays'),
  customRangeGrid: document.getElementById('customRangeGrid'),
  customRangeStartDate: document.getElementById('customRangeStartDate'),
  customRangeEndDate: document.getElementById('customRangeEndDate'),
  customRangeStartHour: document.getElementById('customRangeStartHour'),
  customRangeEndHour: document.getElementById('customRangeEndHour'),
  customRangeError: document.getElementById('customRangeError'),
  customRangeClear: document.getElementById('customRangeClear'),
  customRangeApply: document.getElementById('customRangeApply'),
  customRangeTitle: document.getElementById('customRangeTitle'),
  appUpdateInstalled: document.getElementById('appUpdateInstalled'),
  automaticAppUpdatesRow: document.getElementById('automaticAppUpdatesRow'),
  automaticAppUpdatesInput: document.getElementById('automaticAppUpdatesInput'),
  automaticAppUpdatesNote: document.getElementById('automaticAppUpdatesNote'),
  appUpdateLatest: document.getElementById('appUpdateLatest'),
  appUpdateCheckButton: document.getElementById('appUpdateCheckButton'),
  appUpdateViewReleaseButton: document.getElementById('appUpdateViewReleaseButton'),
  appUpdateNotes: document.getElementById('appUpdateNotes'),
  appUpdateNotesTitle: document.getElementById('appUpdateNotesTitle'),
  appUpdateNotesBody: document.getElementById('appUpdateNotesBody'),
  appUpdateReleaseNotesButton: document.getElementById('appUpdateReleaseNotesButton'),
  appUpdateMessage: document.getElementById('appUpdateMessage'),
  titleIconRow: document.getElementById('titleIconRow'),
  titleIconInput: document.getElementById('titleIconInput'),
  showCompactTotalTokensInput: document.getElementById('showCompactTotalTokensInput'),
  swapSettingsRefreshInput: document.getElementById('swapSettingsRefreshInput'),
  resetClientDisplayOrderButton: document.getElementById('resetClientDisplayOrderButton'),
  showAllClientsButton: document.getElementById('showAllClientsButton'),
  resetViewDisplayOrderButton: document.getElementById('resetViewDisplayOrderButton'),
  showAllViewsButton: document.getElementById('showAllViewsButton'),
  viewDisplayList: document.getElementById('viewDisplayList'),
  syncSettingsSummary: document.getElementById('syncSettingsSummary'),
  toolsSettingsSummary: document.getElementById('toolsSettingsSummary'),
  accountsSettingsSummary: document.getElementById('accountsSettingsSummary'),
  limitsSettingsSummary: document.getElementById('limitsSettingsSummary'),
  generalSettingsSummary: document.getElementById('generalSettingsSummary'),
  mainSettingsSummary: document.getElementById('mainSettingsSummary'),
  windowSettingsSummary: document.getElementById('windowSettingsSummary'),
  appearanceSettingsSummary: document.getElementById('appearanceSettingsSummary'),
  themePresetChips: document.getElementById('themePresetChips'),
  themeColorGrid: document.getElementById('themeColorGrid'),
  themeCodeInput: document.getElementById('themeCodeInput'),
  applyThemeCodeButton: document.getElementById('applyThemeCodeButton'),
  copyThemeCodeButton: document.getElementById('copyThemeCodeButton'),
  themeCodeStatus: document.getElementById('themeCodeStatus'),
  themeAdvancedGroup: document.getElementById('themeAdvancedGroup'),
  themeAdvancedToggle: document.getElementById('themeAdvancedToggle'),
  themeAdvancedDetails: document.getElementById('themeAdvancedDetails'),
  themeVendorGroup: document.getElementById('themeVendorGroup'),
  themeVendorToggle: document.getElementById('themeVendorToggle'),
  themeVendorDetails: document.getElementById('themeVendorDetails'),
  vendorColorList: document.getElementById('vendorColorList'),
  resetThemeColorsButton: document.getElementById('resetThemeColorsButton'),
  resetVendorColorsButton: document.getElementById('resetVendorColorsButton'),
  sessionDetail: document.getElementById('session-detail'),
  sessionDetailHead: document.getElementById('session-detail-head')
});

function toggleAccordionRow(row) {
  const isExpanded = row.classList.contains('expanded');
  document.querySelectorAll('.row.expanded').forEach((other) => {
    other.classList.remove('expanded');
    other.setAttribute('aria-expanded', 'false');
  });
  if (!isExpanded) {
    row.classList.add('expanded');
    row.setAttribute('aria-expanded', 'true');
  }
}

function setAttributeIfChanged(element, name, value) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

document.addEventListener('click', (event) => {
  const row = event.target.closest('.row.has-accordion');
  if (row) toggleAccordionRow(row);
});

document.addEventListener('keydown', (event) => {
  const row = event.target.closest('.row.has-accordion');
  if (!row || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  toggleAccordionRow(row);
});

document.addEventListener('pointerdown', (event) => {
  if (state.viewSwitcherOpen && !event.target.closest('#viewSwitcher')) {
    setViewSwitcherOpen(false);
  }
});

document.addEventListener('pointerup', () => {
  clearViewSwitcherLongPress();
  if (viewSwitcherLongPressTriggered) {
    setTimeout(() => { viewSwitcherLongPressTriggered = false; }, 0);
  }
});

document.addEventListener('pointercancel', () => {
  clearViewSwitcherLongPress();
  viewSwitcherLongPressTriggered = false;
});

function preferredLanguages() {
  return navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
}

function currentLanguage() {
  return i18n.normalizeLanguage(state.settings?.language || 'auto');
}

function currentLocale() {
  return i18n.resolveLocale(currentLanguage(), preferredLanguages());
}

function t(key, params) {
  return i18n.translate(currentLocale(), key, params);
}

function translatedLimitCapabilityTag(label) {
  const key = LIMIT_CAPABILITY_TAG_KEYS[label];
  return key ? t(key) : label;
}

function applySettingsTranslations() {
  if (els.languageInput) els.languageInput.value = currentLanguage();
  i18n.applyTranslations(document, currentLocale());
  if (customRangePickerApi) {
    syncCustomRangeButton();
    // Month/weekday labels are built from locale, not data-i18n nodes.
    if (state.customRangeOpen || state.customRangeDraft || state.customRange) syncCustomRangeFields();
  }
}

function applySettingsSectionDom(id, open) {
  const toggle = document.querySelector(`[data-settings-section="${id}"]`);
  const details = document.getElementById(`${id}SettingsDetails`);
  const group = toggle?.closest('.settings-collapsible-group');
  toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
  details?.classList.toggle('hidden', !open);
  group?.classList.toggle('expanded', open);
}

function setSettingsSectionExpanded(section, expanded) {
  const id = String(section || '').trim();
  if (!SETTINGS_SECTION_IDS.includes(id)) return;
  const next = Boolean(expanded);
  if (next) {
    for (const other of SETTINGS_SECTION_IDS) {
      if (other === id || !state.settingsSections[other]) continue;
      state.settingsSections[other] = false;
      applySettingsSectionDom(other, false);
    }
  }
  state.settingsSections[id] = next;
  applySettingsSectionDom(id, next);
}

// Expanding a section auto-collapses the previously open one. When that one
// sits ABOVE the clicked header, the content above shrinks while scrollTop
// stays put, so the clicked card visually flies upward. Pin the clicked
// header to its on-screen position for the duration of the 250ms accordion
// transition (rAF-corrected each frame; a single pass when motion is off).
const SETTINGS_SCROLL_ANCHOR_MS = 360;
const SETTINGS_SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab']);
let settingsScrollAnchorFrame = null;

function cancelSettingsScrollAnchor() {
  if (settingsScrollAnchorFrame === null) return;
  cancelAnimationFrame(settingsScrollAnchorFrame);
  settingsScrollAnchorFrame = null;
}

function cancelSettingsScrollAnchorOnKeydown(event) {
  if (SETTINGS_SCROLL_KEYS.has(event.key)) cancelSettingsScrollAnchor();
}

function shouldAnchorSettingsScroll(section, expanding) {
  if (!expanding) return false;
  const sectionIndex = SETTINGS_SECTION_IDS.indexOf(section);
  return SETTINGS_SECTION_IDS.slice(0, sectionIndex).some(id => state.settingsSections[id]);
}

function anchorSettingsScroll(anchorEl, mutate) {
  cancelSettingsScrollAnchor();
  const panel = els.settingsPanel;
  if (!panel || !anchorEl) { mutate(); return; }
  const offset = anchorEl.getBoundingClientRect().top - panel.getBoundingClientRect().top;
  mutate();
  const reducedMotion = prefersReducedMotion();
  const deadline = performance.now() + SETTINGS_SCROLL_ANCHOR_MS;
  const pin = () => {
    settingsScrollAnchorFrame = null;
    if (!anchorEl.isConnected || panel.classList.contains('hidden')) return;
    const drift = anchorEl.getBoundingClientRect().top - panel.getBoundingClientRect().top - offset;
    if (Math.abs(drift) > 0.5) panel.scrollTop += drift;
    if (!reducedMotion && performance.now() < deadline) {
      settingsScrollAnchorFrame = requestAnimationFrame(pin);
    }
  };
  settingsScrollAnchorFrame = requestAnimationFrame(pin);
}

function setupSettingsSections() {
  for (const toggle of document.querySelectorAll('[data-settings-section]')) {
    const section = toggle.dataset.settingsSection;
    toggle.addEventListener('click', () => {
      const expanding = !state.settingsSections[section];
      const mutate = () => setSettingsSectionExpanded(section, expanding);
      if (shouldAnchorSettingsScroll(section, expanding)) anchorSettingsScroll(toggle, mutate);
      else { cancelSettingsScrollAnchor(); mutate(); }
    });
    setSettingsSectionExpanded(section, state.settingsSections[section]);
  }
  els.settingsPanel?.addEventListener('pointerdown', cancelSettingsScrollAnchor, { passive: true });
  els.settingsPanel?.addEventListener('wheel', cancelSettingsScrollAnchor, { passive: true });
  els.settingsPanel?.addEventListener('keydown', cancelSettingsScrollAnchorOnKeydown);
}

function refreshIntervalLabel(value) {
  const ms = Number(value) || 300000;
  const minutes = Math.max(1, Math.round(ms / 60000));
  return t('settings.summary.minutes', { minutes });
}

function viewsSummary() {
  const hidden = hiddenViewSet();
  const visible = VIEW_DISPLAY_OPTIONS.length - hidden.size;
  return t('settings.summary.views', { visible, total: VIEW_DISPLAY_OPTIONS.length });
}

function settingsSectionSummary(section) {
  if (!state.settings) return '';
  if (section === 'sync') {
    if (state.settings.hubMode === 'client') return t('settings.sync.connectHub');
    return t('settings.sync.localOnly');
  }
  if (section === 'tools') {
    return t('settings.summary.tools', {
      tracked: enabledClientSet().size,
      visible: KNOWN_CLIENTS.length - hiddenClientSet().size,
      pinned: pinnedClientSet().size
    });
  }
  if (section === 'accounts') {
    const accountCount = Array.isArray(state.hubAccounts) ? state.hubAccounts.length : 0;
    return t('settings.summary.accounts', {
      linked: accountCount,
      total: accountCount
    });
  }
  if (section === 'limits') {
    return t('settings.summary.limits', {
      enabled: enabledLimitProviderSet().size,
      refresh: refreshIntervalLabel(state.settings.limitsRefreshMs)
    });
  }
  if (section === 'main') {
    return viewsSummary();
  }
  if (section === 'window') {
    const behavior = WINDOW_BEHAVIOR_VALUES.includes(state.settings.windowBehavior) ? state.settings.windowBehavior : 'floating';
    return t(`settings.windowBehavior.${behavior}`);
  }
  if (section === 'appearance') {
    return appearanceSummary();
  }
  if (section === 'general') {
    const startup = state.appInfo?.loginItemSupported
      ? (state.settings.startAtLogin ? t('settings.summary.on') : t('settings.summary.off'))
      : t('settings.summary.unavailable');
    return t('settings.summary.general', {
      startup
    });
  }
  return '';
}

function renderSettingsSummaries() {
  for (const section of SETTINGS_SECTION_IDS) {
    const el = els[`${section}SettingsSummary`];
    if (el) el.textContent = settingsSectionSummary(section);
  }
}

function formatNumber(value) { return Math.round(Number(value || 0)).toLocaleString('en-US'); }
function formatCompact(value) {
  const num = Math.round(Number(value || 0));
  const abs = Math.abs(num);
  const units = [
    { divisor: 1e3, suffix: 'K' },
    { divisor: 1e6, suffix: 'M' },
    { divisor: 1e9, suffix: 'B' }
  ];
  let unitIndex = abs >= 1e9 ? 2 : abs >= 1e6 ? 1 : abs >= 1e3 ? 0 : -1;
  if (unitIndex < 0) return String(num);

  let unit = units[unitIndex];
  let display = (num / unit.divisor).toFixed(1);
  if (Math.abs(Number(display)) >= 1000 && unitIndex < units.length - 1) {
    unit = units[unitIndex + 1];
    display = (num / unit.divisor).toFixed(1);
  }
  return `${display.replace(/\.0$/, '')}${unit.suffix}`;
}
function updateTotalCompact(value) {
  if (!els.totalTokensCompact) return;
  const num = Math.round(Number(value || 0));
  if (state.settings?.showCompactTotalTokens !== true || Math.abs(num) < 1000) {
    hideTotalCompact();
  } else {
    els.totalTokensCompact.textContent = `≈ ${formatCompact(num)}`;
    els.totalTokensCompact.classList.remove('hidden');
  }
  fitTotalNumber();
}
function hideTotalCompact() {
  if (!els.totalTokensCompact) return;
  els.totalTokensCompact.textContent = '';
  els.totalTokensCompact.classList.add('hidden');
}
// Scale the exact total to fit the width it is actually given instead of clipping
// it to an ellipsis. The compact chip (when shown) is flex:0 0 auto and claims its
// width first, so the number's clientWidth is its allotted box while scrollWidth is
// its natural width; the ratio is how far the font must shrink to stay whole.
function totalNumberFontScale(availableWidth, naturalWidth, minScale = 0.5) {
  if (!(naturalWidth > 0) || !(availableWidth > 0)) return 1;
  return Math.min(1, Math.max(minScale, availableWidth / naturalWidth));
}
function fitTotalNumber() {
  const el = els.totalTokens;
  if (!el) return;
  el.style.fontSize = '';
  const base = parseFloat(getComputedStyle(el).fontSize);
  if (!(base > 0)) return;
  const scale = totalNumberFontScale(el.clientWidth, el.scrollWidth);
  if (scale < 1) el.style.fontSize = `${Math.floor(base * scale)}px`;
}
function trendShortLabel(label, labelKey) {
  const value = String(label || '');
  if (labelKey === 'month') return value.slice(0, 7);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${Number(m[2])}/${Number(m[3])}` : value;
}
function compactMonthLabel(label) {
  const match = /^(\d{4})-(\d{2})/.exec(String(label || ''));
  if (!match) return String(label || '');
  return new Intl.DateTimeFormat(currentLocale(), { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}
function currentCurrency() { return currencyApi.normalizeCurrency(state.settings?.currency); }
function formatCost(value) { return currencyApi.formatCurrencyFromUsd(value, currentCurrency()); }
function applyEffectiveCurrencyRates() {
  if (state.settings?.currencyRatesEffective) currencyApi.configureRates(state.settings.currencyRatesEffective);
}
function formatRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return String(Number(num.toFixed(num >= 1 ? 2 : 4)));   // trim noise: 31.6749… -> 31.67
}
function currencyRateMode(code) {
  const override = Number(state.settings?.currencyRates?.[code]);
  return Number.isFinite(override) && override > 0 ? 'manual' : 'auto';
}
function syncCurrencyRateControls() {
  const code = currentCurrency();
  if (!els.currencyRateRow) return;
  if (code === 'USD') { els.currencyRateRow.classList.add('hidden'); return; }
  els.currencyRateRow.classList.remove('hidden');
  const mode = currencyRateMode(code);
  if (els.currencyRateModeAuto) els.currencyRateModeAuto.checked = mode === 'auto';
  if (els.currencyRateModeManual) els.currencyRateModeManual.checked = mode === 'manual';
  const eff = Number(state.settings?.currencyRatesEffective?.[code]);
  if (mode === 'manual') {
    els.currencyRateManualField?.classList.remove('hidden');
    if (els.currencyRateStatus) els.currencyRateStatus.textContent = '';
    // Don't clobber the field while the user is typing in it.
    if (els.currencyRateOverrideInput && document.activeElement !== els.currencyRateOverrideInput) {
      els.currencyRateOverrideInput.value = formatRate(eff);
    }
  } else {
    els.currencyRateManualField?.classList.add('hidden');
    if (els.currencyRateStatus) {
      const info = state.settings?.currencyRateInfo;
      if (!Number.isFinite(eff)) els.currencyRateStatus.textContent = '';
      else if (info?.source) els.currencyRateStatus.textContent = t('settings.currency.rateLive', { rate: formatRate(eff), date: (info.date || '').slice(5) });
      else els.currencyRateStatus.textContent = t('settings.currency.rateDefault', { rate: formatRate(eff) });
    }
  }
}
function formatTime(value) { const date = value ? new Date(value) : new Date(); return Number.isNaN(date.getTime()) ? '--:--:--' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function formatPercent(value) { return Number.isFinite(Number(value)) ? `${Math.round(Number(value))}%` : '--'; }
function formatReset(value) {
  const diffMs = limitProviderPresentationApi.limitResetRemainingMs(value);
  if (diffMs === null) return '';
  if (diffMs === 0) return 'Reset now';
  return `Reset ${formatDuration(diffMs)}`;
}
function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}
function formatActiveDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(Number(ms || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '0m';
}
function formatUpdatedAge(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Update unknown';
  const diffMs = Math.max(0, Date.now() - date.getTime());
  if (diffMs < 45_000) return 'Updated just now';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.round(hours / 24)}d ago`;
}
function versionText(value) {
  return value ? `v${value}` : 'unknown';
}
function appUpdateActionMode(s) {
  if (!s) return '';
  if (s.installRetryBlocked) return s.latest?.htmlUrl ? 'release' : '';
  if (s.downloaded) return 'install';
  if (!s.hasUpdate) return '';
  if (s.installSupported) return 'download';
  return s.latest?.htmlUrl ? 'release' : '';
}
function setAppUpdatePillDisclosure(available) {
  const action = els.appUpdatePillAction;
  if (available) {
    action.setAttribute('aria-haspopup', 'dialog');
    action.setAttribute('aria-controls', 'appUpdatePopover');
    action.setAttribute('aria-expanded', String(els.appUpdatePopover.matches(':popover-open')));
    return;
  }
  action.removeAttribute('aria-haspopup');
  action.removeAttribute('aria-controls');
  action.removeAttribute('aria-expanded');
}
function renderAppUpdatePill() {
  const s = state.appUpdate;
  const pill = els.appUpdatePill;
  if (!pill) return;
  const mode = appUpdateActionMode(s);
  const version = s?.latest?.version || s?.installVersion || '';
  if (!s || !mode || !version || !s.showUpdateNotice) {
    pill.classList.add('hidden');
    pill.classList.remove('is-ready');
    pill.setAttribute('title', '');
    els.appUpdatePillLabel.textContent = '';
    els.appUpdatePillAction.removeAttribute('title');
    els.appUpdatePillAction.removeAttribute('aria-label');
    els.appUpdatePillAction.disabled = false;
    els.appUpdatePillRestart.classList.add('hidden');
    els.appUpdatePillRestartLabel.textContent = '';
    els.appUpdatePillRestart.disabled = false;
    els.appUpdatePillRestart.removeAttribute('title');
    els.appUpdatePillRestart.removeAttribute('aria-label');
    setAppUpdatePillDisclosure(false);
    return;
  }
  const hasReleaseNotes = releaseNoteGroupsForCurrentLocale(s.latest).length > 0;
  setAppUpdatePillDisclosure(hasReleaseNotes);
  pill.classList.remove('hidden');
  pill.classList.toggle('is-ready', mode === 'install');
  els.appUpdatePillDismiss.classList.toggle('hidden', mode === 'install' || s.installBusy);
  pill.setAttribute('title', '');
  const releaseLabel = hasReleaseNotes
    ? t('settings.appUpdate.whatsNew', { version })
    : (s.latest?.name || `v${version}`);
  els.appUpdatePillAction.setAttribute('title', releaseLabel);
  els.appUpdatePillAction.setAttribute('aria-label', releaseLabel);
  els.appUpdatePillAction.disabled = mode === 'install' && !hasReleaseNotes && !s.latest?.htmlUrl;
  els.appUpdatePillRestart.classList.toggle('hidden', mode !== 'install');
  els.appUpdatePillRestart.disabled = Boolean(s.installBusy);
  els.appUpdatePillRestartLabel.textContent = mode === 'install'
    ? t('settings.appUpdate.restartShort')
    : '';
  els.appUpdatePillRestart.setAttribute('title', t('settings.appUpdate.ready'));
  els.appUpdatePillRestart.setAttribute('aria-label', t('settings.appUpdate.restart'));
  if (s.installPhase === 'downloading' && Number.isFinite(s.installProgress)) {
    els.appUpdatePillLabel.textContent = `${Math.round(s.installProgress)}%`;
  } else {
    els.appUpdatePillLabel.textContent = mode === 'install'
      ? `v${version}`
      : `↑ v${version}`;
  }
}
function releaseNoteGroupsForCurrentLocale(latest) {
  const notes = latest?.releaseNotes;
  if (!notes || typeof notes !== 'object') return [];
  const preferred = currentLocale().startsWith('zh') ? notes.zh : notes.en;
  if (Array.isArray(preferred) && preferred.length > 0) return preferred;
  if (Array.isArray(notes.en) && notes.en.length > 0) return notes.en;
  return Array.isArray(notes.zh) ? notes.zh : [];
}
function buildAppUpdateNoteGroupNodes(groups) {
  return groups.map((group) => {
    const section = document.createElement('section');
    section.className = 'app-update-note-group';
    const title = document.createElement('div');
    title.className = 'app-update-note-title';
    title.textContent = String(group?.title || '');
    const list = document.createElement('ul');
    for (const item of Array.isArray(group?.items) ? group.items : []) {
      const row = document.createElement('li');
      row.textContent = String(item || '');
      list.append(row);
    }
    section.append(title, list);
    return section;
  });
}
function renderAppUpdatePopover(s) {
  const version = s?.latest?.version || '';
  const groups = releaseNoteGroupsForCurrentLocale(s?.latest);
  const mode = appUpdateActionMode(s);
  if (!version || groups.length === 0 || !mode) {
    if (els.appUpdatePopover.matches(':popover-open')) els.appUpdatePopover.hidePopover();
    els.appUpdatePopoverTitle.textContent = '';
    els.appUpdatePopoverBody.replaceChildren();
    return false;
  }
  els.appUpdatePopoverTitle.textContent = t('settings.appUpdate.whatsNew', { version });
  els.appUpdatePopoverBody.replaceChildren(...buildAppUpdateNoteGroupNodes(groups));
  els.appUpdatePopoverAction.textContent = mode === 'install'
    ? t('settings.appUpdate.restart')
    : mode === 'download'
      ? t('settings.appUpdate.download')
      : t('settings.appUpdate.viewRelease');
  els.appUpdatePopoverAction.disabled = Boolean(s.installBusy);
  els.appUpdatePopoverRelease.classList.toggle('hidden', !s.latest?.htmlUrl);
  return true;
}
function positionAppUpdatePopover() {
  const rect = els.appUpdatePill.getBoundingClientRect();
  const width = Math.min(320, window.innerWidth - 24);
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width));
  els.appUpdatePopover.style.width = `${width}px`;
  els.appUpdatePopover.style.left = `${left}px`;
  els.appUpdatePopover.style.bottom = `${Math.max(12, window.innerHeight - rect.top + 8)}px`;
}
function renderAppUpdateNotes(s) {
  const version = s?.latest?.version || '';
  const groups = releaseNoteGroupsForCurrentLocale(s?.latest);
  const visible = Boolean(version && groups.length > 0);
  els.appUpdateNotes.classList.toggle('hidden', !visible);
  if (!visible) {
    els.appUpdateNotes.open = false;
    els.appUpdateNotesTitle.textContent = '';
    els.appUpdateNotesBody.replaceChildren();
    return;
  }

  els.appUpdateNotesTitle.textContent = t('settings.appUpdate.whatsNew', { version });
  els.appUpdateNotesBody.replaceChildren(...buildAppUpdateNoteGroupNodes(groups));
  els.appUpdateReleaseNotesButton.classList.toggle('hidden', !s.latest?.htmlUrl);
  if (s.hasUpdate && state.appUpdateNotesPresentedVersion !== version) {
    els.appUpdateNotes.open = true;
    state.appUpdateNotesPresentedVersion = version;
  }
}
function renderSettingsAppUpdateRow() {
  const s = state.appUpdate;
  if (!s) {
    els.appUpdateInstalled.textContent = '—';
    els.appUpdateLatest.textContent = t('settings.common.notChecked');
    els.appUpdateCheckButton.disabled = false;
    els.appUpdateCheckButton.textContent = t('settings.appUpdate.check');
    els.appUpdateViewReleaseButton.classList.add('hidden');
    els.appUpdateMessage.textContent = '';
    els.appUpdateMessage.classList.remove('error');
    renderAppUpdateNotes(null);
    return;
  }
  els.appUpdateInstalled.textContent = `v${s.currentVersion}`;
  const displayVersion = s.latest?.version || s.installVersion || '';
  if (displayVersion) {
    els.appUpdateLatest.textContent = !s.hasUpdate && semverLikeEqual(displayVersion, s.currentVersion)
      ? t('settings.appUpdate.latestWithStatus', { version: displayVersion, status: t('settings.appUpdate.upToDateShort') })
      : `v${displayVersion}`;
    const actionMode = appUpdateActionMode(s);
    els.appUpdateViewReleaseButton.classList.toggle('hidden', !actionMode);
    els.appUpdateViewReleaseButton.disabled = Boolean(s.installBusy);
    els.appUpdateViewReleaseButton.textContent = actionMode === 'install'
      ? t('settings.appUpdate.restart')
      : actionMode === 'download'
        ? t('settings.appUpdate.download')
        : t('settings.appUpdate.viewRelease');
  } else {
    els.appUpdateLatest.textContent = s.lastCheckedAt ? t('settings.appUpdate.upToDate') : t('settings.common.notChecked');
    els.appUpdateViewReleaseButton.classList.add('hidden');
  }
  els.appUpdateCheckButton.disabled = Boolean(s.checking || s.installBusy);
  els.appUpdateCheckButton.textContent = s.checking ? t('settings.appUpdate.checking') : t('settings.appUpdate.check');
  renderAppUpdateNotes(s);
  if (s.installPhase === 'downloading') {
    const percent = Number.isFinite(s.installProgress) ? Math.round(s.installProgress) : 0;
    els.appUpdateMessage.textContent = t('settings.appUpdate.downloading', { percent });
    els.appUpdateMessage.classList.remove('error');
  } else if (s.downloaded) {
    els.appUpdateMessage.textContent = state.appInfo?.platform === 'win32'
      ? t('settings.appUpdate.readyWindowsUnsigned')
      : t('settings.appUpdate.ready');
    els.appUpdateMessage.classList.remove('error');
  } else if (s.installError) {
    els.appUpdateMessage.textContent = t('settings.appUpdate.installError');
    els.appUpdateMessage.classList.add('error');
  } else if (s.lastError) {
    els.appUpdateMessage.textContent = t('settings.appUpdate.githubError');
    els.appUpdateMessage.classList.add('error');
  } else {
    els.appUpdateMessage.textContent = '';
    els.appUpdateMessage.classList.remove('error');
  }
}

function renderAutomaticAppUpdateControl() {
  if (!els.automaticAppUpdatesInput) return;
  const control = appUpdatePresentationApi.automaticAppUpdateControlState({
    preferenceEnabled: state.settings?.automaticAppUpdates,
    updateState: state.appUpdate
  });
  els.automaticAppUpdatesInput.checked = control.checked;
  els.automaticAppUpdatesInput.disabled = control.disabled;
  els.automaticAppUpdatesRow?.classList.toggle('is-disabled', control.unavailable);
  if (els.automaticAppUpdatesNote) {
    els.automaticAppUpdatesNote.textContent = t(control.descriptionKey);
  }
}

function semverLikeEqual(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a === b;
}
function compactAge(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const diffMs = Math.max(0, Date.now() - date.getTime());
  if (diffMs < 45_000) return t('settings.age.justNow');
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return t('settings.age.minutesAgo', { minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('settings.age.hoursAgo', { hours });
  return t('settings.age.daysAgo', { days: Math.round(hours / 24) });
}
function colorWithAlpha(hex, alpha) {
  const raw = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(raw)) return `rgba(183, 234, 212, ${alpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function setTokscaleMessage(text = '', tone = '') {
  if (!els.tokscaleMessage) return;
  els.tokscaleMessage.textContent = text;
  els.tokscaleMessage.classList.toggle('error', tone === 'error');
  els.tokscaleMessage.classList.toggle('success', tone === 'success');
}

function mergeTokscalePayload(payload) {
  if (!payload || typeof payload !== 'object') return;
  if (payload.status) state.tokscaleStatus = payload.status;
  else if (payload.supported === false) state.tokscaleStatus = { supported: false };
  else if (payload.current || payload.bundled || payload.downloaded) {
    state.tokscaleStatus = {
      ...(state.tokscaleStatus || { supported: true }),
      supported: payload.supported !== false,
      current: payload.current ?? state.tokscaleStatus?.current ?? null,
      bundled: payload.bundled ?? state.tokscaleStatus?.bundled ?? null,
      downloaded: payload.downloaded ?? state.tokscaleStatus?.downloaded ?? null
    };
  }
  if (payload.npm || payload.checkedAt) {
    state.tokscaleCheck = {
      newer: Boolean(payload.newer),
      npm: payload.npm || state.tokscaleCheck?.npm || null,
      checkedAt: payload.checkedAt || state.tokscaleCheck?.checkedAt || null
    };
  }
  if (payload.downloaded === true && state.tokscaleCheck?.npm?.version === payload.version) {
    state.tokscaleCheck = { ...state.tokscaleCheck, newer: false };
  }
}

function renderTokscaleStatus() {
  if (!els.tokscaleGroup) return;
  const status = state.tokscaleStatus;
  if (status?.supported === false) {
    els.tokscaleGroup.classList.add('hidden');
    return;
  }
  els.tokscaleGroup.classList.remove('hidden');
  const current = status?.current;
  const source = current?.source === 'downloaded'
    ? (current.installedAt
      ? t('settings.tokscale.downloadedSourceWithAge', { age: compactAge(current.installedAt) })
      : t('settings.tokscale.downloadedSource'))
    : t('settings.tokscale.bundledSource');
  els.tokscaleInstalled.textContent = current ? `${versionText(current.version)} (${source})` : t('settings.common.notFound');
  els.tokscaleBundledLine.classList.toggle('hidden', !status?.downloaded || !status?.bundled);
  els.tokscaleBundled.textContent = status?.bundled ? versionText(status.bundled.version) : '—';
  if (state.tokscaleCheck?.npm?.version) {
    els.tokscaleNpm.textContent = state.tokscaleCheck.newer
      ? versionText(state.tokscaleCheck.npm.version)
      : t('settings.appUpdate.latestWithStatus', { version: state.tokscaleCheck.npm.version, status: t('settings.tokscale.currentSuffix') });
  } else {
    els.tokscaleNpm.textContent = t('settings.common.notChecked');
  }
  els.checkTokscaleButton.disabled = state.tokscaleBusy;
  els.downloadTokscaleButton.disabled = state.tokscaleBusy;
  els.resetTokscaleButton.disabled = state.tokscaleBusy;
  els.downloadTokscaleButton.classList.toggle('hidden', !state.tokscaleCheck?.newer);
  els.resetTokscaleButton.classList.toggle('hidden', !status?.downloaded);
}

async function refreshTokscaleStatus() {
  if (!window.tokenMonitor.getTokscaleStatus) return;
  try {
    state.tokscaleStatus = await window.tokenMonitor.getTokscaleStatus();
    renderTokscaleStatus();
  } catch (error) {
    setTokscaleMessage(error.message, 'error');
  }
}

async function checkTokscaleNpm() {
  state.tokscaleBusy = true;
  setTokscaleMessage(t('settings.tokscale.checkingNpm'));
  renderTokscaleStatus();
  try {
    const result = await window.tokenMonitor.checkTokscaleNpm();
    if (result?.error) throw new Error(result.error);
    mergeTokscalePayload(result);
    if (state.tokscaleStatus?.supported === false) return;
    setTokscaleMessage(state.tokscaleCheck?.newer ? t('settings.tokscale.newerOnNpm') : t('settings.tokscale.bundledCurrent'));
  } catch (error) {
    setTokscaleMessage(error.message, 'error');
  } finally {
    state.tokscaleBusy = false;
    renderTokscaleStatus();
  }
}

async function downloadTokscaleFromNpm() {
  state.tokscaleBusy = true;
  setTokscaleMessage(t('settings.tokscale.downloading'));
  renderTokscaleStatus();
  try {
    const result = await window.tokenMonitor.downloadTokscaleFromNpm();
    if (result?.error) throw new Error(result.error);
    mergeTokscalePayload(result);
    setTokscaleMessage(t('settings.tokscale.downloaded', { version: versionText(result.version) }), 'success');
  } catch (error) {
    setTokscaleMessage(error.message, 'error');
  } finally {
    state.tokscaleBusy = false;
    renderTokscaleStatus();
  }
}

async function resetTokscaleToBundled() {
  state.tokscaleBusy = true;
  setTokscaleMessage(t('settings.tokscale.resetting'));
  renderTokscaleStatus();
  try {
    state.tokscaleStatus = await window.tokenMonitor.resetTokscaleToBundled();
    state.tokscaleCheck = null;
    setTokscaleMessage(t('settings.tokscale.usingBundled'), 'success');
  } catch (error) {
    setTokscaleMessage(error.message, 'error');
  } finally {
    state.tokscaleBusy = false;
    renderTokscaleStatus();
  }
}
function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

// A single in-flight tween on the headline number. Without cancelling it, an
// orphaned loop from the previous period keeps writing its old value every
// frame and overwrites a later static update (e.g. switching to a zero period
// mid-animation).
let numberAnimHandle = 0;
let numberAnimTarget = null;
let numberAnimValue = 0;
function cancelNumberAnimation() {
  if (numberAnimHandle) cancelAnimationFrame(numberAnimHandle);
  numberAnimHandle = 0;
  numberAnimTarget = null;
}

function headlineNumberIsAnimatingTo(value) {
  return Boolean(numberAnimHandle) && numberAnimTarget === value;
}

function animateNumber(el, from, to, duration = 1000, onDone = null) {
  cancelNumberAnimation();
  if (prefersReducedMotion()) {
    el.textContent = formatNumber(to);
    numberAnimValue = to;
    if (typeof onDone === 'function') onDone();
    return;
  }
  const start = performance.now();
  const delta = to - from;
  numberAnimTarget = to;
  numberAnimValue = from;
  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    numberAnimValue = from + delta * easeOutQuart(progress);
    el.textContent = formatNumber(numberAnimValue);
    if (progress < 1) {
      numberAnimHandle = requestAnimationFrame(frame);
    } else {
      numberAnimHandle = 0;
      numberAnimTarget = null;
      numberAnimValue = to;
      if (typeof onDone === 'function') onDone();
    }
  }
  numberAnimHandle = requestAnimationFrame(frame);
}

const rowNumberAnimations = new Map();
const rowBarAnimations = new Map();
const rowRenderFingerprints = new WeakMap();
const largeSessionContainmentScheduler = createAfterLayoutScheduler(
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null,
  typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null
);

function updateLargeSessionContainment(enabled, { remeasure = false } = {}) {
  els.breakdown.classList.toggle('large-session-list', enabled);
  if (!enabled) {
    largeSessionContainmentScheduler.cancel();
    els.breakdown.classList.remove('large-session-list-ready');
    return;
  }
  if (remeasure) {
    largeSessionContainmentScheduler.cancel();
    els.breakdown.classList.remove('large-session-list-ready');
  }
  if (largeSessionContainmentScheduler.pending() || els.breakdown.classList.contains('large-session-list-ready')) return;
  // Let Chromium lay out every new row without size containment first. The
  // `auto` intrinsic size can then retain each row's real block size before
  // off-screen rendering is enabled, avoiding scroll-geometry corrections.
  largeSessionContainmentScheduler.schedule(() => {
    if (els.breakdown.classList.contains('large-session-list')) {
      els.breakdown.classList.add('large-session-list-ready');
    }
  });
}

function prefersReducedMotion() {
  return motionPreferenceApi.shouldReduceMotion(state.settings?.reduceMotion, reducedMotionMedia?.matches);
}

function settleMotionAnimations() {
  cancelNumberAnimation();
  numberAnimValue = state.currentTotal;
  els.totalTokens.textContent = formatNumber(state.currentTotal);
  updateTotalCompact(state.currentTotal);
  for (const [el, motion] of rowNumberAnimations) {
    cancelAnimationFrame(motion.handle);
    const target = Number(motion.target ?? el.dataset.motionTarget ?? el.dataset.motionValue ?? 0);
    el.textContent = formatNumber(target);
    el.dataset.motionValue = String(target);
    delete el.dataset.motionTarget;
  }
  rowNumberAnimations.clear();
  for (const animation of document.getAnimations?.() || []) {
    try { animation.finish(); } catch (_) { animation.cancel(); }
  }
  rowBarAnimations.clear();
}

function applyReduceMotionPreference(value) {
  const preference = motionPreferenceApi.normalize(value);
  document.documentElement.dataset.reduceMotion = preference;
  if (motionPreferenceApi.shouldReduceMotion(preference, reducedMotionMedia?.matches)) settleMotionAnimations();
  return preference;
}

function captureBreakdownMotion() {
  const rows = Array.from(els.breakdown?.querySelectorAll('.row[data-key]') || []);
  if (!shouldAnimateBreakdownRows(rows.length, { reducedMotion: prefersReducedMotion() })) return null;
  const snapshot = new Map();
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    const fill = row.querySelector('.bar-fill');
    const trackWidth = fill?.parentElement?.getBoundingClientRect().width || 0;
    const fillWidth = fill?.getBoundingClientRect().width || 0;
    snapshot.set(row.dataset.key, {
      top: rect.top,
      value: Number(row.querySelector('.row-value')?.dataset.motionValue || row.dataset.motionValue || 0),
      barScale: trackWidth > 0 ? Math.max(0, Math.min(1, fillWidth / trackWidth)) : 0
    });
  }
  return snapshot;
}

function animateRowNumber(el, from, to, duration = 420) {
  const previous = rowNumberAnimations.get(el);
  if (previous?.target === to) return;
  if (previous) cancelAnimationFrame(previous.handle);
  const startValue = Number.isFinite(previous?.value) ? previous.value : from;
  if (!Number.isFinite(startValue) || !Number.isFinite(to) || startValue === to || prefersReducedMotion()) {
    el.textContent = formatNumber(to);
    el.dataset.motionValue = String(Number(to) || 0);
    delete el.dataset.motionTarget;
    rowNumberAnimations.delete(el);
    return;
  }
  const startedAt = performance.now();
  const delta = to - startValue;
  const motion = { handle: 0, target: to, value: startValue };
  el.textContent = formatNumber(startValue);
  el.dataset.motionValue = String(startValue);
  el.dataset.motionTarget = String(to);
  function frame(now) {
    if (prefersReducedMotion()) {
      el.textContent = formatNumber(to);
      el.dataset.motionValue = String(Number(to) || 0);
      delete el.dataset.motionTarget;
      if (rowNumberAnimations.get(el) === motion) rowNumberAnimations.delete(el);
      return;
    }
    const progress = Math.min(1, (now - startedAt) / duration);
    motion.value = startValue + delta * easeOutQuart(progress);
    el.textContent = formatNumber(motion.value);
    el.dataset.motionValue = String(motion.value);
    if (progress < 1) {
      motion.handle = requestAnimationFrame(frame);
    } else {
      delete el.dataset.motionTarget;
      if (rowNumberAnimations.get(el) === motion) rowNumberAnimations.delete(el);
    }
  }
  motion.handle = requestAnimationFrame(frame);
  rowNumberAnimations.set(el, motion);
}

function animateBreakdownFrom(snapshot, { duration = 420 } = {}) {
  if (!snapshot) return;
  const rows = Array.from(els.breakdown?.querySelectorAll('.row[data-key]') || []);
  if (!shouldAnimateBreakdownRows(rows.length, { reducedMotion: prefersReducedMotion() })) return;
  let enteringIndex = 0;
  for (const row of rows) {
    const previous = snapshot.get(row.dataset.key);
    const value = Number(row.dataset.motionValue || 0);
    const fill = row.querySelector('.bar-fill');
    const targetScale = Math.max(0, Math.min(1, Number(fill?.style.getPropertyValue('--bar-scale')) || 0));
    if (previous) {
      const deltaY = previous.top - row.getBoundingClientRect().top;
      if (Math.abs(deltaY) > 0.5) {
        row.animate([
          { transform: `translate3d(0, ${deltaY}px, 0)` },
          { transform: 'translate3d(0, 0, 0)' }
        ], { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
      animateBarBetween(fill, previous.barScale, targetScale, 0, duration);
      animateRowNumber(row.querySelector('.row-value'), previous.value, value, duration);
      continue;
    }
    row.animate([
      { opacity: 0, transform: 'translate3d(0, 7px, 0)' },
      { opacity: 1, transform: 'translate3d(0, 0, 0)' }
    ], {
      duration: 240,
      delay: Math.min(enteringIndex, 6) * 18,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'backwards'
    });
    const delay = Math.min(enteringIndex, 6) * 18;
    animateBarBetween(fill, 0, targetScale, delay, Math.max(1, duration - delay));
    animateRowNumber(row.querySelector('.row-value'), 0, value, duration);
    enteringIndex += 1;
  }
}

function animateBarBetween(fill, fromScale, toScale, delay = 0, duration = 420) {
  if (!fill?.animate) return;
  const previous = rowBarAnimations.get(fill);
  const previousIsActive = previous?.animation.pending || previous?.animation.playState === 'running';
  if (previousIsActive && Math.abs(previous.target - toScale) < 0.001) return;
  for (const animation of fill.getAnimations()) animation.cancel();
  rowBarAnimations.delete(fill);
  if (Math.abs(toScale - fromScale) < 0.001) return;
  const animation = fill.animate([
    { transform: `scaleX(${fromScale})` },
    { transform: `scaleX(${toScale})` }
  ], {
    duration,
    delay,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    fill: 'backwards'
  });
  const motion = { animation, target: toScale };
  const forget = () => {
    if (rowBarAnimations.get(fill) === motion) rowBarAnimations.delete(fill);
  };
  animation.onfinish = forget;
  animation.oncancel = forget;
  rowBarAnimations.set(fill, motion);
}

function captureTrendBarMotion() {
  const snapshot = new Map();
  for (const bar of els.trendsPanel?.querySelectorAll('.spark-bar[data-motion-key]') || []) {
    snapshot.set(bar.dataset.motionKey, { height: bar.getBoundingClientRect().height });
  }
  return snapshot;
}

function animateTrendBarsFrom(snapshot, { fromZero = false } = {}) {
  if (prefersReducedMotion()) return;
  const bars = Array.from(els.trendsPanel?.querySelectorAll('.spark-bar[data-motion-key]') || []);
  bars.forEach((bar, index) => {
    const previous = snapshot.get(bar.dataset.motionKey);
    const targetHeight = bar.getBoundingClientRect().height;
    const fromScale = fromZero || !previous
      ? 0
      : targetHeight > 0 ? previous.height / targetHeight : 1;
    if (Math.abs(fromScale - 1) < 0.001) return;
    bar.animate([
      { transform: `scaleY(${fromScale})` },
      { transform: 'scaleY(1)' }
    ], {
      duration: 420,
      delay: previous && !fromZero ? 0 : Math.min(index, 14) * 14,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'backwards'
    });
  });
}

const HOME_HISTORY_MOTION_MS = 920;
const HOME_HEATMAP_MOTION_MS = 640;
const HOME_HEAT_CELL_MOTION_MS = 240;

function animateHomeHistoryVisuals(activityScroll, activityCanvas, trendChart) {
  if (!state.animateChartsOnRender) return;
  state.animateChartsOnRender = false;
  if (prefersReducedMotion()) return;

  const heatCells = Array.from(activityCanvas?.querySelectorAll('.heat-base-layer .heat') || []);
  const viewport = activityScroll?.getBoundingClientRect();
  const visibleCells = heatCells.map((cell, index) => ({ cell, column: Math.floor(index / 7), rect: cell.getBoundingClientRect() }))
    .filter(({ rect }) => viewport && rect.right > viewport.left && rect.left < viewport.right);
  const firstVisibleColumn = visibleCells.length ? visibleCells[0].column : 0;
  const lastVisibleColumn = visibleCells.length ? visibleCells[visibleCells.length - 1].column : firstVisibleColumn;
  const heatColumnDelay = (HOME_HEATMAP_MOTION_MS - HOME_HEAT_CELL_MOTION_MS) / Math.max(1, lastVisibleColumn - firstVisibleColumn);
  visibleCells.forEach(({ cell, column }) => {
    cell.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: HOME_HEAT_CELL_MOTION_MS,
      delay: (column - firstVisibleColumn) * heatColumnDelay,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'backwards'
    });
  });

  const line = trendChart?.querySelector('.area-line-stroke');
  const fill = trendChart?.querySelector('.area-line-fill');
  const length = line?.getTotalLength?.() || 0;
  if (length > 0) {
    line.animate([
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: length },
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 }
    ], {
      duration: HOME_HISTORY_MOTION_MS,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'backwards'
    });
  }
  fill?.animate([
    { clipPath: 'inset(0 100% 0 0)' },
    { clipPath: 'inset(0 0 0 0)' }
  ], {
    duration: HOME_HISTORY_MOTION_MS,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    fill: 'backwards'
  });
}

function applyBarScale(fill, scale) {
  const safeScale = Math.max(0, Math.min(1, Number(scale) || 0));
  fill.style.setProperty('--bar-scale', String(safeScale));
  if (!state.animateBarsFromZero || prefersReducedMotion() || !fill.animate) return;
  animateBarBetween(fill, 0, safeScale, 0, 420);
}

function rowWidth(value, max) {
  if (Number(value) <= 0) return 0;
  return max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
}

function rowTemplate(rowData) {
  const { key, name, platform, client, subtitle, detail, kind } = rowData;
  const row = document.createElement('div');
  row.dataset.key = key;
  if (platform) row.dataset.platform = platform;
  if (client) row.dataset.client = client;
  if (kind) row.dataset.kind = kind;
  row.innerHTML = '<div class="row-head"><div class="row-name"><span class="row-mark"></span><div class="row-label"><span class="row-title"></span><span class="row-subtitle"></span><span class="row-detail"></span></div></div><div class="row-metrics"><div class="row-value"></div><div class="row-cost"></div></div></div><div class="row-body"><div class="bar"><div class="bar-fill"></div></div><div class="row-accordion"><div class="row-accordion-inner"></div></div></div>';
  row.querySelector('.row-title').textContent = name;
  row.querySelector('.row-subtitle').textContent = subtitle || '';
  row.querySelector('.row-detail').textContent = detail || '';
  return row;
}

function renderDeviceAccordion(accordionInner, deviceDetail) {
  const signature = JSON.stringify([
    toolIconsEnabled(state.settings?.showToolIcons),
    deviceDetail.emptyText,
    deviceDetail.metaParts,
    deviceDetail.tools.map((tool) => [
      tool.key,
      tool.value,
      Math.round(tool.percent),
      tool.color,
      tool.models.map((model) => [model.key, model.value])
    ])
  ]);
  if (accordionInner.dataset.signature === signature) return;

  const content = document.createElement('div');
  content.className = 'accordion-content device-breakdown';
  if (deviceDetail.tools.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'device-breakdown-empty';
    empty.textContent = deviceDetail.emptyText;
    content.append(empty);
  } else {
    for (const tool of deviceDetail.tools) {
      const toolGroup = document.createElement('div');
      toolGroup.className = 'device-tool';
      const head = document.createElement('div');
      head.className = 'device-tool-head';
      const label = document.createElement('div');
      label.className = 'device-tool-label';
      const mark = document.createElement('span');
      if (toolIconsEnabled(state.settings?.showToolIcons) && clientsWithIcon.has(tool.client)) {
        mark.className = `device-tool-mark row-icon row-icon-${tool.client}`;
      } else {
        mark.className = 'device-tool-mark dot';
        mark.style.background = tool.color;
      }
      const name = document.createElement('span');
      name.className = 'device-tool-name';
      name.textContent = tool.name;
      const percent = document.createElement('span');
      percent.className = 'accordion-pct';
      percent.textContent = `${Math.round(tool.percent)}%`;
      label.append(mark, name, percent);
      const metrics = document.createElement('span');
      metrics.className = 'device-tool-metrics';
      metrics.textContent = formatNumber(tool.value);
      head.append(label, metrics);
      toolGroup.append(head);

      if (tool.models.length > 0) {
        const modelList = document.createElement('div');
        modelList.className = 'device-model-list';
        for (const model of tool.models) {
          const modelRow = document.createElement('div');
          modelRow.className = 'device-model-row';
          const modelName = document.createElement('span');
          modelName.className = 'device-model-name';
          modelName.textContent = model.name;
          const modelValue = document.createElement('span');
          modelValue.className = 'device-model-value';
          modelValue.textContent = formatCompact(model.value);
          modelRow.append(modelName, modelValue);
          modelList.append(modelRow);
        }
        toolGroup.append(modelList);
      }
      content.append(toolGroup);
    }
  }
  if (deviceDetail.metaParts.length > 0) {
    const meta = document.createElement('div');
    meta.className = 'device-meta';
    meta.textContent = deviceDetail.metaParts.join(' · ');
    content.append(meta);
  }
  accordionInner.replaceChildren(content);
  accordionInner.dataset.signature = signature;
}

function updateRow(row, { name, subtitle, detail, value, cost, max, color, barBackground, accordionRows, deviceDetail, stale, platform, local, client, kind, cacheReadTokens, outputTokens }) {
  const width = rowWidth(value, max);
  const isExpanded = row.classList.contains('expanded');
  row.className = `row${kind ? ` ${kind}-row` : ''}${stale ? ' stale' : ''}${local ? ' local' : ''}`;
  row.title = local ? 'This device' : '';
  
  if (cacheReadTokens !== undefined || outputTokens !== undefined) {
    row.dataset.cacheRead = cacheReadTokens || 0;
    row.dataset.outputTokens = outputTokens || 0;
    row.dataset.totalTokens = value || 0;
    row.dataset.name = name || '';
  }
  if (platform !== undefined) row.dataset.platform = platform || '';
  if (client !== undefined) row.dataset.client = client || '';
  if (kind !== undefined) row.dataset.kind = kind || '';
  const mark = row.querySelector('.row-mark');
  const iconKind = iconKindFor({ key: row.dataset.key, platform: row.dataset.platform || '', client: row.dataset.client || '' }, state.breakdown);
  if (iconKind.kind === 'icon') {
    mark.className = `row-mark row-icon ${iconKind.iconClass}`;
    mark.style.background = '';
  } else {
    mark.className = 'row-mark dot';
    mark.style.background = color;
  }
  row.querySelector('.row-title').textContent = name;
  const subtitleEl = row.querySelector('.row-subtitle');
  subtitleEl.textContent = subtitle || '';
  subtitleEl.classList.toggle('hidden', !subtitle);
  const detailEl = row.querySelector('.row-detail');
  detailEl.textContent = detail || '';
  detailEl.classList.toggle('hidden', !detail);
  const valueEl = row.querySelector('.row-value');
  valueEl.textContent = formatNumber(value);
  valueEl.dataset.motionValue = String(Number(value) || 0);
  row.dataset.motionValue = String(Number(value) || 0);
  row.querySelector('.row-cost').textContent = formatCost(cost || 0);
  const fill = row.querySelector('.bar-fill');
  fill.style.background = barBackground || color;
  applyBarScale(fill, width / 100);

  const accordionInner = row.querySelector('.row-accordion-inner');
  if (deviceDetail) {
    renderDeviceAccordion(accordionInner, deviceDetail);
    row.classList.add('has-accordion');
    if (isExpanded) row.classList.add('expanded');
  } else if (Array.isArray(accordionRows) && accordionRows.length > 0) {
    const accordionSignature = JSON.stringify(accordionRows.map((tool) => [tool.name, tool.value, Math.round(tool.percent), tool.color]));
    if (accordionInner.dataset.signature !== accordionSignature) {
      const content = document.createElement('div');
      content.className = 'accordion-content project-tool-breakdown';
      for (const tool of accordionRows) {
        const item = document.createElement('div');
        item.className = 'accordion-row project-tool-row';
        const label = document.createElement('div');
        label.className = 'accordion-label';
        const mark = document.createElement('span');
        mark.className = 'project-tool-mark';
        mark.style.background = tool.color;
        const text = document.createElement('span');
        text.textContent = tool.name;
        const percent = document.createElement('span');
        percent.className = 'accordion-pct';
        percent.textContent = `${Math.round(tool.percent)}%`;
        label.append(mark, text, percent);
        const tokens = document.createElement('span');
        tokens.className = 'accordion-value';
        tokens.textContent = formatNumber(tool.value);
        item.append(label, tokens);
        content.append(item);
      }
      accordionInner.replaceChildren(content);
      accordionInner.dataset.signature = accordionSignature;
    }
    row.classList.add('has-accordion');
    if (isExpanded) row.classList.add('expanded');
  } else if ((cacheReadTokens !== undefined || outputTokens !== undefined) && value > 0 && kind !== 'session') {
    const cacheRead = cacheReadTokens || 0;
    const output = outputTokens || 0;
    const totalTokens = value || 0;
    const cacheMiss = Math.max(0, totalTokens - cacheRead - output);
    const inputTokens = cacheRead + cacheMiss;
    const hitPct = inputTokens > 0 ? Math.round((cacheRead / inputTokens) * 100) : 0;
    const missPct = inputTokens > 0 ? 100 - hitPct : 0;
    
    delete accordionInner.dataset.signature;
    accordionInner.innerHTML = `
      <div class="accordion-content">
        <div class="accordion-row">
          <div class="accordion-label">${t('dashboard.tooltip.inputCacheHit')} <span class="accordion-pct">${hitPct}%</span></div>
          <div class="accordion-value">${formatNumber(cacheRead)}</div>
        </div>
        <div class="accordion-row">
          <div class="accordion-label">${t('dashboard.tooltip.inputCacheMiss')} <span class="accordion-pct">${missPct}%</span></div>
          <div class="accordion-value">${formatNumber(cacheMiss)}</div>
        </div>
        <div class="accordion-row">
          <div class="accordion-label">${t('dashboard.tooltip.output')}</div>
          <div class="accordion-value">${formatNumber(output)}</div>
        </div>
      </div>
    `;
    row.classList.add('has-accordion');
    if (isExpanded) row.classList.add('expanded');
  } else {
    accordionInner.replaceChildren();
    delete accordionInner.dataset.signature;
    row.classList.remove('has-accordion');
    row.classList.remove('expanded');
  }
  if (row.classList.contains('has-accordion')) {
    if (row.tabIndex !== 0) row.tabIndex = 0;
    setAttributeIfChanged(row, 'role', 'button');
    setAttributeIfChanged(row, 'aria-expanded', String(row.classList.contains('expanded')));
    setAttributeIfChanged(row, 'aria-label', `${name}, ${t('dashboard.stat.totalTokens')}: ${formatNumber(value)}, ${t('dashboard.stat.totalCost')}: ${formatCost(cost || 0)}`);
  } else {
    if (row.hasAttribute('tabindex')) row.removeAttribute('tabindex');
    if (row.hasAttribute('role')) row.removeAttribute('role');
    if (row.hasAttribute('aria-expanded')) row.removeAttribute('aria-expanded');
    if (row.hasAttribute('aria-label')) row.removeAttribute('aria-label');
  }
}

function applyHomeListMark(mark, iconKind, color) {
  if (iconKind.kind === 'icon') {
    mark.className = `home-list-mark row-icon ${iconKind.iconClass}`;
    mark.style.background = '';
    return;
  }
  mark.className = 'home-list-mark';
  mark.style.background = color;
}

function renderRows(rows, { incompleteHint = '' } = {}) {
  const largeSessionList = isLargeSessionBreakdown(state.breakdown, rows.length);
  if (rows.length === 0 && !incompleteHint) {
    updateLargeSessionContainment(false);
    els.breakdown.replaceChildren();
    state.rowSignature = '';
    return;
  }
  const max = Math.max(1, ...rows.map((row) => row.value));
  const liveMotionSnapshot = !state.periodMotionActive && !state.animateBarsFromZero
    ? captureBreakdownMotion()
    : null;
  const hintText = incompleteHint ? t(incompleteHint) : '';
  const signature = JSON.stringify([state.breakdown, hintText, rows.map((row) => row.key)]);
  const children = Array.from(els.breakdown.children);
  const existingHint = children.find((child) => child.classList.contains('breakdown-incomplete-hint'));
  const existing = new Map(children.filter((child) => child !== existingHint).map((child) => [child.dataset.key, child]));
  const structureChanged = signature !== state.rowSignature;
  if (structureChanged) {
    const nodes = rows.map((row) => existing.get(row.key) || rowTemplate(row));
    if (incompleteHint) {
      const hint = existingHint || document.createElement('p');
      hint.className = 'breakdown-incomplete-hint';
      hint.setAttribute('role', 'status');
      hint.textContent = hintText;
      nodes.unshift(hint);
    }
    els.breakdown.replaceChildren(...nodes);
    state.rowSignature = signature;
  }
  updateLargeSessionContainment(largeSessionList, { remeasure: structureChanged });
  const current = new Map(Array.from(els.breakdown.children)
    .filter((child) => !child.classList.contains('breakdown-incomplete-hint'))
    .map((child) => [child.dataset.key, child]));
  const renderContext = {
    breakdown: state.breakdown,
    currency: currentCurrency(),
    currencyRatesEffective: state.settings?.currencyRatesEffective || null,
    locale: currentLocale(),
    showToolIcons: toolIconsEnabled(state.settings?.showToolIcons)
  };
  for (const rowData of rows) {
    const row = current.get(rowData.key);
    if (!row) continue;
    const fingerprint = rowRenderFingerprint(rowData, max, renderContext);
    if (rowRenderFingerprints.get(row) === fingerprint) continue;
    updateRow(row, { ...rowData, max });
    rowRenderFingerprints.set(row, fingerprint);
  }
  if (liveMotionSnapshot) animateBreakdownFrom(liveMotionSnapshot, { duration: 600 });
}

function deviceLabel(device) {
  return device.deviceId || device.hostname || 'device';
}

function deviceColor(stale) {
  return stale ? deviceStaleColor : deviceAccent;
}

function deviceRuntimeLabel(value) {
  if (value === 'electron-widget') return t('devices.runtime.widget');
  if (value === 'headless-agent') return t('devices.runtime.agent');
  return String(value || '');
}

function deviceSyncedLabel(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const diffMs = Math.max(0, Date.now() - date.getTime());
  let age;
  if (diffMs < 45_000) age = t('settings.age.justNow');
  else {
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 60) age = t('settings.age.minutesAgo', { minutes });
    else {
      const hours = Math.round(minutes / 60);
      age = hours < 24
        ? t('settings.age.hoursAgo', { hours })
        : t('settings.age.daysAgo', { days: Math.round(hours / 24) });
    }
  }
  return t('devices.synced', { age });
}

function stableColor(value, colors) {
  let hash = 0;
  for (const char of String(value || '')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

function deviceRowsForPeriod() {
  const localId = state.settings?.deviceId || '';
  const devices = (state.stats?.devices || []).filter((device) => (
    state.period !== 'custom' || device?.periods?.custom
  ));
  return devices.map((device) => {
    const breakdown = deviceBreakdownApi.deviceBreakdownForPeriod(device, state.period, {
      clientLabels,
      clientColors,
      fallbackColor: clientColors.default
    });
    const period = device.periods?.[state.period] || {};
    const runtime = deviceRuntimeLabel(device.agentRuntime);
    const version = device.agentVersion ? `${runtime ? `${runtime} ` : ''}v${device.agentVersion}` : runtime;
    const metaParts = [deviceBreakdownApi.devicePlatformLabel(device.platform, device.osName, device.osVersion), version, deviceSyncedLabel(device.updatedAt)].filter(Boolean);
    return {
      key: device.deviceId,
      name: deviceLabel(device),
      value: breakdown.totalTokens,
      cost: Number(period.costUsd || 0),
      color: deviceColor(Boolean(device.stale)),
      stale: Boolean(device.stale),
      platform: device.platform || '',
      local: Boolean(localId) && device.deviceId === localId,
      deviceDetail: {
        ...breakdown,
        emptyText: breakdown.totalTokens > 0 ? t('devices.detailsUnavailable') : t('home.noTools'),
        metaParts
      }
    };
  }).sort((a, b) => b.value - a.value);
}

function toolRowsForPeriod(period) {
  const clientRows = Object.entries(period?.clients || {}).filter(([, value]) => Number(value) > 0).map(([client, value]) => ({ key: client, name: clientLabels[client] || client, value: Number(value), cost: Number(period?.clientCosts?.[client] || 0), color: clientColors[client] || clientColors.default, stale: false, cacheReadTokens: Number(period?.clientCacheReads?.[client] || 0), cacheWriteTokens: Number(period?.clientCacheWrites?.[client] || 0), outputTokens: Number(period?.clientOutputs?.[client] || 0) }));
  if (clientRows.length > 0) {
    const usageSortedRows = clientRows.sort((a, b) => b.value - a.value);
    return clientDisplayPreferencesApi.applyClientDisplayPreferences(usageSortedRows, state.settings?.clientDisplayOrder, state.settings?.hiddenClients, KNOWN_CLIENTS, state.settings?.pinnedClients);
  }
  if (Number(period?.totalTokens || 0) === 0) return [];
  return deviceRowsForPeriod();
}

function modelRowsForPeriod(period) {
  const modelRows = Object.entries(period?.models || {}).filter(([, value]) => Number(value) > 0).map(([model, value]) => ({
    key: model,
    name: model,
    value: Number(value),
    cost: Number(period?.modelCosts?.[model] || 0),
    color: modelColor(model),
    stale: false,
    cacheReadTokens: Number(period?.modelCacheReads?.[model] || 0),
    cacheWriteTokens: Number(period?.modelCacheWrites?.[model] || 0),
    outputTokens: Number(period?.modelOutputs?.[model] || 0)
  }));
  if (modelRows.length > 0) return modelRows.sort((a, b) => b.value - a.value);
  if (Number(period?.totalTokens || 0) === 0) return [];
  return toolRowsForPeriod(period);
}

function sessionRowsForPeriod(period) {
  const rows = sessionRowsApi.sessionRowsForPeriod(period, {
    nativeSessions: state.stats?.nativeSessions?.[state.period],
    clientLabels,
    clientColors,
    modelColor,
    stableColor,
    fallbackColors: fallbackModelColors,
    archivedLabel: t('session.archived')
  });
  if (rows.length > 0) return rows.sort((a, b) => b.sortTime - a.sortTime || b.value - a.value || b.cost - a.cost || a.name.localeCompare(b.name));
  if (Number(period?.totalTokens || 0) === 0) return [];
  return modelRowsForPeriod(period);
}

function projectRowsForPeriod(period) {
  return projectRowsApi.projectRowsForPeriod(period, {
    nativeProjects: state.stats?.nativeProjects?.[state.period],
    clientLabels,
    clientColors,
    stableColor,
    fallbackColors: fallbackModelColors,
    unknownClientLabel: t('projects.unknownTool')
  });
}

function rowsForPeriod(period) {
  if (state.breakdown === 'device') return deviceRowsForPeriod();
  if (state.breakdown === 'model') return modelRowsForPeriod(period);
  if (state.breakdown === 'session') return sessionRowsForPeriod(period);
  if (state.breakdown === 'project') return projectRowsForPeriod(period);
  return toolRowsForPeriod(period);
}

function limitViewAvailable() {
  return enabledLimitProviderSet().size > 0;
}

function effectiveViewDisplayOrderValue() {
  const raw = state.settings?.viewDisplayOrder;
  const rawIds = String(raw || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (rawIds.length > 0 && !rawIds.includes('home')) {
    const normalized = viewDisplayPreferencesApi.normalizeViewDisplayOrder(raw, VIEW_DISPLAY_OPTIONS);
    return ['home', ...normalized.filter((id) => id !== 'home')].join(',');
  }
  return raw;
}

function availableBreakdownIds() {
  const order = ['home', baseBreakdownOrder[0], 'status', 'trends', ...baseBreakdownOrder.slice(1)];
  let available = state.settings?.historyEnabled === false ? order.filter((id) => id !== 'trends') : order;
  if (state.settings?.projectsEnabled === false) available = available.filter((id) => id !== 'project');
  return limitViewAvailable() ? [...available, 'limits'] : available;
}

function visibleBreakdownOrder() {
  return viewDisplayPreferencesApi.visibleViewOrder({
    views: VIEW_DISPLAY_OPTIONS,
    orderValue: effectiveViewDisplayOrderValue(),
    hiddenValue: state.settings?.hiddenViews,
    availableIds: availableBreakdownIds(),
    includeIds: directBreakdownOverride ? [directBreakdownOverride] : []
  });
}

function ensureBreakdownVisible() {
  const availableIds = availableBreakdownIds();
  if (directBreakdownOverride === state.breakdown && availableIds.includes(state.breakdown)) return;
  directBreakdownOverride = null;
  const next = viewDisplayPreferencesApi.preferredViewId({
    views: VIEW_DISPLAY_OPTIONS,
    orderValue: effectiveViewDisplayOrderValue(),
    hiddenValue: state.settings?.hiddenViews,
    availableIds,
    currentId: state.breakdown
  });
  if (next !== state.breakdown) setBreakdown(next);
}

function limitStatusLabel(status) {
  if (status === 'ok') return 'Live';
  if (status === 'disabled') return 'Disabled';
  if (status === 'notConfigured') return 'Not signed in';
  if (status === 'noSyncedData') return 'No synced data';
  if (status === 'unauthorized') return 'Sign in again';
  if (status === 'rateLimited') return 'Limited';
  if (status === 'sourceRateLimited') return 'Usage API limited';
  if (status === 'unavailable') return 'Unavailable';
  return 'Error';
}

function syncProvenanceActive() {
  return state.mode === 'sync' || Boolean(String(state.settings?.hubUrl || '').trim());
}

function limitProviderProvenance(provider) {
  return limitProviderPresentationApi.limitProviderProvenance(provider, {
    localDeviceId: state.settings?.deviceId || '',
    syncActive: syncProvenanceActive(),
    devices: state.stats?.devices || []
  });
}

function limitProviderMeta(provider, provenance = null) {
  const sourceDevice = limitProviderPresentationApi.limitProviderMainDeviceLabel(provenance, { showSource: Boolean(state.settings?.showLimitSource) });
  if (provider.stale) {
    const parts = ['Stale', formatUpdatedAge(provider.updatedAt).replace('Updated ', '')];
    if (sourceDevice) parts.push(sourceDevice);
    return parts.join(' · ');
  }
  if (provider.status === 'ok') {
    const parts = [];
    if (state.settings?.showLimitSource) {
      const sourceLabel = limitProviderPresentationApi.limitProviderSourceLabel(provider) || LIMIT_SOURCE_LABELS[provider.source];
      if (sourceLabel) parts.push(sourceLabel);
    }
    if (sourceDevice) parts.push(sourceDevice);
    return `${formatUpdatedAge(provider.updatedAt)}${parts.length ? ` · ${parts.join(' · ')}` : ''}`;
  }
  return limitStatusLabel(provider.status, false);
}

function limitProviderPlan(provider) {
  if (provider?.status && provider.status !== 'ok' && !provider.stale) return limitStatusLabel(provider.status, false);
  const label = String(provider?.planLabel || provider?.accountLabel || '').trim();
  if (label) return limitProviderPresentationApi.limitProviderDisplayLabel(translatedLimitCapabilityTag(label));
  return provider?.status && provider.status !== 'ok' ? limitStatusLabel(provider.status, false) : '';
}

function configuredLimitProviderOrder() {
  const enabled = enabledLimitProviderSet();
  return limitProviderOrderApi
    .normalizeLimitProviderOrder(state.settings?.limitProviderOrder, LIMIT_PROVIDERS)
    .filter((id) => enabled.has(id));
}

function configuredLimitProviderSelection() {
  const raw = state.settings?.limitProviders;
  const source = raw === undefined || raw === null ? DEFAULT_LIMIT_PROVIDER_ORDER : raw;
  return limitProviderOrderApi.normalizeLimitProviderSelection(source, LIMIT_PROVIDERS);
}

function enabledLimitProviderSet() {
  if (state.settings?.limitsEnabled === false) return new Set();
  return new Set(configuredLimitProviderSelection());
}

function missingLimitProviderStatus() {
  return state.mode === 'sync' || String(state.settings?.hubUrl || '').trim() ? 'noSyncedData' : 'notConfigured';
}

function windowForKind(provider, kind) {
  return (provider?.windows || []).find((window) => window.kind === kind) || null;
}

function windowsForKind(provider, kind) {
  return (provider?.windows || []).filter((window) => window.kind === kind);
}

function antigravityQuotaGroups(provider) {
  const entries = (provider?.windows || [])
    .filter((window) => window.kind === 'session' || window.kind === 'weekly')
    .map((window) => {
      const presentation = limitProviderPresentationApi.antigravityQuotaWindow(window);
      return presentation ? { ...presentation, window } : null;
    });
  // Legacy GetUserStatus pools have model names rather than group + period
  // labels. Keep their existing flat layout instead of guessing a hierarchy.
  if (entries.length === 0 || entries.some((entry) => entry === null)) return [];
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.groupLabel)) groups.set(entry.groupLabel, []);
    groups.get(entry.groupLabel).push(entry);
  }
  return [...groups].map(([label, windows]) => ({ label, windows }));
}

function formatLimitAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return `$${number.toFixed(2)}`;
}

// Absolute count for windows that expose units (credits). It follows the same
// display mode as percent bars: remaining/total in quota mode, used/total in
// used mode.
function formatLimitCount(window, showUsed = false) {
  const used = Number(window?.used);
  const limit = Number(window?.limit);
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return '';
  const trim = (n) => Number(Math.max(0, n).toFixed(2)).toString();
  return `${trim(showUsed ? used : limit - used)}/${trim(limit)}`;
}

// One-line Overage value: "12.5 credits · $3.20" (credits used, then est. cost).
// Either piece may be absent; the row only renders when at least one is present.
function formatKiroOverageValue(window) {
  const parts = [];
  const credits = Number(window?.used);
  if (Number.isFinite(credits)) parts.push(`${Number(credits.toFixed(2))} credits`);
  const cost = Number(window?.remaining);
  if (Number.isFinite(cost)) parts.push(formatLimitAmount(cost));
  return parts.join(' · ');
}

function formatCodexResetCreditsValue(resetCredits) {
  const available = Number(resetCredits?.availableCount);
  if (!Number.isFinite(available)) return '';
  const count = Math.max(0, Math.floor(available));
  if (count <= 0) return '';
  return `${count} reset${count === 1 ? '' : 's'}`;
}

function codexResetCreditExpirationDates(resetCredits) {
  const values = Array.isArray(resetCredits?.expirations) ? resetCredits.expirations : [];
  const dates = values
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length > 0) return dates;
  const fallback = resetCredits?.nextExpiresAt ? new Date(resetCredits.nextExpiresAt) : null;
  return fallback && !Number.isNaN(fallback.getTime()) ? [fallback] : [];
}

function codexResetCreditExpiryLabel(date) {
  const diffMs = date.getTime() - Date.now();
  return diffMs <= 0 ? 'now' : formatDuration(diffMs);
}

function codexResetCreditExpiryDetailLabel(date) {
  const diffMs = date.getTime() - Date.now();
  return diffMs <= 0 ? 'Expires now' : `Expires in ${formatDuration(diffMs)}`;
}

function codexResetCreditExpiryDateLabel(date) {
  return new Intl.DateTimeFormat(currentLocale(), { month: 'numeric', day: 'numeric' }).format(date);
}

function limitDetailTooltipShouldHoldRender() {
  if (!state.limitDetailTooltipActive || !els.limitsPanel) return false;
  return Boolean(els.limitsPanel.querySelector('.limit-detail-tooltip-wrap:hover, .limit-detail-tooltip-wrap:focus-within'));
}

function flushPendingLimitDetailTooltipRender() {
  if (!state.limitDetailTooltipRenderPending || state.breakdown !== 'limits') return;
  state.limitDetailTooltipRenderPending = false;
  renderLimits();
}

function codexResetCreditsNode(resetCredits) {
  const valueText = formatCodexResetCreditsValue(resetCredits);
  if (!valueText) return null;
  const expirationDates = codexResetCreditExpirationDates(resetCredits);
  const item = document.createElement('div');
  item.className = 'limit-window limit-window-wide limit-window-note limit-reset-credits';
  const line = document.createElement('div');
  line.className = 'limit-reset-credits-line';
  const value = document.createElement('span');
  value.className = 'limit-reset-credits-value';
  value.textContent = valueText;
  line.append(value);
  if (expirationDates.length > 0) {
    const expiryGroup = document.createElement('span');
    expiryGroup.className = 'limit-reset-credits-expiry-group';
    const timeline = document.createElement('span');
    timeline.className = 'limit-reset-credits-timeline';
    const summaryParts = expirationDates.slice(0, 3).map(codexResetCreditExpiryLabel);
    const hiddenExpirationCount = expirationDates.length - summaryParts.length;
    if (hiddenExpirationCount > 0) summaryParts.push(`+${hiddenExpirationCount}`);
    summaryParts.forEach((text, index) => {
      const time = document.createElement('span');
      time.className = 'limit-reset-credits-time';
      if (index > 0) {
        const separator = document.createElement('span');
        separator.className = 'limit-reset-credits-separator';
        separator.textContent = '·';
        separator.setAttribute('aria-hidden', 'true');
        time.append(separator);
      }
      time.append(document.createTextNode(text));
      timeline.append(time);
    });
    expiryGroup.append(timeline);
    if (expirationDates.length > 1) {
      const infoWrap = document.createElement('span');
      infoWrap.className = 'limit-detail-tooltip-wrap';
      infoWrap.classList.toggle('has-opened', state.limitDetailTooltipHasOpened);
      const info = document.createElement('span');
      info.className = 'limit-detail-tooltip-trigger';
      info.textContent = 'i';
      info.tabIndex = 0;
      info.setAttribute('aria-label', expirationDates.map((date, index) => `Reset ${index + 1}: ${codexResetCreditExpiryDetailLabel(date)}`).join(', '));
      const tooltip = document.createElement('span');
      tooltip.className = 'limit-detail-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      expirationDates.forEach((date) => {
        const row = document.createElement('span');
        row.className = 'limit-detail-tooltip-row';
        const label = document.createElement('span');
        label.textContent = codexResetCreditExpiryDateLabel(date);
        const tooltipExpiry = document.createElement('span');
        tooltipExpiry.textContent = codexResetCreditExpiryLabel(date);
        row.append(label, tooltipExpiry);
        tooltip.append(row);
      });
      const markResetCreditsTooltipOpened = () => {
        state.limitDetailTooltipHasOpened = true;
        state.limitDetailTooltipActive = true;
        infoWrap.classList.add('has-opened');
      };
      const releaseResetCreditsTooltip = () => {
        requestAnimationFrame(() => {
          if (limitDetailTooltipShouldHoldRender()) return;
          state.limitDetailTooltipActive = false;
          flushPendingLimitDetailTooltipRender();
        });
      };
      infoWrap.addEventListener('pointerenter', markResetCreditsTooltipOpened);
      infoWrap.addEventListener('focusin', markResetCreditsTooltipOpened);
      infoWrap.addEventListener('pointerleave', releaseResetCreditsTooltip);
      infoWrap.addEventListener('focusout', releaseResetCreditsTooltip);
      infoWrap.append(info, tooltip);
      expiryGroup.append(infoWrap);
    }
    line.append(expiryGroup);
  }
  item.append(line);
  item.setAttribute('aria-label', ['Reset credits', valueText, expirationDates.map(codexResetCreditExpiryDetailLabel).join(', ')].filter(Boolean).join(', '));
  return item;
}

function openrouterSpendEntries(balance) {
  return [
    ['Today', optionalFiniteNumber(balance?.todaySpend)],
    ['Week', optionalFiniteNumber(balance?.weekSpend)],
    ['Month', optionalFiniteNumber(balance?.monthSpend)],
    ['All time', optionalFiniteNumber(balance?.allTimeSpend)]
  ].filter(([, value]) => value !== null);
}

function openrouterSpendNode(balance) {
  const entries = openrouterSpendEntries(balance);
  if (entries.length === 0) return null;
  const currency = balance?.currency || 'USD';
  const preferredSummary = entries.filter(([label]) => label === 'Today' || label === 'Month');
  const summaryEntries = preferredSummary.length > 0 ? preferredSummary : entries.slice(0, 2);
  const summaryText = summaryEntries
    .map(([label, value]) => `${label} ${formatMoney(value, currency)}`)
    .join(' · ');

  const item = document.createElement('div');
  item.className = 'limit-window limit-window-wide limit-window-note limit-spend';
  const line = document.createElement('div');
  line.className = 'limit-window-text limit-spend-line';
  const label = document.createElement('span');
  label.textContent = 'Spend';
  const right = document.createElement('span');
  right.className = 'limit-spend-right';
  const summary = document.createElement('span');
  summary.className = 'limit-spend-summary';
  summary.textContent = summaryText;
  right.append(summary);

  if (entries.length > summaryEntries.length) {
    const infoWrap = document.createElement('span');
    infoWrap.className = 'limit-detail-tooltip-wrap limit-spend-info-wrap';
    infoWrap.classList.toggle('has-opened', state.limitDetailTooltipHasOpened);
    const info = document.createElement('span');
    info.className = 'limit-detail-tooltip-trigger';
    info.textContent = 'i';
    info.tabIndex = 0;
    info.setAttribute(
      'aria-label',
      entries.map(([entryLabel, value]) => `${entryLabel}: ${formatMoney(value, currency)}`).join(', ')
    );
    const tooltip = document.createElement('span');
    tooltip.className = 'limit-detail-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    entries.forEach(([entryLabel, value]) => {
      const row = document.createElement('span');
      row.className = 'limit-detail-tooltip-row';
      const tooltipLabel = document.createElement('span');
      tooltipLabel.textContent = entryLabel;
      const tooltipValue = document.createElement('span');
      tooltipValue.textContent = formatMoney(value, currency);
      row.append(tooltipLabel, tooltipValue);
      tooltip.append(row);
    });
    const markSpendTooltipOpened = () => {
      state.limitDetailTooltipHasOpened = true;
      state.limitDetailTooltipActive = true;
      infoWrap.classList.add('has-opened');
    };
    const releaseSpendTooltip = () => {
      requestAnimationFrame(() => {
        if (limitDetailTooltipShouldHoldRender()) return;
        state.limitDetailTooltipActive = false;
        flushPendingLimitDetailTooltipRender();
      });
    };
    infoWrap.addEventListener('pointerenter', markSpendTooltipOpened);
    infoWrap.addEventListener('focusin', markSpendTooltipOpened);
    infoWrap.addEventListener('pointerleave', releaseSpendTooltip);
    infoWrap.addEventListener('focusout', releaseSpendTooltip);
    infoWrap.append(info, tooltip);
    right.append(infoWrap);
  }

  line.append(label, right);
  item.append(line);
  item.setAttribute(
    'aria-label',
    ['Spend', ...entries.map(([entryLabel, value]) => `${entryLabel} ${formatMoney(value, currency)}`)].join(', ')
  );
  return item;
}

const CURRENCY_SYMBOLS = { CNY: '¥', USD: '$' };

function formatMoney(value, currency) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  const symbol = CURRENCY_SYMBOLS[String(currency || '').toUpperCase()] || '$';
  return `${symbol}${number.toFixed(2)}`;
}

function optionalFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function openrouterCreditsWindow(provider) {
  const windows = Array.isArray(provider?.windows) ? provider.windows : [];
  // Older hubs normalized windows before `metric` existed. Keep the label
  // fallback only for those mixed-version payloads.
  return windows.find((window) => window?.metric === 'credits')
    || windows.find((window) => !window?.metric && window?.label === 'Credits')
    || null;
}

function formatLimitWindowValue(window, fillPercent, hasPercent, showUsed) {
  if (hasPercent) return `${formatPercent(fillPercent)} ${limitModeSuffix(showUsed)}`;
  if (!window) return '--';
  const remaining = Number(window?.remaining);
  if (Number.isFinite(remaining)) {
    return window?.showMeter === false ? formatLimitAmount(remaining) : `${formatLimitAmount(remaining)} left`;
  }
  const limit = Number(window?.limit);
  if (Number.isFinite(limit)) return `${formatLimitAmount(limit)} cap`;
  return '';
}

function formatHomeLimitWindowValue(window, showUsed) {
  if (window?.planStatus === 'expired') return t('limits.mimo.planExpired');
  if (window?.kind === 'balance') {
    return `${formatMoney(window.amount, window.currency)} left`;
  }
  const percent = limitFillPercent(window?.remainingPercent, window?.usedPercent, showUsed);
  return `${formatPercent(percent)} ${limitModeSuffix(showUsed)}`;
}

function balanceRemainingWindow(balance) {
  const amount = Math.max(0, Number(balance?.amount || 0));
  const spend = Math.max(0, Number(balance?.monthSpend || 0));
  const total = amount + spend;
  const remainingPercent = total > 0 ? (amount / total) * 100 : 100;
  return { remainingPercent };
}

function mimoTokenPlanWindowFromBalance(balance) {
  if (!balance) return null;
  if (balance.planStatus === 'expired') return null;
  const used = optionalFiniteNumber(balance.planUsed);
  const limit = optionalFiniteNumber(balance.planLimit);
  const percent = optionalFiniteNumber(balance.planPercent);
  const hasUsed = used !== null;
  const hasLimit = limit !== null;
  const hasPercent = percent !== null;
  if (!hasUsed && !hasLimit && !hasPercent) return null;
  const resolvedPercent = hasPercent
    ? Math.max(0, Math.min(100, percent))
    : (hasUsed && hasLimit && limit > 0 ? Math.max(0, Math.min(100, (used / limit) * 100)) : null);
  return {
    kind: 'billing',
    label: 'Token Plan',
    used: hasUsed ? used : null,
    limit: hasLimit ? limit : null,
    remaining: hasUsed && hasLimit ? Math.max(0, limit - used) : null,
    usedPercent: resolvedPercent,
    remainingPercent: resolvedPercent == null ? null : Math.max(0, Math.min(100, 100 - resolvedPercent)),
    showMeter: true
  };
}

function limitMeterNode(color, percent, tone = 1) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const meter = document.createElement('div');
  meter.className = 'limit-meter';
  meter.style.background = colorWithAlpha(color, 0.16);
  const fill = document.createElement('div');
  fill.className = 'limit-meter-fill';
  applyBarScale(fill, safePercent / 100);
  fill.style.background = color;
  fill.style.opacity = tone;
  meter.append(fill);
  return meter;
}

function limitWindowNode(label, window, color, tone = 1, valueOverride = null, detailText = '') {
  const remaining = Number(window?.remainingPercent);
  const used = Number(window?.usedPercent);
  const showMeter = window?.showMeter !== false;
  const hasPercent = showMeter && (Number.isFinite(remaining) || Number.isFinite(used));
  // valueOverride windows carry a fixed (money/amount) label — keep their meter
  // on "remaining" so bar and label stay consistent; only percent-labelled
  // windows honour the used-mode flip.
  const showUsed = Boolean(state.settings?.showLimitUsed) && valueOverride == null;
  const fillPercent = limitFillPercent(remaining, used, showUsed);
  const item = document.createElement('div');
  item.className = 'limit-window';
  const text = document.createElement('div');
  text.className = 'limit-window-text';
  const name = document.createElement('span');
  name.textContent = window?.label || label;
  const value = document.createElement('span');
  value.textContent = valueOverride != null ? valueOverride : formatLimitWindowValue(window, fillPercent, hasPercent, showUsed);
  text.append(name, value);
  const meter = limitMeterNode(color, fillPercent, tone);
  const reset = document.createElement('div');
  reset.className = 'limit-reset';
  const resetText = window?.resetsAt
    ? formatReset(window.resetsAt)
    : window?.resetDescription || '';
  if (detailText) {
    // Keep the reset text left-aligned (consistent with every other provider)
    // and add the absolute count on the right, under the top-line percentage.
    reset.classList.add('limit-reset-split');
    const resetSpan = document.createElement('span');
    resetSpan.textContent = resetText;
    const detailSpan = document.createElement('span');
    detailSpan.className = 'limit-detail';
    detailSpan.textContent = detailText;
    reset.append(resetSpan, detailSpan);
  } else {
    reset.textContent = resetText;
  }
  if (showMeter) {
    item.append(text, meter, reset);
  } else {
    item.classList.add('limit-window-note');
    item.append(text, reset);
  }
  return item;
}

function providersByLimitProviderId(providers) {
  const byId = new Map();
  for (const provider of providers || []) {
    const id = String(provider?.provider || '').trim().toLowerCase();
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(provider);
  }
  return byId;
}

function renderLimitProviderMark(id, color) {
  const mark = document.createElement('span');
  if (clientsWithIcon.has(id)) {
    mark.className = `limit-icon limit-icon-${id}`;
  } else {
    mark.className = 'dot';
    mark.style.background = color;
  }
  return mark;
}

function renderLimitProviderHead(id, label, provider, color, options = {}) {
  const head = document.createElement('div');
  head.className = 'limit-head';
  const titleBlock = document.createElement('div');
  titleBlock.className = 'limit-title';
  const name = document.createElement('div');
  name.className = 'limit-name';
  if (options.showIcon !== false) name.append(renderLimitProviderMark(id, color));
  const title = document.createElement('span');
  title.className = 'limit-name-title';
  title.textContent = options.title || label;
  const provenance = limitProviderProvenance(provider);
  name.append(title);
  titleBlock.append(name);
  // The multi-account group header has no quota of its own, and its accounts can
  // update at different times (different devices too), so it omits the meta line
  // entirely — each account row below shows its own "Updated" time.
  if (!options.hideMeta) {
    const meta = document.createElement('div');
    meta.className = 'limit-meta';
    const metaParts = [];
    // A single Codex account stays clean like every other provider (just the
    // "Updated" line). The email only matters when several accounts share the
    // group, where it's each subrow's title (options.accountTitle) — not here.
    if (provider.status === 'ok' || provider.stale) metaParts.push(limitProviderMeta(provider, provenance));
    const metaText = metaParts.filter(Boolean).join(' · ');
    if (metaText) meta.append(document.createTextNode(metaText));
    titleBlock.append(meta);
  }
  const plan = document.createElement('div');
  plan.className = 'limit-plan';
  plan.textContent = options.planText ?? limitProviderPlan(provider);
  head.append(titleBlock, plan);
  return head;
}

function renderProviderWindows(provider, color) {
  const windows = document.createElement('div');
  windows.className = 'limit-windows';
  if (provider.provider === 'codex') {
    const session = windowForKind(provider, 'session');
    const weekly = windowForKind(provider, 'weekly');
    if (session) {
      const sessionNode = limitWindowNode(session.label || 'Session', session, color, 0.95);
      if (!weekly) sessionNode.classList.add('limit-window-wide');
      windows.append(sessionNode);
    }
    if (weekly) {
      const weeklyNode = limitWindowNode(weekly.label || 'Weekly', weekly, color, 0.68);
      if (!session) weeklyNode.classList.add('limit-window-wide');
      windows.append(weeklyNode);
    }
    const resetNode = codexResetCreditsNode(provider.resetCredits);
    if (resetNode) windows.append(resetNode);
  } else if (provider.provider === 'cursor') {
    windows.classList.add('limit-windows-cursor');
    const billingWindows = windowsForKind(provider, 'billing');
    const visibleWindows = billingWindows.length > 0 ? billingWindows : [null];
    for (const billing of visibleWindows) {
      const node = limitWindowNode('Billing cycle', billing, color, 0.68);
      node.classList.add('limit-window-wide');
      windows.append(node);
    }
  } else if (provider.provider === 'antigravity') {
    windows.classList.add('limit-windows-antigravity');
    const quotaGroups = antigravityQuotaGroups(provider);
    if (quotaGroups.length > 0) {
      windows.classList.add('limit-windows-antigravity-grouped');
      for (const group of quotaGroups) {
        const groupNode = document.createElement('div');
        groupNode.className = 'limit-window-group';
        groupNode.setAttribute('role', 'group');
        groupNode.setAttribute('aria-label', group.label);
        const title = document.createElement('div');
        title.className = 'limit-window-group-title';
        title.textContent = group.label;
        const groupWindows = document.createElement('div');
        groupWindows.className = 'limit-window-group-items';
        for (const entry of group.windows) {
          const opacity = entry.window.kind === 'session' ? 0.95 : 0.78;
          groupWindows.append(limitWindowNode(
            entry.windowLabel,
            { ...entry.window, label: entry.windowLabel },
            color,
            opacity
          ));
        }
        groupNode.append(title, groupWindows);
        windows.append(groupNode);
      }
    } else {
      const weeklyWindows = windowsForKind(provider, 'weekly');
      const visibleWindows = weeklyWindows.length > 0 ? weeklyWindows : [null];
      for (const quotaWindow of visibleWindows) {
        const node = limitWindowNode(quotaWindow?.label || 'Weekly', quotaWindow, color, 0.78);
        node.classList.add('limit-window-wide');
        windows.append(node);
      }
    }
  } else if (provider.provider === 'opencode') {
    // Go reports session/weekly/monthly windows ($12/$30/$60); Zen reports a prepaid balance (and,
    // when the account is active, rolling/weekly). The monthly window normalizes to kind 'billing'
    // (see normalizeWindowKind). Show only the windows that exist — no empty `--` placeholders — and
    // surface the Zen balance as a full-width, no-meter note when present.
    const session = windowForKind(provider, 'session');
    const weekly = windowForKind(provider, 'weekly');
    const monthly = windowForKind(provider, 'billing');
    if (session) windows.append(limitWindowNode('Session', session, color, 0.95));
    if (weekly) windows.append(limitWindowNode('Weekly', weekly, color, 0.68));
    // Monthly spans the full row (like Balance) so it never leaves a half-empty grid cell.
    if (monthly) {
      const node = limitWindowNode('Monthly', monthly, color, 0.5);
      node.classList.add('limit-window-wide');
      windows.append(node);
    }
    // Balance is a Zen-only concept. Show it only when a real balance number came
    // back (incl. $0.00). It can't key off `source === 'web'` anymore — Go usage is
    // now fetched over the web too, so a pure-Go account (no Zen, balanceUsd null)
    // must not get a phantom `Balance —` line.
    const hasBalance = typeof provider.balanceUsd === 'number' && Number.isFinite(provider.balanceUsd);
    if (hasBalance) {
      const node = limitWindowNode('Balance', { showMeter: false }, color, 0.68, formatLimitAmount(provider.balanceUsd));
      node.classList.add('limit-window-wide');
      windows.append(node);
    }
  } else if (provider.provider === 'openrouter') {
    windows.classList.add('limit-windows-openrouter');
    const balance = provider.balance || null;
    const currency = balance?.currency || 'USD';
    const balanceAmount = optionalFiniteNumber(balance?.amount);
    const creditsWindow = openrouterCreditsWindow(provider);
    if (balanceAmount !== null) {
      const balanceWindow = creditsWindow || (balanceAmount === 0
        ? { usedPercent: 100, remainingPercent: 0, showMeter: true }
        : { showMeter: false });
      const balanceNode = limitWindowNode(
        'Balance',
        { ...balanceWindow, label: 'Balance' },
        color,
        0.95,
        `${formatMoney(balanceAmount, currency)} left`
      );
      balanceNode.classList.add('limit-window-wide', 'limit-window-no-reset');
      windows.append(balanceNode);
    }
    for (const quotaWindow of (provider.windows || []).filter((window) => window !== creditsWindow)) {
      const hasMeter = quotaWindow?.showMeter !== false;
      const remaining = optionalFiniteNumber(quotaWindow?.remaining);
      const limit = optionalFiniteNumber(quotaWindow?.limit);
      const absoluteDetail = hasMeter && remaining !== null && limit !== null
        ? `${formatMoney(remaining, 'USD')} left · ${formatMoney(limit, 'USD')} total`
        : '';
      const valueOverride = hasMeter ? null : (quotaWindow?.detail || '—');
      const node = limitWindowNode(
        quotaWindow?.label || 'Usage',
        quotaWindow,
        color,
        hasMeter ? 0.85 : 0.6,
        valueOverride,
        absoluteDetail
      );
      node.classList.add('limit-window-wide');
      if (!hasMeter) node.classList.add('limit-window-no-reset');
      windows.append(node);
    }
    const spendNode = openrouterSpendNode(balance);
    if (spendNode) windows.append(spendNode);
  } else if (provider.provider === 'deepseek') {
    // DeepSeek does not expose a fixed quota denominator. This intentionally
    // visualizes the balance relative to this month's inferred starting funds:
    // current / (current + observed month spend).
    windows.classList.add('limit-windows-deepseek');
    const balance = provider.balance || null;
    if (balance) {
      const currency = balance.currency;
      const balanceNode = limitWindowNode('Balance', balanceRemainingWindow(balance), color, 0.95,
        `${formatMoney(balance.amount, currency)} left`);
      balanceNode.classList.add('limit-window-wide', 'limit-window-no-reset');
      windows.append(balanceNode);

      const parts = [];
      if (Number.isFinite(Number(balance.todaySpend))) parts.push(`Today ${formatMoney(balance.todaySpend, currency)}`);
      if (Number.isFinite(Number(balance.monthSpend))) {
        parts.push(`Month ${formatMoney(balance.monthSpend, currency)}`);
      }
      if (parts.length) {
        const spendNode = limitWindowNode('Spend', { showMeter: false }, color, 0.6, parts.join(' · '));
        spendNode.classList.add('limit-window-wide', 'limit-window-note');
        windows.append(spendNode);
      }
    }
  } else if (provider.provider === 'mimo') {
    windows.classList.add('limit-windows-mimo');
    const balance = provider.balance || null;
    const tokenPlan = windowForKind(provider, 'billing') || mimoTokenPlanWindowFromBalance(balance);
    if (tokenPlan) {
      const node = limitWindowNode(tokenPlan.label || 'Token Plan', tokenPlan, color, 0.68);
      node.classList.add('limit-window-wide');
      windows.append(node);
    } else if (balance?.planStatus === 'expired') {
      const node = limitWindowNode('Token Plan', { showMeter: false }, color, 0.68, t('limits.mimo.planExpired'));
      node.classList.add('limit-window-wide', 'limit-window-no-reset');
      windows.append(node);
    }
    const amount = optionalFiniteNumber(balance?.amount);
    const giftBalance = optionalFiniteNumber(balance?.giftBalance);
    const cashBalance = optionalFiniteNumber(balance?.cashBalance);
    if (amount !== null || giftBalance !== null || cashBalance !== null) {
      const detailParts = [];
      if (giftBalance !== null) detailParts.push(`Gift ${formatMoney(giftBalance, balance.currency)}`);
      if (cashBalance !== null) detailParts.push(`Cash ${formatMoney(cashBalance, balance.currency)}`);
      const balanceText = formatMoney(amount, balance.currency) || '—';
      const balanceNode = limitWindowNode(
        'Balance',
        { showMeter: false },
        color,
        0.68,
        balanceText,
        detailParts.join(' · ')
      );
      balanceNode.classList.add('limit-window-wide', 'limit-window-no-reset');
      windows.append(balanceNode);
    }
  } else if (provider.provider === 'grok') {
    // Grok exposes a single Monthly billing window (no session/weekly). Render it
    // full-width so it doesn't share a row with an empty placeholder. This mirrors
    // how Cursor's billing cycle and OpenCode's Monthly are handled.
    windows.classList.add('limit-windows-grok');
    const monthly = windowForKind(provider, 'billing');
    if (monthly) {
      const node = limitWindowNode(monthly.label || 'Monthly', monthly, color, 0.68);
      node.classList.add('limit-window-wide');
      windows.append(node);
    }
  } else if (provider.provider === 'copilot') {
    windows.classList.add('limit-windows-copilot');
    const billingWindows = windowsForKind(provider, 'billing');
    for (const billing of billingWindows) {
      const node = limitWindowNode(billing?.label || 'Monthly', billing, color, 0.68);
      node.classList.add('limit-window-wide');
      windows.append(node);
    }
  } else if (provider.provider === 'zai' || provider.provider === 'zaiteam') {
    const fiveHour = windowForKind(provider, 'session');
    const weekly = windowForKind(provider, 'weekly');
    const mcp = windowForKind(provider, 'billing');
    if (fiveHour) {
      const fiveHourNode = limitWindowNode('5-hour', fiveHour, color, 0.95);
      if (!weekly) fiveHourNode.classList.add('limit-window-wide');
      windows.append(fiveHourNode);
    }
    if (weekly) windows.append(limitWindowNode('Weekly', weekly, color, 0.68));
    if (mcp) {
      const mcpNode = limitWindowNode('MCP', mcp, color, 0.68);
      mcpNode.classList.add('limit-window-wide');
      windows.append(mcpNode);
    }
  } else if (provider.provider === 'volcengine') {
    const session = windowForKind(provider, 'session');
    const weekly = windowForKind(provider, 'weekly');
    const monthly = windowForKind(provider, 'billing');
    if (session) {
      const sessionNode = limitWindowNode(session.label || '5-hour', session, color, 0.95);
      if (!weekly && !monthly && session.label) sessionNode.classList.add('limit-window-wide');
      windows.append(sessionNode);
    }
    if (weekly) windows.append(limitWindowNode('Weekly', weekly, color, 0.68));
    if (monthly) {
      const monthlyNode = limitWindowNode('Monthly', monthly, color, 0.68);
      monthlyNode.classList.add('limit-window-wide');
      windows.append(monthlyNode);
    }
  } else if (provider.provider === 'kiro') {
    // Kiro exposes monthly credits (plus an optional bonus pool), both billing
    // windows. Render them full-width like Copilot's quota windows.
    windows.classList.add('limit-windows-kiro');
    const billingWindows = windowsForKind(provider, 'billing');
    for (const billing of billingWindows) {
      if (billing?.showMeter === false) {
        // Overage: a single compact line like Cursor's "Credits $0.00" (no bar,
        // no reset) with the credits used and estimated cost joined on the right.
        const node = limitWindowNode(billing.label || 'Overage', billing, color, 0.6, formatKiroOverageValue(billing));
        node.classList.add('limit-window-wide', 'limit-window-no-reset');
        windows.append(node);
      } else {
        const node = limitWindowNode(
          billing?.label || 'Credits',
          billing,
          color,
          0.68,
          null,
          formatLimitCount(billing, Boolean(state.settings?.showLimitUsed))
        );
        node.classList.add('limit-window-wide');
        windows.append(node);
      }
    }
  } else if (provider.provider === 'qoder') {
    windows.classList.add('limit-windows-qoder');
    const credits = windowForKind(provider, 'billing');
    if (credits) {
      const node = limitWindowNode(
        credits?.label || 'Credits',
        credits,
        color,
        0.68,
        null,
        formatLimitCount(credits, Boolean(state.settings?.showLimitUsed))
      );
      node.classList.add('limit-window-wide');
      windows.append(node);
    }
  } else if (provider.provider === 'kimi') {
    const fiveHour = windowForKind(provider, 'session');
    const weekly = windowForKind(provider, 'weekly');
    const monthly = windowForKind(provider, 'billing');
    if (fiveHour) {
      const node = limitWindowNode(fiveHour.label || '5-hour', fiveHour, color, 0.95);
      if (!weekly) node.classList.add('limit-window-wide');
      windows.append(node);
    }
    if (weekly) {
      const node = limitWindowNode(weekly.label || 'Weekly', weekly, color, 0.68);
      if (!fiveHour) node.classList.add('limit-window-wide');
      windows.append(node);
    }
    if (monthly) {
      const node = limitWindowNode(
        monthly.label || 'Monthly',
        monthly,
        color,
        0.5,
        null,
        monthly.detail || ''
      );
      node.classList.add('limit-window-wide');
      windows.append(node);
    }
  } else if (provider.provider === 'ollama') {
    const session = windowForKind(provider, 'session');
    const weekly = windowForKind(provider, 'weekly');
    if (session) {
      const node = limitWindowNode('Session', session, color, 0.95);
      if (!weekly) node.classList.add('limit-window-wide');
      windows.append(node);
    }
    if (weekly) windows.append(limitWindowNode('Weekly', weekly, color, 0.68));
  } else if (provider.provider === 'claude') {
    // Claude usually shows session + one all-models weekly, but can carry a second
    // model-scoped weekly (the temporary "Fable only" promo cap). Render every
    // weekly the response actually has, and nothing when a bucket is absent — no
    // empty placeholder — so the scoped bar appears only while the promo is live.
    const session = windowForKind(provider, 'session');
    if (session) windows.append(limitWindowNode(session.label || 'Session', session, color, 0.95));
    for (const weekly of windowsForKind(provider, 'weekly')) {
      const node = limitWindowNode(weekly.label || 'Weekly', weekly, color, 0.68);
      // The all-models weekly pairs with Session in the two-column grid; a
      // model-scoped weekly (the "Fable only" promo cap) has no partner, so span
      // the full row instead of leaving a half-empty cell.
      if (weekly.label) node.classList.add('limit-window-wide');
      windows.append(node);
    }
  } else {
    // Default: render only the windows the provider actually has. Providers
    // that only expose a single window shouldn't leave a half-empty bar next to
    // the real one. (Grok is handled above; this branch covers minimax's
    // session + weekly pair and any future session/weekly provider.)
    const session = windowForKind(provider, 'session');
    const weekly = windowForKind(provider, 'weekly');
    if (session) windows.append(limitWindowNode(session.label || 'Session', session, color, 0.95));
    if (weekly) windows.append(limitWindowNode(weekly.label || 'Weekly', weekly, color, 0.68));
  }
  return windows;
}

function renderLimitProviderRow(id, label, provider, color, options = {}) {
  const row = document.createElement('div');
  const classes = ['limit-row'];
  if (options.accountRow) classes.push('limit-account-row');
  if (provider.stale) classes.push('stale');
  row.className = classes.join(' ');
  row.append(
    renderLimitProviderHead(id, label, provider, color, options),
    renderProviderWindows(provider, color)
  );
  return row;
}

function maskEmailAddress(value) {
  const raw = String(value || '').trim();
  const separator = raw.indexOf('@');
  if (separator <= 0) return raw;
  const local = raw.slice(0, separator);
  const domain = raw.slice(separator + 1);
  if (local.length <= 2) return `${local[0] || ''}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

function codexAccountTitle(provider, index) {
  const accountLabel = String(provider?.accountLabel || provider?.accountName || '').trim();
  if (accountLabel) return accountLabel;
  const email = String(provider?.accountEmail || '').trim();
  if (email) return state.settings?.maskLimitAccountEmails ? maskEmailAddress(email) : email;
  return `Account ${index + 1}`;
}

function renderCodexAccountGroup(label, providers, color) {
  const row = document.createElement('div');
  row.className = `limit-row limit-row-group${providers.some((provider) => provider.stale) ? ' stale' : ''}`;
  const groupProvider = { provider: 'codex', status: 'ok', windows: [] };
  const head = renderLimitProviderHead('codex', label, groupProvider, color, {
    planText: `${providers.length} accounts`,
    hideMeta: true
  });
  const accountList = document.createElement('div');
  accountList.className = 'limit-account-list';
  providers.forEach((provider, index) => {
    accountList.append(renderLimitProviderRow('codex', codexAccountTitle(provider, index, providers), provider, color, {
      accountRow: true,
      accountTitle: true,
      showIcon: false
    }));
  });
  row.append(head, accountList);
  return row;
}

function mimoAccountTitle(provider, index) {
  const email = String(provider?.accountEmail || '').trim();
  if (email) return state.settings?.maskLimitAccountEmails ? maskEmailAddress(email) : email;
  return `Account ${index + 1}`;
}

function renderMimoAccountGroup(label, providers, color) {
  const row = document.createElement('div');
  row.className = `limit-row limit-row-group${providers.some((provider) => provider.stale) ? ' stale' : ''}`;
  const groupProvider = { provider: 'mimo', status: 'ok', windows: [] };
  const head = renderLimitProviderHead('mimo', label, groupProvider, color, {
    planText: `${providers.length} accounts`,
    hideMeta: true
  });
  const accountList = document.createElement('div');
  accountList.className = 'limit-account-list';
  providers.forEach((provider, index) => {
    accountList.append(renderLimitProviderRow('mimo', mimoAccountTitle(provider, index), provider, color, {
      accountRow: true,
      accountTitle: true,
      showIcon: false
    }));
  });
  row.append(head, accountList);
  return row;
}

function opencodeAccountTitle(provider, index) {
  const name = String(provider?.accountName || '').trim();
  if (name) return name;
  // Older synced clients put the user-defined profile name in accountLabel.
  // Keep those rows identifiable while new clients carry profile and plan in
  // separate fields. Go/Zen are plan labels, never account identities.
  const legacyName = String(provider?.accountLabel || '').trim();
  return legacyName && legacyName !== 'Go' && legacyName !== 'Zen'
    ? legacyName
    : `Account ${index + 1}`;
}

function renderOpenCodeAccountGroup(label, providers, color) {
  const row = document.createElement('div');
  row.className = 'limit-row limit-row-group';
  const groupProvider = { provider: 'opencode', status: 'ok', windows: [] };
  const head = renderLimitProviderHead('opencode', label, groupProvider, color, {
    planText: t('settings.opencode.nAccounts', { count: providers.length }),
    hideMeta: true
  });
  const accountList = document.createElement('div');
  accountList.className = 'limit-account-list';
  providers.forEach((provider, index) => {
    const legacyProfileLabel = !provider?.accountName
      && provider?.accountLabel
      && provider.accountLabel !== 'Go'
      && provider.accountLabel !== 'Zen';
    accountList.append(renderLimitProviderRow('opencode', opencodeAccountTitle(provider, index), provider, color, {
      accountRow: true,
      showIcon: false,
      ...(legacyProfileLabel ? { planText: '' } : {})
    }));
  });
  row.append(head, accountList);
  return row;
}

function openrouterAccountTitle(provider, index) {
  const accountName = String(provider?.accountName || provider?.accountLabel || '').trim();
  if (accountName.toLowerCase() === 'environment') return t('settings.openrouter.environment');
  return accountName || `Account ${index + 1}`;
}

function renderOpenRouterAccountGroup(label, providers, color) {
  const row = document.createElement('div');
  row.className = `limit-row limit-row-group${providers.some((provider) => provider.stale) ? ' stale' : ''}`;
  const groupProvider = { provider: 'openrouter', status: 'ok', windows: [] };
  const head = renderLimitProviderHead('openrouter', label, groupProvider, color, {
    planText: t('settings.openrouter.nAccounts', { count: providers.length }),
    hideMeta: true
  });
  const accountList = document.createElement('div');
  accountList.className = 'limit-account-list';
  providers.forEach((provider, index) => {
    accountList.append(renderLimitProviderRow('openrouter', openrouterAccountTitle(provider, index), provider, color, {
      accountRow: true,
      showIcon: false
    }));
  });
  row.append(head, accountList);
  return row;
}

function renderLimits() {
  if (!els.limitsPanel) return;
  const holdLimitDetailTooltipRender = limitDetailTooltipShouldHoldRender();
  if (holdLimitDetailTooltipRender) {
    state.limitDetailTooltipRenderPending = true;
    return;
  }
  state.limitDetailTooltipRenderPending = false;
  const limitsEnabled = state.settings?.limitsEnabled !== false;
  const enabled = enabledLimitProviderSet();
  const providers = providersByLimitProviderId(state.stats?.limits?.providers || []);
  const nodes = [];
  const rows = limitProviderOrderApi
    .orderedLimitProviders(LIMIT_PROVIDERS, state.settings?.limitProviderOrder)
    .filter(({ id }) => limitsEnabled && enabled.has(id));
  if (rows.length === 0) {
    els.limitsPanel.replaceChildren();
    return;
  }
  for (const { id, label } of rows) {
    const providerEnabled = limitsEnabled && enabled.has(id);
    const providerEntries = providerEnabled
      ? (providers.get(id) || [{ provider: id, status: state.stats ? missingLimitProviderStatus() : 'unavailable', windows: [] }])
      : [{ provider: id, status: 'disabled', windows: [] }];
    const visibleProviders = providerEntries.length > 0
      ? providerEntries
      : { provider: id, status: 'disabled', windows: [] };
    const color = id === 'mimo' ? clientColors.xiaomi : (clientColors[id] || clientColors.default);
    if (id === 'codex' && Array.isArray(visibleProviders) && visibleProviders.length > 1) {
      nodes.push(renderCodexAccountGroup(label, visibleProviders, color));
      continue;
    }
    if (id === 'opencode' && Array.isArray(visibleProviders) && visibleProviders.length > 1) {
      nodes.push(renderOpenCodeAccountGroup(label, visibleProviders, color));
      continue;
    }
    if (id === 'openrouter' && Array.isArray(visibleProviders) && visibleProviders.length > 1) {
      nodes.push(renderOpenRouterAccountGroup(label, visibleProviders, color));
      continue;
    }
    if (id === 'mimo' && Array.isArray(visibleProviders) && visibleProviders.length > 1) {
      nodes.push(renderMimoAccountGroup(label, visibleProviders, color));
      continue;
    }
    const provider = Array.isArray(visibleProviders) ? visibleProviders[0] : visibleProviders;
    nodes.push(renderLimitProviderRow(id, label, provider, color));
  }
  els.limitsPanel.replaceChildren(...nodes);
}

function serviceStatusLabel(status) {
  if (status === 'ok') return t('serviceStatus.ok');
  if (status === 'degraded') return t('serviceStatus.degraded');
  if (status === 'outage') return t('serviceStatus.outage');
  return t('serviceStatus.unknown');
}

function serviceStatusMeta(provider) {
  // Show a short affected-component *count* rather than the names: the names are
  // the variable-length part that overflowed the line, while the count keeps the
  // real scope visible — an incident title (line 2) often understates it, e.g.
  // "errors on Haiku" while claude.ai/API/Code are all degraded. Full names stay
  // in the row tooltip (set in renderServiceStatus).
  const parts = [];
  const affectedCount = serviceStatusPresentationApi.affectedComponentNames(provider.componentIssues).all.length;
  if (affectedCount > 0) parts.push(t('serviceStatus.components', { count: affectedCount }));
  if (Number(provider.incidentCount || 0) > 0) parts.push(t('serviceStatus.incidents', { count: provider.incidentCount }));
  if (Number(provider.maintenanceCount || 0) > 0) parts.push(t('serviceStatus.maintenance', { count: provider.maintenanceCount }));
  if (parts.length) return parts.join(' · ');
  // "No ongoing issues" only reads true for a healthy provider — a degraded one
  // with nothing to count shows just its timestamp rather than a contradiction.
  return provider.status === 'ok' ? t('serviceStatus.noIssues') : '';
}

function visibleServiceProviderIds() {
  return serviceStatusProviderPreferencesApi.visibleOrder(
    SERVICE_PROVIDER_OPTIONS,
    state.settings?.serviceProviderDisplayOrder,
    state.settings?.hiddenServiceProviders
  );
}

function serviceStatusRows() {
  const order = visibleServiceProviderIds();
  const rank = new Map(order.map((id, index) => [id, index]));
  const base = (state.serviceStatus?.providers?.length)
    ? state.serviceStatus.providers
    : SERVICE_STATUS_PLACEHOLDERS.map((provider) => ({
        ...provider,
        status: 'unknown',
        description: state.serviceStatusBusy ? t('serviceStatus.loading') : t('serviceStatus.notChecked'),
        checkedAt: '',
        updatedAt: '',
        componentIssues: [],
        incidentCount: 0,
        maintenanceCount: 0
      }));
  return base
    .filter((provider) => rank.has(provider.id))
    .sort((a, b) => rank.get(a.id) - rank.get(b.id));
}

function serviceStatusIconId(id) {
  return id === 'openai' ? 'codex' : id; // claude/cursor/deepseek map 1:1
}

function renderServiceStatus() {
  if (!els.serviceStatusPanel) return;
  const rows = serviceStatusRows().map((provider) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `service-status-row service-status-${provider.status || 'unknown'}`;
    row.dataset.provider = provider.id;
    row.title = t('serviceStatus.openPage', { name: provider.label });
    row.addEventListener('click', () => window.tokenMonitor.openExternal?.(provider.pageUrl));
    const head = document.createElement('div');
    head.className = 'service-status-head';
    const title = document.createElement('div');
    title.className = 'service-status-title';
    if (state.settings?.showToolIcons) {
      const icon = document.createElement('span');
      icon.className = `service-status-icon row-icon row-icon-${serviceStatusIconId(provider.id)}`;
      title.append(icon);
    }
    const name = document.createElement('strong');
    name.textContent = provider.label;
    title.append(name);
    const pill = document.createElement('span');
    pill.className = 'service-status-pill';
    pill.textContent = serviceStatusLabel(provider.status);
    head.append(title, pill);
    const description = document.createElement('div');
    description.className = 'service-status-description';
    description.textContent = serviceStatusPresentationApi.statusHeadline(provider) || t('serviceStatus.unknown');
    const meta = document.createElement('div');
    meta.className = 'service-status-meta';
    const metaInfo = serviceStatusMeta(provider);
    meta.textContent = metaInfo;
    if (provider.checkedAt) {
      if (metaInfo) meta.append(document.createTextNode(' · '));
      const checkedSpan = document.createElement('span');
      checkedSpan.className = 'service-status-checked';
      checkedSpan.dataset.checkedAt = provider.checkedAt;
      checkedSpan.textContent = formatAgo(Date.now() - Date.parse(provider.checkedAt));
      meta.append(checkedSpan);
    }
    const affected = serviceStatusPresentationApi.affectedComponentNames(provider.componentIssues).all;
    if (affected.length) meta.title = affected.join(t('serviceStatus.listSeparator'));
    row.append(head, description, meta);
    return row;
  });
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'service-status-empty';
    empty.textContent = t('serviceStatus.allHidden');
    els.serviceStatusPanel.replaceChildren(empty);
    return;
  }
  els.serviceStatusPanel.replaceChildren(...rows);
}

async function refreshServiceStatus(options = {}) {
  if (!window.tokenMonitor.getServiceStatus || state.serviceStatusBusy) return;
  state.serviceStatusBusy = true;
  renderServiceStatus();
  try {
    state.serviceStatus = await window.tokenMonitor.getServiceStatus({ force: options.force === true, providerIds: visibleServiceProviderIds() });
  } catch (error) {
    const checkedAt = new Date().toISOString();
    state.serviceStatus = {
      checkedAt,
      providers: SERVICE_STATUS_PLACEHOLDERS.map((provider) => ({
        ...provider,
        status: 'unknown',
        indicator: 'unknown',
        description: t('serviceStatus.checkFailed'),
        checkedAt,
        updatedAt: '',
        componentIssues: [],
        incidentCount: 0,
        maintenanceCount: 0,
        error: error.message
      }))
    };
  } finally {
    state.serviceStatusBusy = false;
    renderServiceStatus();
  }
}

function formatAgo(ms) {
  const { unit, value } = serviceStatusPresentationApi.agoBucket(ms);
  const key = `serviceStatus.ago${unit.charAt(0).toUpperCase()}${unit.slice(1)}`;
  return t(key, { n: value });
}

function serviceStatusRefreshMs() {
  const value = Number(state.settings?.serviceStatusRefreshMs);
  return value > 0 ? value : Infinity; // 0 = Manual
}

function lastServiceStatusCheckedAt() {
  return Date.parse(state.serviceStatus?.checkedAt || '') || 0;
}

function maybeFetchServiceStatus() {
  if (state.serviceStatusBusy) return;
  if (visibleServiceProviderIds().length === 0) return;
  if (!state.serviceStatus) { refreshServiceStatus().catch(() => {}); return; }
  const intervalMs = serviceStatusRefreshMs();
  if (Number.isFinite(intervalMs) && Date.now() - lastServiceStatusCheckedAt() >= intervalMs) {
    refreshServiceStatus().catch(() => {});
  }
}

function updateServiceStatusAgoLabels() {
  const spans = els.serviceStatusPanel?.querySelectorAll('.service-status-checked') || [];
  for (const span of spans) {
    const checkedAt = Date.parse(span.dataset.checkedAt || '');
    if (Number.isFinite(checkedAt)) span.textContent = formatAgo(Date.now() - checkedAt);
  }
}

function onServiceStatusTick() {
  if (state.breakdown !== 'status') { stopServiceStatusTicker(); return; }
  updateServiceStatusAgoLabels();
  maybeFetchServiceStatus();
}

function ensureServiceStatusTicker() {
  if (state.serviceStatusTicker) return;
  state.serviceStatusTicker = setInterval(onServiceStatusTick, 1000);
  onServiceStatusTick();
}

function stopServiceStatusTicker() {
  if (!state.serviceStatusTicker) return;
  clearInterval(state.serviceStatusTicker);
  state.serviceStatusTicker = null;
}

async function openSessionDetail({ client, sessionId, sessionCost, title }) {
  state.openSession = { client, sessionId, sessionCost, title, detail: null };
  renderSessionDetail({ loading: true });
  try {
    const detail = await window.tokenMonitor.getSessionDetail({ client, sessionId, period: state.period, sessionCost });
    if (state.openSession && state.openSession.sessionId === sessionId) {
      state.openSession.detail = detail;
      renderSessionDetail({ detail });
    }
  } catch (_) {
    if (state.openSession && state.openSession.sessionId === sessionId) renderSessionDetail({ error: true });
  }
}

function toggleDetailSort() {
  state.detailSort = state.detailSort === 'tokens' ? 'time' : 'tokens';
  if (state.openSession && state.openSession.detail) renderSessionDetail({ detail: state.openSession.detail });
}

function closeSessionDetail() {
  state.openSession = null;
  els.sessionDetail.classList.add('hidden');
  els.sessionDetail.replaceChildren();
  els.sessionDetailHead.classList.add('hidden');
  els.sessionDetailHead.replaceChildren();
  render();
}

function renderSessionDetail({ detail, loading, error } = {}) {
  els.breakdown.classList.add('hidden');
  els.sessionDetail.classList.remove('hidden');
  els.sessionDetailHead.classList.remove('hidden');
  const head = els.sessionDetailHead;       // static layer — rows scroll independently below it
  const container = els.sessionDetail;
  head.replaceChildren();
  container.replaceChildren();

  const back = document.createElement('button');
  back.className = 'detail-back';
  back.textContent = `‹ ${t('sessions') || 'Sessions'}`;
  back.addEventListener('click', closeSessionDetail);
  head.append(back);

  if (loading) { container.append(detailNote(t('detailLoading') || 'Loading…')); return; }
  if (error || (detail && detail.found === false)) { container.append(detailNote(t('detailNotFound') || 'Transcript not found on this machine.')); return; }

  const rows = sessionDetailApi.exchangeRows(detail, { now: new Date(), sortBy: state.detailSort });
  if (rows.length === 0) { container.append(detailNote(t('detailEmpty') || 'No activity in this period.')); return; }

  const sort = document.createElement('button');
  sort.className = 'detail-sort';
  sort.textContent = state.detailSort === 'tokens' ? (t('sortMostTokens') || '↕ Most tokens') : (t('sortNewest') || '↕ Newest');
  sort.addEventListener('click', toggleDetailSort);
  head.append(sort);

  const max = Math.max(1, ...rows.map((row) => row.value));
  for (const row of rows) container.append(exchangeNode(row, max));
}

function detailNote(text) {
  const note = document.createElement('div');
  note.className = 'detail-note';
  note.textContent = text;
  return note;
}

function exchangeNode(row, max) {
  const wrap = document.createElement('div');
  wrap.className = 'detail-exchange';
  wrap.innerHTML = '<div class="detail-ex-head"><span class="detail-chev">▸</span>'
    + '<div class="detail-ex-label"><span class="detail-ex-title"></span><span class="detail-ex-sub"></span></div>'
    + '<div class="detail-ex-metrics"><span class="detail-ex-value"></span><span class="detail-ex-cost"></span></div></div>'
    + '<div class="bar"><div class="bar-fill"></div></div>'
    + '<div class="detail-turns hidden"></div>';
  const exTitle = wrap.querySelector('.detail-ex-title');
  if (row.isPrompt) {
    const role = document.createElement('span');
    role.className = 'detail-role-user';
    role.textContent = t('roleYou') || 'You';
    const sep = document.createElement('span');
    sep.className = 'detail-role-sep';
    sep.textContent = ' › ';
    exTitle.append(role, sep);
  }
  exTitle.append(document.createTextNode(row.title));
  wrap.querySelector('.detail-ex-sub').textContent = row.subtitle;
  wrap.querySelector('.detail-ex-value').textContent = formatNumber(row.value);
  wrap.querySelector('.detail-ex-cost').textContent = formatCost(row.cost);
  applyBarScale(wrap.querySelector('.bar-fill'), rowWidth(row.value, max) / 100);

  const turnsEl = wrap.querySelector('.detail-turns');
  for (const turn of row.turns) turnsEl.append(turnNode(turn));

  const head = wrap.querySelector('.detail-ex-head');
  head.addEventListener('click', () => {
    const collapsed = turnsEl.classList.toggle('hidden');
    wrap.querySelector('.detail-chev').textContent = collapsed ? '▸' : '▾';
  });
  return wrap;
}

function turnNode(turn) {
  const el = document.createElement('div');
  el.className = 'detail-turn';
  const tk = turn.tokens || {};
  // "cache" folds cache reads + cache writes (Claude's cache_creation) into one bucket so the
  // in/out/cache breakdown sums to the turn total; reason is an informational subset of out.
  const cache = (tk.cacheRead || 0) + (tk.cacheWrite || 0);
  const split = `in ${formatNumber(tk.input || 0)} · out ${formatNumber(tk.output || 0)} · cache ${formatNumber(cache)}`
    + (tk.reasoning ? ` · reason ${formatNumber(tk.reasoning)}` : '');
  el.innerHTML = '<div class="detail-turn-label"><span class="detail-turn-title"></span><span class="detail-turn-split"></span><span class="detail-turn-tools"></span></div>'
    + '<div class="detail-turn-metrics"><span class="detail-turn-value"></span><span class="detail-turn-cost"></span></div>';
  el.querySelector('.detail-turn-title').textContent = `AI ${turn.label}`;
  el.querySelector('.detail-turn-split').textContent = split;
  el.querySelector('.detail-turn-tools').textContent = turn.tools ? `⊢ ${turn.tools}` : '';
  el.querySelector('.detail-turn-value').textContent = formatNumber(turn.value);
  el.querySelector('.detail-turn-cost').textContent = formatCost(turn.cost);
  return el;
}

let contentReadySignaled = false;

function renderTrends() {
  const charts = window.TokenMonitorUsageCharts;
  const previousBars = captureTrendBarMotion();
  const preview = state.stats?.historyPreview || { daily: [], monthly: [], summary: {} };
  const todayTotal = Number(state.stats?.periods?.today?.totalTokens || 0);
  const { points, metric, labelKey } = charts.selectPreviewSeries(preview, state.period);
  const finalPoints = state.period === 'today' ? charts.patchTodayBar(points, todayTotal) : points;

  if (finalPoints.length === 0) {
    els.trendsPanel.innerHTML = `<div class="trends-empty">${t('trends.empty')}</div>`;
    return;
  }

  const model = charts.sparklinePreview(finalPoints, { width: 300, height: 120, gap: 0.3, metric });
  const titles = finalPoints.map((p) => `${trendShortLabel(p[labelKey], labelKey)} · ${formatCompact(p[metric])}`);
  const svg = charts.sparklineSvg(model, { titles });

  const summary = preview.summary || {};
  const rangeLabel = state.period === 'allTime' ? t('trends.range.year')
    : state.period === 'month' ? t('trends.range.month') : t('trends.range.week');
  const first = trendShortLabel(finalPoints[0][labelKey], labelKey);
  const last = trendShortLabel(finalPoints[finalPoints.length - 1][labelKey], labelKey);
  const stats = [
    [t('trends.activeDays'), formatNumber(summary.activeDays)],
    [t('trends.currentStreak'), formatNumber(summary.currentStreak)],
    [t('trends.activeTime'), formatActiveDuration(summary.activeTimeMs)],
    [t('trends.peakDay'), formatCompact(summary.peakDayTokens)]
  ];
  const statsHtml = stats
    .map(([k, v]) => `<div class="trends-stat"><span class="trends-stat-v">${v}</span><span class="trends-stat-k">${k}</span></div>`)
    .join('');

  els.trendsPanel.innerHTML =
    `<div class="trends-cap"><span>${rangeLabel}</span><span class="trends-open-hint" title="${t('trends.open')}">↗</span></div>`
    + `<div class="trends-spark" role="button" tabindex="0" title="${t('trends.open')}">${svg}</div>`
    + `<div class="trends-axis"><span>${first}</span><span>${last}</span></div>`
    + `<div class="trends-stats">${statsHtml}</div>`;
  const bars = Array.from(els.trendsPanel.querySelectorAll('.spark-bar'));
  bars.forEach((bar, index) => {
    bar.dataset.motionKey = String(finalPoints[index]?.[labelKey] || index);
  });
  const fromZero = state.animateChartsOnRender;
  animateTrendBarsFrom(previousBars, { fromZero });
  if (fromZero) state.animateChartsOnRender = false;
}

function viewLabelById(id) {
  const view = VIEW_DISPLAY_OPTIONS.find((option) => option.id === id);
  return view ? viewLabel(view) : id;
}

function openHomeSettings() {
  if (!els.settingsPanel) return;
  els.settingsPanel.classList.remove('hidden');
  els.shell.classList.add('settings-open');
  els.shell.style.transform = 'translateZ(0)';
  setSettingsSectionExpanded('main', true);
  state.homeSettingsExpanded = true;
  syncSettingsForm();
  requestAnimationFrame(() => {
    document.getElementById('homeSettingsContainer')?.scrollIntoView({ block: 'nearest' });
  });
}

function openTrendSettings() {
  if (!els.settingsPanel) return;
  els.settingsPanel.classList.remove('hidden');
  els.shell.classList.add('settings-open');
  els.shell.style.transform = 'translateZ(0)';
  setSettingsSectionExpanded('main', true);
  state.trendSettingsExpanded = true;
  syncSettingsForm();
  requestAnimationFrame(() => {
    document.getElementById('trendSettingsContainer')?.scrollIntoView({ block: 'nearest' });
  });
}

function openSettingsPanel() {
  if (!els.settingsPanel) return;
  if (state.viewSwitcherOpen) setViewSwitcherOpen(false);
  els.settingsPanel.classList.remove('hidden');
  els.shell.classList.add('settings-open');
  els.shell.style.transform = 'translateZ(0)';
  requestAnimationFrame(() => { els.shell.style.transform = ''; });
}

function openViewFromTray(viewId) {
  if (!availableBreakdownIds().includes(viewId)) return;
  if (state.viewSwitcherOpen) setViewSwitcherOpen(false);
  stopWindowShortcutRecording();
  els.settingsPanel?.classList.add('hidden');
  els.shell.classList.remove('settings-open');
  state.openSession = null;
  renderBreakdownChange(viewId, { allowHidden: true });
}

const HOME_HISTORY_MAX_RETRIES = 3;
const HOME_HISTORY_RETRY_MS = 4000;

async function loadHomeHistory() {
  if (state.homeHistoryBusy || !window.tokenMonitor.getDashboardHistory) return;
  if (!homeOverviewApi.shouldFetchHomeHistory({
    requested: state.homeHistoryRequested,
    stats: state.stats,
    lastSignature: state.homeHistorySignature
  })) return;
  // The signature is recorded before the await on purpose: it stops a failed or empty
  // fetch from re-firing on the very next render (renderHome runs loadHomeHistory every
  // render), which is the #39 spin loop. A transient failure or a raced empty result is
  // recovered by the bounded timer-driven retry in the finally block instead, not by
  // render — so Home is not stranded on the 30-day preview until the history genuinely
  // changes, which for an account with history but no current activity might be never.
  const requestSignature = homeOverviewApi.homeHistorySignature(state.stats);
  const previewHadDays = homeOverviewApi.historyHasDays(state.stats?.historyPreview);
  if (state.homeHistoryRetrySignature !== requestSignature) {
    clearTimeout(state.homeHistoryRetryTimer);
    state.homeHistoryRetryTimer = null;
    state.homeHistoryRetrySignature = requestSignature;
    state.homeHistoryRetries = 0;
  }
  state.homeHistoryRequested = true;
  state.homeHistorySignature = requestSignature;
  state.homeHistoryBusy = true;
  let resolved = false;
  let fetchedHistory = null;
  try {
    // Only ever one fetch in flight (homeHistoryBusy), so the response is the freshest
    // history at invoke time and can be taken as-is — no older reply can land on top of
    // a newer one.
    fetchedHistory = await window.tokenMonitor.getDashboardHistory();
    resolved = true;
  } catch (error) {
    console.log(`[home] history failed: ${error.message}`);
  } finally {
    state.homeHistoryBusy = false;
    const outcome = homeOverviewApi.homeHistoryFetchOutcome({
      resolved,
      history: fetchedHistory,
      previewHasDays: previewHadDays
    });
    if (outcome.accepted) {
      state.homeHistory = fetchedHistory;
      state.homeHistoryLoadedSignature = requestSignature;
      state.homeHistoryRetries = 0;
      state.homeHistoryRetrySignature = '';
      clearTimeout(state.homeHistoryRetryTimer);
      state.homeHistoryRetryTimer = null;
    } else if (homeOverviewApi.shouldRetryHomeHistory({
      loadedDays: outcome.loadedDays,
      previewHasDays: previewHadDays,
      retries: state.homeHistoryRetries,
      maxRetries: HOME_HISTORY_MAX_RETRIES
    })) {
      state.homeHistoryRetries += 1;
      clearTimeout(state.homeHistoryRetryTimer);
      state.homeHistoryRetryTimer = setTimeout(() => {
        state.homeHistoryRetryTimer = null;
        // Stale display data is not proof that this signature loaded. Retry only
        // while the target is still current and no later request accepted it.
        if (state.homeHistoryLoadedSignature === requestSignature) return;
        if (homeOverviewApi.homeHistorySignature(state.stats) !== requestSignature) return;
        state.homeHistorySignature = '';
        void loadHomeHistory();
      }, HOME_HISTORY_RETRY_MS);
    }
    if (state.breakdown === 'home') render();
  }
}

function homeModuleIds() {
  const hidden = hiddenHomeModuleSet();
  return homeModulePreferencesApi
    .orderedHomeModules(HOME_MODULE_OPTIONS, state.settings?.homeModuleOrder)
    .map((module) => module.id)
    .filter((id) => !hidden.has(id));
}

function nextBreakdown(value) {
  const order = visibleBreakdownOrder();
  if (order.length === 0) return 'home';
  const index = order.indexOf(value);
  return order[(index + 1) % order.length] || order[0];
}

function viewSwitcherIcon(id) {
  const icon = document.createElement('span');
  icon.className = `view-switcher-icon ${VIEW_ICON_CLASSES[id] || 'view-icon-home'}`;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

function clearViewSwitcherLongPress() {
  if (viewSwitcherLongPressTimer) clearTimeout(viewSwitcherLongPressTimer);
  viewSwitcherLongPressTimer = null;
}

function clearViewSwitcherHoverClose() {
  if (viewSwitcherHoverCloseTimer) clearTimeout(viewSwitcherHoverCloseTimer);
  viewSwitcherHoverCloseTimer = null;
}

function scheduleViewSwitcherHoverClose() {
  clearViewSwitcherHoverClose();
  viewSwitcherHoverCloseTimer = setTimeout(() => {
    viewSwitcherHoverCloseTimer = null;
    if (state.viewSwitcherOpen) setViewSwitcherOpen(false);
  }, VIEW_SWITCHER_HOVER_CLOSE_MS);
}

function updateViewSwitcherOpenState({ focusMenu = false, focusDisclosure = false } = {}) {
  if (!els.viewSwitcher) return false;
  const menu = els.viewSwitcher.querySelector('#viewSwitcherMenu');
  const disclosure = els.viewSwitcher.querySelector('.view-switcher-disclosure');
  if (!menu || !disclosure) return false;

  els.viewSwitcher.classList.toggle('is-open', state.viewSwitcherOpen);
  els.viewSwitcher.classList.toggle('has-opened', state.viewSwitcherHasOpened);
  disclosure.setAttribute('aria-expanded', String(state.viewSwitcherOpen));
  menu.classList.toggle('hidden', !state.viewSwitcherOpen);
  menu.setAttribute('aria-hidden', String(!state.viewSwitcherOpen));
  for (const item of menu.querySelectorAll('.view-switcher-menu-item')) {
    item.tabIndex = state.viewSwitcherOpen && item.classList.contains('is-current') ? 0 : -1;
  }
  if (focusMenu) requestAnimationFrame(() => menu.querySelector('.is-current')?.focus());
  if (focusDisclosure) requestAnimationFrame(() => disclosure.focus());
  return true;
}

function setViewSwitcherOpen(open, { focusMenu = false, focusDisclosure = false } = {}) {
  const nextOpen = Boolean(open);
  if (state.viewSwitcherOpen === nextOpen && !focusMenu && !focusDisclosure) return;
  if (nextOpen) state.viewSwitcherHasOpened = true;
  state.viewSwitcherOpen = nextOpen;
  if (updateViewSwitcherOpenState({ focusMenu, focusDisclosure })) return;
  renderViewSwitcher({ focusMenu, focusDisclosure });
}

function renderViewSwitcher({ focusMenu = false, focusDisclosure = false } = {}) {
  if (!els.viewSwitcher) return;
  const order = visibleBreakdownOrder();
  const currentId = order.includes(state.breakdown) ? state.breakdown : (order[0] || 'home');
  const currentLabel = viewLabelById(currentId);
  const nextId = nextBreakdown(currentId);
  const nextLabel = viewLabelById(nextId);

  const current = document.createElement('button');
  current.type = 'button';
  current.className = 'view-switcher-current';
  current.title = t('views.switcher.next', { view: nextLabel });
  current.setAttribute('aria-label', current.title);
  current.append(viewSwitcherIcon(currentId));
  const label = document.createElement('span');
  label.className = 'view-switcher-label';
  label.textContent = currentLabel;
  current.append(label);
  current.addEventListener('click', () => {
    if (viewSwitcherLongPressTriggered) {
      viewSwitcherLongPressTriggered = false;
      return;
    }
    state.viewSwitcherOpen = false;
    updateViewSwitcherOpenState();
    renderBreakdownChange(nextBreakdown(state.breakdown));
  });
  current.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    clearViewSwitcherLongPress();
    viewSwitcherLongPressTriggered = false;
    viewSwitcherLongPressTimer = setTimeout(() => {
      viewSwitcherLongPressTimer = null;
      viewSwitcherLongPressTriggered = true;
      setViewSwitcherOpen(true, { focusMenu: true });
    }, VIEW_SWITCHER_LONG_PRESS_MS);
  });
  current.addEventListener('pointerleave', clearViewSwitcherLongPress);
  current.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    clearViewSwitcherLongPress();
    setViewSwitcherOpen(true, { focusMenu: true });
  });

  const disclosure = document.createElement('button');
  disclosure.type = 'button';
  disclosure.className = 'view-switcher-disclosure';
  disclosure.title = t('views.switcher.choose');
  disclosure.setAttribute('aria-label', disclosure.title);
  disclosure.setAttribute('aria-haspopup', 'menu');
  disclosure.setAttribute('aria-controls', 'viewSwitcherMenu');
  disclosure.setAttribute('aria-expanded', String(state.viewSwitcherOpen));
  disclosure.addEventListener('pointerenter', (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    clearViewSwitcherHoverClose();
    if (!state.viewSwitcherOpen) setViewSwitcherOpen(true);
  });
  disclosure.addEventListener('click', (event) => {
    if (event.detail > 0 && state.viewSwitcherOpen) return;
    const open = !state.viewSwitcherOpen;
    setViewSwitcherOpen(open, { focusMenu: open });
  });

  const menu = document.createElement('div');
  menu.id = 'viewSwitcherMenu';
  menu.className = `view-switcher-menu${state.viewSwitcherOpen ? '' : ' hidden'}`;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', t('views.switcher.choose'));
  menu.setAttribute('aria-hidden', String(!state.viewSwitcherOpen));
  for (const id of order) {
    const item = document.createElement('button');
    const active = id === currentId;
    item.type = 'button';
    item.className = `view-switcher-menu-item${active ? ' is-current' : ''}`;
    item.dataset.view = id;
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', String(active));
    if (active) item.setAttribute('aria-current', 'page');
    item.tabIndex = state.viewSwitcherOpen ? (active ? 0 : -1) : -1;
    item.append(viewSwitcherIcon(id));
    const itemLabel = document.createElement('span');
    itemLabel.className = 'view-switcher-menu-label';
    itemLabel.textContent = viewLabelById(id);
    item.append(itemLabel);
    item.addEventListener('click', () => {
      state.viewSwitcherOpen = false;
      updateViewSwitcherOpenState();
      if (id === state.breakdown) renderViewSwitcher({ focusDisclosure: true });
      else renderBreakdownChange(id);
    });
    menu.append(item);
  }
  menu.addEventListener('keydown', (event) => {
    const items = Array.from(menu.querySelectorAll('.view-switcher-menu-item'));
    if (event.key === 'Escape') {
      event.preventDefault();
      setViewSwitcherOpen(false, { focusDisclosure: true });
      return;
    }
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight'
      ? 1
      : (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0);
    if (!direction && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const currentIndex = Math.max(0, items.indexOf(document.activeElement));
    const nextIndex = event.key === 'Home'
      ? 0
      : (event.key === 'End' ? items.length - 1 : (currentIndex + direction + items.length) % items.length);
    items[nextIndex]?.focus();
  });

  els.viewSwitcher.classList.toggle('is-open', state.viewSwitcherOpen);
  els.viewSwitcher.classList.toggle('has-opened', state.viewSwitcherHasOpened);
  els.viewSwitcher.replaceChildren(current, disclosure, menu);
  if (focusMenu) requestAnimationFrame(() => menu.querySelector('.is-current')?.focus());
  if (focusDisclosure) requestAnimationFrame(() => disclosure.focus());
}

function homeModuleShell(kind, title, viewId, meta = '') {
  const module = document.createElement('section');
  module.className = `home-module home-module-${kind}`;
  module.tabIndex = 0;
  module.setAttribute('role', 'button');
  module.setAttribute('aria-label', title);
  module.addEventListener('click', (event) => {
    if (event.target.closest('.home-activity-scroll')) return;
    renderBreakdownChange(viewId, { fromHome: true });
  });
  module.addEventListener('keydown', (event) => {
    if (event.target !== module) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    renderBreakdownChange(viewId, { fromHome: true });
  });
  const head = document.createElement('div');
  head.className = 'home-module-head';
  const titleWrap = document.createElement('div');
  titleWrap.className = 'home-module-title-wrap';
  const label = document.createElement('span');
  label.className = 'home-module-label';
  label.textContent = title;
  titleWrap.append(label);
  const end = document.createElement('div');
  end.className = 'home-module-head-end';
  if (meta) {
    const metaText = document.createElement('span');
    metaText.className = 'home-module-meta';
    metaText.textContent = meta;
    end.append(metaText);
  }
  const icon = document.createElement('span');
  icon.className = `home-module-jump ${VIEW_ICON_CLASSES[viewId] || ''}`;
  icon.setAttribute('aria-hidden', 'true');
  end.append(icon);
  head.append(titleWrap, end);
  const body = document.createElement('div');
  body.className = 'home-module-body';
  module.append(head, body);
  return { module, body };
}

function homeLimitAccountTitle(id, provider, index, providerEntries = [provider]) {
  if (id === 'codex') return codexAccountTitle(provider, index, providerEntries);
  if (id === 'mimo') return mimoAccountTitle(provider, index);
  if (id === 'opencode') return opencodeAccountTitle(provider, index);
  return String(provider?.accountEmail || provider?.accountName || '').trim() || `Account ${index + 1}`;
}

function homeLimitRows() {
  const enabled = enabledLimitProviderSet();
  const providerOrder = state.settings?.homeLimitProviderOrder || state.settings?.limitProviderOrder;
  const providerOptions = limitProviderOrderApi.orderedLimitProviders(LIMIT_PROVIDERS, providerOrder);
  const hasConfiguredOrder = Boolean(state.settings?.homeLimitProviderOrder);
  return homeOverviewApi.homeLimitAccountsForProviders({
    providers: (state.stats?.limits?.providers || []).map((provider) => ({
      ...provider,
      windows: limitProviderPresentationApi.limitProviderCompactWindows(provider, provider.windows)
    })),
    providerOptions,
    enabledProviderIds: Array.from(enabled),
    hiddenProviderIds: Array.from(hiddenHomeLimitProviderSet()),
    colors: clientColors,
    limit: state.settings?.homeLimitAccountCount ?? 3,
    sort: hasConfiguredOrder ? 'configured' : 'remaining',
    accountName: (provider, index, providerEntries) => {
      const id = String(provider?.provider || '').trim().toLowerCase();
      const option = providerOptions.find((entry) => entry.id === id);
      const providerTitle = option?.label || id;
      if (providerEntries.length > 1) {
        const accountTitle = homeLimitAccountTitle(id, provider, index, providerEntries);
        return state.settings?.showHomeLimitProviderNames === true || state.settings?.showToolIcons === false
          ? `${providerTitle} · ${accountTitle}`
          : accountTitle;
      }
      return providerTitle;
    }
  });
}

function homeLimitWindowLabel(window, providerId = '', visibleWindows = []) {
  const compactLabel = limitProviderPresentationApi.limitProviderCompactWindowLabel(providerId, window, visibleWindows);
  if (compactLabel) return compactLabel;
  if (window?.kind === 'billing') {
    const label = String(window?.label || '').trim();
    if (label) return label;
  }
  const key = {
    session: 'home.limit.session',
    weekly: 'home.limit.weekly',
    billing: 'home.limit.billing',
    monthly: 'home.limit.monthly'
  }[window.kind];
  if (key) return t(key);
  if (window?.kind === 'balance') return 'Balance';
  return window.label;
}

function renderHomeLimitModule() {
  const { module, body } = homeModuleShell('limits', t('home.limits'), 'limits');
  const rows = homeLimitRows();
  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'home-module-empty';
    empty.textContent = t('home.noLimits');
    body.append(empty);
    return module;
  }
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'home-limit-account';
    const account = document.createElement('div');
    account.className = 'home-limit-account-head';
    const mark = document.createElement('span');
    applyHomeListMark(mark, iconKindFor({ key: row.providerId || row.key }, 'limits'), row.color);
    const name = document.createElement('span');
    name.className = 'home-list-name';
    name.textContent = row.name;
    account.append(mark, name);
    const windows = document.createElement('div');
    windows.className = 'home-limit-windows';
    for (const window of row.windows) {
      const metric = document.createElement('div');
      metric.className = 'home-limit-window';
      const line = document.createElement('div');
      line.className = 'home-limit-window-line';
      const label = document.createElement('span');
      label.className = 'home-limit-window-label';
      label.textContent = homeLimitWindowLabel(window, row.providerId, row.windows);
      const value = document.createElement('span');
      value.className = 'home-list-value';
      const showUsed = Boolean(state.settings?.showLimitUsed);
      value.textContent = window.value || formatHomeLimitWindowValue(window, showUsed);
      if (state.settings?.showHomeLimitBars === true && window.remainingPercent != null) {
        const remainingPercent = Math.max(0, Math.min(100, Number(window.remainingPercent) || 0));
        if (remainingPercent < 20) {
          value.classList.add('home-limit-value-critical');
        } else if (remainingPercent < 50) {
          value.classList.add('home-limit-value-low');
          value.style.setProperty('--home-limit-accent', row.color);
        }
      }
      line.append(label, value);
      metric.append(line);
      const resetAt = formatReset(window.resetsAt);
      const resetText = document.createElement('span');
      resetText.className = 'home-limit-reset';
      const resetLabel = window.resetsAt
        ? resetAt || '\u00a0'
        : window.resetDescription
        ? t('home.reset', { value: window.resetDescription })
        : '\u00a0';
      const periodLabel = limitProviderPresentationApi.limitProviderCompactWindowPeriodLabel(row.providerId, window, row.windows);
      resetText.textContent = periodLabel && resetLabel !== '\u00a0' ? `${periodLabel} · ${resetLabel}` : resetLabel;
      metric.append(resetText);
      windows.append(metric);
    }
    item.append(account, windows);
    body.append(item);
  }
  return module;
}

function renderHomeModelModule(period) {
  const { module, body } = homeModuleShell('model', t('home.models'), 'model');
  const rows = homeOverviewApi.homeModelRows(modelRowsForPeriod(period), period?.totalTokens, 5);
  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'home-module-empty';
    empty.textContent = t('home.noModels');
    body.append(empty);
    return module;
  }
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'home-list-row home-model-row';
    const mark = document.createElement('span');
    applyHomeListMark(mark, iconKindFor({ key: row.key || row.name }, 'model'), row.color);
    const name = document.createElement('span');
    name.className = 'home-list-name';
    name.textContent = row.name;
    const value = document.createElement('span');
    value.className = 'home-list-value';
    value.textContent = formatCompact(row.value);
    const share = document.createElement('span');
    share.className = 'home-list-aux';
    share.textContent = formatPercent(row.share * 100);
    item.append(mark, name, value, share);
    body.append(item);
  }
  return module;
}

function homeToolSourceRows(period) {
  return Object.entries(period?.clients || {}).map(([client, value]) => ({
    key: client,
    name: clientLabels[client] || client,
    value: Number(value || 0),
    color: clientColors[client] || clientColors.default
  }));
}

function renderHomeToolModule(period) {
  const { module, body } = homeModuleShell('tool', t('home.tools'), 'tool');
  const rows = homeOverviewApi.homeToolRows(homeToolSourceRows(period), period?.totalTokens, 5);
  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'home-module-empty';
    empty.textContent = t('home.noTools');
    body.append(empty);
    return module;
  }
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'home-list-row home-tool-row';
    const mark = document.createElement('span');
    applyHomeListMark(mark, iconKindFor({ key: row.key }, 'tool'), row.color);
    const name = document.createElement('span');
    name.className = 'home-list-name';
    name.textContent = row.name;
    const value = document.createElement('span');
    value.className = 'home-list-value';
    value.textContent = formatCompact(row.value);
    const share = document.createElement('span');
    share.className = 'home-list-aux';
    share.textContent = formatPercent(row.share * 100);
    item.append(mark, name, value, share);
    body.append(item);
  }
  return module;
}

function renderHomeDeviceModule() {
  const { module, body } = homeModuleShell('device', t('home.devices'), 'device');
  const rows = homeOverviewApi.homeDeviceRows(state.stats?.devices || [], {
    localDeviceId: state.settings?.deviceId || '',
    period: state.period,
    limit: 4
  });
  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'home-module-empty';
    empty.textContent = t('home.noDevices');
    body.append(empty);
    return module;
  }
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'home-list-row home-device-row';
    if (row.isStale) {
      item.classList.add('is-stale');
      item.title = t('home.staleDevice');
    }
    const mark = document.createElement('span');
    applyHomeListMark(mark, iconKindFor({ platform: row.platform }, 'device'), row.isStale ? deviceStaleColor : deviceAccent);
    const label = document.createElement('span');
    label.className = 'home-list-name home-device-label';
    const name = document.createElement('span');
    name.className = 'home-device-name';
    name.textContent = row.name;
    label.append(name);
    if (row.isLocal) {
      const badge = document.createElement('span');
      badge.className = 'home-device-badge';
      badge.textContent = 'you';
      label.append(badge);
    }
    const value = document.createElement('span');
    value.className = 'home-list-value';
    value.textContent = formatCompact(row.value);
    item.append(mark, label, value);
    body.append(item);
  }
  return module;
}

function dailyWithHeatIntensity(daily) {
  return window.TokenMonitorUsageCharts.computeHeatmapIntensities(daily);
}

function applyHomeActivityScroll(scroller) {
  const target = homeOverviewApi.homeActivityScrollTarget({
    scrollWidth: scroller.scrollWidth,
    clientWidth: scroller.clientWidth,
    followEnd: state.homeActivityFollowEnd,
    savedLeft: state.homeActivityScrollLeft
  });
  if (Math.abs(scroller.scrollLeft - target) > 0.5) scroller.scrollLeft = target;
  scroller.classList.toggle('is-scrolled', target > 2);
}

function setupHomeActivityScroller(scroller, onReady = null) {
  let drag = null;
  let readySignaled = false;
  const applySettledLayout = () => {
    applyHomeActivityScroll(scroller);
    if (readySignaled || typeof onReady !== 'function') return;
    const svg = scroller.querySelector('.dash-heatmap');
    if (scroller.clientWidth <= 0 || !svg || svg.getBoundingClientRect().width <= 0) return;
    readySignaled = true;
    onReady();
  };
  scroller.addEventListener('scroll', () => {
    scroller.classList.toggle('is-scrolled', scroller.scrollLeft > 2);
    const record = homeOverviewApi.homeActivityScrollRecord({
      scrollLeft: scroller.scrollLeft,
      scrollWidth: scroller.scrollWidth,
      clientWidth: scroller.clientWidth
    });
    if (!record) return; // not laid out / panel hidden — don't persist a bogus position
    state.homeActivityScrollLeft = record.scrollLeft;
    state.homeActivityFollowEnd = record.followEnd;
  });
  scroller.addEventListener('click', (event) => event.stopPropagation());
  scroller.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.pointerType === 'touch') return;
    event.preventDefault();
    drag = { x: event.clientX, left: scroller.scrollLeft };
    scroller.classList.add('is-dragging');
    scroller.setPointerCapture?.(event.pointerId);
  });
  scroller.addEventListener('pointermove', (event) => {
    if (!drag) return;
    event.preventDefault();
    scroller.scrollLeft = drag.left - (event.clientX - drag.x);
  });
  const endDrag = (event) => {
    if (!drag) return;
    drag = null;
    scroller.classList.remove('is-dragging');
    if (scroller.hasPointerCapture?.(event.pointerId)) scroller.releasePointerCapture(event.pointerId);
  };
  scroller.addEventListener('pointerup', endDrag);
  scroller.addEventListener('pointercancel', endDrag);

  // Land on the newest (right) column only after the browser has actually laid the
  // heatmap out. A single requestAnimationFrame measures before layout settles on a
  // cold window (far more often on Windows), reads scrollWidth === clientWidth, and
  // sticks at the oldest edge. ResizeObserver delivers post-layout and also fires once
  // the panel becomes visible / the window resizes, so the measurement is always real.
  state.homeActivityResizeObserver?.disconnect();
  if (typeof ResizeObserver === 'function') {
    state.homeActivityResizeObserver = new ResizeObserver(applySettledLayout);
    state.homeActivityResizeObserver.observe(scroller);
  } else if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(applySettledLayout));
  }
  applyHomeActivityScroll(scroller);
}

function homeActivityTooltipEl() {
  let tooltip = document.querySelector('.home-activity-tooltip');
  if (tooltip) return tooltip;
  tooltip = document.createElement('div');
  tooltip.className = 'home-activity-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('aria-hidden', 'true');

  const count = document.createElement('span');
  count.className = 'home-activity-tooltip-count';
  count.dataset.homeActivityTooltipCount = 'true';

  const label = document.createElement('span');
  label.className = 'home-activity-tooltip-label';
  label.dataset.homeActivityTooltipLabel = 'true';
  label.textContent = 'tokens';

  const date = document.createElement('span');
  date.className = 'home-activity-tooltip-date';
  date.dataset.homeActivityTooltipDate = 'true';

  const row = document.createElement('span');
  row.className = 'home-activity-tooltip-row';
  row.append(count, label);
  tooltip.append(row, date);
  document.body.append(tooltip);
  return tooltip;
}

function moveHomeActivityTooltip(tooltip, cell) {
  const cellRect = cell.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const gap = 9;
  const pad = 6;
  const desiredX = cellRect.left + cellRect.width / 2;
  const x = Math.max(pad + tooltipRect.width / 2, Math.min(window.innerWidth - pad - tooltipRect.width / 2, desiredX));
  const aboveY = cellRect.top - tooltipRect.height - gap;
  const belowY = cellRect.bottom + gap;
  const y = aboveY >= pad ? aboveY : Math.min(window.innerHeight - pad - tooltipRect.height, belowY);
  tooltip.style.transform = `translate(${x}px, ${y}px) translate(-50%, 0)`;
}

function setupHomeActivityHover(scroller) {
  const canvas = scroller.querySelector('.home-activity-canvas');
  const svg = canvas?.querySelector('.dash-heatmap');
  const gradient = svg?.querySelector('#homeActivitySpotlightGradient');
  const tooltip = homeActivityTooltipEl();
  let activeCell = null;
  let spotlightFrame = 0;
  let spotlightVisible = false;
  const spotlightTarget = { x: -200, y: -200 };
  const spotlightCurrent = { x: -200, y: -200 };

  const setSpotlight = (point) => {
    gradient?.setAttribute('cx', String(Math.round(point.x * 10) / 10));
    gradient?.setAttribute('cy', String(Math.round(point.y * 10) / 10));
  };

  const scheduleSpotlight = () => {
    if (spotlightFrame || !gradient) return;
    spotlightFrame = requestAnimationFrame(() => {
      spotlightFrame = 0;
      const dx = spotlightTarget.x - spotlightCurrent.x;
      const dy = spotlightTarget.y - spotlightCurrent.y;
      if (Math.abs(dx) < 0.12 && Math.abs(dy) < 0.12) {
        spotlightCurrent.x = spotlightTarget.x;
        spotlightCurrent.y = spotlightTarget.y;
      } else {
        spotlightCurrent.x += dx * 0.32;
        spotlightCurrent.y += dy * 0.32;
        scheduleSpotlight();
      }
      setSpotlight(spotlightCurrent);
    });
  };

  const moveSpotlight = (x, y) => {
    spotlightTarget.x = x;
    spotlightTarget.y = y;
    if (!spotlightVisible) {
      spotlightVisible = true;
      spotlightCurrent.x = x;
      spotlightCurrent.y = y;
      setSpotlight(spotlightCurrent);
      return;
    }
    scheduleSpotlight();
  };

  const hide = () => {
    tooltip.dataset.visible = 'false';
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.style.transform = 'translate(-9999px, -9999px)';
    if (spotlightFrame) cancelAnimationFrame(spotlightFrame);
    spotlightFrame = 0;
    spotlightVisible = false;
    spotlightTarget.x = -200;
    spotlightTarget.y = -200;
    spotlightCurrent.x = -200;
    spotlightCurrent.y = -200;
    setSpotlight(spotlightCurrent);
    if (activeCell) activeCell.removeAttribute('data-active');
    activeCell = null;
  };

  scroller.addEventListener('pointermove', (event) => {
    if (!svg || scroller.classList.contains('is-dragging')) {
      hide();
      return;
    }
    const rect = svg.getBoundingClientRect();
    const view = svg.viewBox.baseVal;
    const x = view.x + (event.clientX - rect.left) * view.width / Math.max(1, rect.width);
    const y = view.y + (event.clientY - rect.top) * view.height / Math.max(1, rect.height);
    moveSpotlight(x, y);

    const target = event.target instanceof Element ? event.target.closest('.heat[data-d]') : null;
    const cell = target && canvas.contains(target) ? target : null;
    if (!cell) {
      hide();
      return;
    }
    if (activeCell !== cell) {
      activeCell?.removeAttribute('data-active');
      activeCell = cell;
      activeCell.setAttribute('data-active', 'true');
      tooltip.querySelector('[data-home-activity-tooltip-count]').textContent = formatCompact(Number(cell.dataset.t || 0));
      tooltip.querySelector('[data-home-activity-tooltip-label]').textContent = 'tokens';
      tooltip.querySelector('[data-home-activity-tooltip-date]').textContent = cell.dataset.d || '';
    }
    tooltip.dataset.visible = 'true';
    tooltip.setAttribute('aria-hidden', 'false');
    moveHomeActivityTooltip(tooltip, cell);
  });
  scroller.addEventListener('pointerleave', hide);
  scroller.addEventListener('scroll', hide);
  // The tooltip lives on document.body and is only dismissed by handlers on this
  // scroller, which renderHome() throws away on every rebuild. Expose the latest
  // hide() so renderHome/render can clear it — DOM removal fires no pointerleave.
  state.homeActivityHoverTeardown = hide;
}

// Dismiss the body-level activity tooltip + spotlight from outside the scroller's own
// pointer handlers (Home rerender, or switching away from Home while a cell is hovered).
// Clearing the ref after teardown drops the last hold on the old hide() closure, so a
// discarded scroller + its SVG can be collected when the trends module goes away and no
// fresh setupHomeActivityHover reassigns it. setup always re-registers before any hover.
function hideHomeActivityTooltip() {
  state.homeActivityHoverTeardown?.();
  state.homeActivityHoverTeardown = null;
}

function renderHomeTrendsModule() {
  const charts = window.TokenMonitorUsageCharts;
  const historyEnabled = state.settings?.historyEnabled !== false;
  const preview = state.stats?.historyPreview || { daily: [] };
  const history = homeOverviewApi.pickHomeHistory(state.homeHistory, preview);
  const rawDaily = history.daily || [];
  if (!historyEnabled || rawDaily.length === 0) {
    const { module, body } = homeModuleShell('trends', t('home.activity'), 'trends');
    const empty = document.createElement('div');
    empty.className = 'home-module-empty';
    if (historyEnabled) {
      empty.textContent = state.trendsActivating ? t('home.historyLoading') : t('home.noHistory');
    } else {
      const text = document.createElement('span');
      text.textContent = t('home.historyDisabled');
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'home-module-empty-action';
      action.textContent = t('home.enableHistory');
      action.addEventListener('click', (event) => {
        event.stopPropagation();
        openTrendSettings();
      });
      empty.append(text, action);
    }
    body.append(empty);
    return module;
  }
  // The snapshot's today bucket lags the live headline total between history ticks;
  // patch today's tokens with the live period total (like the trends sparkline's
  // patchTodayBar) so the heatmap and trend line match the number shown above them.
  // The key must be the LOCAL day: the period being patched in is local-day scoped.
  const today = charts.localDayKey();
  const todayPeriod = state.stats?.periods?.today;
  const points = homeOverviewApi.patchDailyToday(rawDaily, today, Number(todayPeriod?.totalTokens || 0), Number(todayPeriod?.costUsd || 0));
  const activityLayout = homeOverviewApi.homeActivityHeatmapLayout();
  const heatMetric = state.settings?.heatmapMetric || 'cost';
  const intensityField = heatMetric === 'cost' ? 'costIntensity' : 'tokenIntensity';
  const intensityPoints = dailyWithHeatIntensity(points).map((p) => ({
    ...p,
    intensity: Number(p[intensityField] ?? p.intensity ?? 0)
  }));
  const activity = charts.rollingYearHeatmap(intensityPoints, {
    endDate: today,
    cell: activityLayout.cell,
    gap: activityLayout.gap
  });
  const summaryActiveDays = state.stats?.historyPreview?.summary?.activeDays;
  const activeDaysWindow = state.settings?.homeActiveDaysWindow || 'all';
  const displayActiveDays = activeDaysWindow === 'year'
    ? activity.cells.filter((cell) => cell.tokens > 0).length
    : (Number.isFinite(summaryActiveDays)
        ? summaryActiveDays
        : activity.cells.filter((cell) => cell.tokens > 0).length);
  const activeDaysLabel = activeDaysWindow === 'year'
    ? t('home.activeDaysYear', { count: displayActiveDays })
    : t('home.activeDays', { count: displayActiveDays });
  const { module, body } = homeModuleShell('trends', t('home.activity'), 'trends', activeDaysLabel);
  const activityScroll = document.createElement('div');
  activityScroll.className = 'home-activity-scroll';
  activityScroll.tabIndex = 0;
  activityScroll.setAttribute('role', 'region');
  activityScroll.setAttribute('aria-label', t('home.activityScroll'));
  const activityCanvas = document.createElement('div');
  activityCanvas.className = 'home-activity-canvas';
  activityCanvas.innerHTML = charts.heatmapSvg(activity, {
    monthLabel: (month) => compactMonthLabel(month.label),
    radius: activityLayout.radius,
    glowFilterId: 'homeActivityHeatGlow',
    spotlightId: 'homeActivitySpotlight',
    spotlightRadius: 82
  });
  activityScroll.append(activityCanvas);
  const linePoints = charts.clampDaily(points, 45);
  const summary = homeOverviewApi.homeTrendSummary(linePoints);
  const trendHead = document.createElement('div');
  trendHead.className = 'home-trend-head';
  const trendTitle = document.createElement('span');
  trendTitle.textContent = t('home.trend');
  const trendMeta = document.createElement('span');
  trendMeta.className = 'home-module-meta';
  trendMeta.textContent = t('home.peakTokens', { value: formatCompact(summary.peak) });
  trendHead.append(trendTitle, trendMeta);
  const model = charts.areaLineChart(linePoints, { width: 300, height: 70, padTop: 4, padRight: 3, padBottom: 4, padLeft: 3, metric: 'tokens', curve: true });
  const plot = document.createElement('div');
  plot.className = 'home-trend-plot';
  const chart = document.createElement('div');
  chart.className = 'home-area-chart';
  chart.innerHTML = charts.areaLineSvg(model);
  plot.append(chart);
  const dates = document.createElement('div');
  dates.className = 'home-trend-dates';
  for (const date of summary.dates) {
    const label = document.createElement('span');
    label.className = 'home-trend-date';
    label.textContent = trendShortLabel(date, 'date');
    dates.append(label);
  }
  body.append(activityScroll, trendHead, plot, dates);
  setupHomeActivityScroller(activityScroll, () => animateHomeHistoryVisuals(activityScroll, activityCanvas, chart));
  setupHomeActivityHover(activityScroll);
  return module;
}

function renderHome() {
  if (!els.homePanel) return;
  if (state.homeScrollResetPending) {
    els.homePanel.scrollTop = 0;
    state.homeScrollResetPending = false;
  }
  // The previous scroller (and its ResizeObserver) is about to be replaced; drop the
  // observer so at most one is live and it is gone if the trends module disappears,
  // and hide any open activity tooltip before its owning scroller is discarded.
  hideHomeActivityTooltip();
  state.homeActivityResizeObserver?.disconnect();
  state.homeActivityResizeObserver = null;
  const period = state.stats.periods?.[state.period] || { totalTokens: 0, costUsd: 0, clients: {} };
  const moduleIds = homeModuleIds();
  if (moduleIds.includes('trends')) void loadHomeHistory();
  if (moduleIds.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'home-empty';
    const title = document.createElement('div');
    title.className = 'home-empty-title';
    title.textContent = t('home.emptyTitle');
    const body = document.createElement('div');
    body.className = 'home-empty-body';
    body.textContent = t('home.emptyBody');
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'home-empty-action';
    action.textContent = t('home.customize');
    action.addEventListener('click', openHomeSettings);
    empty.append(title, body, action);
    els.homePanel.replaceChildren(empty);
    return;
  }
  const nodes = moduleIds.map((id) => {
    if (id === 'limits') return renderHomeLimitModule();
    if (id === 'tool') return renderHomeToolModule(period);
    if (id === 'device') return renderHomeDeviceModule();
    if (id === 'model') return renderHomeModelModule(period);
    return renderHomeTrendsModule();
  });
  els.homePanel.replaceChildren(...nodes);
  // setupHomeActivityScroller wires a ResizeObserver that applies the scroll position
  // post-layout, so no requestAnimationFrame guess is needed here.
}

function renderUsageEstimateBadge(period) {
  const badge = els.usageEstimateBadge;
  if (!badge) return;
  const estimated = period?.estimated === true;
  badge.hidden = !estimated;
  badge.classList.toggle('hidden', !estimated);
  badge.textContent = estimated ? t('usage.estimated') : '';
  badge.title = estimated ? t('usage.estimatedTitle') : '';
}

function render() {
  if (!state.stats) return;
  reconcileCustomRangeCapability();
  syncPeriodTabs();
  renderSessionUsageArchiveStatus();
  ensureBreakdownVisible();
  renderViewSwitcher();
  if (state.openSession && state.breakdown !== 'session') { state.openSession = null; els.sessionDetail.classList.add('hidden'); els.sessionDetail.replaceChildren(); els.sessionDetailHead.classList.add('hidden'); els.sessionDetailHead.replaceChildren(); }
  if (state.openSession) { els.sessionDetail.classList.remove('hidden'); els.sessionDetailHead.classList.remove('hidden'); } else { els.sessionDetail.classList.add('hidden'); els.sessionDetailHead.classList.add('hidden'); }
  const period = state.stats.periods?.[state.period] || { totalTokens: 0, costUsd: 0, clients: {} };
  renderUsageEstimateBadge(period);
  const nextTotal = Number(period.totalTokens || 0);
  const totalChanged = nextTotal !== state.currentTotal;
  if (state.suppressInitialNumberAnimation) {
    cancelNumberAnimation();
    numberAnimValue = nextTotal;
    els.totalTokens.textContent = formatNumber(nextTotal);
    updateTotalCompact(nextTotal);
    state.suppressInitialNumberAnimation = false;
  } else if (totalChanged) {
    // Keep the compact chip visible through the count-up and lock the font to the
    // widest endpoint first (a downward roll starts wider than it settles), so the
    // number never vanishes, clips, or resizes mid-roll. Re-fit on completion so a
    // window resize during the animation, or a downward settle, still ends correct.
    const animationFrom = numberAnimHandle ? numberAnimValue : state.currentTotal;
    const widest = formatNumber(nextTotal).length >= formatNumber(animationFrom).length ? nextTotal : animationFrom;
    els.totalTokens.textContent = formatNumber(widest);
    updateTotalCompact(nextTotal);
    animateNumber(els.totalTokens, animationFrom, nextTotal, state.periodMotionActive ? 800 : 1000, fitTotalNumber);
    pulseLiveDot();
  } else if (!headlineNumberIsAnimatingTo(nextTotal)) {
    cancelNumberAnimation();
    numberAnimValue = nextTotal;
    els.totalTokens.textContent = formatNumber(nextTotal);
    updateTotalCompact(nextTotal);
  }
  state.currentTotal = nextTotal;
  els.cost.textContent = formatCost(period.costUsd || 0);
  if (!state.refreshBusy && !state.refreshFeedbackTimer) setRefreshButtonState('idle');
  els.shell.classList.toggle('session-mode', state.breakdown === 'session');
  els.shell.classList.toggle('home-mode', state.breakdown === 'home');
  els.viewBackRow?.classList.toggle('hidden', state.breakdown === 'home' || !state.homeReturnVisible);
  // Leaving Home only CSS-hides the panel, so its heatmap scroller never sees a
  // pointerleave — dismiss the body-level tooltip here (renderHome covers rerenders).
  if (state.breakdown !== 'home') hideHomeActivityTooltip();
  if (state.breakdown === 'status') ensureServiceStatusTicker(); else stopServiceStatusTicker();
  if (state.breakdown === 'home') {
    els.breakdown.classList.add('hidden');
    els.serviceStatusPanel?.classList.add('hidden');
    els.trendsPanel.classList.add('hidden');
    els.limitsPanel.classList.add('hidden');
    els.homePanel.classList.remove('hidden');
    renderHome();
  } else if (state.breakdown === 'limits') {
    els.homePanel.classList.add('hidden');
    els.breakdown.classList.add('hidden');
    els.serviceStatusPanel?.classList.add('hidden');
    els.trendsPanel.classList.add('hidden');
    els.limitsPanel.classList.remove('hidden');
    renderLimits();
  } else if (state.breakdown === 'trends') {
    els.homePanel.classList.add('hidden');
    els.breakdown.classList.add('hidden');
    els.limitsPanel.classList.add('hidden');
    els.serviceStatusPanel?.classList.add('hidden');
    els.trendsPanel.classList.remove('hidden');
    renderTrends();
  } else if (state.breakdown === 'status') {
    els.homePanel.classList.add('hidden');
    els.breakdown.classList.add('hidden');
    els.limitsPanel.classList.add('hidden');
    els.trendsPanel.classList.add('hidden');
    els.serviceStatusPanel?.classList.remove('hidden');
    renderServiceStatus();
  } else if (state.openSession) {
    // session-detail view replaces the breakdown list; keep both the list and
    // limits hidden so a periodic re-render doesn't surface them over the detail.
    els.limitsPanel.classList.add('hidden');
    els.serviceStatusPanel?.classList.add('hidden');
    els.trendsPanel.classList.add('hidden');
    els.homePanel.classList.add('hidden');
    els.breakdown.classList.add('hidden');
  } else {
    els.homePanel.classList.add('hidden');
    els.limitsPanel.classList.add('hidden');
    els.serviceStatusPanel?.classList.add('hidden');
    els.trendsPanel.classList.add('hidden');
    els.breakdown.classList.remove('hidden');
    const rows = rowsForPeriod(period);
    let incompleteHint = '';
    if (state.breakdown === 'project' && projectRowsApi.projectBreakdownIncomplete(state.stats, state.period)) {
      incompleteHint = 'projects.incomplete';
    } else if (state.breakdown === 'session' && sessionRowsApi.sessionBreakdownIncomplete(state.stats, state.period)) {
      incompleteHint = 'sessions.incomplete';
    }
    renderRows(rows, { incompleteHint });
  }
  
  renderFloatingBubbleContent();
  // Tell main the window has painted real content (not the static "0" defaults),
  // so a recreated window can stay hidden until it's populated. See loadWindowFile.
  if (!contentReadySignaled) {
    contentReadySignaled = true;
    window.tokenMonitor.signalContentReady?.();
  }
}

function setStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.classList.toggle('error', isError);
}

const STREAM_REASON_KEYS = {
  unauthorized: 'settings.sync.offline.unauthorized',
  refused: 'settings.sync.offline.refused',
  timeout: 'settings.sync.offline.timeout',
  dns: 'settings.sync.offline.dns',
  unreachable: 'settings.sync.offline.unreachable',
  server_error: 'settings.sync.offline.serverError',
  disconnected: 'settings.sync.offline.disconnected',
  idle_timeout: 'settings.sync.offline.idleTimeout',
  network: 'settings.sync.offline.network'
};

const SYNC_HEALTH_REASON_KEYS = {
  unauthorized: 'settings.sync.offline.unauthorized',
  forbidden: 'settings.sync.offline.forbidden',
  request_timeout: 'settings.sync.offline.timeout',
  timeout: 'settings.sync.offline.timeout',
  rate_limited: 'settings.sync.offline.rateLimited',
  hub_server_error: 'settings.sync.offline.serverError',
  server_error: 'settings.sync.offline.serverError',
  refused: 'settings.sync.offline.refused',
  dns: 'settings.sync.offline.dns',
  unreachable: 'settings.sync.offline.unreachable',
  network: 'settings.sync.offline.network',
  disconnected: 'settings.sync.offline.disconnected',
  idle_timeout: 'settings.sync.offline.idleTimeout',
  hub_not_configured: 'settings.sync.offline.notConfigured',
  insecure_hub_transport: 'settings.sync.offline.configuration',
  hub_transport_unavailable: 'settings.sync.offline.configuration',
  collector_unavailable: 'settings.sync.offline.network',
  collection_failed: 'settings.sync.offline.network',
  external_agent_active: 'settings.sync.offline.configuration',
  upload_scheduler_unavailable: 'settings.sync.offline.network',
  stream_offline: 'settings.sync.offline.disconnected',
  recovery_timeout: 'settings.sync.offline.timeout',
  upload_failed: 'settings.sync.offline.network',
  hub_read_failed: 'settings.sync.offline.network'
};

const SYNC_HEALTH_STATE_KEYS = {
  idle: 'settings.sync.healthState.idle',
  collecting: 'settings.sync.healthState.collecting',
  ok: 'settings.sync.healthState.ok',
  uploading: 'settings.sync.healthState.uploading',
  waiting: 'settings.sync.healthState.waiting',
  backoff: 'settings.sync.healthState.backoff',
  failed: 'settings.sync.healthState.failed',
  error: 'settings.sync.healthState.error',
  aborted: 'settings.sync.healthState.aborted',
  blocked: 'settings.sync.healthState.blocked',
  connecting: 'settings.sync.healthState.connecting',
  live: 'settings.sync.healthState.live',
  offline: 'settings.sync.healthState.offline',
  'idle-timeout': 'settings.sync.healthState.idleTimeout',
  not_applicable: 'settings.sync.healthState.notApplicable',
  stopped: 'settings.sync.healthState.stopped',
  unknown: 'settings.sync.healthState.unknown'
};

const RECOVERY_CHANNEL_LABEL_KEYS = {
  collection: 'settings.sync.healthLocal',
  upload: 'settings.sync.healthUpload',
  rest: 'settings.sync.healthRest',
  stream: 'settings.sync.healthStream'
};

function recoveryFailures(result) {
  if (!result || typeof result !== 'object') return [];
  const channels = ['collection', 'upload', 'rest', 'stream'];
  return result.ok === false || channels.some((channel) => result[channel]?.ok === false)
    ? channels
      .filter((channel) => result[channel]?.ok === false && result[channel]?.code !== 'not_applicable')
      .map((channel) => ({ channel, result: result[channel] }))
    : [];
}

function streamFailureText(failure) {
  if (!failure || !failure.reason) return '';
  // Only render reasons that come from the stream classifier. Local-collector
  // statuses (e.g. 'collecting') can land in streamFailure during client→local
  // fallback; mapping those to a sync error would be a false "Connection failed".
  const key = STREAM_REASON_KEYS[failure.reason];
  if (!key) return '';
  const base = t(key);
  return failure.detail ? `${base} (${failure.detail})` : base;
}

function syncHealthFailureText(code) {
  if (!code) return '';
  const key = SYNC_HEALTH_REASON_KEYS[code];
  return key ? t(key) : String(code);
}

function syncHealthStateText(stateValue) {
  const state = String(stateValue || '').trim().toLowerCase();
  return t(SYNC_HEALTH_STATE_KEYS[state] || SYNC_HEALTH_STATE_KEYS.unknown);
}

function syncHealthEntryHasFailure(entry) {
  if (!entry || entry.state === 'not_applicable') return false;
  return Boolean(entry.failureCode) || ['error', 'failed', 'blocked', 'aborted'].includes(entry.state);
}

function syncHealthEntryDetail(entry) {
  if (!entry || !entry.failureCode || !['error', 'failed', 'backoff', 'blocked', 'aborted', 'offline', 'idle-timeout'].includes(entry.state)) return '';
  const retry = entry.nextRetryAt ? ` → ${formatTime(entry.nextRetryAt)}` : '';
  return ` — ${syncHealthFailureText(entry.failureCode)}${retry}`;
}

function renderSyncHealthStatus() {
  if (!els.syncHealthStatus) return;
  const health = state.syncHealth;
  if (!health || state.settings?.hubMode !== 'client' || state.mode !== 'sync') {
    els.syncHealthStatus.textContent = '';
    els.syncHealthStatus.className = 'hub-status';
    els.syncHealthStatus.hidden = true;
    return;
  }
  const channelKeys = [
    ['local', 'settings.sync.healthLocal'],
    ['upload', 'settings.sync.healthUpload'],
    ['rest', 'settings.sync.healthRest'],
    ['stream', 'settings.sync.healthStream']
  ];
  const parts = channelKeys.map(([channel, labelKey]) => {
    const entry = health[channel] || {};
    return `${t(labelKey)}: ${syncHealthStateText(entry.state)}${syncHealthEntryDetail(entry)}`;
  });
  const recoveryParts = recoveryFailures(state.recoveryResult);
  for (const { channel, result } of recoveryParts) {
    const label = t(RECOVERY_CHANNEL_LABEL_KEYS[channel]);
    const healthChannel = channel === 'collection' ? 'local' : channel;
    const alreadyShown = syncHealthEntryHasFailure(health[healthChannel]);
    if (alreadyShown) continue;
    parts.push(`${label}: ${syncHealthFailureText(result.code || 'sync_failed')}`);
  }
  els.syncHealthStatus.textContent = parts.join(' · ');
  const hasFailure = channelKeys.some(([channel]) => syncHealthEntryHasFailure(health[channel])) || recoveryParts.length > 0;
  els.syncHealthStatus.className = hasFailure ? 'hub-status error' : 'hub-status';
  els.syncHealthStatus.hidden = false;
}

function statusTextFor(mode, connected) {
  if (mode === 'sync') return connected ? 'Live' : 'Offline';
  if (mode === 'local') return connected ? 'Local' : 'Collecting…';
  return 'Starting…';
}

function liveDotTitle(mode, connected) {
  if (mode === 'sync') {
    if (connected) return t('status.hubStreamLive');
    const reason = streamFailureText(state.streamFailure);
    return reason ? `${t('status.hubStreamOffline')}: ${reason}` : t('status.hubStreamOffline');
  }
  if (mode === 'local') return connected ? 'Local collector running' : 'Local collector starting…';
  return 'Idle';
}

function setLiveDot(connected) {
  els.liveDot.classList.toggle('live', Boolean(connected));
  els.liveDot.title = liveDotTitle(state.mode, connected);
}

// Flare the live dot once when fresh data arrives. Re-arming the one-shot
// animation needs a class remove + forced reflow before re-adding.
function pulseLiveDot() {
  const dot = els.liveDot;
  if (!dot || !dot.classList.contains('live')) return;
  dot.classList.remove('pulse');
  void dot.offsetWidth;
  dot.classList.add('pulse');
}

function refreshButtonIdleTitle() {
  if (state.stats?.updatedAt) return t('refreshButton.refreshedAt', { time: formatTime(state.stats.updatedAt) });
  return t('refreshButton.label');
}

function clearRefreshButtonFeedbackTimer() {
  if (!state.refreshFeedbackTimer) return;
  clearTimeout(state.refreshFeedbackTimer);
  state.refreshFeedbackTimer = null;
}

function setRefreshButtonState(status = 'idle') {
  if (!els.refreshButton) return;
  els.refreshButton.classList.toggle('is-refreshing', status === 'refreshing');
  els.refreshButton.classList.toggle('is-refreshed', status === 'refreshed');
  els.refreshButton.classList.toggle('is-refresh-error', status === 'error');
  els.refreshButton.disabled = status === 'refreshing';
  if (status === 'refreshing') {
    els.refreshButton.title = t('refreshButton.refreshing');
    els.refreshButton.setAttribute('aria-label', t('refreshButton.refreshing'));
    els.refreshButton.setAttribute('aria-busy', 'true');
  } else if (status === 'refreshed') {
    els.refreshButton.title = t('refreshButton.refreshed');
    els.refreshButton.setAttribute('aria-label', t('refreshButton.refreshed'));
    els.refreshButton.setAttribute('aria-busy', 'false');
  } else if (status === 'error') {
    els.refreshButton.title = t('refreshButton.failed');
    els.refreshButton.setAttribute('aria-label', t('refreshButton.failed'));
    els.refreshButton.setAttribute('aria-busy', 'false');
  } else {
    els.refreshButton.title = refreshButtonIdleTitle();
    els.refreshButton.setAttribute('aria-label', t('refreshButton.label'));
    els.refreshButton.removeAttribute('aria-busy');
  }
}

function settleRefreshButtonState(status) {
  clearRefreshButtonFeedbackTimer();
  setRefreshButtonState(status);
  state.refreshFeedbackTimer = setTimeout(() => {
    state.refreshFeedbackTimer = null;
    setRefreshButtonState('idle');
  }, REFRESH_BUTTON_FEEDBACK_MS);
}

// The main process rebuilds the TOTAL session list for display but ships it as a
// display-only sibling (`allTimeSessionsView`) so it never pollutes the lossless
// period export. Overlay it onto periods.allTime here, on the renderer's own copy, so
// every session-view reader (list, archived count, detail lookup) sees it. See
// injectLocalDeviceStatus in main.js.
function preserveCustomPeriod(stats) {
  if (!stats || state.period !== 'custom' || !state.stats?.periods?.custom) return stats;
  return {
    ...stats,
    periods: {
      ...(stats.periods || {}),
      custom: state.stats.periods.custom
    }
  };
}

function overlayAllTimeSessions(stats) {
  if (stats && stats.allTimeSessionsView && stats.periods?.allTime) {
    stats.periods.allTime.sessions = stats.allTimeSessionsView;
  }
  return stats;
}

async function refreshStats(options = {}) {
  const feedback = options.feedback === true;
  if (feedback) {
    if (state.refreshBusy) return;
    state.refreshBusy = true;
    clearRefreshButtonFeedbackTimer();
    setRefreshButtonState('refreshing');
  }
  try {
    if (options.recover !== true) state.recoveryResult = null;
    if (options.recover === true) {
      state.recoveryResult = await window.tokenMonitor.recoverNow?.() || null;
      state.syncHealth = await window.tokenMonitor.getSyncHealth?.() || state.syncHealth;
    }
    const statsOptions = options.recover === true
      ? { ...options, force: false, forceHistory: false, recover: false }
      : options;
    state.stats = preserveCustomPeriod(overlayAllTimeSessions(await window.tokenMonitor.getStats(statsOptions)));
    if (state.period === 'custom' && state.customRange && (options.force || options.feedback)) {
      try { await applyCustomRange(state.customRange); } catch (_) {}
    }
    if (options.forceHistory === true) {
      // A manual history rescan is an explicit retry boundary. Let Home request the
      // corresponding full payload even when its revision is unchanged, and restore
      // a retry budget that an earlier outage may have exhausted.
      clearTimeout(state.homeHistoryRetryTimer);
      state.homeHistoryRetryTimer = null;
      state.homeHistoryLoadedSignature = '';
      state.homeHistoryRetrySignature = '';
      state.homeHistoryRetries = 0;
      state.homeHistorySignature = '';
    }
    setStatus(statusTextFor(state.mode, state.streamConnected));
    render();
    renderToolPreferences();
    renderWslPanel();
    maybeUpdateBarsIcon();
    if (feedback) settleRefreshButtonState(recoveryFailures(state.recoveryResult).length > 0 ? 'error' : 'refreshed');
  } catch (error) {
    // The dot colour shows the offline state and the reason lives in the
    // live-dot tooltip + sync settings line, so keep the header status pill
    // hidden instead of surfacing the raw hub error (e.g. a 404 HTML page).
    console.log(`[refresh] getStats failed: ${error.message}`);
    setStatus(statusTextFor(state.mode, state.streamConnected));
    if (feedback) settleRefreshButtonState('error');
  } finally {
    if (feedback) state.refreshBusy = false;
  }
}

async function refreshStatusViewManually() {
  if (state.refreshBusy || state.serviceStatusBusy) return;
  state.refreshBusy = true;
  clearRefreshButtonFeedbackTimer();
  setRefreshButtonState('refreshing');
  try {
    await refreshServiceStatus({ force: true });
    settleRefreshButtonState('refreshed');
  } catch (error) {
    setStatus(error.message, true);
    settleRefreshButtonState('error');
  } finally {
    state.refreshBusy = false;
  }
}

function publishViewState() {
  window.tokenMonitor.setViewState?.({ period: state.period, breakdown: state.breakdown });
}


function ensureHourSelect(selectEl) {
  if (!selectEl || selectEl.options.length === 24 || !customRangePickerApi) return;
  selectEl.replaceChildren();
  for (const option of customRangePickerApi.hourOptions()) {
    const node = document.createElement('option');
    node.value = String(option.value);
    node.textContent = option.label;
    selectEl.append(node);
  }
}

function currentCustomRangeDraft() {
  if (state.customRangeDraft) return customRangePickerApi.normalizeDraft(state.customRangeDraft);
  if (state.customRange) return customRangePickerApi.normalizeDraft(state.customRange);
  return customRangePickerApi.normalizeDraft({
    startDate: customRangePickerApi.localDayKey(),
    endDate: customRangePickerApi.localDayKey(),
    startHour: 0,
    endHour: new Date().getHours()
  });
}

function setCustomRangeError(message) {
  state.customRangeError = message || '';
  if (!els.customRangeError) return;
  els.customRangeError.textContent = state.customRangeError;
  els.customRangeError.classList.toggle('hidden', !state.customRangeError);
}

function syncCustomRangeFields() {
  if (!customRangePickerApi || !els.customRangeStartDate) return;
  ensureHourSelect(els.customRangeStartHour);
  ensureHourSelect(els.customRangeEndHour);
  const draft = currentCustomRangeDraft();
  state.customRangeDraft = draft;
  els.customRangeStartDate.value = draft.startDate;
  els.customRangeEndDate.value = draft.endDate;
  els.customRangeStartHour.value = String(draft.startHour);
  els.customRangeEndHour.value = String(draft.endHour);
  if (!state.customRangeMonth) {
    const [y, m] = draft.startDate.split('-').map(Number);
    state.customRangeMonth = { year: y, monthIndex: m - 1 };
  }
  const locale = currentLocale();
  if (els.customRangeWeekdays) {
    const labels = customRangePickerApi.weekdayLabels(locale);
    const frag = document.createDocumentFragment();
    for (const label of labels) {
      const span = document.createElement('span');
      span.textContent = label;
      frag.append(span);
    }
    els.customRangeWeekdays.replaceChildren(frag);
  }
  if (els.customRangeMonthLabel) {
    els.customRangeMonthLabel.textContent = customRangePickerApi.monthLabel(
      state.customRangeMonth.year,
      state.customRangeMonth.monthIndex,
      locale
    );
  }
  if (els.customRangeGrid) {
    const cells = customRangePickerApi.buildMonthCells(
      state.customRangeMonth.year,
      state.customRangeMonth.monthIndex,
      draft
    );
    const frag = document.createDocumentFragment();
    for (const cell of cells) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'custom-range-day';
      if (!cell.inMonth) btn.classList.add('outside');
      if (cell.inRange) btn.classList.add('in-range');
      if (cell.isEndpoint) btn.classList.add('range-endpoint');
      btn.textContent = String(cell.dayNumber);
      btn.dataset.date = cell.date;
      btn.addEventListener('click', () => {
        state.customRangeDraft = customRangePickerApi.applyCalendarDayClick(state.customRangeDraft || draft, cell.date);
        setCustomRangeError('');
        syncCustomRangeFields();
      });
      frag.append(btn);
    }
    els.customRangeGrid.replaceChildren(frag);
  }
  if (els.customRangeApply) els.customRangeApply.disabled = Boolean(state.customRangeBusy);
  if (els.customRangeClear) els.customRangeClear.disabled = Boolean(state.customRangeBusy);
  setCustomRangeError(state.customRangeError);
}

function setCustomRangeOpen(open) {
  if (open && !customRangeSupported()) return;
  state.customRangeOpen = Boolean(open);
  els.shell?.classList.toggle('custom-range-open', state.customRangeOpen);
  if (els.customRangePopover) {
    els.customRangePopover.classList.toggle('hidden', !state.customRangeOpen);
    // Belt-and-suspenders: class + HTML hidden attribute (this codebase has no global .hidden rule).
    els.customRangePopover.hidden = !state.customRangeOpen;
    els.customRangePopover.setAttribute('aria-hidden', String(!state.customRangeOpen));
  }
  els.customRangeButton?.setAttribute('aria-expanded', String(state.customRangeOpen));
  if (state.customRangeOpen) {
    if (!state.customRangeDraft) state.customRangeDraft = currentCustomRangeDraft();
    if (!state.customRangeMonth && state.customRangeDraft?.startDate) {
      const [y, m] = state.customRangeDraft.startDate.split('-').map(Number);
      state.customRangeMonth = { year: y, monthIndex: m - 1 };
    }
    setCustomRangeError('');
    syncCustomRangeFields();
  }
}

function customRangeSupported() {
  // Older Node Hubs did not publish capabilities, so absence remains
  // backwards-compatible. An explicit false must not silently fall back to a
  // local-only range while the rest of the dashboard is showing many devices.
  return state.stats?.capabilities?.usageRange !== false;
}

function reconcileCustomRangeCapability() {
  if (customRangeSupported()) return;
  if (state.customRangeOpen) setCustomRangeOpen(false);
  state.customRange = null;
  state.customRangeError = '';
  if (state.stats?.periods?.custom) {
    const periods = { ...state.stats.periods };
    delete periods.custom;
    state.stats = { ...state.stats, periods };
  }
  if (state.period === 'custom') {
    state.period = 'today';
    publishViewState();
  }
}

function syncCustomRangeButton() {
  const supported = customRangeSupported();
  const active = state.period === 'custom' && Boolean(state.customRange);
  els.customRangeButton?.classList.toggle('active', active);
  if (!els.customRangeButton) return;
  els.customRangeButton.disabled = !supported;
  if (!supported) {
    els.customRangeButton.title = t('period.custom.unavailable');
    els.customRangeButton.setAttribute('aria-label', t('period.custom.unavailable'));
    return;
  }
  if (active && state.customRange) {
    const label = customRangePickerApi.formatRangeLabel(state.customRange, { compact: true });
    els.customRangeButton.title = label || t('period.custom.button');
    els.customRangeButton.setAttribute('aria-label', label || t('period.custom.button'));
  } else {
    els.customRangeButton.title = t('period.custom.button');
    els.customRangeButton.setAttribute('aria-label', t('period.custom.button'));
  }
}

function readCustomRangeDraftFromFields() {
  return customRangePickerApi.normalizeDraft({
    startDate: els.customRangeStartDate?.value,
    endDate: els.customRangeEndDate?.value,
    startHour: els.customRangeStartHour?.value,
    endHour: els.customRangeEndHour?.value,
    _pickPhase: state.customRangeDraft?._pickPhase
  });
}

async function applyCustomRange(rangeInput) {
  if (!customRangeSupported() || !window.tokenMonitor.getCustomRangeStats) {
    setCustomRangeError(t('period.custom.unavailable'));
    return false;
  }
  const draft = customRangePickerApi.normalizeDraft(rangeInput || readCustomRangeDraftFromFields());
  if (!draft.ok) {
    setCustomRangeError(t('period.custom.invalid'));
    syncCustomRangeFields();
    return false;
  }
  state.customRangeBusy = true;
  state.customRangeError = '';
  syncCustomRangeFields();
  try {
    const result = await window.tokenMonitor.getCustomRangeStats({
      startDate: draft.startDate,
      endDate: draft.endDate,
      startHour: draft.startHour,
      endHour: draft.endHour
    });
    if (!result?.ok || !result.period) {
      setCustomRangeError(result?.message || t('period.custom.failed'));
      return false;
    }
    state.customRange = {
      startDate: result.range.startDate,
      endDate: result.range.endDate,
      startHour: result.range.startHour,
      endHour: result.range.endHour
    };
    state.customRangeDraft = { ...state.customRange, ok: true, _pickPhase: 'done' };
    if (state.stats) {
      const existingDevices = Array.isArray(state.stats.devices) ? state.stats.devices : [];
      const customDevices = Array.isArray(result.devices) ? result.devices : [];
      const customById = new Map(customDevices.map((device) => [String(device?.deviceId || ''), device]));
      const devices = existingDevices.map((device) => {
        const custom = customById.get(String(device?.deviceId || ''));
        if (!custom) return device;
        return { ...device, periods: { ...(device.periods || {}), custom: custom.periods?.custom || {} } };
      });
      for (const custom of customDevices) {
        if (!devices.some((device) => String(device?.deviceId || '') === String(custom?.deviceId || ''))) devices.push(custom);
      }
      state.stats = {
        ...state.stats,
        devices,
        periods: {
          ...(state.stats.periods || {}),
          custom: result.period
        }
      };
    } else {
      state.stats = {
        periods: { custom: result.period },
        devices: Array.isArray(result.devices) ? result.devices : []
      };
    }
    state.period = 'custom';
    publishViewState();
    syncPeriodTabs();
    syncCustomRangeButton();
    state.rowSignature = '';
    state.periodMotionActive = true;
    render();
    state.periodMotionActive = false;
    setCustomRangeOpen(false);
    return true;
  } catch (error) {
    setCustomRangeError(error?.message || t('period.custom.failed'));
    return false;
  } finally {
    state.customRangeBusy = false;
    syncCustomRangeFields();
    syncCustomRangeButton();
  }
}


function clearCustomRangeSelection() {
  state.customRange = null;
  state.customRangeDraft = customRangePickerApi.normalizeDraft({
    startDate: customRangePickerApi.localDayKey(),
    endDate: customRangePickerApi.localDayKey(),
    startHour: 0,
    endHour: new Date().getHours()
  });
  state.customRangeError = '';
  if (state.period === 'custom') {
    state.period = 'today';
    publishViewState();
  }
  if (state.stats?.periods?.custom) {
    const periods = { ...state.stats.periods };
    delete periods.custom;
    state.stats = { ...state.stats, periods };
  }
  syncPeriodTabs();
  syncCustomRangeButton();
  syncCustomRangeFields();
  state.rowSignature = '';
  render();
}

function setupCustomRangeUI() {
  if (!els.customRangeButton || !customRangePickerApi) return;
  ensureHourSelect(els.customRangeStartHour);
  ensureHourSelect(els.customRangeEndHour);
  els.customRangeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setCustomRangeOpen(!state.customRangeOpen);
  });
  els.customRangeClose?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    setCustomRangeOpen(false);
  });
  els.customRangePopover?.addEventListener('pointerdown', (event) => {
    // Keep interactions inside the dialog from being treated as outside dismiss.
    event.stopPropagation();
  });
  els.customRangePrevMonth?.addEventListener('click', () => {
    const base = state.customRangeMonth || { year: new Date().getFullYear(), monthIndex: new Date().getMonth() };
    state.customRangeMonth = customRangePickerApi.shiftMonth(base.year, base.monthIndex, -1);
    syncCustomRangeFields();
  });
  els.customRangeNextMonth?.addEventListener('click', () => {
    const base = state.customRangeMonth || { year: new Date().getFullYear(), monthIndex: new Date().getMonth() };
    state.customRangeMonth = customRangePickerApi.shiftMonth(base.year, base.monthIndex, 1);
    syncCustomRangeFields();
  });
  const onFieldChange = () => {
    state.customRangeDraft = readCustomRangeDraftFromFields();
    if (state.customRangeDraft.startDate) {
      const [y, m] = state.customRangeDraft.startDate.split('-').map(Number);
      state.customRangeMonth = { year: y, monthIndex: m - 1 };
    }
    setCustomRangeError(state.customRangeDraft.ok ? '' : t('period.custom.invalid'));
    syncCustomRangeFields();
  };
  els.customRangeStartDate?.addEventListener('change', onFieldChange);
  els.customRangeEndDate?.addEventListener('change', onFieldChange);
  els.customRangeStartHour?.addEventListener('change', onFieldChange);
  els.customRangeEndHour?.addEventListener('change', onFieldChange);
  els.customRangeApply?.addEventListener('click', async () => {
    await applyCustomRange();
  });
  els.customRangeClear?.addEventListener('click', () => {
    clearCustomRangeSelection();
    setCustomRangeOpen(false);
  });
  document.addEventListener('pointerdown', (event) => {
    if (!state.customRangeOpen) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (els.customRangePopover?.contains(target) || els.customRangeButton?.contains(target)) return;
    setCustomRangeOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.customRangeOpen) {
      event.preventDefault();
      setCustomRangeOpen(false);
    }
  });
  // Popover must start closed; never auto-open on launch.
  setCustomRangeOpen(false);
  syncCustomRangeButton();
}

function setPeriod(period) {
  const next = normalizeInitialViewValue(period, viewPeriodValues, state.period);
  if (next === state.period) {
    publishViewState();
    return false;
  }
  state.period = next;
  if (next !== 'custom') {
    // Keep the last custom payload around so reopening the picker can re-apply it,
    // but leave the active period on the chosen preset tab.
    state.customRangeError = '';
  }
  publishViewState();
  syncCustomRangeButton();
  return true;
}

function setBreakdown(breakdown, options = {}) {
  const next = normalizeInitialViewValue(breakdown, viewBreakdownValues, state.breakdown);
  directBreakdownOverride = options.allowHidden === true ? next : null;
  if (next === state.breakdown) {
    publishViewState();
    return false;
  }
  state.homeReturnVisible = options.fromHome === true && state.breakdown === 'home' && next !== 'home';
  state.homeScrollResetPending = next === 'home';
  state.breakdown = next;
  state.rowSignature = '';
  publishViewState();
  return true;
}

function renderBreakdownChange(breakdown, options = {}) {
  if (!setBreakdown(breakdown, options)) return false;
  state.animateBarsFromZero = true;
  state.animateChartsOnRender = true;
  let renderSucceeded = false;
  try {
    render();
    renderSucceeded = true;
  } finally {
    state.animateBarsFromZero = false;
    // Home consumes this flag asynchronously after ResizeObserver confirms layout.
    // Clear it only after a failed render so that deferred entry motion still runs.
    if (!renderSucceeded) state.animateChartsOnRender = false;
  }
  return true;
}

function restartTimer() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  const interval = state.streamConnected
    ? 5 * 60 * 1000
    : Number(state.settings?.refreshMs || 15000);
  state.refreshTimer = setInterval(refreshStats, interval);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function applyControlLayout(swapSettingsAndRefresh) {
  const footerSlot = document.getElementById('footerActionSlot');
  if (!footerSlot || !els.utilityActions) return;
  footerSlot.appendChild(els.utilityActions);
  els.utilityActions.classList.toggle('is-swapped', swapSettingsAndRefresh);
  if (swapSettingsAndRefresh) {
    els.utilityActions.append(els.settingsButton, els.refreshButton);
  } else {
    els.utilityActions.append(els.refreshButton, els.settingsButton);
  }
}

function applyAppearanceSettings(settings) {
  const opacity = glassRenderingApi.renderedGlassOpacity(settings, {
    platform: state.appInfo?.platform,
    userAgent: navigator.userAgent
  });
  const depth = clamp(settings?.glassBlur ?? 32, 0, 100) / 100;
  const systemGlassDisabled = settings?.systemGlass === false;
  const isWindows = navigator.userAgent.toLowerCase().includes('windows');
  const querySurface = new URLSearchParams(window.location.search).get('windowsSurface');
  const windowsGlass = windowsGlassApi.appearanceState(settings, {
    isWindows,
    surface: settings?.windowsSurface || querySurface
  });
  const macosGlass = macosGlassApi.appearanceState(settings, {
    isMac: state.appInfo?.platform === 'darwin',
    liquidAvailable: settings?.macosGlassLiquidAvailable
      ?? state.settings?.macosGlassLiquidAvailable
      ?? false
  });
  const nativeWindowsBackdropEnabled = isWindows && windowsGlass.nativeBackdrop;
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--glass-alpha', opacity.toFixed(2));
  rootStyle.setProperty('--line-alpha', (0.1 + depth * 0.09).toFixed(3));
  rootStyle.setProperty('--line-strong-alpha', (0.18 + depth * 0.14).toFixed(3));
  rootStyle.setProperty('--control-alpha', (0.03 + depth * 0.045).toFixed(3));
  rootStyle.setProperty('--windows-fallback-alpha', (0.64 + opacity * 0.22).toFixed(3));
  rootStyle.setProperty('--windows-fallback-blur', `${Math.round(22 + depth * 14)}px`);
  document.documentElement.classList.toggle('system-glass-disabled', systemGlassDisabled);
  els.macosGlassRow?.classList.toggle('hidden', !macosGlass.showStyleControl);
  if (els.macosGlassInput) els.macosGlassInput.value = macosGlass.requestedStyle;
  if (els.macosGlassNote) els.macosGlassNote.classList.toggle('hidden', !macosGlass.showLiquidNote);
  if (macosGlass.showStyleControl) document.documentElement.dataset.macosGlass = macosGlass.effectiveStyle;
  else delete document.documentElement.dataset.macosGlass;
  // Theme colours must be applied before calculating transient Windows
  // surfaces. Native Mica/Acrylic follows the OS theme, while menus and
  // tooltips still need a theme-aware fill when a custom light preset is used.
  // Preview patches omit themeColors, so reuse the saved palette while still
  // recalculating it for the preview's native/non-native backdrop state.
  const themeColors = settings && 'themeColors' in settings
    ? settings.themeColors
    : state.settings?.themeColors;
  applyThemeColors(themeColors, { nativeBackdrop: nativeWindowsBackdropEnabled });
  const lightTheme = nativeWindowsBackdropEnabled
    ? systemDarkThemeMedia?.matches !== true
    : themePresetsApi.isLightHex(resolvedThemeColor('bg'));
  rootStyle.setProperty('--windows-popover-alpha', windowsGlassApi.nativePopoverAlpha({
    lightTheme,
    surface: windowsGlass.surface
  }).toFixed(3));
  rootStyle.setProperty('--windows-popover-blur', `${windowsGlassApi.nativePopoverBlur({ surface: windowsGlass.surface })}px`);

  // Mica and the deterministic Win10 fallback both get an explicit surface
  // attribute. The former leaves the shell open for DWM; the latter paints a
  // controlled CSS fallback and may also be enhanced by native Accent Blur.
  if (isWindows && windowsGlass.surface !== 'none') {
    document.documentElement.dataset.windowsSurface = windowsGlass.surface;
    document.body.dataset.windowsSurface = windowsGlass.surface;
  } else {
    delete document.documentElement.dataset.windowsSurface;
    delete document.body.dataset.windowsSurface;
  }
  applyReduceMotionPreference(settings?.reduceMotion);
  els.liveDot.style.display = (settings?.showLiveDot !== false) ? '' : 'none';
  els.shell.classList.toggle('desktop-mode', settings?.windowBehavior === 'desktop');
  // Windows frameless chrome has very little room beside the native window
  // buttons. Keep the compact brand mark there even for older saved settings
  // that selected the full text title; the text option remains available on
  // platforms where it can fit naturally.
  els.titleIconRow?.classList.toggle('hidden', isWindows);
  if (els.titleIconInput) els.titleIconInput.disabled = isWindows;
  els.shell.classList.toggle('title-icon-only', isWindows || settings?.titleIconOnly === true);
  const trayMode = settings && 'trayMode' in settings
    ? settings.trayMode === true
    : state.settings?.trayMode === true;
  els.shell.classList.toggle('tray-mode', trayMode);
  if (settings && ('settingsInTitlebar' in settings || 'trayMode' in settings)) {
    applyControlLayout(settings.settingsInTitlebar === true);
  }
  let isMacLegacyRadius = false;
  if (!isWindows && state.appInfo?.platform === 'darwin' && state.appInfo?.osRelease) {
    // macOS Tahoe (macOS 26) is Darwin 25. Older macOS versions (like 14, 15) use a ~12px native vibrancy radius.
    const major = parseInt(state.appInfo.osRelease.split('.')[0], 10);
    if (major < 25) isMacLegacyRadius = true;
  }

  document.documentElement.classList.remove('is-windows-glass'); // cleanup old class
  document.body.classList.remove('is-windows-glass');
  
  document.documentElement.classList.toggle('is-windows', isWindows);
  document.body.classList.toggle('is-windows', isWindows);

  const isMac = state.appInfo?.platform === 'darwin'
    || navigator.userAgent.toLowerCase().includes('macintosh');
  document.documentElement.classList.toggle('is-macos', isMac);
  document.body.classList.toggle('is-macos', isMac);
  
  document.documentElement.classList.toggle('is-mac-legacy', isMacLegacyRadius);
  document.body.classList.toggle('is-mac-legacy', isMacLegacyRadius);
  updateTitleFit();
}

const themePresetsApi = window.TokenMonitorThemePresets;
let themeCodeFeedbackGeneration = 0;
let appliedThemeOverrides = {};
// Snapshot of the canonical brand colours, taken before any override is
// applied. clientColors is mutated in place (other modules hold the same
// reference), so this is the source of truth for "reset to brand".
const BRAND_VENDOR_COLORS = { ...clientColors };

function appearanceSummary() {
  const theme = themePresetsApi.normalizeOverrides(state.settings?.themeColors, themePresetsApi.INTERFACE_COLOR_KEYS);
  const vendor = themePresetsApi.normalizeOverrides(state.settings?.vendorColors, Object.keys(BRAND_VENDOR_COLORS));
  const presetId = matchingThemePresetId(theme);
  const presetLabel = presetId ? t(`settings.appearance.preset.${presetId}`) : t('settings.appearance.custom');
  const customVendors = Object.keys(vendor).length;
  if (customVendors > 0) {
    return t('settings.summary.appearance', { theme: presetLabel, vendors: customVendors });
  }
  return presetLabel;
}

// Returns the preset id whose colours exactly match the resolved palette, or
// null when the palette is a custom mix.
function matchingThemePresetId(overrides) {
  const resolved = themePresetsApi.mergeThemeColors(overrides);
  for (const preset of themePresetsApi.THEME_PRESETS) {
    if (themePresetsApi.INTERFACE_COLOR_KEYS.every((k) => resolved[k] === preset.colors[k])) return preset.id;
  }
  return null;
}

function applyThemeColors(overrides) {
  const options = arguments[1] || {};
  const nativeBackdrop = options.nativeBackdrop ?? document.documentElement.dataset.windowsSurface === 'mica';
  appliedThemeOverrides = themePresetsApi.normalizeOverrides(overrides, themePresetsApi.INTERFACE_COLOR_KEYS);
  const root = document.documentElement.style;
  for (const { name, value } of themePresetsApi.themeCssVarEntries(appliedThemeOverrides, {
    nativeBackdrop,
    systemDark: systemDarkThemeMedia?.matches === true
  })) {
    if (value) root.setProperty(name, value);
    else root.removeProperty(name);
  }
  renderFloatingBubbleContent();
}

systemDarkThemeMedia?.addEventListener?.('change', () => {
  if (state.settings) applyAppearanceSettings(state.settings);
});

function applyVendorColorOverrides(overrides) {
  const merged = themePresetsApi.mergeVendorColors(BRAND_VENDOR_COLORS, overrides);
  for (const key of Object.keys(BRAND_VENDOR_COLORS)) clientColors[key] = merged[key];
}

// Current resolved palette value for an interface colour key.
function resolvedThemeColor(key) {
  return appliedThemeOverrides[key] || themePresetsApi.DEFAULT_THEME[key];
}

function buildAppearanceColorControls() {
  renderThemePresetChips();
  renderThemeColorGrid();
  renderVendorColorList();
  if (els.themeCodeInput && document.activeElement !== els.themeCodeInput) {
    const code = themePresetsApi.encodeThemeCode(state.settings?.themeColors);
    if (els.themeCodeInput.value !== code) {
      els.themeCodeInput.value = code;
      invalidateThemeCodeFeedback();
    }
  }
}

function renderThemePresetChips() {
  if (!els.themePresetChips) return;
  const activeId = matchingThemePresetId(state.settings?.themeColors);
  els.themePresetChips.innerHTML = '';
  for (const preset of themePresetsApi.THEME_PRESETS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'theme-preset-chip';
    chip.classList.toggle('active', preset.id === activeId);
    chip.dataset.presetId = preset.id;
    const dot = document.createElement('span');
    dot.className = 'theme-preset-dot';
    dot.style.background = preset.colors.accent;
    const label = document.createElement('span');
    label.textContent = t(`settings.appearance.preset.${preset.id}`);
    chip.append(dot, label);
    chip.addEventListener('click', () => selectThemePreset(preset.id));
    els.themePresetChips.appendChild(chip);
  }
}

function renderThemeColorGrid() {
  if (!els.themeColorGrid) return;
  els.themeColorGrid.innerHTML = '';
  for (const key of themePresetsApi.INTERFACE_COLOR_KEYS) {
    const row = document.createElement('label');
    row.className = 'color-picker-row';
    const name = document.createElement('span');
    name.className = 'color-picker-name';
    name.textContent = t(`settings.appearance.color.${key}`);
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'color-picker-input';
    input.value = resolvedThemeColor(key);
    input.dataset.themeKey = key;
    input.addEventListener('input', () => previewThemeColor(key, input.value));
    input.addEventListener('change', () => saveThemeColor(key, input.value));
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'reset-appearance-button reset-inline';
    reset.textContent = '↺';
    reset.title = t('settings.appearance.resetColor');
    reset.addEventListener('click', () => resetThemeColor(key));
    row.append(name, input, reset);
    els.themeColorGrid.appendChild(row);
  }
}

function renderVendorColorList() {
  if (!els.vendorColorList) return;
  const overrides = themePresetsApi.normalizeOverrides(state.settings?.vendorColors, Object.keys(BRAND_VENDOR_COLORS));
  els.vendorColorList.innerHTML = '';
  for (const id of themePresetsApi.orderedVendorIds(BRAND_VENDOR_COLORS)) {
    const row = document.createElement('label');
    row.className = 'vendor-color-row';
    const name = document.createElement('span');
    name.className = 'vendor-color-name';
    name.textContent = id === 'default' ? t('settings.appearance.vendorDefault') : themePresetsApi.vendorLabel(id);
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'color-picker-input';
    input.value = overrides[id] || BRAND_VENDOR_COLORS[id];
    input.dataset.vendorId = id;
    input.addEventListener('input', () => previewVendorColor(id, input.value));
    input.addEventListener('change', () => saveVendorColor(id, input.value));
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'reset-appearance-button reset-inline';
    reset.textContent = '↺';
    reset.title = t('settings.appearance.resetBrand');
    reset.addEventListener('click', () => resetVendorColor(id));
    row.append(name, input, reset);
    els.vendorColorList.appendChild(row);
  }
}

function currentThemeOverrides() {
  return themePresetsApi.normalizeOverrides(state.settings?.themeColors, themePresetsApi.INTERFACE_COLOR_KEYS);
}

function currentVendorOverrides() {
  return themePresetsApi.normalizeOverrides(state.settings?.vendorColors, Object.keys(BRAND_VENDOR_COLORS));
}

function previewThemeColor(key, value) {
  if (!themePresetsApi.isValidHex(value)) return;
  const next = { ...currentThemeOverrides(), [key]: themePresetsApi.normalizeHex(value) };
  applyThemeColors(next);
}

async function saveThemeColor(key, value) {
  if (!themePresetsApi.isValidHex(value)) return;
  const next = { ...currentThemeOverrides(), [key]: themePresetsApi.normalizeHex(value) };
  await commitThemeColors(next);
}

async function resetThemeColor(key) {
  const next = { ...currentThemeOverrides() };
  delete next[key];
  await commitThemeColors(next);
}

async function selectThemePreset(presetId) {
  const preset = themePresetsApi.THEME_PRESETS.find((p) => p.id === presetId);
  if (!preset) return;
  // Store only the keys that differ from the built-in default, so the palette
  // tracks default changes for untouched colours.
  const next = {};
  for (const key of themePresetsApi.INTERFACE_COLOR_KEYS) {
    if (preset.colors[key] !== themePresetsApi.DEFAULT_THEME[key]) next[key] = preset.colors[key];
  }
  await commitThemeColors(next);
}

async function commitThemeColors(overrides) {
  state.settings.themeColors = overrides;
  applyThemeColors(overrides);
  buildAppearanceColorControls();
  renderSettingsSummaries();
  await saveSettings({ themeColors: overrides });
}

function showThemeCodeStatus(key, type = '') {
  if (!els.themeCodeStatus) return;
  els.themeCodeStatus.textContent = t(key);
  els.themeCodeStatus.classList.toggle('success', type === 'success');
  els.themeCodeStatus.classList.toggle('error', type === 'error');
}

function clearThemeCodeStatus() {
  if (!els.themeCodeStatus) return;
  els.themeCodeStatus.textContent = '';
  els.themeCodeStatus.classList.remove('success', 'error');
}

function invalidateThemeCodeFeedback() {
  themeCodeFeedbackGeneration += 1;
  clearThemeCodeStatus();
  return themeCodeFeedbackGeneration;
}

function themeCodeFeedbackIsCurrent(generation, code) {
  return generation === themeCodeFeedbackGeneration && els.themeCodeInput?.value === code;
}

async function applyThemeCodeFromInput() {
  const generation = invalidateThemeCodeFeedback();
  const parsed = themePresetsApi.decodeThemeCode(els.themeCodeInput?.value);
  if (!parsed.ok) {
    const key = parsed.reason === 'unsupportedVersion'
      ? 'settings.appearance.themeCodeUnsupported'
      : 'settings.appearance.themeCodeInvalid';
    showThemeCodeStatus(key, 'error');
    return;
  }
  els.themeCodeInput.value = parsed.code;
  await commitThemeColors(parsed.colors);
  if (themeCodeFeedbackIsCurrent(generation, parsed.code)) {
    showThemeCodeStatus('settings.appearance.themeCodeApplied', 'success');
  }
}

async function pasteAndApplyThemeCode() {
  const generation = invalidateThemeCodeFeedback();
  const code = els.themeCodeInput?.value;
  let text;
  try {
    text = await navigator.clipboard.readText();
  } catch (_) {
    if (!themeCodeFeedbackIsCurrent(generation, code)) return;
    showThemeCodeStatus('settings.appearance.themeCodeCopyFailed', 'error');
    return;
  }
  if (!themeCodeFeedbackIsCurrent(generation, code)) return;
  const trimmed = (text || '').trim();
  if (els.themeCodeInput) els.themeCodeInput.value = trimmed;
  await applyThemeCodeFromInput();
}

async function copyCurrentThemeCode() {
  const generation = invalidateThemeCodeFeedback();
  const code = themePresetsApi.encodeThemeCode(state.settings?.themeColors);
  els.themeCodeInput.value = code;
  const copied = await copyToClipboard(code);
  if (!themeCodeFeedbackIsCurrent(generation, code)) return;
  showThemeCodeStatus(
    copied ? 'settings.appearance.themeCodeCopied' : 'settings.appearance.themeCodeCopyFailed',
    copied ? 'success' : 'error'
  );
}

function previewVendorColor(id, value) {
  if (!themePresetsApi.isValidHex(value)) return;
  const next = { ...currentVendorOverrides(), [id]: themePresetsApi.normalizeHex(value) };
  applyVendorColorOverrides(next);
  render();
}

async function saveVendorColor(id, value) {
  if (!themePresetsApi.isValidHex(value)) return;
  const next = { ...currentVendorOverrides(), [id]: themePresetsApi.normalizeHex(value) };
  await commitVendorColors(next);
}

async function resetVendorColor(id) {
  const next = { ...currentVendorOverrides() };
  delete next[id];
  await commitVendorColors(next);
}

async function commitVendorColors(overrides) {
  state.settings.vendorColors = overrides;
  applyVendorColorOverrides(overrides);
  render();
  buildAppearanceColorControls();
  renderSettingsSummaries();
  await saveSettings({ vendorColors: overrides });
}

function currentWindowBehavior(source = state.settings) {
  if (WINDOW_BEHAVIOR_VALUES.includes(source?.windowBehavior)) return source.windowBehavior;
  return source?.alwaysOnTop ? 'floating' : 'normal';
}

function nextWindowBehavior(mode) {
  const index = WINDOW_BEHAVIOR_VALUES.indexOf(mode);
  return WINDOW_BEHAVIOR_VALUES[(index + 1) % WINDOW_BEHAVIOR_VALUES.length] || 'floating';
}

function syncWindowBehaviorControls() {
  const mode = currentWindowBehavior();
  const next = nextWindowBehavior(mode);
  els.windowBehaviorInput.value = mode;
  els.pinButton.textContent = WINDOW_BEHAVIOR_ICONS[mode] || WINDOW_BEHAVIOR_ICONS.normal;
  els.pinButton.classList.toggle('active', mode !== 'normal');
  const title = t('settings.windowBehavior.buttonTitle', {
    current: t(`settings.windowBehavior.${mode}`),
    next: t(`settings.windowBehavior.${next}`)
  });
  els.pinButton.title = title;
  els.pinButton.setAttribute('aria-label', title);
}

function syncWindowShortcutStatus() {
  const note = els.windowToggleShortcutNote;
  const value = els.windowToggleShortcutValue;
  const clearButton = els.windowToggleShortcutClearButton;
  if (!note || !value) return;
  const shortcut = normalizeWindowToggleShortcutValue(state.settings?.windowToggleShortcut);
  // The value pill doubles as the record button, so its empty state is the action ("Record"), not "Off".
  const display = windowShortcutApi.formatWindowToggleShortcut(shortcut, t('settings.shortcut.record'));
  const status = state.settings?.windowToggleShortcutStatus?.state || (shortcut ? 'unregistered' : 'off');
  value.classList.toggle('recording', state.recordingWindowShortcut);
  value.textContent = state.recordingWindowShortcut ? t('settings.shortcut.recording') : display;
  if (clearButton) clearButton.disabled = !shortcut && !state.recordingWindowShortcut;
  note.classList.toggle('error', state.windowShortcutInvalid || (Boolean(shortcut) && status !== 'registered'));
  if (state.recordingWindowShortcut) {
    note.textContent = state.windowShortcutInvalid ? t('settings.display.windowShortcutInvalid') : t('settings.display.windowShortcutListening');
  } else if (!shortcut) {
    note.textContent = t('settings.display.windowShortcutNote');
  } else if (status === 'registered') {
    // The value pill already shows the active shortcut; repeating it here reads as clutter.
    note.textContent = t('settings.display.windowShortcutNote');
  } else {
    note.textContent = t('settings.display.windowShortcutConflict', {
      shortcut: display
    });
  }
}

function stopWindowShortcutRecording() {
  if (!state.recordingWindowShortcut) return;
  state.recordingWindowShortcut = false;
  state.windowShortcutInvalid = false;
  window.removeEventListener('keydown', handleWindowShortcutRecordKey, true);
  syncWindowShortcutStatus();
}

function startWindowShortcutRecording() {
  if (state.recordingWindowShortcut) return;
  state.recordingWindowShortcut = true;
  state.windowShortcutInvalid = false;
  window.addEventListener('keydown', handleWindowShortcutRecordKey, true);
  syncWindowShortcutStatus();
}

async function setWindowToggleShortcut(shortcut) {
  stopWindowShortcutRecording();
  await saveSettings({ windowToggleShortcut: shortcut });
}

function handleWindowShortcutRecordKey(event) {
  if (!state.recordingWindowShortcut) return;
  event.preventDefault();
  event.stopPropagation();
  const result = windowShortcutApi.windowToggleShortcutFromEvent(event, navigator.platform);
  if (result.action === 'cancel') {
    stopWindowShortcutRecording();
    return;
  }
  if (result.action === 'clear') {
    setWindowToggleShortcut('').catch(() => {});
    return;
  }
  if (result.action === 'record') {
    setWindowToggleShortcut(result.shortcut).catch(() => {});
    return;
  }
  state.windowShortcutInvalid = true;
  syncWindowShortcutStatus();
}

function applyFloatingBubbleState(payload = {}) {
  const side = payload?.collapsed && ['left', 'right'].includes(payload.side) ? payload.side : null;
  state.floatingBubble = { collapsed: Boolean(side), side };
  document.documentElement.classList.toggle('floating-bubble-collapsed-left', side === 'left');
  document.documentElement.classList.toggle('floating-bubble-collapsed-right', side === 'right');
  document.body.classList.toggle('floating-bubble-collapsed-left', side === 'left');
  document.body.classList.toggle('floating-bubble-collapsed-right', side === 'right');
  const title = t('floatingBubble.expand');
  if (els.floatingBubbleTab) {
    els.floatingBubbleTab.title = title;
    els.floatingBubbleTab.setAttribute('aria-label', title);
  }
  renderFloatingBubbleContent();
}

const BUBBLE_CONTENT_VALUES = ['icon', 'tokens', 'cost', 'both', 'tokensAll', 'costAll', 'bothAll', 'limitsAllSessions', 'bars', 'barsSession', 'barsWeekly', 'barsAllSessions', 'custom'];
function normalizeTrayContentValue(value) {
  return BUBBLE_CONTENT_VALUES.includes(value) ? value : 'icon';
}

function normalizeWindowToggleShortcutValue(value) {
  return windowShortcutApi.normalizeWindowToggleShortcut(value);
}

const BUBBLE_CONTENT_MIN_W = 34;
const BUBBLE_CONTENT_HEIGHT = 34;
const BUBBLE_CONTENT_PAD_X = 10;

function floatingBubbleGeneratedColors() {
  const text = resolvedThemeColor('text');
  const rgb = themePresetsApi.hexToRgbTriplet(text);
  return {
    track: `rgba(${rgb}, 0.22)`,
    fill: `rgba(${rgb}, 0.92)`,
    text: `rgba(${rgb}, 0.92)`
  };
}

function renderFloatingBubbleContent() {
  const el = els.floatingBubbleContent;
  if (!el || !state.floatingBubble.collapsed) return;
  const mode = state.settings?.floatingBubbleContent || 'icon';
  if (window.TokenMonitorTrayText.isGeneratedTrayIconMode(mode)) {
    const dataUrl = state.stats
      ? trayDataUrlForMode(mode, 44, floatingBubbleGeneratedColors(), {
          contentOnly: mode === 'barsAllSessions' || mode === 'limitsAllSessions',
          providerContrastHalo: true,
          showProviderBadge: false,
          layout: mode === 'custom' ? state.settings?.floatingBubbleCustomLayout : undefined
        })
      : null;
    if (dataUrl) {
      el.classList.add('bars');
      const img = new Image();
      img.alt = '';
      // A data-URL image has no layout width until it loads; size once it does.
      img.addEventListener('load', reportFloatingBubbleSize, { once: true });
      img.src = dataUrl;
      el.replaceChildren(img);
      return;
    }
    el.classList.remove('bars');
    el.textContent = (state.stats && window.TokenMonitorTrayText.formatTrayText(state.stats, mode, currentCurrency(), state.settings)) || 'Σ';
  } else if (mode === 'icon') {
    el.classList.remove('bars');
    el.textContent = 'Σ';
  } else {
    el.classList.remove('bars');
    el.textContent = state.stats ? (window.TokenMonitorTrayText.formatTrayText(state.stats, mode, currentCurrency(), state.settings) || '0') : '0';
  }
  reportFloatingBubbleSize();
}

function reportFloatingBubbleSize() {
  if (!state.floatingBubble.collapsed) return;
  const el = els.floatingBubbleContent;
  const mode = state.settings?.floatingBubbleContent || 'icon';
  // Height is constant; only the width tracks the content.
  let width = BUBBLE_CONTENT_MIN_W;
  if (mode !== 'icon' && el) {
    const pad = window.TokenMonitorTrayText.isGeneratedTrayIconMode(mode) ? 8 : BUBBLE_CONTENT_PAD_X * 2;
    width = Math.max(BUBBLE_CONTENT_MIN_W, Math.ceil(el.scrollWidth) + pad);
  }
  window.tokenMonitor.setFloatingBubbleCollapsedSize?.({ width, height: BUBBLE_CONTENT_HEIGHT });
}

const HOVER_REVEAL_DELAY_MS = 250;
const HOVER_COLLAPSE_GRACE_MS = 200;
let floatingBubbleHoverRevealTimer = null;
let floatingBubbleHoverCollapseTimer = null;
let suppressHoverRevealUntilReentry = false;

function floatingBubbleHoverMode() {
  return state.settings?.floatingBubbleTrigger === 'hover' && state.settings?.floatingBubbleEnabled === true;
}

function clearHoverRevealTimer() {
  if (floatingBubbleHoverRevealTimer) { clearTimeout(floatingBubbleHoverRevealTimer); floatingBubbleHoverRevealTimer = null; }
}

function clearHoverCollapseTimer() {
  if (floatingBubbleHoverCollapseTimer) { clearTimeout(floatingBubbleHoverCollapseTimer); floatingBubbleHoverCollapseTimer = null; }
}

function handleFloatingBubbleHoverEnter() {
  if (!floatingBubbleHoverMode() || !state.floatingBubble.collapsed || suppressHoverRevealUntilReentry) return;
  clearHoverRevealTimer();
  floatingBubbleHoverRevealTimer = setTimeout(() => {
    floatingBubbleHoverRevealTimer = null;
    if (!floatingBubbleHoverMode() || !state.floatingBubble.collapsed || floatingBubbleDrag) return;
    window.tokenMonitor.peekFloatingBubble?.();
  }, HOVER_REVEAL_DELAY_MS);
}

function handleFloatingBubbleHoverLeave() {
  clearHoverRevealTimer();
  suppressHoverRevealUntilReentry = false;
}

function handleDocumentHoverLeave() {
  if (!floatingBubbleHoverMode() || state.floatingBubble.collapsed) return;
  clearHoverCollapseTimer();
  floatingBubbleHoverCollapseTimer = setTimeout(() => {
    floatingBubbleHoverCollapseTimer = null;
    if (!floatingBubbleHoverMode() || state.floatingBubble.collapsed) return;
    window.tokenMonitor.collapseFloatingBubbleIfIdle?.();
  }, HOVER_COLLAPSE_GRACE_MS);
}

let floatingBubbleDrag = null;

function floatingBubblePointerOffset(event) {
  const rect = els.floatingBubbleTab?.getBoundingClientRect?.();
  const width = rect?.width || els.floatingBubbleTab?.offsetWidth || 18;
  const height = rect?.height || els.floatingBubbleTab?.offsetHeight || 34;
  const rawX = rect ? event.clientX - rect.left : width / 2;
  const rawY = rect ? event.clientY - rect.top : height / 2;
  const offsetX = Number.isFinite(rawX) ? Math.max(0, Math.min(width, rawX)) : width / 2;
  const offsetY = Number.isFinite(rawY) ? Math.max(0, Math.min(height, rawY)) : height / 2;
  return {
    offsetX: Math.round(offsetX),
    offsetY: Math.round(offsetY),
    offsetRatioX: width > 0 ? offsetX / width : 0.5,
    offsetRatioY: height > 0 ? offsetY / height : 0.5
  };
}

function finishFloatingBubbleDrag(pointerId) {
  if (!floatingBubbleDrag || floatingBubbleDrag.pointerId !== pointerId) return null;
  const drag = floatingBubbleDrag;
  floatingBubbleDrag = null;
  els.floatingBubbleTab?.classList.remove('dragging');
  try { els.floatingBubbleTab?.releasePointerCapture?.(pointerId); } catch (_) {}
  return drag;
}

function handleFloatingBubblePointerDown(event) {
  if (!state.floatingBubble.collapsed || event.button !== 0) return;
  clearHoverRevealTimer();
  floatingBubbleDrag = {
    pointerId: event.pointerId,
    startX: event.screenX,
    startY: event.screenY,
    ...floatingBubblePointerOffset(event),
    moved: false
  };
  els.floatingBubbleTab?.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function handleFloatingBubblePointerMove(event) {
  const drag = floatingBubbleDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const totalDx = event.screenX - drag.startX;
  const totalDy = event.screenY - drag.startY;
  if (!drag.moved && Math.hypot(totalDx, totalDy) < 4) return;
  drag.moved = true;
  els.floatingBubbleTab?.classList.add('dragging');
  const move = window.tokenMonitor.moveFloatingBubble?.({
    offsetX: drag.offsetX,
    offsetY: drag.offsetY,
    offsetRatioX: drag.offsetRatioX,
    offsetRatioY: drag.offsetRatioY
  });
  move?.catch?.(() => {});
  event.preventDefault();
}

function handleFloatingBubblePointerUp(event) {
  const drag = finishFloatingBubbleDrag(event.pointerId);
  if (!drag) return;
  if (!drag.moved) window.tokenMonitor.expandFloatingBubble?.();
  else {
    suppressHoverRevealUntilReentry = true;
    const move = window.tokenMonitor.moveFloatingBubble?.({
      offsetX: drag.offsetX,
      offsetY: drag.offsetY,
      offsetRatioX: drag.offsetRatioX,
      offsetRatioY: drag.offsetRatioY
    });
    move?.catch?.(() => {});
  }
  event.preventDefault();
}

function appearancePatchFromControls() {
  const systemGlass = els.systemGlassInputs?.find((input) => input.checked)?.value !== 'off';
  return {
    systemGlass,
    macosGlassStyle: macosGlassModeApi.normalizeMacosGlassStyle(els.macosGlassInput?.value),
    reduceMotion: els.reduceMotionInputs?.find((input) => input.checked)?.value || 'system',
    showLiveDot: Boolean(els.liveDotInput.checked),
    showToolIcons: Boolean(els.toolIconsInput.checked),
    titleIconOnly: Boolean(els.titleIconInput.checked),
    showCompactTotalTokens: Boolean(els.showCompactTotalTokensInput.checked),
    settingsInTitlebar: Boolean(els.swapSettingsRefreshInput.checked),
    glassOpacity: Number(els.glassInput.value === '' ? defaultAppearance.glassOpacity : els.glassInput.value),
    glassBlur: Number(els.blurInput.value === '' ? defaultAppearance.glassBlur : els.blurInput.value),
    zoomFactor: Number(els.zoomInput.value === '' ? defaultAppearance.zoomFactor * 100 : els.zoomInput.value) / 100
  };
}

function syncSliderRow(input) {
  if (!input) return;
  const valueEl = input.closest('.settings-slider-item')?.querySelector('.slider-value');
  if (valueEl) valueEl.textContent = String(Math.round(Number(input.value)));
}

function syncSliderRows() {
  syncSliderRow(els.glassInput);
  syncSliderRow(els.blurInput);
  syncSliderRow(els.zoomInput);
}

function applyAppearanceFromControls() {
  const patch = appearancePatchFromControls();
  applyAppearanceSettings(patch);
  syncSliderRows();
  window.tokenMonitor.previewAppearance?.(patch).catch(() => {});
}

async function saveAppearanceFromControls() {
  await saveSettings({ ...appearancePatchFromControls(), discordRpcEnabled: Boolean(els.discordRpcInput.checked) });
}

function syncHubModeUi() {
  const mode = state.settings.hubMode || 'local';
  for (const input of els.hubModeOptions.querySelectorAll('input[name="hubMode"]')) {
    input.checked = input.value === mode;
  }
  els.hubClientFields.classList.toggle('hidden', mode !== 'client');
  if (els.allowInsecureHubHttpInput) els.allowInsecureHubHttpInput.checked = state.settings.allowInsecureHubHttp === true;
  renderSyncClientStatus();
}

function renderSyncClientStatus() {
  if (!els.syncClientStatus) return;
  // Gate on the runtime mode, not just the hubMode setting: an invalid or
  // blocked Hub URL leaves local collection running, while its transport error
  // stays separate in the health row. Matches liveDotTitle's gating.
  const show = state.settings?.hubMode === 'client' && state.mode === 'sync' && !state.streamConnected;
  const text = show ? streamFailureText(state.streamFailure) : '';
  els.syncClientStatus.textContent = text;
  els.syncClientStatus.className = 'hub-status error';
  // Empty .hub-status still renders a bordered box, so hide it entirely when
  // there is nothing to show (connected, or not in client mode).
  els.syncClientStatus.hidden = !text;
  renderSyncHealthStatus();
}

async function copyToClipboard(text, button) {
  try {
    if (window.tokenMonitor.copyText) await window.tokenMonitor.copyText(text);
    else await navigator.clipboard.writeText(text);
    if (button) {
      const previous = button.textContent;
      button.textContent = '✓';
      setTimeout(() => { button.textContent = previous; }, 900);
    }
    return true;
  } catch (_) {
    return false;
  }
}

function syncPeriodTabs() {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const presetActive = state.period !== 'custom';
  const activeIndex = presetActive
    ? Math.max(0, tabs.findIndex((tab) => tab.dataset.period === state.period))
    : -1;
  const tabsEl = document.querySelector('.tabs');
  if (tabsEl) {
    if (activeIndex >= 0) tabsEl.style.setProperty('--period-index', String(activeIndex));
    tabsEl.classList.toggle('custom-active', !presetActive);
  }
  for (const tab of tabs) {
    const active = presetActive && tab.dataset.period === state.period;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
  }
  syncCustomRangeButton();
}

function applyInitialBreakdownPreference() {
  if (initialBreakdownPreferenceApplied || !state.settings) return;
  initialBreakdownPreferenceApplied = true;
  const next = viewDisplayPreferencesApi.preferredViewId({
    views: VIEW_DISPLAY_OPTIONS,
    orderValue: effectiveViewDisplayOrderValue(),
    hiddenValue: state.settings?.hiddenViews,
    availableIds: availableBreakdownIds(),
    currentId: state.breakdown,
    preferFirst: true
  });
  if (next !== state.breakdown) setBreakdown(next);
}

function renderSessionUsageArchiveStatus() {
  if (!els.sessionUsageArchiveStatus) return;
  if (state.settings?.sessionUsageArchiveEnabled === false) {
    els.sessionUsageArchiveStatus.textContent = t('settings.collection.sessionArchivePaused');
    return;
  }
  const count = sessionRowsApi.archivedSessionCount(state.stats);
  els.sessionUsageArchiveStatus.textContent = count > 0
    ? t('settings.collection.sessionArchiveActiveCount', { count })
    : t('settings.collection.sessionArchiveEmpty');
}

function syncSettingsForm() {
  applySettingsTranslations();
  applyInitialBreakdownPreference();
  syncPeriodTabs();
  syncHubModeUi();
  if (els.languageInput) els.languageInput.value = currentLanguage();
  if (els.currencyInput) els.currencyInput.value = currentCurrency();
  syncCurrencyRateControls();
  els.hubUrlInput.value = state.settings.hubUrl || '';
  els.secretInput.value = state.settings.secret || '';
  els.deviceIdInput.value = state.settings.deviceId || '';
  els.showLimitSourceInput.checked = Boolean(state.settings.showLimitSource);
  els.maskLimitAccountEmailsInput.checked = Boolean(state.settings.maskLimitAccountEmails);
  els.showLimitUsedInput.value = state.settings.showLimitUsed ? 'used' : 'remaining';
  if (els.syncUploadIntervalInput) {
    const value = Number(state.settings.syncUploadIntervalMs);
    const allowed = Array.from(els.syncUploadIntervalInput.options, (option) => Number(option.value));
    els.syncUploadIntervalInput.value = String(allowed.includes(value) ? value : 0);
  }
  if (els.collectionCadenceInput) {
    const value = Number(state.settings.collectionIntervalMs);
    const allowed = [300000, 900000, 1800000];
    els.collectionCadenceInput.value = state.settings.collectionMode === 'interval'
      ? String(allowed.includes(value) ? value : 300000)
      : 'live';
    if (els.collectionCadenceNote) {
      els.collectionCadenceNote.hidden = els.collectionCadenceInput.value === 'live';
    }
  }
  if (els.wslScanInput) els.wslScanInput.checked = state.settings.wslScanEnabled !== false;
  if (els.sessionUsageArchiveInput) els.sessionUsageArchiveInput.checked = state.settings.sessionUsageArchiveEnabled !== false;
  renderAutomaticAppUpdateControl();
  renderSessionUsageArchiveStatus();
  const exportAutoOn = Boolean(state.settings.exportAutoEnabled);
  const exportDir = state.settings.exportDir || '';
  if (els.exportAutoInput) els.exportAutoInput.checked = exportAutoOn;
  if (els.exportAutoDetails) els.exportAutoDetails.classList.toggle('hidden', !exportAutoOn);
  if (els.exportIntervalInput) els.exportIntervalInput.value = String(state.settings.exportIntervalMs || 60000);
  if (els.exportDirLabel) els.exportDirLabel.textContent = exportDir || t('settings.export.noFolder');
  if (els.exportAutoStatus) {
    const exportActive = exportAutoOn && Boolean(exportDir);
    els.exportAutoStatus.classList.toggle('hidden', !exportAutoOn);
    els.exportAutoStatus.classList.toggle('is-active', exportActive);
    els.exportAutoStatus.textContent = exportActive
      ? t('settings.export.statusActive')
      : t('settings.export.statusNeedsFolder');
  }
  renderWslPanel();
  const systemGlass = state.settings.systemGlass === false ? 'off' : 'system';
  for (const input of els.systemGlassInputs || []) input.checked = input.value === systemGlass;
  if (els.macosGlassInput) {
    els.macosGlassInput.value = macosGlassModeApi.normalizeMacosGlassStyle(state.settings.macosGlassStyle);
  }
  const reduceMotion = motionPreferenceApi.normalize(state.settings.reduceMotion);
  for (const input of els.reduceMotionInputs || []) input.checked = input.value === reduceMotion;
  els.liveDotInput.checked = state.settings.showLiveDot !== false;
  els.toolIconsInput.checked = state.settings.showToolIcons !== false;
  els.titleIconInput.checked = state.settings.titleIconOnly === true;
  els.showCompactTotalTokensInput.checked = state.settings.showCompactTotalTokens === true;
  els.swapSettingsRefreshInput.checked = state.settings.settingsInTitlebar === true;
  els.discordRpcInput.checked = Boolean(state.settings.discordRpcEnabled);
  syncWindowBehaviorControls();
  els.floatingBubbleInput.checked = state.settings.floatingBubbleEnabled === true;
  if (els.floatingBubbleTriggerInput) els.floatingBubbleTriggerInput.value = state.settings.floatingBubbleTrigger === 'hover' ? 'hover' : 'click';
  if (els.floatingBubbleContentInput) els.floatingBubbleContentInput.value = normalizeTrayContentValue(state.settings.floatingBubbleContent);
  els.floatingBubbleOptions?.classList.toggle('hidden', state.settings.floatingBubbleEnabled !== true);
  const showTrayIcon = state.settings.showTrayIcon !== false;
  if (els.showTrayIconInput) els.showTrayIconInput.checked = showTrayIcon;
  els.trayModeInput.disabled = !showTrayIcon;
  els.trayModeInput.checked = showTrayIcon && Boolean(state.settings.trayMode);
  els.trayContentInput.value = ['tokens', 'cost', 'both', 'tokensAll', 'costAll', 'bothAll', 'limitsAllSessions', 'bars', 'barsSession', 'barsWeekly', 'barsAllSessions', 'icon', 'custom'].includes(state.settings.trayContent) ? state.settings.trayContent : 'tokens';
  els.trayContentInput.disabled = !showTrayIcon;
  els.showTrayProviderBadgeInput.checked = state.settings.showTrayProviderBadge === true;
  els.showTrayProviderBadgeInput.disabled = !showTrayIcon;
  els.trayIconOptions?.classList.toggle('hidden', !showTrayIcon);
  els.trayOptions?.classList.toggle('hidden', !showTrayIcon || !state.settings.trayMode);
  syncTrayComposerVisibility();
  syncWindowShortcutStatus();
  if (els.startAtLoginInput) {
    els.startAtLoginInput.disabled = !state.appInfo?.loginItemSupported;
    els.startAtLoginInput.checked = Boolean(state.settings.startAtLogin && state.appInfo?.loginItemSupported);
  }
  if (els.startInTrayInput) els.startInTrayInput.checked = Boolean(state.settings.startInTray);
  if (els.closeToTrayInput) {
    els.closeToTrayInput.checked = Boolean(state.settings.closeToTray);
    els.closeToTrayInput.disabled = !showTrayIcon;
  }
  if (els.startupNote) {
    els.startupNote.textContent = !state.appInfo?.loginItemSupported
      ? t('settings.startup.available')
      : state.appInfo?.platform === 'linux'
        ? t('settings.startup.appimageNote')
        : t('settings.startup.launchAtSignIn');
  }
  els.glassInput.value = String(state.settings.glassOpacity ?? 68);
  els.blurInput.value = String(state.settings.glassBlur ?? 32);
  els.zoomInput.value = String(Math.round((Number(state.settings.zoomFactor) || 1) * 100));
  syncSliderRows();
  renderViewPreferences();
  renderToolPreferences();
  renderSettingsSummaries();
  applyVendorColorOverrides(state.settings.vendorColors);
  applyAppearanceSettings(state.settings);
  buildAppearanceColorControls();
  renderTokscaleStatus();
  renderSettingsAppUpdateRow();
  renderCustomPricing();
  renderHubAccountList();
  applyFloatingBubbleState(state.floatingBubble);
  if (state.breakdown === 'limits') renderLimits();
  else render();
}

function enabledClientSet() {
  return new Set(String(state.settings.clients || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
}

function hiddenClientSet() {
  return new Set(clientDisplayPreferencesApi.normalizeHiddenClients(state.settings?.hiddenClients, KNOWN_CLIENTS).split(',').filter(Boolean));
}

function hiddenViewSet() {
  return new Set(viewDisplayPreferencesApi.normalizeHiddenViews(state.settings?.hiddenViews, VIEW_DISPLAY_OPTIONS).split(',').filter(Boolean));
}

function hiddenHomeModuleSet() {
  return new Set(homeModulePreferencesApi.normalizeHiddenHomeModules(state.settings?.hiddenHomeModules, HOME_MODULE_OPTIONS).split(',').filter(Boolean));
}

function hiddenHomeLimitProviderSet() {
  const hidden = limitProviderOrderApi.normalizeLimitProviderSelection(state.settings?.hiddenHomeLimitProviders || '', LIMIT_PROVIDERS);
  return new Set(hidden);
}

function homeLimitProviderOrderValue() {
  return state.settings?.homeLimitProviderOrder || state.settings?.limitProviderOrder;
}

function viewLabel(view) {
  return t(view.labelKey || `views.${view.id}`);
}

function pinnedClientSet() {
  return new Set(clientDisplayPreferencesApi.normalizePinnedClients(state.settings?.pinnedClients, KNOWN_CLIENTS).split(',').filter(Boolean));
}

function visibilityIcon(hidden) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const paths = [
    'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'
  ];
  if (hidden) paths.push('M4 4l16 16');
  for (const d of paths) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

function pinIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M14 3l7 7-3 1-4 4 .5 3-2 2-3-5-5-3 2-2 3 .5 4-4 1-3Z');
  svg.appendChild(path);
  return svg;
}

function preferenceListForKind(kind) {
  if (kind === 'client') return els.clientDisplayList;
  if (kind === 'view') return els.viewDisplayList;
  if (kind === 'statusProvider') return document.getElementById('serviceProviderList');
  if (kind === 'homeModule') return document.getElementById('homeSettingsList');
  if (kind === 'homeLimitProvider') return document.getElementById('homeLimitProviderList');
  return null;
}

function preferenceItemAttribute(kind) {
  if (kind === 'client') return 'client';
  if (kind === 'view') return 'view';
  if (kind === 'statusProvider') return 'statusProvider';
  if (kind === 'homeModule') return 'homeModule';
  if (kind === 'homeLimitProvider') return 'homeLimitProvider';
  return '';
}

function preferenceRows(kind) {
  const list = preferenceListForKind(kind);
  const selector = kind === 'client'
    ? '.tool-preference-row[data-client]'
    : kind === 'view'
      ? '.view-preference-row[data-view]'
      : kind === 'statusProvider'
        ? '.status-provider-row[data-status-provider]'
        : kind === 'homeModule'
          ? '.home-module-preference-row[data-home-module]'
          : kind === 'homeLimitProvider'
            ? '.home-limit-provider-row[data-home-limit-provider]'
            : '.limit-provider-row[data-provider]';
  return Array.from(list?.querySelectorAll(selector) || []);
}

function preferenceOrder(kind) {
  const attr = preferenceItemAttribute(kind);
  return preferenceRows(kind).map((row) => row.dataset[attr]).filter(Boolean);
}

function preferenceRowRects(kind) {
  const attr = preferenceItemAttribute(kind);
  return preferenceRows(kind).map((row) => {
    const rect = row.getBoundingClientRect();
    return { id: row.dataset[attr], top: rect.top, bottom: rect.bottom };
  });
}

function applyPreferenceOrder(kind, order) {
  const list = preferenceListForKind(kind);
  if (!list) return;
  const attr = preferenceItemAttribute(kind);
  const rowsById = new Map(preferenceRows(kind).map((row) => [row.dataset[attr], row]));
  for (const id of order || []) {
    const row = rowsById.get(id);
    if (row) list.appendChild(row);
  }
}

function finishPreferenceDrag() {
  setPreferencePointerListeners(false);
  document.querySelectorAll('.is-dragging').forEach((row) => row.classList.remove('is-dragging'));
  preferenceDrag = null;
}

function applyPreferenceLiveOrder(kind, clientY) {
  if (!preferenceDrag) return -1;
  const currentOrder = preferenceOrder(kind);
  const nextOrder = preferenceDragSortApi.reorderItemsFromClientY(currentOrder, preferenceRowRects(kind), preferenceDrag.id, clientY);
  if (nextOrder.join(',') !== currentOrder.join(',')) {
    applyPreferenceOrder(kind, nextOrder);
    preferenceDrag.changed = true;
  }
  preferenceDrag.order = nextOrder;
  return nextOrder;
}

function startPreferenceDrag(event, kind, id) {
  if (event.currentTarget.disabled) return;
  event.preventDefault();
  const order = preferenceOrder(kind);
  preferenceDrag = { kind, id, pointerId: event.pointerId, originalOrder: order, order, changed: false, handle: event.currentTarget };
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.currentTarget.closest('[data-client], [data-provider], [data-view], [data-status-provider], [data-home-module], [data-home-limit-provider]')?.classList.add('is-dragging');
  setPreferencePointerListeners(true);
  applyPreferenceLiveOrder(kind, event.clientY);
}

function setPreferencePointerListeners(active) {
  const method = active ? 'addEventListener' : 'removeEventListener';
  window[method]('pointermove', onPreferencePointerMove, true);
  window[method]('pointerup', onPreferencePointerUp, true);
  window[method]('pointercancel', onPreferencePointerCancel, true);
}

function releasePreferencePointer(pointerId) {
  const handle = preferenceDrag?.handle;
  if (handle?.hasPointerCapture?.(pointerId)) {
    handle.releasePointerCapture(pointerId);
  }
}

function onPreferencePointerMove(event) {
  if (!preferenceDrag || preferenceDrag.pointerId !== event.pointerId) return;
  event.preventDefault();
  applyPreferenceLiveOrder(preferenceDrag.kind, event.clientY);
}

function onPreferencePointerUp(event) {
  if (!preferenceDrag || preferenceDrag.pointerId !== event.pointerId) return;
  event.preventDefault();
  const { kind, id } = preferenceDrag;
  const order = applyPreferenceLiveOrder(kind, event.clientY) || preferenceDrag.order;
  const changed = preferenceDrag.changed;
  releasePreferencePointer(event.pointerId);
  finishPreferenceDrag();
  if (changed) void onPreferenceOrderCommit(kind, order, id);
}

function onPreferencePointerCancel(event) {
  if (!preferenceDrag || preferenceDrag.pointerId !== event.pointerId) return;
  applyPreferenceOrder(preferenceDrag.kind, preferenceDrag.originalOrder);
  releasePreferencePointer(event.pointerId);
  finishPreferenceDrag();
}

function createPreferenceOrderHandle({ kind, id, label, count }) {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'preference-order-handle';
  handle.dataset.preferenceOrderHandle = kind;
  const titleKey = kind === 'client'
    ? 'settings.tools.reorderClient'
    : kind === 'view'
      ? 'settings.views.reorderView'
      : kind === 'statusProvider'
        ? 'serviceStatus.reorderProvider'
        : kind === 'homeModule'
          ? 'settings.home.reorderModule'
          : kind === 'homeLimitProvider'
            ? 'settings.home.reorderProvider'
            : 'settings.limits.reorderProvider';
  handle.title = t(titleKey, { name: label });
  handle.setAttribute('aria-label', handle.title);
  handle.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown Home End');
  handle.disabled = count <= 1;
  handle.addEventListener('pointerdown', (event) => startPreferenceDrag(event, kind, id));
  handle.addEventListener('keydown', (event) => onPreferenceOrderKeydown(event, kind, id));
  return handle;
}

function renderViewPreferences() {
  if (!els.viewDisplayList) return;
  const hidden = hiddenViewSet();
  const orderValue = effectiveViewDisplayOrderValue();
  const views = viewDisplayPreferencesApi.orderedViews(VIEW_DISPLAY_OPTIONS, orderValue);
  const hasCustomOrder = viewDisplayPreferencesApi.hasCustomViewDisplayOrder(state.settings?.viewDisplayOrder);
  const hasHiddenViews = hidden.size > 0;
  if (els.resetViewDisplayOrderButton) els.resetViewDisplayOrderButton.disabled = !hasCustomOrder;
  if (els.showAllViewsButton) els.showAllViewsButton.disabled = !hasHiddenViews;
  els.viewDisplayList.replaceChildren();
  const visibleCount = views.filter((view) => !hidden.has(view.id)).length;
  for (const view of views) {
    const id = view.id;
    const label = viewLabel(view);
    const isHidden = hidden.has(id);
    const historyEnabled = state.settings?.historyEnabled !== false;
    const projectsEnabled = state.settings?.projectsEnabled !== false;
    const isDisabled = (id === 'trends' && !historyEnabled) || (id === 'project' && !projectsEnabled);
    const isEffectivelyHidden = isHidden || isDisabled;
    const row = document.createElement('div');
    row.className = 'view-preference-row';
    row.dataset.view = id;
    row.classList.toggle('is-hidden', isEffectivelyHidden);
    row.classList.toggle('is-disabled', isDisabled);
    const name = document.createElement('div');
    name.className = 'tool-preference-name';
    name.textContent = label;
    const visibility = document.createElement('button');
    visibility.type = 'button';
    visibility.className = `tool-visibility-button${isEffectivelyHidden ? ' is-hidden' : ''}`;
    visibility.dataset.view = id;
    visibility.title = t(isEffectivelyHidden ? 'settings.views.showView' : 'settings.views.hideView', { name: label });
    visibility.setAttribute('aria-label', visibility.title);
    visibility.setAttribute('aria-pressed', String(!isEffectivelyHidden));
    visibility.disabled = !isEffectivelyHidden && visibleCount <= 1;
    visibility.append(visibilityIcon(isEffectivelyHidden));
    visibility.addEventListener('click', () => {
      if (id === 'trends') return onTrendVisibilityToggle();
      if (id === 'project') return onProjectVisibilityToggle();
      return onViewVisibilityToggle(id);
    });
    const handle = createPreferenceOrderHandle({ kind: 'view', id, label, count: views.length });
    const actions = document.createElement('div');
    actions.className = 'tool-preference-actions';
    actions.append(visibility, handle);
    row.append(name, actions);
    els.viewDisplayList.appendChild(row);
    if (id === 'home') {
      row.classList.add('has-subgroup');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = `view-subgroup-toggle${state.homeSettingsExpanded ? ' is-expanded' : ''}`;
      toggle.title = t('settings.views.configureHome', { name: label });
      toggle.setAttribute('aria-label', toggle.title);
      toggle.setAttribute('aria-expanded', String(Boolean(state.homeSettingsExpanded)));
      const toggleIcon = document.createElement('span');
      toggleIcon.className = 'view-subgroup-icon';
      toggleIcon.setAttribute('aria-hidden', 'true');
      toggle.append(toggleIcon);
      toggle.addEventListener('click', () => {
        state.homeSettingsExpanded = !state.homeSettingsExpanded;
        toggle.classList.toggle('is-expanded', state.homeSettingsExpanded);
        toggle.setAttribute('aria-expanded', String(Boolean(state.homeSettingsExpanded)));
        const container = document.getElementById('homeSettingsContainer');
        if (container) container.classList.toggle('hidden', !state.homeSettingsExpanded);
      });
      actions.insertBefore(toggle, visibility);

      const listContainer = document.createElement('div');
      listContainer.id = 'homeSettingsContainer';
      listContainer.className = `accordion-animated-container${state.homeSettingsExpanded ? '' : ' hidden'}`;
      const inner = document.createElement('div');
      inner.className = 'accordion-animation-inner';
      inner.appendChild(renderHomeSettingsList());
      listContainer.appendChild(inner);
      els.viewDisplayList.appendChild(listContainer);
    }
    if (id === 'trends') {
      row.classList.add('has-subgroup');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = `view-subgroup-toggle${state.trendSettingsExpanded ? ' is-expanded' : ''}`;
      toggle.title = t('settings.views.configureTrend', { name: label });
      toggle.setAttribute('aria-label', toggle.title);
      toggle.setAttribute('aria-expanded', String(Boolean(state.trendSettingsExpanded)));
      const toggleIcon = document.createElement('span');
      toggleIcon.className = 'view-subgroup-icon';
      toggleIcon.setAttribute('aria-hidden', 'true');
      toggle.append(toggleIcon);
      toggle.addEventListener('click', () => {
        state.trendSettingsExpanded = !state.trendSettingsExpanded;
        toggle.classList.toggle('is-expanded', state.trendSettingsExpanded);
        toggle.setAttribute('aria-expanded', String(Boolean(state.trendSettingsExpanded)));
        const container = document.getElementById('trendSettingsContainer');
        if (container) container.classList.toggle('hidden', !state.trendSettingsExpanded);
      });
      actions.insertBefore(toggle, visibility);
      
      const listContainer = document.createElement('div');
      listContainer.id = 'trendSettingsContainer';
      listContainer.className = `accordion-animated-container${state.trendSettingsExpanded ? '' : ' hidden'}`;
      const inner = document.createElement('div');
      inner.className = 'accordion-animation-inner';
      inner.appendChild(renderTrendSettingsList());
      listContainer.appendChild(inner);
      els.viewDisplayList.appendChild(listContainer);
    }
    if (id === 'project') {
      row.classList.add('has-subgroup');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = `view-subgroup-toggle${state.projectSettingsExpanded ? ' is-expanded' : ''}`;
      toggle.title = t('settings.views.configureProject', { name: label });
      toggle.setAttribute('aria-label', toggle.title);
      toggle.setAttribute('aria-expanded', String(Boolean(state.projectSettingsExpanded)));
      const toggleIcon = document.createElement('span');
      toggleIcon.className = 'view-subgroup-icon';
      toggleIcon.setAttribute('aria-hidden', 'true');
      toggle.append(toggleIcon);
      toggle.addEventListener('click', () => {
        state.projectSettingsExpanded = !state.projectSettingsExpanded;
        toggle.classList.toggle('is-expanded', state.projectSettingsExpanded);
        toggle.setAttribute('aria-expanded', String(Boolean(state.projectSettingsExpanded)));
        const container = document.getElementById('projectSettingsContainer');
        if (container) container.classList.toggle('hidden', !state.projectSettingsExpanded);
      });
      actions.insertBefore(toggle, visibility);

      const listContainer = document.createElement('div');
      listContainer.id = 'projectSettingsContainer';
      listContainer.className = `accordion-animated-container${state.projectSettingsExpanded ? '' : ' hidden'}`;
      const inner = document.createElement('div');
      inner.className = 'accordion-animation-inner';
      inner.appendChild(renderProjectSettingsList());
      listContainer.appendChild(inner);
      els.viewDisplayList.appendChild(listContainer);
    }
    if (id === 'status') {
      row.classList.add('has-subgroup');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = `view-subgroup-toggle${state.serviceProvidersExpanded ? ' is-expanded' : ''}`;
      toggle.title = t('serviceStatus.configureProviders', { name: label });
      toggle.setAttribute('aria-label', toggle.title);
      toggle.setAttribute('aria-expanded', String(Boolean(state.serviceProvidersExpanded)));
      const toggleIcon = document.createElement('span');
      toggleIcon.className = 'view-subgroup-icon';
      toggleIcon.setAttribute('aria-hidden', 'true');
      toggle.append(toggleIcon);
      toggle.addEventListener('click', () => {
        state.serviceProvidersExpanded = !state.serviceProvidersExpanded;
        toggle.classList.toggle('is-expanded', state.serviceProvidersExpanded);
        toggle.setAttribute('aria-expanded', String(Boolean(state.serviceProvidersExpanded)));
        const container = document.getElementById('serviceProvidersContainer');
        if (container) container.classList.toggle('hidden', !state.serviceProvidersExpanded);
      });
      actions.insertBefore(toggle, actions.firstChild);
      
      const listContainer = document.createElement('div');
      listContainer.id = 'serviceProvidersContainer';
      listContainer.className = `accordion-animated-container${state.serviceProvidersExpanded ? '' : ' hidden'}`;
      const inner = document.createElement('div');
      inner.className = 'accordion-animation-inner';
      inner.appendChild(renderServiceProviderList());
      listContainer.appendChild(inner);
      els.viewDisplayList.appendChild(listContainer);
    }
  }
}

function renderHomeLimitProviderList() {
  const wrap = document.createElement('div');
  wrap.id = 'homeLimitProviderList';
  wrap.className = 'home-limit-provider-list';
  const hidden = hiddenHomeLimitProviderSet();
  const enabled = enabledLimitProviderSet();
  const providers = limitProviderOrderApi
    .orderedLimitProviders(LIMIT_PROVIDERS, homeLimitProviderOrderValue())
    .filter(({ id }) => enabled.has(id));
  const hasCustomOrder = Boolean(state.settings?.homeLimitProviderOrder);
  const statusLabel = document.createElement('label');
  statusLabel.className = 'checkbox-label home-limit-status-setting';
  const statusInput = document.createElement('input');
  statusInput.type = 'checkbox';
  statusInput.checked = state.settings?.showHomeLimitBars === true;
  const statusText = document.createElement('span');
  statusText.textContent = t('settings.home.showLimitBars');
  statusInput.addEventListener('change', () => void saveSettings({ showHomeLimitBars: statusInput.checked }));
  statusLabel.append(statusInput, statusText);
  const providerNamesLabel = document.createElement('label');
  providerNamesLabel.className = 'checkbox-label home-limit-status-setting';
  const providerNamesInput = document.createElement('input');
  providerNamesInput.type = 'checkbox';
  const providerNamesRequired = state.settings?.showToolIcons === false;
  providerNamesInput.checked = providerNamesRequired || state.settings?.showHomeLimitProviderNames === true;
  providerNamesInput.disabled = providerNamesRequired;
  const providerNamesText = document.createElement('span');
  providerNamesText.textContent = t('settings.home.showLimitProviderNames');
  const providerNamesCopy = document.createElement('span');
  providerNamesCopy.className = 'home-limit-provider-names-copy';
  providerNamesCopy.append(providerNamesText);
  if (providerNamesRequired) {
    const requiredReason = t('settings.home.providerNamesRequiredWithoutIcons');
    const requiredReasonText = document.createElement('span');
    requiredReasonText.id = 'homeLimitProviderNamesReason';
    requiredReasonText.className = 'home-limit-provider-names-reason';
    requiredReasonText.textContent = requiredReason;
    providerNamesCopy.append(requiredReasonText);
    providerNamesLabel.title = requiredReason;
    providerNamesInput.setAttribute('aria-describedby', requiredReasonText.id);
  }
  providerNamesInput.addEventListener('change', async () => {
    await saveSettings({ showHomeLimitProviderNames: providerNamesInput.checked });
    renderHomeIfVisible();
  });
  providerNamesLabel.append(providerNamesInput, providerNamesCopy);
  const countLabel = document.createElement('label');
  countLabel.className = 'settings-item home-limit-account-count-setting';
  const countText = document.createElement('span');
  countText.className = 'settings-item-text';
  const countTitle = document.createElement('span');
  countTitle.className = 'settings-item-title';
  countTitle.textContent = t('settings.home.limitAccountCount');
  countText.append(countTitle);
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.min = '1';
  countInput.max = '12';
  countInput.step = '1';
  countInput.inputMode = 'numeric';
  countInput.value = String(state.settings?.homeLimitAccountCount ?? 3);
  countInput.addEventListener('change', async () => {
    await saveSettings({ homeLimitAccountCount: Number(countInput.value) });
    renderHomeIfVisible();
  });
  countLabel.append(countText, countInput);
  const header = document.createElement('div');
  header.className = 'settings-note-row home-limit-provider-header';
  const note = document.createElement('p');
  note.className = 'settings-note';
  note.textContent = t('settings.home.limitProvidersNote');
  const headerActions = document.createElement('div');
  headerActions.className = 'tool-header-actions';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'tool-header-action';
  reset.textContent = '↺';
  reset.title = t('settings.views.resetOrder');
  reset.setAttribute('aria-label', reset.title);
  reset.disabled = !hasCustomOrder;
  reset.addEventListener('click', () => void resetHomeLimitProviderOrder());
  const showAll = document.createElement('button');
  showAll.type = 'button';
  showAll.className = 'tool-header-action';
  const showAllEye = document.createElement('span');
  showAllEye.className = 'tool-header-eye';
  showAllEye.setAttribute('aria-hidden', 'true');
  showAll.append(showAllEye);
  showAll.title = t('settings.views.showAll');
  showAll.setAttribute('aria-label', showAll.title);
  showAll.disabled = providers.every(({ id }) => !hidden.has(id));
  showAll.addEventListener('click', () => void showAllHomeLimitProviders());
  headerActions.append(reset, showAll);
  header.append(note, headerActions);
  wrap.append(statusLabel, providerNamesLabel, countLabel, header);
  for (const { id, label, settingsLabel } of providers) {
    const isHidden = hidden.has(id);
    const row = document.createElement('div');
    row.className = 'home-limit-provider-row';
    row.dataset.homeLimitProvider = id;
    row.classList.toggle('is-hidden', isHidden);
    const labelGroup = document.createElement('div');
    labelGroup.className = 'tool-preference-label';
    const name = document.createElement('div');
    name.className = 'tool-preference-name';
    name.textContent = settingsLabel || label;
    labelGroup.append(name);
    const visibility = document.createElement('button');
    visibility.type = 'button';
    visibility.className = `tool-visibility-button${isHidden ? ' is-hidden' : ''}`;
    visibility.title = t(isHidden ? 'settings.home.showProvider' : 'settings.home.hideProvider', { name: settingsLabel || label });
    visibility.setAttribute('aria-label', visibility.title);
    visibility.setAttribute('aria-pressed', String(!isHidden));
    visibility.append(visibilityIcon(isHidden));
    visibility.addEventListener('click', () => onHomeLimitProviderVisibilityToggle(id));
    const handle = createPreferenceOrderHandle({ kind: 'homeLimitProvider', id, label: settingsLabel || label, count: providers.length });
    const actions = document.createElement('div');
    actions.className = 'tool-preference-actions';
    actions.append(visibility, handle);
    row.append(labelGroup, actions);
    wrap.append(row);
  }
  return wrap;
}

function renderHomeSettingsList() {
  const wrap = document.createElement('div');
  wrap.id = 'homeSettingsList';
  wrap.className = 'home-settings-list';
  const hidden = hiddenHomeModuleSet();
  const modules = homeModulePreferencesApi.orderedHomeModules(HOME_MODULE_OPTIONS, state.settings?.homeModuleOrder);
  const hasCustomOrder = homeModulePreferencesApi.normalizeHomeModuleOrder(state.settings?.homeModuleOrder, HOME_MODULE_OPTIONS).join(',') !== homeModulePreferencesApi.DEFAULT_HOME_MODULE_ORDER;
  const header = document.createElement('div');
  header.className = 'settings-note-row home-settings-header';
  const note = document.createElement('p');
  note.className = 'settings-note home-settings-note';
  note.textContent = t('settings.views.homeSettingsNote');
  const headerActions = document.createElement('div');
  headerActions.className = 'tool-header-actions';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'tool-header-action';
  reset.textContent = '↺';
  reset.title = t('settings.views.resetOrder');
  reset.setAttribute('aria-label', reset.title);
  reset.disabled = !hasCustomOrder;
  reset.addEventListener('click', () => void resetHomeModuleOrder());
  const showAll = document.createElement('button');
  showAll.type = 'button';
  showAll.className = 'tool-header-action';
  const showAllEye = document.createElement('span');
  showAllEye.className = 'tool-header-eye';
  showAllEye.setAttribute('aria-hidden', 'true');
  showAll.append(showAllEye);
  showAll.title = t('settings.views.showAll');
  showAll.setAttribute('aria-label', showAll.title);
  showAll.disabled = hidden.size === 0;
  showAll.addEventListener('click', () => void showAllHomeModules());
  headerActions.append(reset, showAll);
  header.append(note, headerActions);
  wrap.append(header);
  for (const moduleOption of modules) {
    const id = moduleOption.id;
    const label = t(moduleOption.labelKey);
    const isHidden = hidden.has(id);
    const row = document.createElement('div');
    row.className = 'home-module-preference-row';
    row.dataset.homeModule = id;
    row.classList.toggle('is-hidden', isHidden);
    const name = document.createElement('div');
    name.className = 'tool-preference-name';
    name.textContent = label;
    const actions = document.createElement('div');
    actions.className = 'tool-preference-actions';
    if (id === 'limits' || id === 'trends') {
      const configure = document.createElement('button');
      configure.type = 'button';
      const expanded = id === 'limits' ? state.homeLimitSettingsExpanded : state.homeActivitySettingsExpanded;
      configure.className = `view-subgroup-toggle${expanded ? ' is-expanded' : ''}`;
      configure.title = t(id === 'limits' ? 'settings.home.configureLimits' : 'settings.home.configureActivity');
      configure.setAttribute('aria-label', configure.title);
      configure.setAttribute('aria-expanded', String(Boolean(expanded)));
      const toggleIcon = document.createElement('span');
      toggleIcon.className = 'view-subgroup-icon';
      toggleIcon.setAttribute('aria-hidden', 'true');
      configure.append(toggleIcon);
      configure.addEventListener('click', () => {
        if (id === 'limits') {
          state.homeLimitSettingsExpanded = !state.homeLimitSettingsExpanded;
          configure.classList.toggle('is-expanded', state.homeLimitSettingsExpanded);
          configure.setAttribute('aria-expanded', String(Boolean(state.homeLimitSettingsExpanded)));
          const container = document.getElementById('homeLimitProviderContainer');
          if (container) container.classList.toggle('hidden', !state.homeLimitSettingsExpanded);
          return;
        }
        state.homeActivitySettingsExpanded = !state.homeActivitySettingsExpanded;
        configure.classList.toggle('is-expanded', state.homeActivitySettingsExpanded);
        configure.setAttribute('aria-expanded', String(Boolean(state.homeActivitySettingsExpanded)));
        const container = document.getElementById('homeActivitySettingsContainer');
        if (container) container.classList.toggle('hidden', !state.homeActivitySettingsExpanded);
      });
      actions.append(configure);
    }
    const visibility = document.createElement('button');
    visibility.type = 'button';
    visibility.className = `tool-visibility-button${isHidden ? ' is-hidden' : ''}`;
    visibility.title = t(isHidden ? 'settings.home.showModule' : 'settings.home.hideModule', { name: label });
    visibility.setAttribute('aria-label', visibility.title);
    visibility.setAttribute('aria-pressed', String(!isHidden));
    visibility.append(visibilityIcon(isHidden));
    visibility.addEventListener('click', () => onHomeModuleVisibilityToggle(id));
    const handle = createPreferenceOrderHandle({ kind: 'homeModule', id, label, count: modules.length });
    actions.append(visibility, handle);
    row.append(name, actions);
    wrap.append(row);
    if (id === 'limits') {
      const listContainer = document.createElement('div');
      listContainer.id = 'homeLimitProviderContainer';
      listContainer.className = `accordion-animated-container${state.homeLimitSettingsExpanded ? '' : ' hidden'}`;
      const inner = document.createElement('div');
      inner.className = 'accordion-animation-inner';
      inner.appendChild(renderHomeLimitProviderList());
      listContainer.appendChild(inner);
      wrap.append(listContainer);
    }
    if (id === 'trends') {
      const listContainer = document.createElement('div');
      listContainer.id = 'homeActivitySettingsContainer';
      listContainer.className = `accordion-animated-container${state.homeActivitySettingsExpanded ? '' : ' hidden'}`;
      const inner = document.createElement('div');
      inner.className = 'accordion-animation-inner';
      inner.appendChild(renderHomeActivitySettings());
      listContainer.appendChild(inner);
      wrap.append(listContainer);
    }
  }
  return wrap;
}

function renderHomeActivitySettings() {
  const frag = document.createDocumentFragment();

  const heatmapRow = document.createElement('div');
  heatmapRow.className = 'home-activity-settings';
  const heatmapLabel = document.createElement('span');
  heatmapLabel.textContent = t('settings.home.heatmapColor');
  const heatmapOptions = document.createElement('div');
  heatmapOptions.className = 'inline-options';
  heatmapOptions.setAttribute('role', 'radiogroup');
  heatmapOptions.setAttribute('aria-label', heatmapLabel.textContent);
  const currentMetric = state.settings?.heatmapMetric || 'cost';
  for (const metric of ['tokens', 'cost']) {
    const option = document.createElement('label');
    option.className = 'inline-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'homeHeatmapMetric';
    input.value = metric;
    input.checked = currentMetric === metric;
    input.addEventListener('change', () => {
      if (input.checked) void saveSettings({ heatmapMetric: metric }).then(renderHomeIfVisible);
    });
    const text = document.createElement('span');
    text.textContent = t(metric === 'tokens' ? 'dashboard.heatmap.tokens' : 'dashboard.heatmap.cost');
    option.append(input, text);
    heatmapOptions.append(option);
  }
  heatmapRow.append(heatmapLabel, heatmapOptions);
  frag.append(heatmapRow);

  const daysRow = document.createElement('div');
  daysRow.className = 'home-activity-settings';
  const daysLabel = document.createElement('span');
  daysLabel.textContent = t('settings.home.activeDaysWindow');
  const daysOptions = document.createElement('div');
  daysOptions.className = 'inline-options';
  daysOptions.setAttribute('role', 'radiogroup');
  daysOptions.setAttribute('aria-label', daysLabel.textContent);
  const currentDaysWindow = state.settings?.homeActiveDaysWindow || 'all';
  for (const mode of ['all', 'year']) {
    const option = document.createElement('label');
    option.className = 'inline-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'homeActiveDaysWindow';
    input.value = mode;
    input.checked = currentDaysWindow === mode;
    input.addEventListener('change', () => {
      if (input.checked) void saveSettings({ homeActiveDaysWindow: mode }).then(renderHomeIfVisible);
    });
    const text = document.createElement('span');
    text.textContent = t(`settings.home.activeDaysWindow.${mode}`);
    option.append(input, text);
    daysOptions.append(option);
  }
  daysRow.append(daysLabel, daysOptions);
  frag.append(daysRow);

  return frag;
}

function renderTrendSettingsList() {
  const wrap = document.createElement('div');
  wrap.id = 'trendSettingsList';
  wrap.className = 'trend-settings-list';
  const label = document.createElement('label');
  label.className = 'checkbox-label trend-settings-row';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = state.settings?.historyEnabled !== false;
  const text = document.createElement('span');
  text.textContent = t('settings.views.enableTrend');
  label.append(input, text);
  wrap.append(label);

  const HISTORY_INTERVAL_OPTIONS = [300000, 600000, 900000, 1800000, 3600000];
  const intervalRow = document.createElement('label');
  intervalRow.className = 'status-provider-interval';
  intervalRow.classList.toggle('hidden', !input.checked);
  const intervalLabel = document.createElement('span');
  intervalLabel.textContent = t('settings.views.trendInterval');
  const select = document.createElement('select');
  select.id = 'trendIntervalSelect';
  const currentMs = HISTORY_INTERVAL_OPTIONS.includes(Number(state.settings?.historyIntervalMs)) ? Number(state.settings.historyIntervalMs) : 900000;
  for (const ms of HISTORY_INTERVAL_OPTIONS) {
    const option = document.createElement('option');
    option.value = String(ms);
    option.textContent = t('settings.views.trendIntervalMinutes', { n: ms / 60000 });
    if (ms === currentMs) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener('change', () => void saveSettings({ historyIntervalMs: Number(select.value) }));
  intervalRow.append(intervalLabel, select);
  wrap.append(intervalRow);

  input.addEventListener('change', async () => {
    const enabling = input.checked;
    intervalRow.classList.toggle('hidden', !enabling);
    await setTrendEnabled(enabling);
    state.trendsActivating = enabling;
    renderHomeIfVisible();
  });

  return wrap;
}

function renderProjectSettingsList() {
  const wrap = document.createElement('div');
  wrap.id = 'projectSettingsList';
  wrap.className = 'trend-settings-list';
  const label = document.createElement('label');
  label.className = 'checkbox-label trend-settings-row';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = state.settings?.projectsEnabled !== false;
  const text = document.createElement('span');
  text.textContent = t('settings.views.enableProjects');
  label.append(input, text);
  wrap.append(label);
  input.addEventListener('change', async () => {
    await setProjectsEnabled(input.checked);
    await refreshStats({ force: true });
  });
  return wrap;
}

async function setTrendEnabled(enabled) {
  if (!enabled) {
    await saveSettings({ historyEnabled: enabled });
    return;
  }
  const hidden = hiddenViewSet();
  hidden.delete('trends');
  const nextHiddenViews = Array.from(hidden).join(',');
  await saveSettings({ historyEnabled: enabled, hiddenViews: nextHiddenViews });
}

async function setProjectsEnabled(enabled) {
  if (!enabled) {
    await saveSettings({ projectsEnabled: false });
    return;
  }
  const hidden = hiddenViewSet();
  hidden.delete('project');
  await saveSettings({ projectsEnabled: true, hiddenViews: Array.from(hidden).join(',') });
}

function renderServiceProviderList() {
  const wrap = document.createElement('div');
  wrap.id = 'serviceProviderList';
  wrap.className = 'status-provider-list';
  const hidden = hiddenServiceProviderSet();
  const providers = serviceStatusProviderPreferencesApi.orderedOptions(SERVICE_PROVIDER_OPTIONS, state.settings?.serviceProviderDisplayOrder);
  const hasCustomOrder = serviceStatusProviderPreferencesApi.hasCustomOrder(state.settings?.serviceProviderDisplayOrder);
  const header = document.createElement('div');
  header.className = 'settings-note-row status-provider-header';
  const note = document.createElement('p');
  note.className = 'settings-note';
  note.textContent = t('serviceStatus.providersNote');
  const headerActions = document.createElement('div');
  headerActions.className = 'tool-header-actions';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'tool-header-action';
  reset.textContent = '↺';
  reset.title = t('settings.views.resetOrder');
  reset.setAttribute('aria-label', reset.title);
  reset.disabled = !hasCustomOrder;
  reset.addEventListener('click', () => void resetServiceProviderOrder());
  const showAll = document.createElement('button');
  showAll.type = 'button';
  showAll.className = 'tool-header-action';
  const showAllEye = document.createElement('span');
  showAllEye.className = 'tool-header-eye';
  showAllEye.setAttribute('aria-hidden', 'true');
  showAll.append(showAllEye);
  showAll.title = t('settings.views.showAll');
  showAll.setAttribute('aria-label', showAll.title);
  showAll.disabled = hidden.size === 0;
  showAll.addEventListener('click', () => void showAllServiceProviders());
  headerActions.append(reset, showAll);
  header.append(note, headerActions);
  wrap.append(header);
  const SERVICE_STATUS_REFRESH_OPTIONS = [0, 60000, 120000, 300000, 900000, 1800000];
  const intervalRow = document.createElement('label');
  intervalRow.className = 'status-provider-interval';
  const intervalLabel = document.createElement('span');
  intervalLabel.textContent = t('serviceStatus.refreshEvery');
  const select = document.createElement('select');
  select.id = 'serviceStatusRefreshSelect';
  const currentMs = Number(state.settings?.serviceStatusRefreshMs) || 0;
  for (const ms of SERVICE_STATUS_REFRESH_OPTIONS) {
    const option = document.createElement('option');
    option.value = String(ms);
    option.textContent = ms === 0 ? t('serviceStatus.refreshManual') : t('serviceStatus.refreshMinutes', { n: ms / 60000 });
    if (ms === currentMs) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener('change', () => void saveSettings({ serviceStatusRefreshMs: Number(select.value) }));
  intervalRow.append(intervalLabel, select);
  wrap.append(intervalRow);
  for (const { id, label } of providers) {
    const isHidden = hidden.has(id);
    const row = document.createElement('div');
    row.className = 'status-provider-row';
    row.dataset.statusProvider = id;
    row.classList.toggle('is-hidden', isHidden);
    const name = document.createElement('div');
    name.className = 'tool-preference-name';
    name.textContent = label;
    const visibility = document.createElement('button');
    visibility.type = 'button';
    visibility.className = `tool-visibility-button${isHidden ? ' is-hidden' : ''}`;
    visibility.dataset.statusProvider = id;
    visibility.title = t(isHidden ? 'serviceStatus.showProvider' : 'serviceStatus.hideProvider', { name: label });
    visibility.setAttribute('aria-label', visibility.title);
    visibility.setAttribute('aria-pressed', String(!isHidden));
    visibility.append(visibilityIcon(isHidden));
    visibility.addEventListener('click', () => onServiceProviderVisibilityToggle(id));
    const handle = createPreferenceOrderHandle({ kind: 'statusProvider', id, label, count: providers.length });
    const actions = document.createElement('div');
    actions.className = 'tool-preference-actions';
    actions.append(visibility, handle);
    row.append(name, actions);
    wrap.append(row);
  }
  return wrap;
}

function localDevice() {
  const devices = state.stats?.devices || [];
  const localId = state.settings?.deviceId || '';
  return (localId && devices.find((device) => device.deviceId === localId))
    || (devices.length === 1 ? devices[0] : null);
}

function localClientStatus() {
  return localDevice()?.clientStatus || {};
}

function localWslStatus() {
  return localDevice()?.wslStatus || null;
}

// WSL attribution panel: shows the WSL pipeline state + which tools were detected
// (markers) vs which returned tokens. Windows-only (the whole block hides off-Win).
function renderWslPanel() {
  if (!els.wslScanRow) return;
  const isWin = state.appInfo?.platform === 'win32';
  els.wslScanRow.classList.toggle('hidden', !isWin);
  if (!els.wslPanel) return;
  els.wslPanel.replaceChildren();
  const status = localWslStatus();
  if (!isWin || !status) return;

  const header = document.createElement('div');
  header.className = 'wsl-panel-header';
  const title = document.createElement('span');
  title.className = 'wsl-panel-title';
  title.textContent = t('settings.collection.wslPanel.title');
  // Tone classes are the existing ones: ok (green) / neutral (amber) / muted (grey).
  const tone = (status.state === 'active') ? 'ok'
    : (status.state === 'no-data' || status.state === 'not-running') ? 'neutral'
    : 'muted';
  const stateTag = document.createElement('span');
  stateTag.className = `tool-status-tag tool-status-tag-${tone}`;
  const stateKeyMap = { active: 'active', 'no-data': 'noData', 'not-running': 'notRunning', 'not-installed': 'notInstalled', disabled: 'disabled' };
  stateTag.textContent = t(`settings.collection.wslPanel.${stateKeyMap[status.state] || 'disabled'}`);
  header.append(title, stateTag);
  els.wslPanel.append(header);

  // Tool rows whenever detection found markers (active OR markers-but-no-tokens).
  if ((status.detected || []).length > 0) {
    const withData = new Set(status.withData || []);
    for (const id of status.detected) {
      const row = document.createElement('div');
      row.className = 'wsl-panel-row';
      const name = document.createElement('span');
      name.className = 'wsl-panel-name';
      name.textContent = (clientLabels[id] || id);
      const has = withData.has(id);
      const tag = document.createElement('span');
      tag.className = `tool-status-tag tool-status-tag-${has ? 'ok' : 'neutral'}`;
      tag.textContent = t(has ? 'settings.collection.wslPanel.hasData' : 'settings.collection.wslPanel.noDataTag');
      row.append(name, tag);
      els.wslPanel.append(row);
    }

    if (wslStatusPresentationApi.sqliteHelpClients(status).length > 0) {
      const help = document.createElement('p');
      help.className = 'settings-note wsl-panel-help';
      const message = document.createElement('span');
      message.textContent = t('settings.collection.wslPanel.sqliteHelp');
      const guide = document.createElement('button');
      guide.type = 'button';
      guide.className = 'inline-link';
      guide.textContent = t('settings.collection.wslPanel.setupGuide');
      guide.addEventListener('click', () => window.tokenMonitor.openExternal?.(TOKEN_MONITOR_WSL_SQLITE_GUIDE_URL));
      help.append(message, ' ', guide);
      els.wslPanel.append(help);
    }
  }
}

function renderToolPreferences() {
  if (!els.clientDisplayList) return;
  const enabled = enabledClientSet();
  const hidden = hiddenClientSet();
  const pinned = pinnedClientSet();
  const clientStatus = localClientStatus();
  const clients = clientDisplayPreferencesApi.orderedClients(KNOWN_CLIENTS, state.settings?.clientDisplayOrder, state.settings?.pinnedClients);
  const hasCustomOrder = clientDisplayPreferencesApi.hasCustomDisplayOrder(state.settings?.clientDisplayOrder);
  const hasPinnedClients = pinned.size > 0;
  const hasHiddenClients = hidden.size > 0;
  if (els.resetClientDisplayOrderButton) els.resetClientDisplayOrderButton.disabled = !hasCustomOrder && !hasPinnedClients;
  if (els.showAllClientsButton) els.showAllClientsButton.disabled = !hasHiddenClients;
  els.clientDisplayList.replaceChildren();
  for (const { id, label } of clients) {
    const row = document.createElement('div');
    row.className = 'tool-preference-row';
    row.dataset.client = id;
    const isHidden = hidden.has(id);
    const isPinned = pinned.has(id);
    row.classList.toggle('is-hidden', isHidden);
    row.classList.toggle('is-pinned', isPinned);
    const labelGroup = document.createElement('div');
    labelGroup.className = 'tool-preference-label';
    const name = document.createElement('div');
    name.className = 'tool-preference-name';
    name.textContent = label;
    labelGroup.append(name);
    if (enabled.has(id)) {
      // A tracked client with no reported status yet (first collect still running)
      // reads as "waiting for data" rather than a bare blank.
      const tagInfo = clientStatusPresentationApi.clientStatusTag(id, clientStatus[id] || 'waiting');
      if (tagInfo) {
        const tag = document.createElement('span');
        tag.className = `tool-status-tag tool-status-tag-${tagInfo.tone}`;
        tag.textContent = t(tagInfo.key);
        labelGroup.append(tag);
      }
    }
    const track = document.createElement('label');
    track.className = 'tool-preference-toggle';
    const trackInput = document.createElement('input');
    trackInput.type = 'checkbox';
    trackInput.dataset.client = id;
    trackInput.dataset.preference = 'track';
    trackInput.checked = enabled.has(id);
    trackInput.setAttribute('aria-label', t('settings.tools.trackClient', { name: label }));
    trackInput.addEventListener('change', onToolTrackingToggle);
    track.append(trackInput);
    const visibility = document.createElement('button');
    visibility.type = 'button';
    visibility.className = `tool-visibility-button${isHidden ? ' is-hidden' : ''}`;
    visibility.dataset.client = id;
    visibility.title = t(isHidden ? 'settings.tools.showClient' : 'settings.tools.hideClient', { name: label });
    visibility.setAttribute('aria-label', visibility.title);
    visibility.setAttribute('aria-pressed', String(!isHidden));
    visibility.append(visibilityIcon(isHidden));
    visibility.addEventListener('click', () => onClientVisibilityToggle(id));
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = `tool-pin-button${isPinned ? ' is-pinned' : ''}`;
    pin.dataset.client = id;
    pin.title = t(isPinned ? 'settings.tools.unpinClient' : 'settings.tools.pinClient', { name: label });
    pin.setAttribute('aria-label', pin.title);
    pin.setAttribute('aria-pressed', String(isPinned));
    pin.append(pinIcon());
    pin.addEventListener('click', () => onClientPinnedToggle(id));
    const handle = createPreferenceOrderHandle({ kind: 'client', id, label, count: clients.length });
    const actions = document.createElement('div');
    actions.className = 'tool-preference-actions';
    actions.append(track, visibility, pin, handle);
    row.append(labelGroup, actions);
    els.clientDisplayList.appendChild(row);
  }
}

async function onToolTrackingToggle() {
  const checked = Array.from(els.clientDisplayList.querySelectorAll('input[data-preference="track"]'))
    .filter((cb) => cb.checked)
    .map((cb) => cb.dataset.client);
  await saveSettings({ clients: checked.join(',') });
  await refreshStats({ force: true });
}

async function onClientVisibilityToggle(clientId) {
  const hidden = hiddenClientSet();
  if (hidden.has(clientId)) hidden.delete(clientId);
  else hidden.add(clientId);
  await saveSettings({ hiddenClients: Array.from(hidden).join(',') });
}

async function onClientPinnedToggle(clientId) {
  const next = clientDisplayPreferencesApi.togglePinnedClient(state.settings?.pinnedClients, KNOWN_CLIENTS, clientId);
  await saveSettings({ pinnedClients: next, clientDisplayOrder: '' });
}

async function onViewVisibilityToggle(viewId) {
  const hidden = hiddenViewSet();
  if (hidden.has(viewId)) hidden.delete(viewId);
  else hidden.add(viewId);
  await saveSettings({ hiddenViews: Array.from(hidden).join(',') });
}

async function onTrendVisibilityToggle() {
  if (state.settings?.historyEnabled === false) {
    await setTrendEnabled(true);
    await refreshStats({ force: true });
    return;
  }
  await onViewVisibilityToggle('trends');
}

async function onProjectVisibilityToggle() {
  if (state.settings?.projectsEnabled === false) {
    await setProjectsEnabled(true);
    await refreshStats({ force: true });
    return;
  }
  await onViewVisibilityToggle('project');
}

async function onClientDisplayMove(clientId, direction) {
  const pinned = pinnedClientSet();
  const hasCustomOrder = clientDisplayPreferencesApi.hasCustomDisplayOrder(state.settings?.clientDisplayOrder);
  if (!hasCustomOrder && pinned.has(clientId)) {
    const nextPinned = clientDisplayPreferencesApi.movePinnedClient(state.settings?.pinnedClients, KNOWN_CLIENTS, clientId, direction);
    if (nextPinned !== clientDisplayPreferencesApi.normalizePinnedClients(state.settings?.pinnedClients, KNOWN_CLIENTS)) await saveSettings({ pinnedClients: nextPinned });
    return;
  }
  const next = clientDisplayPreferencesApi.moveClientDisplayOrder(state.settings?.clientDisplayOrder, KNOWN_CLIENTS, clientId, direction);
  await saveSettings({ clientDisplayOrder: next, pinnedClients: '' });
}

async function onClientDisplayReorder(clientId, targetIndex) {
  const pinned = pinnedClientSet();
  const hasCustomOrder = clientDisplayPreferencesApi.hasCustomDisplayOrder(state.settings?.clientDisplayOrder);
  if (!hasCustomOrder && pinned.has(clientId)) {
    const pinnedTargetIndex = Math.max(0, Math.min(pinned.size - 1, Number(targetIndex) || 0));
    const nextPinned = clientDisplayPreferencesApi.reorderPinnedClient(state.settings?.pinnedClients, KNOWN_CLIENTS, clientId, pinnedTargetIndex);
    if (nextPinned !== clientDisplayPreferencesApi.normalizePinnedClients(state.settings?.pinnedClients, KNOWN_CLIENTS)) await saveSettings({ pinnedClients: nextPinned });
    return;
  }
  const current = clientDisplayPreferencesApi.normalizeClientDisplayOrder(state.settings?.clientDisplayOrder, KNOWN_CLIENTS).join(',');
  const next = clientDisplayPreferencesApi.reorderClientDisplayOrder(state.settings?.clientDisplayOrder, KNOWN_CLIENTS, clientId, targetIndex);
  if (next === current) return;
  await saveSettings({ clientDisplayOrder: next, pinnedClients: '' });
}

async function onViewDisplayMove(viewId, direction) {
  const next = viewDisplayPreferencesApi.moveViewDisplayOrder(effectiveViewDisplayOrderValue(), VIEW_DISPLAY_OPTIONS, viewId, direction);
  await saveSettings({ viewDisplayOrder: next });
}

async function onViewDisplayReorder(viewId, targetIndex) {
  const orderValue = effectiveViewDisplayOrderValue();
  const current = viewDisplayPreferencesApi.normalizeViewDisplayOrder(orderValue, VIEW_DISPLAY_OPTIONS).join(',');
  const next = viewDisplayPreferencesApi.reorderViewDisplayOrder(orderValue, VIEW_DISPLAY_OPTIONS, viewId, targetIndex);
  if (next === current) return;
  await saveSettings({ viewDisplayOrder: next });
}

async function onHomeModuleVisibilityToggle(moduleId) {
  const hidden = hiddenHomeModuleSet();
  if (hidden.has(moduleId)) hidden.delete(moduleId);
  else hidden.add(moduleId);
  await saveSettings({ hiddenHomeModules: Array.from(hidden).join(',') });
  renderHomeIfVisible();
}

async function onHomeModuleMove(moduleId, direction) {
  const next = homeModulePreferencesApi.moveHomeModuleOrder(state.settings?.homeModuleOrder, HOME_MODULE_OPTIONS, moduleId, direction);
  await saveSettings({ homeModuleOrder: next });
  renderHomeIfVisible();
}

async function onHomeModuleReorder(moduleId, targetIndex) {
  const current = homeModulePreferencesApi.normalizeHomeModuleOrder(state.settings?.homeModuleOrder, HOME_MODULE_OPTIONS).join(',');
  const next = homeModulePreferencesApi.reorderHomeModuleOrder(state.settings?.homeModuleOrder, HOME_MODULE_OPTIONS, moduleId, targetIndex);
  if (next === current) return;
  await saveSettings({ homeModuleOrder: next });
  renderHomeIfVisible();
}

async function resetHomeModuleOrder() {
  await saveSettings({ homeModuleOrder: homeModulePreferencesApi.DEFAULT_HOME_MODULE_ORDER });
  renderHomeIfVisible();
}

async function showAllHomeModules() {
  await saveSettings({ hiddenHomeModules: '' });
  renderHomeIfVisible();
}

function hiddenServiceProviderSet() {
  return new Set(serviceStatusProviderPreferencesApi.normalizeHidden(state.settings?.hiddenServiceProviders, SERVICE_PROVIDER_OPTIONS).split(',').filter(Boolean));
}

async function onServiceProviderVisibilityToggle(providerId) {
  const hidden = hiddenServiceProviderSet();
  if (hidden.has(providerId)) hidden.delete(providerId);
  else hidden.add(providerId);
  await saveSettings({ hiddenServiceProviders: Array.from(hidden).join(',') });
}

async function onServiceProviderMove(providerId, direction) {
  const next = serviceStatusProviderPreferencesApi.moveOrder(state.settings?.serviceProviderDisplayOrder, SERVICE_PROVIDER_OPTIONS, providerId, direction);
  await saveSettings({ serviceProviderDisplayOrder: next });
}

async function onServiceProviderReorder(providerId, targetIndex) {
  const current = serviceStatusProviderPreferencesApi.normalizeOrder(state.settings?.serviceProviderDisplayOrder, SERVICE_PROVIDER_OPTIONS).join(',');
  const next = serviceStatusProviderPreferencesApi.reorderOrder(state.settings?.serviceProviderDisplayOrder, SERVICE_PROVIDER_OPTIONS, providerId, targetIndex);
  if (next === current) return;
  await saveSettings({ serviceProviderDisplayOrder: next });
}

async function onHomeLimitProviderVisibilityToggle(providerId) {
  const hidden = hiddenHomeLimitProviderSet();
  if (hidden.has(providerId)) hidden.delete(providerId);
  else hidden.add(providerId);
  await saveSettings({ hiddenHomeLimitProviders: Array.from(hidden).join(',') });
  renderHomeIfVisible();
}

async function onHomeLimitProviderMove(providerId, direction) {
  const next = limitProviderOrderApi.moveLimitProvider(homeLimitProviderOrderValue(), LIMIT_PROVIDERS, providerId, direction);
  await saveSettings({ homeLimitProviderOrder: next });
  renderHomeIfVisible();
}

async function onHomeLimitProviderReorder(providerId, targetIndex) {
  const current = limitProviderOrderApi.normalizeLimitProviderOrder(homeLimitProviderOrderValue(), LIMIT_PROVIDERS).join(',');
  const next = limitProviderOrderApi.reorderLimitProvider(homeLimitProviderOrderValue(), LIMIT_PROVIDERS, providerId, targetIndex);
  if (next === current) return;
  await saveSettings({ homeLimitProviderOrder: next });
  renderHomeIfVisible();
}

async function resetHomeLimitProviderOrder() {
  await saveSettings({ homeLimitProviderOrder: '' });
  renderHomeIfVisible();
}

async function showAllHomeLimitProviders() {
  await saveSettings({ hiddenHomeLimitProviders: '' });
  renderHomeIfVisible();
}

async function resetServiceProviderOrder() {
  await saveSettings({ serviceProviderDisplayOrder: '' });
}

async function showAllServiceProviders() {
  await saveSettings({ hiddenServiceProviders: '' });
}

async function onPreferenceReorder(kind, id, targetIndex) {
  if (kind === 'client') await onClientDisplayReorder(id, targetIndex);
  else if (kind === 'view') await onViewDisplayReorder(id, targetIndex);
  else if (kind === 'homeModule') await onHomeModuleReorder(id, targetIndex);
  else if (kind === 'homeLimitProvider') await onHomeLimitProviderReorder(id, targetIndex);
  else if (kind === 'statusProvider') await onServiceProviderReorder(id, targetIndex);
}

async function onPreferenceOrderCommit(kind, order, id) {
  const value = (order || []).join(',');
  if (kind === 'client') {
    const pinned = clientDisplayPreferencesApi.normalizePinnedClients(state.settings?.pinnedClients, KNOWN_CLIENTS).split(',').filter(Boolean);
    const hasCustomOrder = clientDisplayPreferencesApi.hasCustomDisplayOrder(state.settings?.clientDisplayOrder);
    if (!hasCustomOrder && pinned.includes(id)) {
      const pinnedSet = new Set(pinned);
      const nextPinned = (order || []).slice(0, pinned.length);
      if (nextPinned.length === pinned.length && nextPinned.every((clientId) => pinnedSet.has(clientId))) {
        const pinnedValue = nextPinned.join(',');
        if (pinnedValue !== pinned.join(',')) await saveSettings({ pinnedClients: pinnedValue });
        return;
      }
    }
    const current = clientDisplayPreferencesApi.normalizeClientDisplayOrder(state.settings?.clientDisplayOrder, KNOWN_CLIENTS).join(',');
    if (value !== current || pinned.length > 0) await saveSettings({ clientDisplayOrder: value, pinnedClients: '' });
    return;
  }
  if (kind === 'view') {
    const current = viewDisplayPreferencesApi.normalizeViewDisplayOrder(effectiveViewDisplayOrderValue(), VIEW_DISPLAY_OPTIONS).join(',');
    if (value !== current) await saveSettings({ viewDisplayOrder: value });
    return;
  }
  if (kind === 'homeModule') {
    const current = homeModulePreferencesApi.normalizeHomeModuleOrder(state.settings?.homeModuleOrder, HOME_MODULE_OPTIONS).join(',');
    if (value !== current) await saveSettings({ homeModuleOrder: value });
    return;
  }
  if (kind === 'homeLimitProvider') {
    const current = limitProviderOrderApi.normalizeLimitProviderOrder(homeLimitProviderOrderValue(), LIMIT_PROVIDERS).join(',');
    if (value !== current) await saveSettings({ homeLimitProviderOrder: value });
    return;
  }
  if (kind === 'statusProvider') {
    const current = serviceStatusProviderPreferencesApi.normalizeOrder(state.settings?.serviceProviderDisplayOrder, SERVICE_PROVIDER_OPTIONS).join(',');
    if (value !== current) await saveSettings({ serviceProviderDisplayOrder: value });
    return;
  }
}

function onPreferenceOrderKeydown(event, kind, id) {
  const moves = { ArrowUp: 'up', ArrowDown: 'down' };
  if (moves[event.key]) {
    event.preventDefault();
    if (kind === 'client') void onClientDisplayMove(id, moves[event.key]);
    else if (kind === 'view') void onViewDisplayMove(id, moves[event.key]);
    else if (kind === 'homeModule') void onHomeModuleMove(id, moves[event.key]);
    else if (kind === 'homeLimitProvider') void onHomeLimitProviderMove(id, moves[event.key]);
    else if (kind === 'statusProvider') void onServiceProviderMove(id, moves[event.key]);
    return;
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    const targetIndex = event.key === 'Home' ? 0 : Number.MAX_SAFE_INTEGER;
    void onPreferenceReorder(kind, id, targetIndex);
  }
}

async function resetClientDisplayOrder() {
  await saveSettings({ clientDisplayOrder: '', pinnedClients: '' });
}

async function showAllClients() {
  await saveSettings({ hiddenClients: '' });
}

async function resetViewDisplayOrder() {
  await saveSettings({ viewDisplayOrder: '' });
}

async function showAllViews() {
  await saveSettings({ hiddenViews: '' });
}

function preserveSettingsPanelScroll(callback) {
  const panel = els.settingsPanel;
  if (!panel || panel.classList.contains('hidden')) return callback();
  const scrollTop = panel.scrollTop;
  const scrollLeft = panel.scrollLeft;
  const restore = () => {
    panel.scrollTop = scrollTop;
    panel.scrollLeft = scrollLeft;
  };
  const result = callback();
  restore();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
  return result;
}

async function saveSettings(patch) {
  try {
    state.settings = await window.tokenMonitor.updateSettings(patch);
  } catch (error) {
    console.error('Could not persist settings:', error);
    try { state.settings = await window.tokenMonitor.getSettings(); } catch (_) {}
    applyEffectiveCurrencyRates();
    preserveSettingsPanelScroll(syncSettingsForm);
    restartTimer();
    maybeUpdateBarsIcon();
    throw error;
  }
  applyEffectiveCurrencyRates();
  preserveSettingsPanelScroll(syncSettingsForm);
  restartTimer();
  maybeUpdateBarsIcon();
  if (patch.showTrayProviderBadge !== undefined) {
    await deliverTrayProviderIcons(patch.showTrayProviderBadge === true);
  }
  return true;
}

function renderHomeIfVisible() {
  if (state.breakdown === 'home' && state.stats) render();
}

function updateTitleFit() {
  const measure = document.querySelector('.app-title-measure');
  const container = document.querySelector('.app-title');
  if (!measure || !container) return;
  if (state.settings?.titleIconOnly || els.shell.classList.contains('title-icon-only')) {
    els.shell.classList.remove('title-collapsed');
    return;
  }
  const dotSpace = (els.liveDot?.offsetWidth || 4) + 5;
  // 4px buffer so the swap happens just before clipping would visibly start.
  const collapse = measure.scrollWidth + 4 > container.clientWidth - dotSpace;
  els.shell.classList.toggle('title-collapsed', collapse);
}

if (typeof ResizeObserver === 'function') {
  const tb = document.querySelector('.titlebar');
  if (tb) new ResizeObserver(updateTitleFit).observe(tb);
}

els.viewSwitcher?.addEventListener('pointerenter', clearViewSwitcherHoverClose);
els.viewSwitcher?.addEventListener('pointerleave', scheduleViewSwitcherHoverClose);
els.backHomeButton?.addEventListener('click', (event) => {
  if (state.viewSwitcherOpen) setViewSwitcherOpen(false);
  if (!renderBreakdownChange('home')) return;
  if (event.detail === 0) {
    requestAnimationFrame(() => els.viewSwitcher?.querySelector('.view-switcher-current')?.focus());
  }
});

window.addEventListener('blur', () => {
  clearViewSwitcherLongPress();
  clearViewSwitcherHoverClose();
  viewSwitcherLongPressTriggered = false;
  if (state.viewSwitcherOpen) setViewSwitcherOpen(false);
});

async function init() {
  try { state.appInfo = await window.tokenMonitor.getAppInfo?.(); } catch (_) {}
  if (els.aboutVersion) els.aboutVersion.textContent = state.appInfo?.version ? `v${state.appInfo.version}` : '—';
  state.settings = await window.tokenMonitor.getSettings();
  applyEffectiveCurrencyRates();
  deliverTrayProviderIcons();

  state.appUpdate = await window.tokenMonitor.getAppUpdateState();
  renderAppUpdatePill();
  renderSettingsAppUpdateRow();
  window.tokenMonitor.onAppUpdatePush?.((payload) => {
    state.appUpdate = payload;
    renderAppUpdatePill();
    renderSettingsAppUpdateRow();
    renderAutomaticAppUpdateControl();
    if (els.appUpdatePopover.matches(':popover-open')) renderAppUpdatePopover(payload);
  });
  if (state.appInfo?.loginItemSupported) {
    state.settings.startAtLogin = Boolean(state.appInfo.loginItemOpenAtLogin);
  }
  syncSettingsForm();
  await refreshHubAccounts();
  publishViewState();
  await refreshTokscaleStatus();
  restartTimer();
  try {
    const status = await window.tokenMonitor.getStreamStatus?.();
    if (status) {
      state.streamConnected = Boolean(status.connected);
      state.mode = status.mode || state.mode;
      state.syncHealth = status.health || state.syncHealth;
      state.streamFailure = status.connected ? null : (status.reason ? { reason: status.reason, detail: status.detail ?? null } : null);
      setLiveDot(state.streamConnected);
      renderSyncClientStatus();
    }
  } catch (_) {}
  try {
    state.syncHealth = await window.tokenMonitor.getSyncHealth?.() || state.syncHealth;
    renderSyncHealthStatus();
  } catch (_) {}
  await refreshStats();
  restartTimer();
  updateTitleFit();
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    if (state.customRangeOpen) setCustomRangeOpen(false);
    const snapshot = captureBreakdownMotion();
    if (!setPeriod(tab.dataset.period)) return;
    syncPeriodTabs();
    if (state.openSession) openSessionDetail(state.openSession);
    state.rowSignature = '';
    state.periodMotionActive = true;
    render();
    state.periodMotionActive = false;
    animateBreakdownFrom(snapshot, { duration: 800 });
  });
}

els.breakdown.addEventListener('click', (event) => {
  if (state.breakdown !== 'session') return;
  const rowEl = event.target.closest('.row');
  if (!rowEl) return;
  const key = rowEl.dataset.key || '';            // "session:<client>:<sessionId>"
  const client = rowEl.dataset.client || '';
  if (client !== 'claude' && client !== 'claude-desktop' && client !== 'codex' && client !== 'opencode') return;
  const match = key.match(/^session:([^:]+):(.+)$/);
  if (!match) return;
  const sessionId = match[2];
  const period = state.stats?.periods?.[state.period];
  const session = period?.sessions?.[`${client}:${sessionId}`];
  openSessionDetail({
    client,
    sessionId,
    sessionCost: Number(session?.costUsd || 0),
    title: rowEl.querySelector('.row-title')?.textContent || ''
  });
});

els.pinButton.addEventListener('click', () => {
  saveSettings({ windowBehavior: nextWindowBehavior(currentWindowBehavior()) });
});
els.settingsButton.addEventListener('click', (event) => {
  if (state.viewSwitcherOpen) setViewSwitcherOpen(false);
  els.settingsPanel.classList.toggle('hidden');
  const settingsOpen = !els.settingsPanel.classList.contains('hidden');
  if (!settingsOpen) stopWindowShortcutRecording();
  els.shell.classList.toggle('settings-open', settingsOpen);
  if (!settingsOpen && state.breakdown === 'home') {
    els.homePanel.scrollTop = 0;
    state.homeScrollResetPending = false;
  }
  if (!settingsOpen && event.detail > 0) els.settingsButton.blur();
  els.shell.style.transform = 'translateZ(0)';
  requestAnimationFrame(() => { els.shell.style.transform = ''; });
});
els.saveSettingsButton.addEventListener('click', async () => {
  const patch = {
    hubUrl: els.hubUrlInput.value.trim(),
    secret: els.secretInput.value,
    allowInsecureHubHttp: Boolean(els.allowInsecureHubHttpInput?.checked),
    deviceId: els.deviceIdInput.value.trim()
  };
  try {
    await saveSettings(patch);
    await refreshHubAccounts();
    await refreshStats();
  } catch (error) {
    if (els.syncClientStatus) {
      els.syncClientStatus.textContent = error?.message || String(error);
      els.syncClientStatus.className = 'hub-status error';
      els.syncClientStatus.classList.remove('hidden');
    }
  }
});

els.hubModeOptions.addEventListener('change', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.name !== 'hubMode') return;
  await saveSettings({ hubMode: target.value });
  await refreshHubAccounts();
  await refreshStats();
});

els.languageInput?.addEventListener('change', async () => {
  await saveSettings({ language: els.languageInput.value });
});

els.currencyInput?.addEventListener('change', async () => {
  await saveSettings({ currency: els.currencyInput.value });
});

els.currencyRateModeAuto?.addEventListener('change', async () => {
  if (!els.currencyRateModeAuto.checked) return;
  const code = currentCurrency();
  if (code === 'USD') return;
  const next = { ...(state.settings?.currencyRates || {}) };
  delete next[code];                       // auto = no override
  await saveSettings({ currencyRates: next });
});

els.currencyRateModeManual?.addEventListener('change', async () => {
  if (!els.currencyRateModeManual.checked) return;
  const code = currentCurrency();
  if (code === 'USD') return;
  const current = Number(state.settings?.currencyRatesEffective?.[code]);  // seed with the live rate
  const seed = Number(formatRate(current)) || 1;                            // stored == what's shown
  await saveSettings({ currencyRates: { ...(state.settings?.currencyRates || {}), [code]: seed } });
  els.currencyRateOverrideInput?.focus();
});

els.currencyRateOverrideInput?.addEventListener('change', async () => {
  const code = currentCurrency();
  if (code === 'USD') return;
  const next = { ...(state.settings?.currencyRates || {}) };
  const num = Number(els.currencyRateOverrideInput.value);
  if (Number.isFinite(num) && num > 0) next[code] = num;
  else delete next[code];                  // cleared/invalid -> revert to auto
  await saveSettings({ currencyRates: next });
});

els.secretPasteButton?.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      els.secretInput.value = text.trim();
    }
  } catch (_) {}
});
els.showLimitSourceInput.addEventListener('change', async () => {
  await saveSettings({ showLimitSource: els.showLimitSourceInput.checked });
});
els.maskLimitAccountEmailsInput.addEventListener('change', async () => {
  await saveSettings({ maskLimitAccountEmails: els.maskLimitAccountEmailsInput.checked });
  renderLimits();
});
els.showLimitUsedInput.addEventListener('change', async () => {
  await saveSettings({ showLimitUsed: els.showLimitUsedInput.value === 'used' });
});
els.syncUploadIntervalInput?.addEventListener('change', async () => {
  await saveSettings({ syncUploadIntervalMs: Number(els.syncUploadIntervalInput.value) });
});
els.collectionCadenceInput?.addEventListener('change', async () => {
  const value = els.collectionCadenceInput.value;
  await saveSettings({
    collectionMode: value === 'live' ? 'live' : 'interval',
    collectionIntervalMs: value === 'live' ? Number(state.settings.collectionIntervalMs || 300000) : Number(value)
  });
});
els.sessionUsageArchiveInput?.addEventListener('change', async () => {
  await saveSettings({ sessionUsageArchiveEnabled: els.sessionUsageArchiveInput.checked });
});
els.clearSessionUsageArchiveButton?.addEventListener('click', async () => {
  if (!window.confirm(t('settings.collection.sessionArchiveConfirm'))) return;
  els.clearSessionUsageArchiveButton.disabled = true;
  try {
    const result = await window.tokenMonitor.clearSessionUsageArchive();
    if (!result?.ok) {
      window.alert(t(result?.error === 'agentActive'
        ? 'settings.collection.sessionArchiveAgentActive'
        : 'settings.collection.sessionArchiveFailed'));
      return;
    }
    await refreshStats();
  } finally {
    els.clearSessionUsageArchiveButton.disabled = false;
  }
});
els.wslScanInput?.addEventListener('change', async () => {
  await saveSettings({ wslScanEnabled: els.wslScanInput.checked });
});
els.exportAutoInput?.addEventListener('change', async () => {
  await saveSettings({ exportAutoEnabled: els.exportAutoInput.checked });
});
els.exportPickDirButton?.addEventListener('click', async () => {
  const result = await window.tokenMonitor.pickExportDir();
  if (result?.ok) await saveSettings({ exportDir: result.dir });
});
els.exportIntervalInput?.addEventListener('change', async () => {
  await saveSettings({ exportIntervalMs: Number(els.exportIntervalInput.value) });
});
els.exportNowButton?.addEventListener('click', async () => {
  els.exportNowButton.disabled = true;
  try {
    const result = await window.tokenMonitor.exportNow();
    if (result?.ok) {
      els.exportNowButton.textContent = t('settings.export.manualDone');
      setTimeout(() => { els.exportNowButton.textContent = t('settings.export.manualNow'); }, 1600);
    } else if (result && !result.canceled) {
      els.exportNowButton.textContent = t('settings.export.manualFailed');
      setTimeout(() => { els.exportNowButton.textContent = t('settings.export.manualNow'); }, 1600);
    }
  } finally {
    els.exportNowButton.disabled = false;
  }
});
els.resetClientDisplayOrderButton?.addEventListener('click', resetClientDisplayOrder);
els.showAllClientsButton?.addEventListener('click', showAllClients);
els.resetViewDisplayOrderButton?.addEventListener('click', resetViewDisplayOrder);
els.showAllViewsButton?.addEventListener('click', showAllViews);
els.resetGlassButton.addEventListener('click', async () => {
  els.glassInput.value = String(defaultAppearance.glassOpacity);
  applyAppearanceFromControls();
  await saveSettings({ glassOpacity: defaultAppearance.glassOpacity });
});
els.resetDepthButton.addEventListener('click', async () => {
  els.blurInput.value = String(defaultAppearance.glassBlur);
  applyAppearanceFromControls();
  await saveSettings({ glassBlur: defaultAppearance.glassBlur });
});
els.glassInput.addEventListener('input', applyAppearanceFromControls);
els.blurInput.addEventListener('input', applyAppearanceFromControls);
els.zoomInput.addEventListener('input', applyAppearanceFromControls);
els.glassInput.addEventListener('change', saveAppearanceFromControls);
els.blurInput.addEventListener('change', saveAppearanceFromControls);
els.zoomInput.addEventListener('change', saveAppearanceFromControls);
els.resetThemeColorsButton?.addEventListener('click', () => commitThemeColors({}));
els.resetVendorColorsButton?.addEventListener('click', () => commitVendorColors({}));
els.applyThemeCodeButton?.addEventListener('click', () => { void pasteAndApplyThemeCode(); });
els.copyThemeCodeButton?.addEventListener('click', () => { void copyCurrentThemeCode(); });
els.themeCodeInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  void applyThemeCodeFromInput();
});
els.themeCodeInput?.addEventListener('input', invalidateThemeCodeFeedback);
function setupThemeAccordion(group, toggle, details) {
  if (!group || !toggle || !details) return;
  const setExpanded = (expanded) => {
    const open = Boolean(expanded);
    toggle.setAttribute('aria-expanded', String(open));
    details.classList.toggle('hidden', !open);
    details.inert = !open;
    group.classList.toggle('expanded', open);
  };
  toggle.addEventListener('click', () => setExpanded(details.classList.contains('hidden')));
  setExpanded(false);
}

setupThemeAccordion(els.themeAdvancedGroup, els.themeAdvancedToggle, els.themeAdvancedDetails);
setupThemeAccordion(els.themeVendorGroup, els.themeVendorToggle, els.themeVendorDetails);
for (const input of els.systemGlassInputs || []) {
  input.addEventListener('change', () => {
    if (input.checked) saveAppearanceFromControls();
  });
}
els.macosGlassInput?.addEventListener('change', saveAppearanceFromControls);
for (const input of els.reduceMotionInputs || []) {
  input.addEventListener('change', async () => {
    if (!input.checked) return;
    state.settings.reduceMotion = applyReduceMotionPreference(input.value);
    await saveAppearanceFromControls();
  });
}
els.liveDotInput.addEventListener('change', saveAppearanceFromControls);
els.toolIconsInput.addEventListener('change', async () => {
  state.settings.showToolIcons = els.toolIconsInput.checked;
  renderHomeIfVisible();
  await saveAppearanceFromControls();
});
els.titleIconInput.addEventListener('change', saveAppearanceFromControls);
els.showCompactTotalTokensInput.addEventListener('change', async () => {
  await saveAppearanceFromControls();
  if (!numberAnimHandle) updateTotalCompact(state.currentTotal);
});
window.addEventListener('resize', () => { if (!numberAnimHandle) fitTotalNumber(); });
els.swapSettingsRefreshInput.addEventListener('change', () => {
  applyControlLayout(els.swapSettingsRefreshInput.checked);
  void saveAppearanceFromControls();
});
els.discordRpcInput.addEventListener('change', saveAppearanceFromControls);
els.windowBehaviorInput.addEventListener('change', () => saveSettings({ windowBehavior: els.windowBehaviorInput.value }));
els.floatingBubbleInput.addEventListener('change', () => {
  els.floatingBubbleOptions?.classList.toggle('hidden', !els.floatingBubbleInput.checked);
  saveSettings({ floatingBubbleEnabled: els.floatingBubbleInput.checked });
});
els.floatingBubbleTriggerInput?.addEventListener('change', () => saveSettings({ floatingBubbleTrigger: els.floatingBubbleTriggerInput.value }));
els.floatingBubbleContentInput?.addEventListener('change', async () => {
  state.settings.floatingBubbleContent = els.floatingBubbleContentInput.value;
  syncTrayComposerVisibility();
  await saveSettings({ floatingBubbleContent: els.floatingBubbleContentInput.value });
  renderFloatingBubbleContent();
});
els.showTrayIconInput?.addEventListener('change', () => {
  const showTrayIcon = els.showTrayIconInput.checked;
  els.trayModeInput.disabled = !showTrayIcon;
  if (!showTrayIcon) els.trayModeInput.checked = false;
  els.trayContentInput.disabled = !showTrayIcon;
  els.showTrayProviderBadgeInput.disabled = !showTrayIcon;
  if (els.closeToTrayInput) {
    els.closeToTrayInput.disabled = !showTrayIcon;
    if (!showTrayIcon) els.closeToTrayInput.checked = false;
  }
  els.trayIconOptions?.classList.toggle('hidden', !showTrayIcon);
  els.trayOptions?.classList.toggle('hidden', !showTrayIcon || !els.trayModeInput.checked);
  saveSettings({ showTrayIcon, trayMode: showTrayIcon ? els.trayModeInput.checked : false });
});
els.trayModeInput.addEventListener('change', () => {
  els.trayOptions?.classList.toggle('hidden', !els.showTrayIconInput?.checked || !els.trayModeInput.checked);
  saveSettings({ trayMode: els.trayModeInput.checked });
});
els.trayContentInput.addEventListener('change', () => {
  state.settings.trayContent = els.trayContentInput.value;
  syncTrayComposerVisibility();
  saveSettings({ trayContent: els.trayContentInput.value });
});
els.showTrayProviderBadgeInput.addEventListener('change', () => saveSettings({ showTrayProviderBadge: els.showTrayProviderBadgeInput.checked }));
els.windowToggleShortcutValue?.addEventListener('click', startWindowShortcutRecording);
els.windowToggleShortcutClearButton?.addEventListener('click', () => setWindowToggleShortcut('').catch(() => {}));
els.startAtLoginInput?.addEventListener('change', () => saveSettings({ startAtLogin: els.startAtLoginInput.checked }));
els.startInTrayInput?.addEventListener('change', () => saveSettings({ startInTray: els.startInTrayInput.checked }));
els.closeToTrayInput?.addEventListener('change', () => saveSettings({ closeToTray: els.closeToTrayInput.checked }));
els.automaticAppUpdatesInput?.addEventListener('change', () => saveSettings({ automaticAppUpdates: els.automaticAppUpdatesInput.checked }));
// Glass and Depth controls were removed from the Windows appearance panel;
// keep this legacy reset binding optional so a missing optional control cannot
// abort the entire renderer bootstrap.
els.resetZoomButton?.addEventListener('click', async () => {
  els.zoomInput.value = String(Math.round(defaultAppearance.zoomFactor * 100));
  syncSliderRow(els.zoomInput);
  await saveSettings({ zoomFactor: defaultAppearance.zoomFactor });
});
els.openConfigButton.addEventListener('click', () => window.tokenMonitor.openUserData());
els.checkTokscaleButton?.addEventListener('click', checkTokscaleNpm);
els.downloadTokscaleButton?.addEventListener('click', downloadTokscaleFromNpm);
els.resetTokscaleButton?.addEventListener('click', resetTokscaleToBundled);
els.openTokscaleLinkButton?.addEventListener('click', () => window.tokenMonitor.openExternal?.('https://github.com/junhoyeo/tokscale'));
els.openRepositoryButton?.addEventListener('click', () => window.tokenMonitor.openExternal?.(TOKEN_MONITOR_REPOSITORY_URL));
els.reportIssueButton?.addEventListener('click', () => window.tokenMonitor.openExternal?.(TOKEN_MONITOR_ISSUES_URL));
els.refreshButton.addEventListener('click', () => {
  if (state.breakdown === 'status') refreshStatusViewManually().catch(() => {});
  // Only this button asks for a history rescan: `{ force: true }` is used all over the
  // settings/account flows, and folding history into it would re-run the expensive
  // `tokscale graph` on every one of them.
  else refreshStats({ force: true, forceHistory: true, recover: true, feedback: true });
});
els.minButton.addEventListener('click', () => window.tokenMonitor.minimize());
els.closeButton.addEventListener('click', () => window.tokenMonitor.close());
els.trendsPanel.addEventListener('click', (event) => {
  if (event.target.closest('.trends-spark, .trends-open-hint')) window.tokenMonitor.openDashboard();
});
els.trendsPanel.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('.trends-spark')) {
    event.preventDefault();
    window.tokenMonitor.openDashboard();
  }
});
els.floatingBubbleTab.addEventListener('pointerdown', handleFloatingBubblePointerDown);
els.floatingBubbleTab.addEventListener('pointermove', handleFloatingBubblePointerMove);
els.floatingBubbleTab.addEventListener('pointerup', handleFloatingBubblePointerUp);
els.floatingBubbleTab.addEventListener('pointercancel', (event) => { finishFloatingBubbleDrag(event.pointerId); });
els.floatingBubbleTab.addEventListener('mouseenter', handleFloatingBubbleHoverEnter);
els.floatingBubbleTab.addEventListener('mouseleave', handleFloatingBubbleHoverLeave);
document.documentElement.addEventListener('mouseleave', handleDocumentHoverLeave);
document.documentElement.addEventListener('mouseenter', clearHoverCollapseTimer);
els.floatingBubbleTab.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  window.tokenMonitor.expandFloatingBubble?.();
});

async function runAppUpdateAction() {
  const mode = appUpdateActionMode(state.appUpdate);
  if (mode === 'install') {
    state.appUpdate = await window.tokenMonitor.installAppUpdate();
  } else if (mode === 'download') {
    state.appUpdate = await window.tokenMonitor.downloadAppUpdate();
  } else if (mode === 'release') {
    const latest = state.appUpdate?.latest;
    if (!latest?.htmlUrl) return;
    await window.tokenMonitor.openExternal(latest.htmlUrl);
  } else {
    return;
  }
  renderAppUpdatePill();
  renderSettingsAppUpdateRow();
}

els.appUpdatePillAction.addEventListener('click', async () => {
  if (!renderAppUpdatePopover(state.appUpdate) || typeof els.appUpdatePopover.showPopover !== 'function') {
    if (appUpdateActionMode(state.appUpdate) === 'install') {
      const url = state.appUpdate?.latest?.htmlUrl;
      if (url) await window.tokenMonitor.openExternal(url);
      return;
    }
    await runAppUpdateAction();
    return;
  }
  positionAppUpdatePopover();
  els.appUpdatePopover.showPopover();
  els.appUpdatePopoverAction.focus();
});

els.appUpdatePillRestart.addEventListener('click', async () => {
  await runAppUpdateAction();
});

els.appUpdatePillDismiss.addEventListener('click', async () => {
  const version = state.appUpdate?.latest?.version;
  if (!version) return;
  state.appUpdate = await window.tokenMonitor.dismissAppUpdate(version);
  if (els.appUpdatePopover.matches(':popover-open')) els.appUpdatePopover.hidePopover();
  renderAppUpdatePill();
});

els.appUpdatePopoverClose.addEventListener('click', () => {
  els.appUpdatePopover.hidePopover();
});

els.appUpdatePopover.addEventListener('toggle', (event) => {
  const open = event.newState === 'open';
  if (els.appUpdatePillAction.hasAttribute('aria-haspopup')) {
    els.appUpdatePillAction.setAttribute('aria-expanded', String(open));
  }
  if (!open) {
    const active = document.activeElement;
    if (active === document.body || active === els.appUpdatePopover || els.appUpdatePopover.contains(active)) {
      els.appUpdatePillAction.focus();
    }
  }
});

els.appUpdatePopoverAction.addEventListener('click', async () => {
  els.appUpdatePopover.hidePopover();
  await runAppUpdateAction();
});

els.appUpdatePopoverRelease.addEventListener('click', async () => {
  const url = state.appUpdate?.latest?.htmlUrl;
  if (url) await window.tokenMonitor.openExternal(url);
});

window.addEventListener('resize', () => {
  if (els.appUpdatePopover.matches(':popover-open')) positionAppUpdatePopover();
});

els.appUpdateCheckButton.addEventListener('click', async () => {
  state.appUpdate = await window.tokenMonitor.checkAppUpdateNow();
  renderAppUpdatePill();
  renderSettingsAppUpdateRow();
});

els.appUpdateViewReleaseButton.addEventListener('click', async () => {
  await runAppUpdateAction();
});

els.appUpdateReleaseNotesButton.addEventListener('click', async () => {
  const url = state.appUpdate?.latest?.htmlUrl;
  if (url) await window.tokenMonitor.openExternal(url);
});

window.tokenMonitor.onSettingsPush?.((next) => {
  if (!next) return;
  const prevMetric = state.settings?.heatmapMetric;
  state.settings = next;
  applyEffectiveCurrencyRates();
  syncSettingsForm();
  maybeUpdateBarsIcon();
  if ((prevMetric || 'cost') !== (next.heatmapMetric || 'cost')) {
    render();
  }
});

reducedMotionMedia?.addEventListener?.('change', () => {
  if (motionPreferenceApi.normalize(state.settings?.reduceMotion) !== 'system') return;
  applyReduceMotionPreference('system');
});

window.tokenMonitor.onOpenSettings?.(openSettingsPanel);
window.tokenMonitor.onOpenView?.(openViewFromTray);

window.tokenMonitor.onFloatingBubbleState?.((payload) => {
  applyFloatingBubbleState(payload);
});

window.tokenMonitor.onTokscalePush?.((payload) => {
  mergeTokscalePayload(payload);
  renderTokscaleStatus();
});

window.tokenMonitor.onStatsPush?.((payload) => {
  if (!payload) return;
  if (payload.event === 'status') {
    state.streamConnected = Boolean(payload.data?.connected);
    if (payload.data?.mode) state.mode = payload.data.mode;
    state.syncHealth = payload.data?.health || state.syncHealth;
    state.streamFailure = state.streamConnected ? null : (payload.data?.reason ? { reason: payload.data.reason, detail: payload.data.detail ?? null } : state.streamFailure);
  } else if (payload.event === 'sync-health') {
    state.syncHealth = payload.data?.health || state.syncHealth;
    renderSyncClientStatus();
    return;
  } else if (payload.data?.stats) {
    // Local collector overlays update client-mode data independently of the
    // Hub SSE transport. Preserve its current Offline/error state until a
    // real stream status or remote stats event proves the connection changed.
    if (payload.data?.reason !== 'local' && payload.data?.transport !== 'rest') {
      state.streamConnected = true;
      state.streamFailure = null;
    }
    if (payload.data?.mode) state.mode = payload.data.mode;
    state.stats = preserveCustomPeriod(overlayAllTimeSessions(payload.data.stats));
    // Progressive mid-tick pushes never carry a fresh history scan (see
    // AGENTS.md collector notes), so only the final push can retire the
    // "just turned trends on" loading state without a flash back to empty.
    if (payload.data?.reason !== 'progress') state.trendsActivating = false;
  } else {
    return;
  }
  setLiveDot(state.streamConnected);
  setStatus(statusTextFor(state.mode, state.streamConnected));
  renderSyncClientStatus();
  if (payload.data?.stats) {
    render();
    renderToolPreferences();
    renderWslPanel();
    maybeUpdateBarsIcon();
  }
  restartTimer();
});

function pickWorstProvider(stats) {
  return window.TokenMonitorTrayText.pickWorstLimitProvider(stats);
}

function pickWorstSessionProvider(stats) {
  return window.TokenMonitorTrayText.pickLimitProviderByKindPriority(stats, ['session', 'weekly']);
}

function pickWorstWeeklyProvider(stats) {
  return window.TokenMonitorTrayText.pickWorstLimitProvider(stats, { kind: 'weekly' });
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const trayProviderImages = {};
const trayProviderImageIds = new WeakMap();
const trayProviderImageOpticalSamples = new WeakMap();
const trayProviderIconDeliveryGuard = window.TokenMonitorTrayProviderIcons.createTrayProviderIconDeliveryGuard();
const trayComposers = {};
let customTrayClockTimer = null;

function providerImageOpticalSample(image) {
  const cached = trayProviderImageOpticalSamples.get(image);
  if (cached) return cached;

  const sampleSize = 128;
  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, sampleSize, sampleSize);

  let bounds = { x: 0, y: 0, width: sampleSize, height: sampleSize };
  try {
    const pixels = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    let minX = sampleSize;
    let minY = sampleSize;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < sampleSize; y += 1) {
      for (let x = 0; x < sampleSize; x += 1) {
        if (pixels[(y * sampleSize + x) * 4 + 3] <= 12) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxX >= minX && maxY >= minY) {
      bounds = {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      };
    }
  } catch (_) {
    // Keep the original frame if a future non-local image cannot be inspected.
  }

  const sample = { canvas, bounds };
  trayProviderImageOpticalSamples.set(image, sample);
  return sample;
}

function paintProviderImage(ctx, image, x, y, size, templateColor = '') {
  const {
    trayProviderOpticalLayout,
    trayProviderOpticalRatio
  } = window.TokenMonitorTrayProviderIcons;
  const sample = providerImageOpticalSample(image);
  const opticalRatio = trayProviderOpticalRatio(trayProviderImageIds.get(image));
  const layout = trayProviderOpticalLayout(sample.bounds, size, opticalRatio);
  const maskSize = Math.max(1, Math.round(size));
  const mask = document.createElement('canvas');
  mask.width = maskSize;
  mask.height = maskSize;
  const maskCtx = mask.getContext('2d');
  maskCtx.drawImage(
    sample.canvas,
    sample.bounds.x,
    sample.bounds.y,
    sample.bounds.width,
    sample.bounds.height,
    layout.x,
    layout.y,
    layout.width,
    layout.height
  );
  if (templateColor) {
    maskCtx.globalCompositeOperation = 'source-in';
    maskCtx.fillStyle = templateColor;
    maskCtx.fillRect(0, 0, maskSize, maskSize);
  }
  ctx.drawImage(mask, x, y, size, size);
}

function drawProviderImage(ctx, image, x, y, size, contrastHalo = false, templateColor = '') {
  if (contrastHalo) {
    const lightSurface = themePresetsApi.isLightHex(resolvedThemeColor('bg'));
    ctx.save();
    ctx.shadowColor = lightSurface ? 'rgba(0, 0, 0, 0.58)' : 'rgba(255, 255, 255, 0.82)';
    ctx.shadowBlur = Math.max(2, Math.round(size * 0.1));
    paintProviderImage(ctx, image, x, y, size, templateColor);
    ctx.restore();
  }
  paintProviderImage(ctx, image, x, y, size, templateColor);
}

function renderBarsIcon(stats, height = 44, picker = pickWorstProvider, colors = {}, options = {}) {
  const trackColor = colors.track || 'rgba(0, 0, 0, 0.32)';
  const fillColor = colors.fill || 'rgba(0, 0, 0, 1)';
  const selection = picker(stats);
  if (!selection) return null;
  const { providerRecord, primaryWindow, secondaryWindow } = selection;
  const providerImage = trayProviderImages[providerRecord.provider];
  const { trayBarFillWidth, trayBarsLayout } = window.TokenMonitorTrayBars;
  const layout = trayBarsLayout(height);

  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, layout.width, layout.height);

  if (providerImage) {
    drawProviderImage(ctx, providerImage, layout.padX, layout.iconY, layout.iconSize, options.providerContrastHalo === true);
  }

  function drawBar(y, percent) {
    roundedRectPath(ctx, layout.barsX, y, layout.barsWidth, layout.barHeight, layout.radius);
    ctx.fillStyle = trackColor;
    ctx.fill();
    const fillW = trayBarFillWidth(limitFillPercent(percent, undefined, Boolean(state.settings?.showLimitUsed)), layout.barsWidth);
    if (!fillW) return;
    // Clip-to-track + flat fillRect: a rounded rect's tiny corners get lost when the icon is downscaled into the menubar.
    ctx.save();
    roundedRectPath(ctx, layout.barsX, y, layout.barsWidth, layout.barHeight, layout.radius);
    ctx.clip();
    ctx.fillStyle = fillColor;
    ctx.fillRect(layout.barsX, y, fillW, layout.barHeight);
    ctx.restore();
  }

  drawBar(layout.barsStartY, primaryWindow?.remainingPercent);
  drawBar(layout.barsStartY + layout.barHeight + layout.barGap, secondaryWindow?.remainingPercent);
  return canvas.toDataURL('image/png');
}

function pickConfiguredSessionProviders(stats, configOrder) {
  return window.TokenMonitorTrayText.pickConfiguredLimitProviders(stats, {
    limitProviderOrder: configOrder,
    limitProviders: configOrder,
    showLimitUsed: Boolean(state.settings?.showLimitUsed)
  });
}

function renderAllSessionsIcon(stats, height = 44, configOrder, colors = {}, options = {}) {
  const trackColor = colors.track || 'rgba(0, 0, 0, 0.32)';
  const fillColor = colors.fill || 'rgba(0, 0, 0, 1)';
  const picks = pickConfiguredSessionProviders(stats, configOrder);
  if (picks.length === 0) return null;
  // With one tool, preserve its canonical pair; a lone weekly/billing window is
  // promoted to the top lane and the lower lane remains an empty track.
  if (picks.length === 1) return renderBarsIcon(stats, height, () => picks[0], colors, options);

  const { trayBarFillWidth, trayBarsLayout } = window.TokenMonitorTrayBars;
  const layout = trayBarsLayout(height, { contentOnly: true });
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, layout.width, layout.height);

  // No per-row icons — order in the dropdown identifies which row is which tool.
  // Keep the canvas to just the bars, so the tray does not reserve a blank icon area.
  function drawBar(y, percent) {
    roundedRectPath(ctx, layout.barsX, y, layout.barsWidth, layout.barHeight, layout.radius);
    ctx.fillStyle = trackColor;
    ctx.fill();
    const fillW = trayBarFillWidth(limitFillPercent(percent, undefined, Boolean(state.settings?.showLimitUsed)), layout.barsWidth);
    if (!fillW) return;
    ctx.save();
    roundedRectPath(ctx, layout.barsX, y, layout.barsWidth, layout.barHeight, layout.radius);
    ctx.clip();
    ctx.fillStyle = fillColor;
    ctx.fillRect(layout.barsX, y, fillW, layout.barHeight);
    ctx.restore();
  }

  drawBar(layout.barsStartY, picks[0].primaryWindow.remainingPercent);
  drawBar(layout.barsStartY + layout.barHeight + layout.barGap, picks[1].primaryWindow.remainingPercent);
  return canvas.toDataURL('image/png');
}

function renderLimitSessionsIcon(stats, height = 44, configOrder, colors = {}, options = {}) {
  const picks = pickConfiguredSessionProviders(stats, configOrder);
  if (picks.length === 0) return null;

  const textColor = colors.text || colors.fill || 'rgba(0, 0, 0, 1)';
  const { trayBarsLayout } = window.TokenMonitorTrayBars;
  const layout = trayBarsLayout(height);
  const iconSize = layout.iconSize;
  const gap = Math.max(3, Math.round(height * 0.1));
  const separator = ' · ';
  const padX = options.contentOnly === true ? 0 : layout.padX;
  const fontSize = Math.round(height * 0.68);
  const font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
  const showUsed = Boolean(state.settings?.showLimitUsed);

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = font;
  const visiblePicks = picks.length === 1
    ? [{
        ...picks[0],
        text: [picks[0].primaryWindow, picks[0].secondaryWindow]
          .filter(Boolean)
          .map((window) => formatPercent(limitFillPercent(window.remainingPercent, window.usedPercent, showUsed)))
          .join(separator)
      }]
    : picks.map((pick) => ({
        ...pick,
        text: formatPercent(limitFillPercent(pick.primaryWindow.remainingPercent, pick.primaryWindow.usedPercent, showUsed))
      }));
  const entries = visiblePicks.map((pick) => {
    const text = pick.text;
    const image = trayProviderImages[pick.providerRecord.provider];
    const textWidth = Math.ceil(measureCtx.measureText(text).width);
    const iconWidth = image ? iconSize + gap : 0;
    return { pick, text, image, width: iconWidth + textWidth };
  }).filter((entry) => entry.text);
  if (entries.length === 0) return null;

  const separatorWidth = Math.ceil(measureCtx.measureText(separator).width);
  const width = Math.ceil(
    padX * 2 +
    entries.reduce((sum, entry) => sum + entry.width, 0) +
    separatorWidth * Math.max(0, entries.length - 1)
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;

  let x = padX;
  const centerY = height / 2;
  entries.forEach((entry, index) => {
    if (entry.image) {
      drawProviderImage(ctx, entry.image, x, layout.iconY, iconSize, options.providerContrastHalo === true);
      x += iconSize + gap;
    }
    ctx.fillText(entry.text, x, centerY + 1);
    x += Math.ceil(ctx.measureText(entry.text).width);
    if (index < entries.length - 1) {
      ctx.fillText(separator, x, centerY + 1);
      x += separatorWidth;
    }
  });
  return canvas.toDataURL('image/png');
}

function trayComposerSampleStats() {
  const resetSoon = new Date(Date.now() + 3 * 60 * 60 * 1000 + 7 * 60 * 1000).toISOString();
  const resetLater = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString();
  return {
    periods: {
      today: { totalTokens: 1_240_000, costUsd: 12.34 },
      month: { totalTokens: 18_600_000, costUsd: 184.2 },
      allTime: { totalTokens: 225_437_666, costUsd: 1502.72 }
    },
    limits: {
      providers: [
        {
          provider: 'codex',
          status: 'ok',
          accountKey: 'preview-codex',
          accountEmail: 'you@example.com',
          sourceDetail: 'app',
          windows: [
            { kind: 'session', label: '', remainingPercent: 64, resetsAt: resetSoon },
            { kind: 'weekly', label: '', remainingPercent: 42, resetsAt: resetLater }
          ]
        },
        {
          provider: 'claude',
          status: 'ok',
          accountKey: 'preview-claude',
          accountEmail: 'work@example.com',
          sourceDetail: 'oauth',
          windows: [
            { kind: 'session', label: '', remainingPercent: 78, resetsAt: resetSoon },
            { kind: 'weekly', label: '', remainingPercent: 57, resetsAt: resetLater }
          ]
        }
      ]
    }
  };
}

function statsForTrayComposer() {
  const sample = trayComposerSampleStats();
  const liveProviders = state.stats?.limits?.providers;
  return {
    ...sample,
    ...state.stats,
    periods: {
      ...sample.periods,
      ...(state.stats?.periods || {})
    },
    limits: Array.isArray(liveProviders) && liveProviders.some((provider) => provider?.status === 'ok' && !provider?.stale)
      ? state.stats.limits
      : sample.limits
  };
}

function drawTrayFallbackMark(ctx, value, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `600 ${Math.round(size * 0.46)}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value === 'app' ? 'Σ' : String(value || '?').slice(0, 1).toUpperCase(), x + size / 2, y + size / 2 + 1);
  ctx.restore();
}

function trayTextCanvasFont(item, fontSize, defaultWeight) {
  const style = item?.fontStyle || 'normal';
  const family = style === 'compactMono'
    ? 'ui-monospace, ".AppleSystemUIFontMonospaced", "SFMono-Regular", "SF Mono", Menlo, monospace'
    : '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
  const weight = style === 'menubar' ? 700 : style === 'compactMono' ? 600 : defaultWeight;
  return `${weight} ${fontSize}px ${family}`;
}

function trayTextHorizontalScale(item) {
  if (item?.fontStyle === 'condensed') return 0.86;
  if (item?.fontStyle === 'menubar') return 0.92;
  return 1;
}

function trayTextSpaceScale(item) {
  return item?.fontStyle === 'compactMono' ? 0.55 : 1;
}

function trayTextRuns(ctx, text, item) {
  const spaceScale = trayTextSpaceScale(item);
  return (String(text).match(/\s+|\S+/g) || ['']).map((value) => {
    const blank = /^\s+$/.test(value);
    return {
      value,
      blank,
      width: ctx.measureText(value).width * (blank ? spaceScale : 1)
    };
  });
}

function measureTrayText(ctx, text, item, horizontalScale = 1) {
  return trayTextRuns(ctx, text, item)
    .reduce((width, run) => width + run.width, 0) * horizontalScale;
}

function drawTrayText(ctx, text, x, y, item, horizontalScale = 1) {
  const spaceScale = trayTextSpaceScale(item);
  if (spaceScale === 1 && horizontalScale === 1) {
    ctx.fillText(text, x, y);
    return;
  }

  const runs = trayTextRuns(ctx, text, item);
  const rawWidth = runs.reduce((width, run) => width + run.width, 0);
  const alignment = ctx.textAlign;
  const startX = alignment === 'right' || alignment === 'end'
    ? -rawWidth
    : alignment === 'center'
      ? -rawWidth / 2
      : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(horizontalScale, 1);
  ctx.textAlign = 'left';
  let cursor = startX;
  for (const run of runs) {
    if (!run.blank) ctx.fillText(run.value, cursor, 0);
    cursor += run.width;
  }
  ctx.restore();
}

function drawCustomTrayProviderBadge(ctx, x, y, size, color) {
  const { trayProviderBadgeLayout } = window.TokenMonitorTrayProviderIcons;
  const layout = trayProviderBadgeLayout(size);
  const badgeX = x + layout.x;
  const badgeY = y + layout.y;
  const { badgeSize, radius, borderWidth } = layout;
  ctx.save();
  roundedRectPath(ctx, badgeX, badgeY, badgeSize, badgeSize, radius);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = color;
  ctx.stroke();

  // Custom tray images remain macOS template images. Cut the T mark out of the
  // badge alpha so the mark survives the menu-bar tint as negative space.
  const left = badgeX + badgeSize * 0.33;
  const right = badgeX + badgeSize * 0.70;
  const top = badgeY + badgeSize * 0.32;
  const bottom = badgeY + badgeSize * 0.71;
  const stemX = badgeX + badgeSize * 0.51;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.moveTo(stemX, top);
  ctx.lineTo(stemX, bottom - badgeSize * 0.12);
  ctx.quadraticCurveTo(stemX, bottom, stemX + badgeSize * 0.14, bottom);
  ctx.lineWidth = Math.max(1, badgeSize * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000000';
  ctx.stroke();
  ctx.restore();
}

function drawCustomTrayProviderImage(ctx, img, provider, x, y, size, options = {}) {
  const showBadge = options.showProviderBadge === true && provider && provider !== 'app';
  const inset = showBadge ? Math.max(1, Math.round(size * 0.07)) : 0;
  const imageSize = size - inset * 2;
  drawProviderImage(
    ctx,
    img,
    x + inset,
    y + inset,
    imageSize,
    options.providerContrastHalo === true,
    options.templateIconColor || ''
  );
  if (showBadge) {
    drawCustomTrayProviderBadge(
      ctx,
      x,
      y,
      size,
      options.templateIconColor || options.textColor || '#000000'
    );
  }
}

function renderCustomTrayItemCanvas(item, height = 44, colors = {}, options = {}) {
  const trackColor = colors.track || 'rgba(0, 0, 0, 0.32)';
  const fillColor = colors.fill || 'rgba(0, 0, 0, 1)';
  const textColor = colors.text || fillColor;
  const h = Math.max(16, Math.round(height));

  if (item.type === 'spacer') {
    const isDot = item.variant === 'dot';
    const ratios = isDot
      ? { narrow: 0.18, regular: 0.24, wide: 0.34 }
      : { narrow: 0.07, regular: 0.14, wide: 0.27 };
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round(h * (ratios[item.size] || ratios.regular)));
    canvas.height = h;
    if (isDot) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = textColor;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, h / 2, Math.max(1, h * 0.055), 0, Math.PI * 2);
      ctx.fill();
    } else if (options.spacerGuide) {
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = trackColor;
      ctx.setLineDash([1, 2]);
      ctx.beginPath();
      ctx.moveTo(0.5, h * 0.2);
      ctx.lineTo(0.5, h * 0.8);
      ctx.moveTo(canvas.width - 0.5, h * 0.2);
      ctx.lineTo(canvas.width - 0.5, h * 0.8);
      ctx.stroke();
    }
    return canvas;
  }

  if (item.type === 'icon') {
    const canvas = document.createElement('canvas');
    canvas.width = h;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const provider = item.provider || 'app';
    const providerImage = trayProviderImages[provider];
    if (providerImage) {
      drawCustomTrayProviderImage(
        ctx,
        providerImage,
        provider,
        0,
        0,
        h,
        { ...options, textColor }
      );
    } else {
      drawTrayFallbackMark(ctx, provider, 0, 0, h, textColor);
    }
    return canvas;
  }

  if (item.type === 'bars') {
    const { trayBarFillWidth, trayBarsLayout } = window.TokenMonitorTrayBars;
    const showIcon = item.icon !== 'none';
    const barLayout = trayBarsLayout(h, { contentOnly: !showIcon });
    const canvas = document.createElement('canvas');
    canvas.width = barLayout.width;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const rows = item.rows.length > 1 ? item.rows.slice(0, 2) : item.rows.slice(0, 1);
    const drawBar = (row, y) => {
      roundedRectPath(ctx, barLayout.barsX, y, barLayout.barsWidth, barLayout.barHeight, barLayout.radius);
      ctx.fillStyle = trackColor;
      ctx.fill();
      const fillWidth = trayBarFillWidth(row.percent, barLayout.barsWidth);
      if (!fillWidth) return;
      ctx.save();
      roundedRectPath(ctx, barLayout.barsX, y, barLayout.barsWidth, barLayout.barHeight, barLayout.radius);
      ctx.clip();
      ctx.fillStyle = fillColor;
      ctx.fillRect(barLayout.barsX, y, fillWidth, barLayout.barHeight);
      ctx.restore();
    };
    if (showIcon) {
      const preferredIndex = item.icon === 'second' ? 1 : 0;
      const iconRow = rows[preferredIndex]?.selection ? rows[preferredIndex] : rows.find((row) => row.selection);
      const provider = item.icon === 'app' ? 'app' : iconRow?.selection?.provider || '';
      const providerImage = trayProviderImages[provider];
      if (providerImage) {
        drawCustomTrayProviderImage(
          ctx,
          providerImage,
          provider,
          barLayout.padX,
          barLayout.iconY,
          barLayout.iconSize,
          { ...options, textColor }
        );
      } else {
        drawTrayFallbackMark(ctx, provider || '?', barLayout.padX, barLayout.iconY, barLayout.iconSize, textColor);
      }
    }
    const ys = rows.length > 1
      ? [barLayout.barsStartY, barLayout.barsStartY + barLayout.barHeight + barLayout.barGap]
      : [Math.round((h - barLayout.barHeight) / 2)];
    rows.forEach((row, index) => {
      drawBar(row, ys[index]);
    });
    return canvas;
  }

  if (item.type === 'stack') {
    const rows = item.rows.slice(0, 2);
    const showIcon = item.icon !== 'none';
    const preferredIndex = item.icon === 'second' ? 1 : 0;
    const iconRow = rows[preferredIndex]?.selection ? rows[preferredIndex] : rows.find((row) => row.selection);
    const provider = item.icon === 'app' ? 'app' : iconRow?.selection?.provider || '';
    const iconSize = h;
    const iconGap = Math.max(2, Math.round(h * 0.08));
    const fontSize = Math.max(8, Math.round(h * 0.43));
    const font = trayTextCanvasFont(item, fontSize, 600);
    const horizontalScale = trayTextHorizontalScale(item);
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = font;
    const textWidth = Math.max(
      ...rows.map((row) => measureTrayText(measure, row.text || '--', item, horizontalScale)),
      1
    );
    const padX = Math.max(1, Math.round(h * 0.04));
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(textWidth) + padX * 2 + (showIcon ? iconSize + iconGap : 0);
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const alignment = item.alignment === 'left' ? 'left' : 'right';
    let textX = alignment === 'right' ? canvas.width - padX : padX;
    if (showIcon) {
      const providerImage = trayProviderImages[provider];
      if (providerImage) {
        drawCustomTrayProviderImage(
          ctx,
          providerImage,
          provider,
          0,
          0,
          iconSize,
          { ...options, textColor }
        );
      } else {
        drawTrayFallbackMark(ctx, provider || '?', 0, 0, iconSize, textColor);
      }
      if (alignment === 'left') textX += iconSize + iconGap;
    }
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = alignment;
    const textBaselineOffset = Math.max(1, Math.round(h * 0.025));
    rows.forEach((row, index) => {
      ctx.fillStyle = row.available === false ? trackColor : textColor;
      drawTrayText(
        ctx,
        row.text || '--',
        textX,
        h * (index === 0 ? 0.28 : 0.72) + textBaselineOffset,
        item,
        horizontalScale
      );
    });
    return canvas;
  }

  const text = item.text || '--';
  const fontSize = Math.round(h * 0.68);
  const font = trayTextCanvasFont(item, fontSize, 500);
  const horizontalScale = trayTextHorizontalScale(item);
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const padX = Math.max(1, Math.round(h * 0.04));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(measureTrayText(measure, text, item, horizontalScale)) + padX * 2);
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = item.available === false ? trackColor : textColor;
  drawTrayText(ctx, text, padX, h / 2 + 1, item, horizontalScale);
  return canvas;
}

function renderCustomTrayLayout(stats, layout, height = 44, colors = {}, options = {}) {
  const resolved = trayLayoutApi.resolveTrayLayout(layout, stats, {
    currency: currentCurrency(),
    nowMs: Date.now(),
    activeAccountKeys: {},
    availableProviderIds: Object.keys(trayProviderImages)
  });
  const items = resolved.items.map((item) => (
    item.type === 'text'
      && item.metric === 'account'
      && state.settings?.maskLimitAccountEmails
      ? { ...item, text: maskEmailAddress(item.text) }
      : item
  ));
  const segments = items.map((item) => renderCustomTrayItemCanvas(item, height, colors, options));
  if (!segments.length) return null;
  const gap = Math.max(1, Math.round(height * 0.03));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, segments.reduce((width, segment) => width + segment.width, 0) + gap * Math.max(0, segments.length - 1));
  canvas.height = Math.max(16, Math.round(height));
  const ctx = canvas.getContext('2d');
  let x = 0;
  for (const segment of segments) {
    ctx.drawImage(segment, x, 0);
    x += segment.width + gap;
  }
  return canvas.toDataURL('image/png');
}

function barsDataUrlForMode(mode, size = 44, colors, options = {}) {
  if (mode === 'barsAllSessions') return renderAllSessionsIcon(state.stats, size, configuredLimitProviderOrder(), colors, options);
  const pickers = { barsSession: pickWorstSessionProvider, barsWeekly: pickWorstWeeklyProvider };
  return renderBarsIcon(state.stats, size, pickers[mode] || pickWorstProvider, colors, options);
}

function trayDataUrlForMode(mode, size = 44, colors, options = {}) {
  if (mode === 'custom') {
    return renderCustomTrayLayout(
      options.stats || state.stats || statsForTrayComposer(),
      options.layout || state.settings?.trayCustomLayout,
      size,
      colors,
      {
        showProviderBadge: state.settings?.showTrayProviderBadge === true,
        ...options
      }
    );
  }
  if (mode === 'limitsAllSessions') return renderLimitSessionsIcon(state.stats, size, configuredLimitProviderOrder(), colors, options);
  return barsDataUrlForMode(mode, size, colors, options);
}

async function maybeUpdateBarsIcon(options = {}) {
  if (options.refreshComposers !== false) refreshTrayComposers();
  const mode = state.settings?.trayContent;
  if (!window.TokenMonitorTrayText.isGeneratedTrayIconMode(mode)) return;
  if (!window.tokenMonitor.setTrayIcons) return;
  const dataUrl = trayDataUrlForMode(mode, 44);
  try { await window.tokenMonitor.setTrayIcons({ [mode]: dataUrl || null }); } catch (_) {}
}

function trayComposerProviderIcon(provider) {
  const id = provider === 'auto' ? 'app' : provider;
  const cached = trayProviderImages[id];
  if (cached) {
    try {
      return providerImageToPngDataUrl(cached, 44, false, {
        templateColor: floatingBubbleGeneratedColors().text
      });
    } catch (_) {}
  }
  if (id === 'app') return '../../../assets/icons/tray-token-monitor.png';
  return window.TokenMonitorTrayProviderIcons.trayProviderIconSources([id])[id] || '';
}

function trayComposerProviderChoices(currentProviders = [], options = {}) {
  const current = new Set(
    (Array.isArray(currentProviders) ? currentProviders : [currentProviders])
      .map((provider) => String(provider || '').trim().toLowerCase())
      .filter((provider) => provider && provider !== 'auto')
  );
  const available = new Set(
    trayLayoutApi.providerOptions(state.stats || {}).map((entry) => entry.value)
  );
  const includeAll = options.includeAll === true;
  const catalogue = includeAll ? TRAY_ICON_PROVIDERS : LIMIT_PROVIDERS;
  return [
    {
      value: 'auto',
      label: t('trayComposer.provider.auto'),
      detail: t('trayComposer.provider.autoDetail'),
      icon: trayComposerProviderIcon('auto')
    },
    ...catalogue
      .filter((provider) => includeAll || available.has(provider.id) || current.has(provider.id))
      .map((provider) => ({
        value: provider.id,
        label: provider.label,
        detail: includeAll || available.has(provider.id) ? '' : t('trayComposer.provider.unavailable'),
        icon: trayComposerProviderIcon(provider.id)
      }))
  ];
}

function trayComposerAccountChoices(provider) {
  const stats = state.stats || {};
  const raw = provider === 'auto'
    ? LIMIT_PROVIDERS.flatMap((entry) => trayLayoutApi.accountOptions(stats, entry.id))
    : trayLayoutApi.accountOptions(stats, provider);
  return raw.map((entry) => ({
    value: entry.value,
    label: entry.label,
    detail: LIMIT_PROVIDERS.find((providerEntry) => providerEntry.id === entry.provider?.provider)?.label || entry.provider?.provider || '',
    icon: trayComposerProviderIcon(entry.provider?.provider)
  }));
}

function trayComposerSourcePreview(source) {
  const item = trayLayoutApi.createTrayLayoutItem('singleBar');
  item.rows = [{ ...item.rows[0], ...source }];
  return renderCustomTrayLayout(
    statsForTrayComposer(),
    { version: trayLayoutApi.VERSION, items: [item] },
    32,
    floatingBubbleGeneratedColors(),
    { templateIconColor: floatingBubbleGeneratedColors().text }
  );
}

function trayComposerWindowChoices(source) {
  const choices = trayLayoutApi.sourceWindowOptions(
    state.stats || {},
    source
  ).map((entry) => ({
    value: entry.value,
    label: trayComposerWindowLabel(entry),
    preview: trayComposerSourcePreview({ ...source, window: entry.value })
  }));
  if (choices.length) return choices;
  return [{
    value: 'primary',
    label: t('trayComposer.window.primary'),
    preview: trayComposerSourcePreview({ ...source, window: 'primary' })
  }];
}

function trayComposerWindowLabel(entry) {
  const kind = String(entry.kind || 'other').toLowerCase();
  const kindKey = `trayComposer.window.${kind}`;
  const translatedKind = t(kindKey);
  const kindLabel = translatedKind === kindKey ? t('trayComposer.window.primary') : translatedKind;
  const rawLabel = String(entry.label || '').trim();
  const normalizedLabel = rawLabel.toLowerCase();
  const redundantLabels = new Set([kind, 'session', 'weekly', 'billing', 'total']);
  if (!rawLabel || redundantLabels.has(normalizedLabel)) return kindLabel;
  return `${kindLabel} · ${rawLabel}`;
}

function previewItemForStyle(style) {
  return trayLayoutApi.createTrayLayoutItem(style);
}

function renderTrayComposerItem(item, options = {}) {
  return renderCustomTrayLayout(
    statsForTrayComposer(),
    { version: trayLayoutApi.VERSION, items: [item] },
    36,
    floatingBubbleGeneratedColors(),
    { templateIconColor: floatingBubbleGeneratedColors().text, ...options }
  );
}

function renderTrayComposerFontPreview(item, fontStyle, options = {}) {
  return renderTrayComposerItem({ ...item, fontStyle }, options);
}

function createTrayComposer(surface) {
  const isTray = surface === 'tray';
  const root = isTray ? els.trayComposer : els.floatingBubbleComposer;
  const layoutKey = isTray ? 'trayCustomLayout' : 'floatingBubbleCustomLayout';
  return window.TokenMonitorTrayComposer.createTrayComposer({
    root,
    surface,
    layoutApi: trayLayoutApi,
    getLayout: () => state.settings?.[layoutKey],
    getStylePreview: (style) => renderTrayComposerItem(
      previewItemForStyle(style),
      {
        showProviderBadge: isTray && state.settings?.showTrayProviderBadge === true,
        spacerGuide: style === 'spacer'
      }
    ),
    getFontStylePreview: (item, fontStyle) => renderTrayComposerFontPreview(item, fontStyle, {
      showProviderBadge: isTray && state.settings?.showTrayProviderBadge === true
    }),
    renderItem: (item) => renderTrayComposerItem(item, {
      showProviderBadge: isTray && state.settings?.showTrayProviderBadge === true
    }),
    providerChoices: trayComposerProviderChoices,
    accountChoices: trayComposerAccountChoices,
    windowChoices: trayComposerWindowChoices,
    label: t,
    onLayoutChange: (nextLayout, { commit }) => {
      state.settings[layoutKey] = trayLayoutApi.normalizeTrayLayout(nextLayout);
      if (isTray) void maybeUpdateBarsIcon({ refreshComposers: commit });
      else {
        renderFloatingBubbleContent();
        if (commit) syncTrayComposerVisibility();
      }
      if (commit) void saveSettings({ [layoutKey]: state.settings[layoutKey] });
    }
  });
}

function syncTrayComposerVisibility() {
  const surfaces = [
    { id: 'tray', root: els.trayComposer, visible: state.settings?.trayContent === 'custom' },
    { id: 'floatingBubble', root: els.floatingBubbleComposer, visible: state.settings?.floatingBubbleContent === 'custom' }
  ];
  window.TokenMonitorTrayComposer.syncTrayComposerSurfaces(
    surfaces,
    trayComposers,
    createTrayComposer
  );
  const clockNeeded = (
    state.settings?.trayContent === 'custom'
      && trayLayoutApi.trayLayoutNeedsClock(state.settings?.trayCustomLayout)
  ) || (
    state.settings?.floatingBubbleContent === 'custom'
      && trayLayoutApi.trayLayoutNeedsClock(state.settings?.floatingBubbleCustomLayout)
  );
  if (clockNeeded && !customTrayClockTimer) {
    customTrayClockTimer = setInterval(() => {
      void maybeUpdateBarsIcon({ refreshComposers: false });
      renderFloatingBubbleContent();
    }, 30 * 1000);
  } else if (!clockNeeded && customTrayClockTimer) {
    clearInterval(customTrayClockTimer);
    customTrayClockTimer = null;
  }
}

function refreshTrayComposers() {
  syncTrayComposerVisibility();
  Object.values(trayComposers).forEach((composer) => composer?.refresh());
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`load failed: ${src}`));
    img.src = src;
  });
}

function providerImageToPngDataUrl(img, size, showBadge = false, options = {}) {
  const { trayProviderBadgeLayout } = window.TokenMonitorTrayProviderIcons;
  const layout = trayProviderBadgeLayout(size);
  const canvas = document.createElement('canvas');
  canvas.width = layout.iconSize;
  canvas.height = layout.iconSize;
  const ctx = canvas.getContext('2d');
  const imageInset = showBadge ? Math.max(1, Math.round(layout.iconSize * 0.07)) : 0;
  const imageSize = layout.iconSize - imageInset * 2;
  if (showBadge) {
    ctx.save();
    ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowBlur = Math.max(2, Math.round(layout.iconSize * 0.1));
    paintProviderImage(ctx, img, imageInset, imageInset, imageSize);
    ctx.restore();
  }
  drawProviderImage(
    ctx,
    img,
    imageInset,
    imageInset,
    imageSize,
    false,
    showBadge ? '' : options.templateColor || ''
  );

  if (!showBadge) return canvas.toDataURL('image/png');

  const { x, y, badgeSize, radius, borderWidth } = layout;
  roundedRectPath(ctx, x, y, badgeSize, badgeSize, radius);
  ctx.fillStyle = '#1688f8';
  ctx.fill();
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Draw the project's T token mark as geometry so it remains crisp without a font dependency.
  const left = x + badgeSize * 0.33;
  const right = x + badgeSize * 0.70;
  const top = y + badgeSize * 0.32;
  const bottom = y + badgeSize * 0.71;
  const stemX = x + badgeSize * 0.51;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.moveTo(stemX, top);
  ctx.lineTo(stemX, bottom - badgeSize * 0.12);
  ctx.quadraticCurveTo(stemX, bottom, stemX + badgeSize * 0.14, bottom);
  ctx.lineWidth = Math.max(2, badgeSize * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  return canvas.toDataURL('image/png');
}

async function deliverTrayProviderIcons(showBadge = state.settings?.showTrayProviderBadge === true) {
  if (!window.tokenMonitor.setTrayIcons) return;
  const deliveryId = trayProviderIconDeliveryGuard.begin();
  const sources = window.TokenMonitorTrayProviderIcons.trayProviderIconSources(trayIconProviderIds);
  sources.app = '../../../assets/icons/tray-token-monitor.png';
  const icons = {};
  for (const [id, path] of Object.entries(sources)) {
    try {
      const img = await loadImage(path);
      trayProviderImages[id] = img;
      trayProviderImageIds.set(img, id);
      icons[id] = providerImageToPngDataUrl(img, 44, showBadge);
    } catch (_) { /* skip missing */ }
  }
  if (!trayProviderIconDeliveryGuard.isCurrent(deliveryId)) return;
  if (Object.keys(icons).length) await window.tokenMonitor.setTrayIcons(icons);
  if (!trayProviderIconDeliveryGuard.isCurrent(deliveryId)) return;
  // Provider images may unlock a richer bars icon now that they're cached.
  maybeUpdateBarsIcon();
}

const HUB_ACCOUNT_PROVIDERS = [
  { id: 'claude', label: 'Claude' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'minimax', label: 'Minimax' },
  { id: 'mimo', label: 'MiMo' },
  { id: 'copilot', label: 'GitHub Copilot' },
  { id: 'zai', label: 'GLM' },
  { id: 'zaiteam', label: 'GLM Team' },
  { id: 'volcengine', label: 'Volcengine' },
  { id: 'qoder', label: 'Qoder' },
  { id: 'commandcode', label: 'Command Code' },
  { id: 'ollama', label: 'Ollama' },
  { id: 'kimi', label: 'Kimi' },
  { id: 'thirdparty', label: 'Third-party' }
];
const HUB_ACCOUNT_PROVIDER_LABELS = new Map(HUB_ACCOUNT_PROVIDERS.map((provider) => [provider.id, provider.label]));

function hubAccountProviderLabel(provider) {
  return HUB_ACCOUNT_PROVIDER_LABELS.get(String(provider || '').trim().toLowerCase()) || String(provider || '').trim() || 'Unknown';
}

function setHubAccountError(message = '') {
  state.hubAccountError = String(message || '');
  if (!els.hubAccountError) return;
  els.hubAccountError.textContent = state.hubAccountError;
  els.hubAccountError.classList.toggle('hidden', !state.hubAccountError);
}

function setHubAccountsExpanded(expanded) {
  state.hubAccountExpanded = Boolean(expanded);
  if (els.hubAccountsSettingsToggle) {
    els.hubAccountsSettingsToggle.setAttribute('aria-expanded', String(state.hubAccountExpanded));
  }
  els.hubAccountsSettingsDetails?.classList.toggle('hidden', !state.hubAccountExpanded);
}

function hubAccountStatusText(account) {
  if (account?.enabled === false) return t('settings.hubAccounts.disabled');
  if (account?.status === 'ok') return t('settings.hubAccounts.statusOk');
  if (account?.status === 'refreshing' || account?.status === 'pending') return t('settings.hubAccounts.statusRefreshing');
  if (account?.status === 'error') return t('settings.hubAccounts.statusError');
  return t('settings.hubAccounts.statusUnknown');
}

function renderHubAccountList() {
  if (!els.hubAccountsList) return;
  const accounts = Array.isArray(state.hubAccounts) ? state.hubAccounts : [];
  const isHubMode = state.settings?.hubMode === 'client';
  if (els.hubAccountsStatus) {
    els.hubAccountsStatus.textContent = !isHubMode
      ? t('settings.hubAccounts.notConfigured')
      : accounts.length
        ? t('settings.hubAccounts.count', { count: accounts.length })
        : t('settings.hubAccounts.empty');
    els.hubAccountsStatus.classList.toggle('error', Boolean(state.hubAccountError));
  }
  els.hubAccountsList.replaceChildren();
  if (!isHubMode) {
    const note = document.createElement('p');
    note.className = 'settings-note';
    note.textContent = t('settings.hubAccounts.requiresHub');
    els.hubAccountsList.append(note);
    return;
  }
  if (accounts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'settings-note';
    empty.textContent = t('settings.hubAccounts.empty');
    els.hubAccountsList.append(empty);
    return;
  }
  for (const account of accounts) {
    const row = document.createElement('div');
    row.className = 'managed-account-row hub-account-row';
    row.dataset.accountId = String(account.id || '');

    const main = document.createElement('div');
    main.className = 'managed-account-main';
    const name = document.createElement('div');
    name.className = 'managed-account-name';
    name.textContent = String(account.name || hubAccountProviderLabel(account.provider));
    const metadata = document.createElement('div');
    metadata.className = 'managed-account-meta';
    const parts = [hubAccountProviderLabel(account.provider)];
    if (account.label) parts.push(String(account.label));
    parts.push(hubAccountStatusText(account));
    if (account.lastSuccessAt) parts.push(t('settings.hubAccounts.lastRefresh', { time: formatTime(account.lastSuccessAt) }));
    metadata.textContent = parts.join(' · ');
    main.append(name, metadata);

    const actions = document.createElement('div');
    actions.className = 'managed-account-actions';
    const refreshButton = document.createElement('button');
    refreshButton.type = 'button';
    refreshButton.dataset.action = 'refresh';
    refreshButton.dataset.accountId = String(account.id || '');
    refreshButton.textContent = t('settings.hubAccounts.refresh');
    refreshButton.disabled = state.hubAccountsBusy;
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.dataset.action = 'remove';
    removeButton.dataset.accountId = String(account.id || '');
    removeButton.textContent = t('settings.hubAccounts.remove');
    removeButton.disabled = state.hubAccountsBusy;
    actions.append(refreshButton, removeButton);
    row.append(main, actions);
    els.hubAccountsList.append(row);
  }
}

async function refreshHubAccounts() {
  if (!window.tokenMonitor.hubAccounts) return;
  if (state.settings?.hubMode !== 'client') {
    state.hubAccounts = [];
    setHubAccountError('');
    renderHubAccountList();
    return;
  }
  state.hubAccountsBusy = true;
  setHubAccountError('');
  renderHubAccountList();
  try {
    const result = await window.tokenMonitor.hubAccounts.list();
    state.hubAccounts = Array.isArray(result?.accounts) ? result.accounts : [];
  } catch (error) {
    state.hubAccounts = [];
    setHubAccountError(error?.message || String(error));
  } finally {
    state.hubAccountsBusy = false;
    renderHubAccountList();
  }
}

function readHubAccountCredential() {
  const raw = String(els.hubAccountCredential?.value || '').trim();
  if (!raw) throw new Error(t('settings.hubAccounts.credentialRequired'));
  let credential;
  try {
    credential = JSON.parse(raw);
  } catch (error) {
    throw new Error(t('settings.hubAccounts.invalidJson'), { cause: error });
  }
  if (!credential || typeof credential !== 'object' || Array.isArray(credential)) {
    throw new Error(t('settings.hubAccounts.invalidJson'));
  }
  return credential;
}

function setupHubAccountsUI() {
  if (!els.hubAccountsSettingsToggle || !els.hubAccountsList) return;
  if (els.hubAccountProvider && els.hubAccountProvider.options.length === 0) {
    for (const provider of HUB_ACCOUNT_PROVIDERS) {
      const option = document.createElement('option');
      option.value = provider.id;
      option.textContent = provider.label;
      els.hubAccountProvider.append(option);
    }
  }
  els.hubAccountsSettingsToggle.addEventListener('click', () => setHubAccountsExpanded(!state.hubAccountExpanded));
  els.hubAccountsRefreshButton?.addEventListener('click', () => { void refreshHubAccounts(); });
  els.hubAccountAddButton?.addEventListener('click', async () => {
    if (state.hubAccountsBusy) return;
    const name = String(els.hubAccountName?.value || '').trim();
    if (!name) {
      setHubAccountError(t('settings.hubAccounts.nameRequired'));
      return;
    }
    let credential;
    try {
      credential = readHubAccountCredential();
    } catch (error) {
      setHubAccountError(error.message);
      return;
    }
    state.hubAccountsBusy = true;
    setHubAccountError('');
    renderHubAccountList();
    try {
      await window.tokenMonitor.hubAccounts.add({
        provider: els.hubAccountProvider.value,
        name,
        label: String(els.hubAccountLabel?.value || '').trim(),
        credential
      });
      if (els.hubAccountName) els.hubAccountName.value = '';
      if (els.hubAccountLabel) els.hubAccountLabel.value = '';
      if (els.hubAccountCredential) els.hubAccountCredential.value = '';
      await refreshHubAccounts();
    } catch (error) {
      setHubAccountError(error?.message || String(error));
    } finally {
      state.hubAccountsBusy = false;
      renderHubAccountList();
    }
  });
  els.hubAccountsList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action][data-account-id]');
    if (!button || state.hubAccountsBusy) return;
    const accountId = String(button.dataset.accountId || '').trim();
    if (!accountId) return;
    state.hubAccountsBusy = true;
    setHubAccountError('');
    renderHubAccountList();
    try {
      if (button.dataset.action === 'remove') {
        if (!window.confirm(t('settings.hubAccounts.removeConfirm'))) return;
        await window.tokenMonitor.hubAccounts.remove(accountId);
      } else if (button.dataset.action === 'refresh') {
        await window.tokenMonitor.hubAccounts.refresh(accountId);
      }
      await refreshHubAccounts();
    } catch (error) {
      setHubAccountError(error?.message || String(error));
    } finally {
      state.hubAccountsBusy = false;
      renderHubAccountList();
    }
  });
  setHubAccountsExpanded(false);
  renderHubAccountList();
}

let openCustomPricingForm = null;

function customPricingMeta(ov) {
  const parts = [];
  if (typeof ov.cacheReadPerM === 'number') parts.push(`${t('settings.customPricing.cacheRead')} $${ov.cacheReadPerM}`);
  if (typeof ov.inputPerM === 'number') parts.push(`${t('settings.customPricing.input')} $${ov.inputPerM}`);
  if (typeof ov.outputPerM === 'number') parts.push(`${t('settings.customPricing.output')} $${ov.outputPerM}`);
  return parts.length ? `${parts.join(' · ')} / 1M` : '';
}

function renderCustomPricing() {
  const listEl = document.getElementById('customPricingList');
  const statusEl = document.getElementById('customPricingStatus');
  if (!listEl) return;
  const overrides = state.settings?.customModelPricing || [];
  if (statusEl) {
    statusEl.textContent = overrides.length
      ? t('settings.customPricing.count', { count: overrides.length })
      : t('settings.customPricing.none');
  }
  listEl.replaceChildren();
  if (overrides.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'settings-note';
    empty.textContent = t('settings.customPricing.empty');
    listEl.append(empty);
    return;
  }
  for (const ov of overrides) {
    const row = document.createElement('div');
    row.className = 'managed-account-row custom-pricing-row';
    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'managed-account-main custom-pricing-edit';
    main.title = t('settings.customPricing.edit');
    main.addEventListener('click', () => { if (openCustomPricingForm) openCustomPricingForm(ov); });
    const name = document.createElement('div');
    name.className = 'managed-account-email';
    name.textContent = ov.modelId;
    const meta = document.createElement('div');
    meta.className = 'managed-account-meta';
    meta.textContent = customPricingMeta(ov);
    main.append(name, meta);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'managed-account-remove custom-pricing-remove';
    remove.textContent = t('settings.customPricing.remove');
    remove.addEventListener('click', async () => {
      const next = customPricingFormApi.removeOverride(state.settings?.customModelPricing || [], ov.modelId);
      await saveSettings({ customModelPricing: next });
      renderCustomPricing();
    });
    row.append(main, remove);
    listEl.append(row);
  }
}

function setupCustomPricingUI() {
  const toggle = document.getElementById('customPricingSettingsToggle');
  if (!toggle) return;
  const details = document.getElementById('customPricingSettingsDetails');
  const group = toggle.closest('.cursor-account-group');
  const setExpanded = (expanded) => {
    state.customPricingExpanded = Boolean(expanded);
    toggle.setAttribute('aria-expanded', String(state.customPricingExpanded));
    details?.classList.toggle('hidden', !state.customPricingExpanded);
    group?.classList.toggle('expanded', state.customPricingExpanded);
  };
  toggle.addEventListener('click', () => setExpanded(!state.customPricingExpanded));
  setExpanded(false);

  const form = document.getElementById('customPricingForm');
  const addButton = document.getElementById('customPricingAddButton');
  const select = document.getElementById('customPricingModelSelect');
  const manualInput = document.getElementById('customPricingModelInput');
  const inputEl = document.getElementById('customPricingInput');
  const outputEl = document.getElementById('customPricingOutput');
  const cacheReadEl = document.getElementById('customPricingCacheRead');
  const hintEl = document.getElementById('customPricingHint');
  const errorEl = document.getElementById('customPricingError');
  const saveButton = document.getElementById('customPricingSaveButton');
  const cancelButton = document.getElementById('customPricingCancelButton');
  manualInput.placeholder = t('settings.customPricing.modelPlaceholder');

  const showHint = (text) => { hintEl.textContent = text || ''; };
  const showError = (text) => { errorEl.textContent = text || ''; errorEl.classList.toggle('hidden', !text); };
  const selectedModelId = () => (select.value === '__manual__' ? manualInput.value.trim() : select.value);

  const resetForm = () => {
    inputEl.value = ''; outputEl.value = ''; cacheReadEl.value = '';
    manualInput.value = ''; manualInput.classList.add('hidden');
    for (const id of ['customPricingInputApprox', 'customPricingOutputApprox', 'customPricingCacheReadApprox']) {
      const span = document.getElementById(id);
      if (span) span.textContent = '';
    }
    showHint(''); showError('');
  };

  const populateModels = () => {
    const ids = customPricingFormApi.inUseModelIds(state.stats);
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = t('settings.customPricing.selectModel');
    select.append(placeholder);
    for (const id of ids) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id;
      select.append(opt);
    }
    const manual = document.createElement('option');
    manual.value = '__manual__';
    manual.textContent = t('settings.customPricing.manualEntry');
    select.append(manual);
  };

  const closeForm = () => {
    form.classList.add('hidden');
    addButton.classList.remove('hidden');
    resetForm();
  };
  openCustomPricingForm = (prefill) => {
    resetForm();
    populateModels();
    if (prefill && prefill.modelId) {
      const hasOption = [...select.options].some((o) => o.value === prefill.modelId);
      if (hasOption) {
        select.value = prefill.modelId;
      } else {
        select.value = '__manual__';
        manualInput.classList.remove('hidden');
        manualInput.value = prefill.modelId;
      }
      inputEl.value = prefill.inputPerM ?? '';
      outputEl.value = prefill.outputPerM ?? '';
      cacheReadEl.value = prefill.cacheReadPerM ?? '';
      for (const el of [inputEl, outputEl, cacheReadEl]) el.dispatchEvent(new Event('input'));
    }
    form.classList.remove('hidden');
    addButton.classList.add('hidden');
  };

  addButton.addEventListener('click', () => openCustomPricingForm());
  cancelButton.addEventListener('click', closeForm);

  select.addEventListener('change', async () => {
    showError('');
    manualInput.classList.toggle('hidden', select.value !== '__manual__');
    if (!select.value || select.value === '__manual__') { showHint(''); return; }
    const id = select.value;
    showHint(t('settings.customPricing.lookingUp'));
    try {
      const res = await window.tokenMonitor.lookupModelPricing(id);
      if (res?.ok && res.result?.pricing) {
        const p = customPricingFormApi.perMillionFromPricing(res.result);
        if (p.inputPerM !== undefined) inputEl.value = p.inputPerM;
        if (p.outputPerM !== undefined) outputEl.value = p.outputPerM;
        if (p.cacheReadPerM !== undefined) cacheReadEl.value = p.cacheReadPerM;
        for (const el of [inputEl, outputEl, cacheReadEl]) el.dispatchEvent(new Event('input'));
        showHint(t('settings.customPricing.currentPrice', { key: res.result.matchedKey || id, source: res.result.source || '' }));
      } else {
        showHint(t('settings.customPricing.noCurrentPrice'));
      }
    } catch (_) {
      showHint(t('settings.customPricing.noCurrentPrice'));
    }
  });

  for (const el of [inputEl, outputEl, cacheReadEl]) {
    el.addEventListener('input', () => {
      const span = document.getElementById(el.id + 'Approx');
      if (!span) return;
      const v = Number(el.value);
      span.textContent = (el.value !== '' && Number.isFinite(v)) ? `≈ ${formatCost(v)} / 1M` : '';
    });
  }

  saveButton.addEventListener('click', async () => {
    showError('');
    const modelId = selectedModelId();
    if (!modelId) { showError(t('settings.customPricing.errorNoModel')); return; }
    const entry = {
      modelId,
      inputPerM: inputEl.value === '' ? undefined : Number(inputEl.value),
      outputPerM: outputEl.value === '' ? undefined : Number(outputEl.value),
      cacheReadPerM: cacheReadEl.value === '' ? undefined : Number(cacheReadEl.value)
    };
    const hasInput = typeof entry.inputPerM === 'number' && entry.inputPerM > 0;
    const hasOutput = typeof entry.outputPerM === 'number' && entry.outputPerM > 0;
    if (!hasInput && !hasOutput) { showError(t('settings.customPricing.errorNoPrice')); return; }
    const next = customPricingFormApi.upsertOverride(state.settings?.customModelPricing || [], entry);
    await saveSettings({ customModelPricing: next });
    closeForm();
    renderCustomPricing();
  });

  renderCustomPricing();
}

function initSettingsAnimationWrappers() {
  const selectors = [
    '.settings-section-details',
    '.cursor-settings-details',
    '.hub-mode-fields',
    '.presence-feature-body',
    '#cursorManualPanel',
    '#opencodeManualPanel',
    '#deepseekManualPanel',
    '#minimaxManualPanel',
    '#zaiManualPanel',
    '#zaiteamManualPanel',
    '#volcengineManualPanel',
    '#qoderManualPanel',
    '#kimiManualPanel',
    '#ollamaManualPanel'
  ].join(', ');

  document.querySelectorAll(selectors).forEach(el => {
    if (el.children.length === 1 && el.firstChild.classList?.contains('accordion-animation-inner')) return;

    const inner = document.createElement('div');
    // Keep specific class for specific paddings, but add common class for animation
    const innerSpecificClass = el.classList.contains('cursor-settings-details')
      ? 'cursor-settings-details-inner'
      : el.classList.contains('settings-section-details')
        ? 'settings-section-details-inner'
        : 'accordion-animation-inner';

    inner.className = `accordion-animation-inner ${innerSpecificClass}`;
    while (el.firstChild) {
      inner.appendChild(el.firstChild);
    }
    el.appendChild(inner);
    el.classList.add('accordion-animated-container');
  });
}

initSettingsAnimationWrappers();
setupSettingsSections();
setupHubAccountsUI();
setupCustomPricingUI();
setupCustomRangeUI();
init();
