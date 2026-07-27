// DOM Elements
const els = {
  globalToggle: document.getElementById('global-toggle'),
  statusIndicator: document.getElementById('status-indicator'),
  statusText: document.getElementById('status-text'),
  btnOpenOptions: document.getElementById('btn-open-options'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  ruleCount: document.getElementById('rule-count'),
  logCount: document.getElementById('log-count'),
  
  // Rules Tab
  rulesList: document.getElementById('rules-list'),
  rulesEmpty: document.getElementById('rules-empty'),
  btnCreateFirst: document.getElementById('btn-create-first'),
  btnAddRule: document.getElementById('btn-add-rule'),
  ruleSearch: document.getElementById('rule-search'),
  
  // Logs Tab
  logsContainer: document.getElementById('logs-container'),
  logsEmpty: document.getElementById('logs-empty'),
  btnClearLogs: document.getElementById('btn-clear-logs'),
  
  // Tools Tab
  btnExportRules: document.getElementById('btn-export-rules'),
  btnImportTrigger: document.getElementById('btn-import-trigger'),
  importFileInput: document.getElementById('import-file-input'),
  presetBtns: document.querySelectorAll('.preset-btn'),
  
  // Modal
  modal: document.getElementById('rule-modal'),
  modalClose: document.getElementById('modal-close'),
  btnCancelRule: document.getElementById('btn-cancel-rule'),
  ruleForm: document.getElementById('rule-form'),
  modalTitle: document.getElementById('modal-title'),
  editRuleId: document.getElementById('edit-rule-id'),
  headersContainer: document.getElementById('headers-container'),
  btnAddHeader: document.getElementById('btn-add-header'),
  btnFormatJson: document.getElementById('btn-format-json'),
  btnMinifyJson: document.getElementById('btn-minify-json'),
  jsonError: document.getElementById('json-error'),
};

let config = { enabled: true, rules: [] };
let logs = [];
let searchQuery = '';

// Initialize
async function init() {
  await loadConfig();
  await loadLogs();
  setupEventListeners();
  
  // 监听后台数据变化更新日志
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes.modresponse_logs) {
        logs = changes.modresponse_logs.newValue || [];
        renderLogs();
      }
      if (changes.modresponse_config) {
        config = changes.modresponse_config.newValue || { enabled: true, rules: [] };
        renderRules();
        updateGlobalToggleUI();
      }
    }
  });
}

// Data Management
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['modresponse_config'], (result) => {
      if (result.modresponse_config) {
        config = result.modresponse_config;
      }
      updateGlobalToggleUI();
      renderRules();
      resolve();
    });
  });
}

async function saveConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ modresponse_config: config }, () => {
      resolve();
    });
  });
}

async function loadLogs() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['modresponse_logs'], (result) => {
      logs = result.modresponse_logs || [];
      renderLogs();
      resolve();
    });
  });
}

// UI Rendering
function updateGlobalToggleUI() {
  els.globalToggle.checked = config.enabled;
  if (config.enabled) {
    els.statusIndicator.classList.remove('disabled');
    els.statusText.textContent = '已启用';
  } else {
    els.statusIndicator.classList.add('disabled');
    els.statusText.textContent = '已停用';
  }
}

function renderRules() {
  const filteredRules = config.rules.filter(rule => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (rule.name || '').toLowerCase().includes(q) || (rule.pattern || '').toLowerCase().includes(q);
  });

  els.ruleCount.textContent = config.rules.length;

  if (filteredRules.length === 0) {
    els.rulesList.innerHTML = '';
    els.rulesEmpty.classList.remove('hidden');
  } else {
    els.rulesEmpty.classList.add('hidden');
    els.rulesList.innerHTML = filteredRules.map(rule => `
      <div class="rule-card">
        <div class="rule-card-header">
          <div class="rule-info">
            <span class="method-tag ${rule.method || 'ALL'}">${rule.method || 'ALL'}</span>
            <span class="rule-name">${escapeHTML(rule.name)}</span>
          </div>
          <div class="rule-actions">
            <label class="switch-toggle" title="规则开关">
              <input type="checkbox" class="rule-toggle" data-id="${rule.id}" ${rule.enabled ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div class="rule-pattern-row">
          <span>${escapeHTML(rule.matchType === 'regex' ? 'Regex' : rule.matchType === 'wildcard' ? 'Wildcard' : rule.matchType)}</span>
          <span>:</span>
          <span>${escapeHTML(rule.pattern)}</span>
        </div>
        <div class="rule-card-header">
          <span class="badge-status ${getBadgeClass(rule.statusCode)}">HTTP ${rule.statusCode || 200}</span>
          <div class="rule-actions">
            <button class="icon-btn btn-edit-rule" data-id="${rule.id}" title="编辑">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="icon-btn btn-dup-rule" data-id="${rule.id}" title="复制">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button class="icon-btn btn-del-rule" data-id="${rule.id}" title="删除" style="color:var(--danger-color); border-color:rgba(239, 68, 68, 0.3)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }
}

function renderLogs() {
  els.logCount.textContent = logs.length;
  if (logs.length === 0) {
    els.logsContainer.innerHTML = '';
    els.logsEmpty.classList.remove('hidden');
  } else {
    els.logsEmpty.classList.add('hidden');
    els.logsContainer.innerHTML = logs.map(log => `
      <div class="log-item">
        <div class="log-row-top">
          <span class="badge-status ${getBadgeClass(log.statusCode)}">${log.method} ${log.statusCode}</span>
          <span class="log-meta">${log.timestamp} · ${log.duration}ms</span>
        </div>
        <div class="log-url">${escapeHTML(log.url)}</div>
        <div class="log-meta">匹配规则: ${escapeHTML(log.ruleName)} (${log.type})</div>
      </div>
    `).join('');
  }
}

// Event Listeners
function setupEventListeners() {
  // Global Toggle
  els.globalToggle.addEventListener('change', async (e) => {
    config.enabled = e.target.checked;
    await saveConfig();
    updateGlobalToggleUI();
  });

  // Tabs
  els.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      els.tabBtns.forEach(b => b.classList.remove('active'));
      els.tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Open Options
  els.btnOpenOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Rules Actions
  els.rulesList.addEventListener('click', async (e) => {
    const btnDel = e.target.closest('.btn-del-rule');
    const btnEdit = e.target.closest('.btn-edit-rule');
    const btnDup = e.target.closest('.btn-dup-rule');
    const toggle = e.target.closest('.rule-toggle');

    if (btnDel) {
      if(confirm('确定要删除此条规则吗？')) {
        config.rules = config.rules.filter(r => r.id !== btnDel.dataset.id);
        await saveConfig();
      }
    } else if (btnEdit) {
      const rule = config.rules.find(r => r.id === btnEdit.dataset.id);
      if (rule) openRuleModal(rule);
    } else if (btnDup) {
      const rule = config.rules.find(r => r.id === btnDup.dataset.id);
      if (rule) {
        const newRule = JSON.parse(JSON.stringify(rule));
        newRule.id = generateId();
        newRule.name = newRule.name + ' (副本)';
        config.rules.push(newRule);
        await saveConfig();
      }
    } else if (toggle) {
      const rule = config.rules.find(r => r.id === toggle.dataset.id);
      if (rule) {
        rule.enabled = toggle.checked;
        await saveConfig();
      }
    }
  });

  els.ruleSearch.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderRules();
  });

  els.btnAddRule.addEventListener('click', () => openRuleModal());
  els.btnCreateFirst.addEventListener('click', () => openRuleModal());

  // Modal
  els.modalClose.addEventListener('click', closeModal);
  els.btnCancelRule.addEventListener('click', closeModal);
  
  els.btnAddHeader.addEventListener('click', () => {
    addHeaderRow();
  });

  els.btnFormatJson.addEventListener('click', () => {
    const el = document.getElementById('rule-body');
    try {
      const parsed = JSON.parse(el.value);
      el.value = JSON.stringify(parsed, null, 2);
      els.jsonError.classList.add('hidden');
    } catch (e) {
      els.jsonError.classList.remove('hidden');
    }
  });

  els.btnMinifyJson.addEventListener('click', () => {
    const el = document.getElementById('rule-body');
    try {
      const parsed = JSON.parse(el.value);
      el.value = JSON.stringify(parsed);
      els.jsonError.classList.add('hidden');
    } catch (e) {
      els.jsonError.classList.remove('hidden');
    }
  });

  els.ruleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    els.jsonError.classList.add('hidden');
    
    const ruleType = document.getElementById('rule-type').value;
    const bodyContent = document.getElementById('rule-body').value;
    if (ruleType === 'json' && bodyContent.trim() !== '') {
      try {
        JSON.parse(bodyContent);
      } catch (err) {
        els.jsonError.classList.remove('hidden');
        return;
      }
    }

    const headers = [];
    document.querySelectorAll('.header-row').forEach(row => {
      const name = row.querySelector('.h-name').value.trim();
      const val = row.querySelector('.h-val').value.trim();
      if (name && val) {
        headers.push({ name, value: val });
      }
    });

    const ruleData = {
      name: document.getElementById('rule-name').value.trim(),
      method: document.getElementById('rule-method').value,
      matchType: document.getElementById('rule-match-type').value,
      pattern: document.getElementById('rule-pattern').value.trim(),
      statusCode: parseInt(document.getElementById('rule-status').value, 10),
      delay: parseInt(document.getElementById('rule-delay').value, 10) || 0,
      responseType: ruleType,
      responseHeaders: headers,
      responseBody: bodyContent
    };

    const id = els.editRuleId.value;
    if (id) {
      const index = config.rules.findIndex(r => r.id === id);
      if (index > -1) {
        config.rules[index] = { ...config.rules[index], ...ruleData };
      }
    } else {
      ruleData.id = generateId();
      ruleData.enabled = true;
      config.rules.push(ruleData);
    }

    await saveConfig();
    closeModal();
  });

  // Logs
  els.btnClearLogs.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'CLEAR_LOGS' }, () => {
      logs = [];
      renderLogs();
    });
  });

  // Tools
  els.btnExportRules.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "modresponse_rules_export.json";
    a.click();
  });

  els.btnImportTrigger.addEventListener('click', () => {
    els.importFileInput.click();
  });

  els.importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported && Array.isArray(imported.rules)) {
          config = imported;
          await saveConfig();
          alert('导入成功！');
          els.importFileInput.value = '';
        } else {
          alert('无效的配置文件！');
        }
      } catch (err) {
        alert('解析 JSON 失败！');
      }
    };
    reader.readAsText(file);
  });

  // Presets
  els.presetBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const type = e.target.dataset.preset;
      let template = null;
      if (type === 'json-success') {
        template = { name: '模板：200 JSON', method: 'GET', matchType: 'contains', pattern: '/api/success', statusCode: 200, delay: 0, responseType: 'json', responseBody: '{\n  "code": 200,\n  "msg": "success"\n}' };
      } else if (type === 'error-404') {
        template = { name: '模板：404 Not Found', method: 'ALL', matchType: 'contains', pattern: '/api/notfound', statusCode: 404, delay: 0, responseType: 'json', responseBody: '{\n  "error": "Not Found"\n}' };
      } else if (type === 'error-500') {
        template = { name: '模板：500 Error', method: 'POST', matchType: 'contains', pattern: '/api/fail', statusCode: 500, delay: 0, responseType: 'json', responseBody: '{\n  "error": "Internal Server Error"\n}' };
      } else if (type === 'slow-delay') {
        template = { name: '模板：慢请求模拟', method: 'ALL', matchType: 'contains', pattern: '/api/slow', statusCode: 200, delay: 2000, responseType: 'json', responseBody: '{\n  "msg": "Delayed response"\n}' };
      }

      if (template) {
        template.id = generateId();
        template.enabled = true;
        template.responseHeaders = [{name: 'Content-Type', value: 'application/json'}];
        config.rules.push(template);
        await saveConfig();
        els.tabBtns[0].click(); // switch to rules tab
      }
    });
  });
}

// Modal Helpers
function openRuleModal(rule = null) {
  els.jsonError.classList.add('hidden');
  els.headersContainer.innerHTML = '';
  
  if (rule) {
    els.modalTitle.textContent = '编辑 Mock 规则';
    els.editRuleId.value = rule.id;
    document.getElementById('rule-name').value = rule.name || '';
    document.getElementById('rule-method').value = rule.method || 'ALL';
    document.getElementById('rule-match-type').value = rule.matchType || 'contains';
    document.getElementById('rule-pattern').value = rule.pattern || '';
    document.getElementById('rule-status').value = rule.statusCode || 200;
    document.getElementById('rule-delay').value = rule.delay || 0;
    document.getElementById('rule-type').value = rule.responseType || 'json';
    document.getElementById('rule-body').value = rule.responseBody || '';
    
    if (rule.responseHeaders && rule.responseHeaders.length > 0) {
      rule.responseHeaders.forEach(h => addHeaderRow(h.name, h.value));
    } else {
      addHeaderRow('Content-Type', 'application/json');
    }
  } else {
    els.modalTitle.textContent = '新建 Mock 规则';
    els.editRuleId.value = '';
    els.ruleForm.reset();
    document.getElementById('rule-status').value = 200;
    document.getElementById('rule-delay').value = 0;
    addHeaderRow('Content-Type', 'application/json');
  }
  
  els.modal.classList.remove('hidden');
}

function closeModal() {
  els.modal.classList.add('hidden');
}

function addHeaderRow(name = '', value = '') {
  const div = document.createElement('div');
  div.className = 'header-row';
  div.innerHTML = `
    <input type="text" class="h-name" placeholder="Header Key (如 x-token)" value="${escapeHTML(name)}">
    <input type="text" class="h-val" placeholder="Value" value="${escapeHTML(value)}">
    <button type="button" class="icon-btn btn-remove-header" style="color:var(--danger-color);border-color:transparent;">&times;</button>
  `;
  div.querySelector('.btn-remove-header').addEventListener('click', () => div.remove());
  els.headersContainer.appendChild(div);
}

// Utils
function generateId() {
  return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
}

function getBadgeClass(status) {
  const code = parseInt(status, 10) || 200;
  if (code >= 200 && code < 300) return 's2xx';
  if (code >= 400 && code < 500) return 's4xx';
  if (code >= 500) return 's5xx';
  return 's4xx'; // default warning color
}

// Run
document.addEventListener('DOMContentLoaded', init);
