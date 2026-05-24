/*[CDN]*/(function (window, document) {
    'use strict';

    /**
     * 轻量 API 封装，签名贴近 ixs/static/lib/app.js 的 window.API
     * 用法：
     *   API.post('admin/ticket_review', {ticket_id: 1, action: 'approve'}, function (resp) {})
     *   API.get('list', {page: 1}, function (resp) {})
     */
    var API = {
        base: '/v1/api/',
        url: function (path) {
            if (/^https?:\/\//.test(path)) {
                return path;
            }
            if (path.charAt(0) === '/') {
                return path;
            }
            return API.base + path.replace(/^\/+/, '');
        },
        encode: function (params) {
            params = params || {};
            var parts = [];
            for (var k in params) {
                if (!Object.prototype.hasOwnProperty.call(params, k)) {
                    continue;
                }
                var v = params[k];
                if (v === undefined || v === null) {
                    continue;
                }
                if (Array.isArray(v)) {
                    for (var i = 0; i < v.length; i++) {
                        parts.push(encodeURIComponent(k + '[]') + '=' + encodeURIComponent(v[i]));
                    }
                } else if (typeof v === 'object') {
                    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(JSON.stringify(v)));
                } else {
                    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
                }
            }
            return parts.join('&');
        },
        request: function (method, path, params, success, fail) {
            var url = API.url(path);
            var body = null;
            if (method === 'GET') {
                var query = API.encode(params);
                if (query) {
                    url += (url.indexOf('?') > -1 ? '&' : '?') + query;
                }
            } else {
                body = API.encode(params);
            }
            var headers = {'Accept': 'application/json'};
            if (method !== 'GET') {
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }
            return fetch(url, {
                method: method,
                headers: headers,
                credentials: 'same-origin',
                body: body,
            }).then(function (resp) {
                return resp.json().catch(function () { return {error: 1, data: 'invalid json'}; });
            }).then(function (data) {
                if (data && data.error == 0) {
                    success && success(data);
                } else {
                    if (fail) {
                        fail(data);
                    } else {
                        Toast.error(formatApiMessage(data, 'request failed'));
                    }
                }
                return data;
            }).catch(function (err) {
                var data = {error: 1, data: String(err && err.message || err)};
                fail ? fail(data) : Toast.error(data.data);
                return data;
            });
        },
        get: function (path, params, success, fail) {
            return API.request('GET', path, params, success, fail);
        },
        post: function (path, params, success, fail) {
            return API.request('POST', path, params, success, fail);
        },
    };

    function formatApiMessage(resp, fallback) {
        if (!resp) {
            return fallback || 'request failed';
        }
        var raw = resp.data;
        if (typeof raw === 'string') {
            return raw || fallback || 'request failed';
        }
        if (raw === null || raw === undefined) {
            return fallback || 'request failed';
        }
        if (typeof raw === 'object') {
            if (typeof raw.msg === 'string' && raw.msg) {
                return raw.msg;
            }
            if (typeof raw.message === 'string' && raw.message) {
                return raw.message;
            }
            try {
                return JSON.stringify(raw);
            } catch (e) {
                return fallback || 'request failed';
            }
        }
        return String(raw);
    }

    /**
     * 简易 Toast：右下角弹出，自动消失
     */
    var Toast = (function () {
        var container = null;
        var max_count = 4;
        var duplicate_window_ms = 1600;
        var duration_map = {
            success: 2200,
            info: 2400,
            warn: 3000,
            error: 4200,
        };
        var duplicate_cache = {};

        function ensure() {
            if (container) return container;
            container = document.createElement('div');
            container.className = 'an-toast-container';
            document.body.appendChild(container);
            return container;
        }

        function remove(el) {
            if (!el || !el.parentNode) return;
            if (el.__anTimer) {
                clearTimeout(el.__anTimer);
                el.__anTimer = null;
            }
            el.classList.remove('an-toast--show');
            setTimeout(function () {
                el.parentNode && el.parentNode.removeChild(el);
            }, 240);
        }

        function text(msg) {
            if (msg === null || msg === undefined) return '';
            if (typeof msg === 'string') return msg;
            if (typeof msg === 'object') {
                try {
                    return JSON.stringify(msg);
                } catch (e) {
                    return '[object]';
                }
            }
            return String(msg);
        }

        function setTimer(el, ms) {
            if (el.__anTimer) {
                clearTimeout(el.__anTimer);
            }
            el.__anRemain = ms;
            el.__anStartAt = Date.now();
            el.__anTimer = setTimeout(function () {
                remove(el);
            }, ms);
        }

        function trimOverflow() {
            while (container && container.children.length > max_count) {
                remove(container.children[0]);
            }
        }

        function show(msg, type, options) {
            ensure();
            var kind = type || 'info';
            var opts = options || {};
            var content = text(msg);
            var cache_key = kind + '::' + content;
            var now = Date.now();
            var cache_row = duplicate_cache[cache_key];
            if (cache_row && (now - cache_row.at < duplicate_window_ms) && cache_row.el && cache_row.el.parentNode) {
                setTimer(cache_row.el, cache_row.ms || duration_map[kind] || duration_map.info);
                return;
            }

            var el = document.createElement('div');
            el.className = 'an-toast an-toast--' + kind;
            el.setAttribute('role', 'status');
            el.innerHTML = '<span class="an-toast__text"></span><button type="button" class="an-toast__close" aria-label="close">×</button>';
            el.querySelector('.an-toast__text').textContent = content;
            var close_btn = el.querySelector('.an-toast__close');
            close_btn.style.marginLeft = '8px';
            close_btn.style.border = '0';
            close_btn.style.background = 'transparent';
            close_btn.style.color = 'inherit';
            close_btn.style.fontSize = '16px';
            close_btn.style.cursor = 'pointer';
            close_btn.addEventListener('click', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                remove(el);
            });

            el.addEventListener('mouseenter', function () {
                if (!el.__anTimer) return;
                clearTimeout(el.__anTimer);
                el.__anTimer = null;
                var past = Date.now() - (el.__anStartAt || Date.now());
                el.__anRemain = Math.max(300, (el.__anRemain || 0) - past);
            });
            el.addEventListener('mouseleave', function () {
                setTimer(el, Math.max(300, el.__anRemain || 800));
            });

            container.appendChild(el);
            trimOverflow();
            setTimeout(function () { el.classList.add('an-toast--show'); }, 10);
            var duration = Math.max(800, parseInt(opts.duration, 10) || duration_map[kind] || duration_map.info);
            setTimer(el, duration);
            duplicate_cache[cache_key] = {
                at: now,
                el: el,
                ms: duration,
            };
        }

        return {
            show: function (m, t, o) { show(m, t, o || {}); },
            info: function (m, o) { show(m, 'info', o || {}); },
            success: function (m, o) { show(m, 'success', o || {}); },
            error: function (m, o) { show(m, 'error', o || {}); },
            warn: function (m, o) { show(m, 'warn', o || {}); },
            clear: function () {
                if (!container) return;
                while (container.firstChild) {
                    remove(container.firstChild);
                }
            },
        };
    })();

    /**
     * 表单提交统一绑定：
     *   <form class="admin-form" data-api="admin/topic_crud" data-method="POST">...</form>
     * 提交后用 Toast 提示，支持 data-confirm。
     */
    function bindAdminForms(scope) {
        scope = scope || document;
        var forms = scope.querySelectorAll('form[data-api]');
        Array.prototype.forEach.call(forms, function (form) {
            if (form.__anBound) return;
            form.__anBound = true;
            form.addEventListener('submit', function (ev) {
                ev.preventDefault();
                var confirmText = form.getAttribute('data-confirm');
                if (confirmText && !window.confirm(confirmText)) {
                    return;
                }
                var fd = new FormData(form);
                var data = {};
                fd.forEach(function (value, key) {
                    if (key.endsWith('[]')) {
                        var pure = key.slice(0, -2);
                        if (!data[pure]) data[pure] = [];
                        data[pure].push(value);
                    } else if (data[key] !== undefined) {
                        if (!Array.isArray(data[key])) data[key] = [data[key]];
                        data[key].push(value);
                    } else {
                        data[key] = value;
                    }
                });
                var method = (form.getAttribute('data-method') || 'POST').toUpperCase();
                var api = form.getAttribute('data-api');
                API.request(method, api, data, function (resp) {
                    var extId = resp.extend && (resp.extend.id || resp.extend.site_id || resp.extend.ticket_id);
                    Toast.success((resp.data || 'ok') + (extId ? ' / id=' + extId : ''));
                    if (form.getAttribute('data-reload') === '1') {
                        setTimeout(function () { location.reload(); }, 600);
                    }
                });
            });
        });
    }

    /**
     * 按钮统一绑定：
     *   <button data-api="admin/ticket_review" data-method="POST"
     *           data-payload='{"ticket_id":1,"op":"approve"}'
     *           data-confirm="确认通过？" data-reload="1">通过</button>
     *   <button data-api="admin/ticket_review" data-prompt="reason" data-op="reject"
     *           data-payload='{"ticket_id":1,"op":"reject"}'>驳回</button>
     */
    function bindAdminButtons(scope) {
        scope = scope || document;
        var btns = scope.querySelectorAll('[data-api]');
        Array.prototype.forEach.call(btns, function (btn) {
            if (btn.tagName === 'FORM') return;
            if (btn.__anBound) return;
            btn.__anBound = true;
            btn.addEventListener('click', function (ev) {
                if (btn.tagName === 'A') ev.preventDefault();
                var confirmText = btn.getAttribute('data-confirm');
                if (confirmText && !window.confirm(confirmText)) return;
                var payload = {};
                try {
                    payload = JSON.parse(btn.getAttribute('data-payload') || '{}');
                } catch (e) {
                    Toast.error('payload 解析失败');
                    return;
                }
                if (!payload.op) {
                    payload.op = btn.getAttribute('data-op') || '';
                }
                // 兼容历史按钮：把 action 映射到 op，并避免保留字冲突。
                if (!payload.op && payload.action) {
                    payload.op = payload.action;
                }
                if (payload.action !== undefined) {
                    delete payload.action;
                }
                if (!payload.ticket_id) {
                    var ticketId = parseInt(btn.getAttribute('data-ticket-id') || '0', 10);
                    if (ticketId > 0) {
                        payload.ticket_id = ticketId;
                    }
                }
                var promptKey = btn.getAttribute('data-prompt');
                if (promptKey) {
                    var promptVal = window.prompt(btn.getAttribute('data-prompt-label') || promptKey, '');
                    if (promptVal === null) return;
                    payload[promptKey] = promptVal;
                }
                var method = (btn.getAttribute('data-method') || 'POST').toUpperCase();
                API.request(method, btn.getAttribute('data-api'), payload, function (resp) {
                    Toast.success(resp.data || 'ok');
                    if (btn.getAttribute('data-reload') === '1') {
                        setTimeout(function () { location.reload(); }, 600);
                    }
                });
            });
        });
    }

    function bindTicketEditorModal(scope) {
        scope = scope || document;
        var open_btns = scope.querySelectorAll('[data-ticket-edit-open]');
        Array.prototype.forEach.call(open_btns, function (btn) {
            if (btn.__anModalBound) return;
            btn.__anModalBound = true;
            btn.addEventListener('click', function () {
                var row = btn.closest('tr');
                if (!row) return;
                var modal = row.querySelector('[data-ticket-modal]');
                if (!modal) return;
                modal.classList.add('is-open');
                document.body.style.overflow = 'hidden';
            });
        });

        var close_btns = scope.querySelectorAll('[data-ticket-edit-close]');
        Array.prototype.forEach.call(close_btns, function (btn) {
            if (btn.__anModalCloseBound) return;
            btn.__anModalCloseBound = true;
            btn.addEventListener('click', function () {
                var modal = btn.closest('[data-ticket-modal]');
                if (!modal) return;
                modal.classList.remove('is-open');
                document.body.style.overflow = '';
            });
        });

        if (!document.__anTicketEscBound) {
            document.__anTicketEscBound = true;
            document.addEventListener('keydown', function (ev) {
                if (ev.key !== 'Escape') return;
                var opened = document.querySelector('[data-ticket-modal].is-open');
                if (!opened) return;
                opened.classList.remove('is-open');
                document.body.style.overflow = '';
            });
        }
    }

    function bindCompareBasket(scope) {
        scope = scope || document;
        var storage_key = 'ainav_compare_eids';

        function readEids() {
            try {
                var raw = localStorage.getItem(storage_key) || '[]';
                var arr = JSON.parse(raw);
                if (!Array.isArray(arr)) return [];
                return arr.map(function (eid) { return String(eid || '').trim(); }).filter(function (eid) { return eid !== ''; });
            } catch (e) {
                return [];
            }
        }

        function writeEids(arr) {
            var list = (arr || []).slice(0, 4);
            localStorage.setItem(storage_key, JSON.stringify(list));
        }

        function refreshLink() {
            var list = readEids();
            var count = scope.querySelector('[data-compare-count]');
            if (count) {
                count.textContent = String(list.length);
            }
            var link = scope.querySelector('[data-compare-link]');
            if (link) {
                var base = link.getAttribute('href') || '/compare/';
                base = base.split('?')[0];
                if (list.length > 0) {
                    link.setAttribute('href', base + '?eids=' + encodeURIComponent(list.join(',')));
                } else {
                    link.setAttribute('href', base);
                }
            }
        }

        var add_btns = scope.querySelectorAll('[data-compare-add]');
        Array.prototype.forEach.call(add_btns, function (btn) {
            if (btn.__anCompareBound) return;
            btn.__anCompareBound = true;
            btn.addEventListener('click', function () {
                var eid = String(btn.getAttribute('data-compare-add') || '').trim();
                if (!eid) return;
                var list = readEids();
                if (list.indexOf(eid) === -1) {
                    list.push(eid);
                    if (list.length > 4) {
                        list = list.slice(list.length - 4);
                    }
                    writeEids(list);
                    Toast.success('已加入对比');
                    refreshLink();
                } else {
                    Toast.info('该站点已在对比列表');
                }
            });
        });
        refreshLink();
    }

    window.API = API;
    window.Toast = Toast;
    window.ainavBind = function (scope) {
        bindAdminForms(scope);
        bindAdminButtons(scope);
        bindTicketEditorModal(scope);
        bindCompareBasket(scope);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { window.ainavBind(); });
    } else {
        window.ainavBind();
    }
})(window, document);
;
