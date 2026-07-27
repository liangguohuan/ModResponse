// 极简后台 Service Worker

// 默认预设演示规则
const DEFAULT_RULES = [
  {
    id: 'demo_rule_1',
    name: '示例：Mock 用户信息接口',
    enabled: true,
    matchType: 'contains',
    pattern: '/api/user/profile',
    method: 'GET',
    statusCode: 200,
    delay: 300,
    responseType: 'json',
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'X-Mock-By', value: 'ModResponse' }
    ],
    responseBody: JSON.stringify({
      code: 200,
      message: 'success',
      data: {
        userId: 88888,
        username: 'Antigravity Developer',
        role: 'Administrator',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Antigravity',
        vipStatus: true,
        permissions: ['read', 'write', 'admin']
      }
    }, null, 2)
  },
  {
    id: 'demo_rule_2',
    name: '示例：模拟 500 服务器异常',
    enabled: false,
    matchType: 'contains',
    pattern: '/api/checkout',
    method: 'POST',
    statusCode: 500,
    delay: 500,
    responseType: 'json',
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json' }
    ],
    responseBody: JSON.stringify({
      code: 500,
      error: 'Internal Server Error',
      message: '支付服务超时或内部故障！(由 ModResponse 伪造)'
    }, null, 2)
  }
];

// 初始化默认配置
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['modresponse_config'], (result) => {
    if (!result.modresponse_config) {
      chrome.storage.local.set({
        modresponse_config: {
          enabled: true,
          rules: DEFAULT_RULES
        },
        modresponse_logs: [],
        intercept_count: 0
      });
    }
  });
});

// 监听通信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'LOG_INTERCEPT') {
    handleLogIntercept(message.log, sender);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'CLEAR_LOGS') {
    chrome.storage.local.set({ modresponse_logs: [], intercept_count: 0 }, () => {
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ success: true });
    });
    return true;
  }
});

// 处理日志与 Badge 计数逻辑
function handleLogIntercept(logItem, sender) {
  chrome.storage.local.get(['modresponse_logs', 'intercept_count'], (result) => {
    const logs = result.modresponse_logs || [];
    const count = (result.intercept_count || 0) + 1;

    // 最多保存 100 条日志
    logs.unshift(logItem);
    if (logs.length > 100) logs.pop();

    chrome.storage.local.set({
      modresponse_logs: logs,
      intercept_count: count
    });

    // 更新图标 Badge 计数
    chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  });
}
