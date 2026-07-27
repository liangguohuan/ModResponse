(function () {
  // 注入 injected.js 到 DOM MAIN world
  function injectScript() {
    try {
      const container = document.head || document.documentElement;
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('injected.js');
      script.onload = function () {
        script.remove();
        syncConfigToInjected();
      };
      container.insertBefore(script, container.children[0]);
    } catch (e) {
      console.error('[ModResponse] Failed to inject script:', e);
    }
  }

  // 同步配置数据到页面的 injected.js
  function syncConfigToInjected() {
    chrome.storage.local.get(['modresponse_config'], (result) => {
      const config = result.modresponse_config || { enabled: true, rules: [] };
      window.postMessage({
        type: 'MODRESPONSE_UPDATE_CONFIG',
        payload: config
      }, '*');
    });
  }

  // 监听 storage 变更，实时更新 injected.js 配置
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.modresponse_config) {
      const newConfig = changes.modresponse_config.newValue || { enabled: true, rules: [] };
      window.postMessage({
        type: 'MODRESPONSE_UPDATE_CONFIG',
        payload: newConfig
      }, '*');
    }
  });

  // 监听 injected.js 发出的拦截日志消息，转发给 Background Service Worker
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.type !== 'MODRESPONSE_LOG_EVENT') {
      return;
    }
    const logData = event.data.payload;
    if (logData) {
      chrome.runtime.sendMessage({
        action: 'LOG_INTERCEPT',
        log: logData
      }).catch(() => {
        // 忽略端口关闭等非致命错误
      });
    }
  });

  // 执行脚本注入
  injectScript();
})();
