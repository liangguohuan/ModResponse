(function () {
  if (window.__MODRESPONSE_INJECTED__) return;
  window.__MODRESPONSE_INJECTED__ = true;

  // 全局配置与规则列表缓存
  let state = {
    enabled: true,
    rules: []
  };

  // 监听来自 content.js 的配置更新消息
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.type !== 'MODRESPONSE_UPDATE_CONFIG') {
      return;
    }
    state = event.data.payload || { enabled: true, rules: [] };
  });

  // 通知 content.js 记录日志
  function notifyLog(logData) {
    window.postMessage({
      type: 'MODRESPONSE_LOG_EVENT',
      payload: logData
    }, '*');
  }

  // URL 匹配算法
  function matchUrl(pattern, matchType, targetUrl) {
    if (!pattern || !targetUrl) return false;
    try {
      if (matchType === 'exact') {
        return targetUrl === pattern || targetUrl.split('?')[0] === pattern;
      }
      if (matchType === 'contains') {
        return targetUrl.includes(pattern);
      }
      if (matchType === 'wildcard') {
        // 通配符转换为正则，如 *api/user*
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        const reg = new RegExp('^' + escaped + '$', 'i');
        return reg.test(targetUrl);
      }
      if (matchType === 'regex') {
        const reg = new RegExp(pattern, 'i');
        return reg.test(targetUrl);
      }
    } catch (e) {
      console.warn('[ModResponse] Rule pattern match error:', e);
    }
    return false;
  }

  // 匹配合适规则
  function findMatchingRule(url, method) {
    if (!state.enabled || !state.rules || state.rules.length === 0) return null;
    const reqMethod = (method || 'GET').toUpperCase();
    
    for (const rule of state.rules) {
      if (!rule.enabled) continue;
      
      // 方法匹配
      const ruleMethod = (rule.method || 'ALL').toUpperCase();
      if (ruleMethod !== 'ALL' && ruleMethod !== reqMethod) {
        continue;
      }
      
      // URL 匹配
      if (matchUrl(rule.pattern, rule.matchType || 'contains', url)) {
        return rule;
      }
    }
    return null;
  }

  // ==========================================
  // 1. 拦截 window.fetch
  // ==========================================
  const rawFetch = window.fetch;
  window.fetch = async function (input, init) {
    let url = '';
    let method = 'GET';

    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input && typeof input === 'object' && input.url) {
      url = input.url;
      method = input.method || method;
    }

    if (init && init.method) {
      method = init.method;
    }

    // 绝对路径转换
    try {
      url = new URL(url, window.location.href).href;
    } catch (e) {
      // 保留原 url
    }

    const matchedRule = findMatchingRule(url, method);

    if (matchedRule) {
      const startTime = Date.now();
      const delay = parseInt(matchedRule.delay, 10) || 0;

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // 构建 Headers
      const headers = new Headers();
      let hasContentType = false;
      if (matchedRule.responseHeaders && Array.isArray(matchedRule.responseHeaders)) {
        matchedRule.responseHeaders.forEach(h => {
          if (h.name && h.value) {
            headers.append(h.name, h.value);
            if (h.name.toLowerCase() === 'content-type') hasContentType = true;
          }
        });
      }
      if (!hasContentType) {
        headers.set('Content-Type', matchedRule.responseType === 'json' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8');
      }

      const bodyText = matchedRule.responseBody || '';
      const statusCode = parseInt(matchedRule.statusCode, 10) || 200;
      const statusText = matchedRule.statusText || (statusCode === 200 ? 'OK' : 'Mocked');

      // 记录拦截日志
      notifyLog({
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toLocaleTimeString(),
        type: 'Fetch',
        url: url,
        method: method,
        ruleName: matchedRule.name || '未命名规则',
        statusCode: statusCode,
        delay: delay,
        duration: Date.now() - startTime
      });

      const responseInit = {
        status: statusCode,
        statusText: statusText,
        headers: headers
      };

      // 针对 Server-Sent Events (SSE) 特殊处理：使用 ReadableStream 保持连接不断开
      let isSSE = false;
      headers.forEach((value, key) => {
        if (key.toLowerCase() === 'content-type' && value.includes('text/event-stream')) {
          isSSE = true;
        }
      });

      if (isSSE && window.ReadableStream) {
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            // 先发送一次匹配的响应体内容
            if (bodyText) {
              controller.enqueue(encoder.encode(bodyText));
            }
            // 不调用 controller.close()，保持流处于开启状态，阻止客户端自动断线重试
            
            // 可以选择定期发一个心跳保持存活 (模拟真实 SSE 行为)
            const interval = setInterval(() => {
              controller.enqueue(encoder.encode(':\n\n')); // comment heartbeat
            }, 10000);

            // 当客户端中止请求时清理
            return () => clearInterval(interval);
          }
        });
        return new Response(stream, responseInit);
      } else {
        return new Response(bodyText, responseInit);
      }
    }

    return rawFetch.apply(this, arguments);
  };

  // ==========================================
  // 2. 拦截 XMLHttpRequest (XHR)
  // ==========================================
  const rawXHR = window.XMLHttpRequest;

  function CustomXHR() {
    const xhr = new rawXHR();
    let _url = '';
    let _method = 'GET';
    let _matchedRule = null;
    let _listeners = {};

    const self = this;

    // 复制原 XHR 的所有可枚举属性和事件句柄代理
    this._xhr = xhr;

    // 属性代理
    ['responseType', 'timeout', 'withCredentials'].forEach(prop => {
      Object.defineProperty(self, prop, {
        get: () => xhr[prop],
        set: (val) => { xhr[prop] = val; }
      });
    });

    // 拦截 open
    this.open = function (method, url, async, user, password) {
      _method = method || 'GET';
      _url = url;
      try {
        _url = new URL(url, window.location.href).href;
      } catch (e) {}

      _matchedRule = findMatchingRule(_url, _method);
      if (!_matchedRule) {
        return xhr.open.apply(xhr, arguments);
      }
    };

    // 拦截 setRequestHeader
    this.setRequestHeader = function (header, value) {
      if (!_matchedRule) {
        return xhr.setRequestHeader.apply(xhr, arguments);
      }
    };

    // 拦截 addEventListener
    this.addEventListener = function (type, listener, options) {
      if (!_listeners[type]) _listeners[type] = [];
      _listeners[type].push(listener);
      return xhr.addEventListener.apply(xhr, arguments);
    };

    this.removeEventListener = function (type, listener, options) {
      if (_listeners[type]) {
        _listeners[type] = _listeners[type].filter(l => l !== listener);
      }
      return xhr.removeEventListener.apply(xhr, arguments);
    };

    // 触发局部与全局事件
    function dispatchXHREvent(type) {
      const event = new Event(type);
      if (typeof self['on' + type] === 'function') {
        self['on' + type].call(self, event);
      }
      if (_listeners[type]) {
        _listeners[type].forEach(fn => fn.call(self, event));
      }
    }

    // 拦截 send
    this.send = function (body) {
      if (!_matchedRule) {
        // 绑定原事件代理机制
        xhr.onreadystatechange = function (e) {
          if (typeof self.onreadystatechange === 'function') self.onreadystatechange(e);
        };
        xhr.onload = function (e) {
          if (typeof self.onload === 'function') self.onload(e);
        };
        xhr.onerror = function (e) {
          if (typeof self.onerror === 'function') self.onerror(e);
        };
        return xhr.send.apply(xhr, arguments);
      }

      // 开始实施 Mock 逻辑
      const startTime = Date.now();
      const delay = parseInt(_matchedRule.delay, 10) || 0;
      const statusCode = parseInt(_matchedRule.statusCode, 10) || 200;
      const responseBody = _matchedRule.responseBody || '';

      setTimeout(() => {
        // 构造伪造数据
        let finalResponse = responseBody;
        if (self.responseType === 'json') {
          try {
            finalResponse = JSON.parse(responseBody);
          } catch (e) {
            finalResponse = null;
          }
        }

        // 定义可读响应属性
        Object.defineProperties(self, {
          readyState: { value: 4, writable: false },
          status: { value: statusCode, writable: false },
          statusText: { value: statusCode === 200 ? 'OK' : 'Mocked', writable: false },
          responseText: { value: responseBody, writable: false },
          response: { value: finalResponse, writable: false },
          responseURL: { value: _url, writable: false }
        });

        // 标头处理
        self.getAllResponseHeaders = function () {
          let headersStr = '';
          if (_matchedRule.responseHeaders && Array.isArray(_matchedRule.responseHeaders)) {
            _matchedRule.responseHeaders.forEach(h => {
              if (h.name && h.value) headersStr += `${h.name.toLowerCase()}: ${h.value}\r\n`;
            });
          }
          if (!headersStr.includes('content-type')) {
            headersStr += `content-type: ${_matchedRule.responseType === 'json' ? 'application/json' : 'text/plain'}\r\n`;
          }
          return headersStr;
        };

        self.getResponseHeader = function (headerName) {
          const headers = self.getAllResponseHeaders().split('\r\n');
          for (let h of headers) {
            const parts = h.split(': ');
            if (parts[0].toLowerCase() === (headerName || '').toLowerCase()) {
              return parts[1];
            }
          }
          return null;
        };

        // 记录日志
        notifyLog({
          id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toLocaleTimeString(),
          type: 'XHR',
          url: _url,
          method: _method,
          ruleName: _matchedRule.name || '未命名规则',
          statusCode: statusCode,
          delay: delay,
          duration: Date.now() - startTime
        });

        // 模拟状态变更状态序列
        dispatchXHREvent('readystatechange');
        dispatchXHREvent('load');
        dispatchXHREvent('loadend');

      }, delay);
    };

    // 其他 XHR 方法代理
    this.abort = function () { xhr.abort(); };
    this.overrideMimeType = function (mime) { xhr.overrideMimeType(mime); };
  }

  window.XMLHttpRequest = CustomXHR;

  // ==========================================
  // 3. 拦截原生 EventSource (SSE)
  // ==========================================
  const rawEventSource = window.EventSource;
  if (rawEventSource) {
    function CustomEventSource(url, eventSourceInitDict) {
      let _url = url;
      try { _url = new URL(url, window.location.href).href; } catch(e) {}
      
      const matchedRule = findMatchingRule(_url, 'GET');
      
      if (!matchedRule) {
        return new rawEventSource(url, eventSourceInitDict);
      }
      
      // 使用纯 plain object，避免继承原生 EventSource prototype 上的 native getter/setter
      // 所有原生属性（url, readyState, withCredentials, close 等）均用 defineProperty 定义，
      // 防止触发 native 层导致 Illegal invocation
      const es = {};

      // 静态常量
      es.CONNECTING = 0;
      es.OPEN = 1;
      es.CLOSED = 2;

      // url（只读）
      Object.defineProperty(es, 'url', {
        value: _url, writable: false, configurable: true, enumerable: true
      });

      // readyState（可读写，绕过 native getter/setter）
      let _readyState = 0; // CONNECTING
      Object.defineProperty(es, 'readyState', {
        get() { return _readyState; },
        set(v) { _readyState = v; },
        configurable: true, enumerable: true
      });

      // withCredentials（可读写）
      let _withCredentials = eventSourceInitDict?.withCredentials || false;
      Object.defineProperty(es, 'withCredentials', {
        get() { return _withCredentials; },
        set(v) { _withCredentials = v; },
        configurable: true, enumerable: true
      });

      // 事件处理器属性
      es.onopen = null;
      es.onmessage = null;
      es.onerror = null;

      let listeners = {};
      es.addEventListener = function(type, listener) {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(listener);
      };
      es.removeEventListener = function(type, listener) {
        if (listeners[type]) {
          listeners[type] = listeners[type].filter(l => l !== listener);
        }
      };
      es.dispatchEvent = function(event) {
        if (typeof es['on' + event.type] === 'function') {
          es['on' + event.type](event);
        }
        if (listeners[event.type]) {
          listeners[event.type].forEach(fn => fn(event));
        }
      };
      es.close = function() {
        es.readyState = es.CLOSED;
      };
      
      const delay = parseInt(matchedRule.delay, 10) || 50;
      
      setTimeout(() => {
        if (es.readyState === es.CLOSED) return;
        
        es.readyState = es.OPEN;
        es.dispatchEvent(new Event('open'));
        
        let mockData = matchedRule.responseBody || '';
        // 自动解析规则中带有的 'data: ' 前缀
        if (mockData.startsWith('data:')) {
          mockData = mockData.replace(/^data:\s*/, '').trim();
        }
        
        if (mockData) {
          const msgEvent = new MessageEvent('message', {
            data: mockData,
            origin: window.location.origin
          });
          es.dispatchEvent(msgEvent);
        }
        
        notifyLog({
          id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toLocaleTimeString(),
          type: 'EventSource',
          url: _url,
          method: 'GET',
          ruleName: matchedRule.name || '未命名规则',
          statusCode: matchedRule.statusCode || 200,
          delay: delay,
          duration: 0
        });

      }, delay);
      
      return es;
    }
    window.EventSource = CustomEventSource;
  }

  console.log('[ModResponse] HTTP Response Mock Hook Injected Successfully.');
})();
