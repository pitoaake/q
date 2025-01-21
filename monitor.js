// 存储监控配置
let monitors = JSON.parse(localStorage.getItem('monitors') || '[]');
let monitorIntervals = new Map();

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
    loadMonitors();
    loadHistory();
    updateMonitorCount();
});

// 切换监控模式
function switchMonitorMode(mode) {
    const singleMode = document.getElementById('singleMonitorMode');
    const batchMode = document.getElementById('batchMonitorMode');
    const singleBtn = document.getElementById('singleMonitorBtn');
    const batchBtn = document.getElementById('batchMonitorBtn');

    if (mode === 'single') {
        singleMode.style.display = 'flex';
        batchMode.style.display = 'none';
        singleBtn.classList.add('active');
        batchBtn.classList.remove('active');
    } else {
        singleMode.style.display = 'none';
        batchMode.style.display = 'flex';
        singleBtn.classList.remove('active');
        batchBtn.classList.add('active');
    }
}

// 添加新的监控
function addMonitor() {
    const domain = document.getElementById('monitorDomain').value.trim();
    const interval = parseInt(document.getElementById('checkInterval').value);

    if (!domain) {
        alert('请输入域名');
        return;
    }

    addSingleMonitor(domain, interval);
    document.getElementById('monitorDomain').value = '';
}

// 批量添加监控
function addBatchMonitors() {
    const domainsText = document.getElementById('batchDomains').value.trim();
    const interval = parseInt(document.getElementById('batchCheckInterval').value);

    if (!domainsText) {
        alert('请输入域名');
        return;
    }

    const domains = domainsText.split('\n')
        .map(d => d.trim())
        .filter(d => d);

    if (domains.length === 0) {
        alert('没有找到有效的域名');
        return;
    }

    let added = 0;
    let skipped = 0;

    domains.forEach(domain => {
        if (monitors.some(m => m.domain === domain)) {
            skipped++;
        } else {
            addSingleMonitor(domain, interval, false);
            added++;
        }
    });

    loadMonitors();
    document.getElementById('batchDomains').value = '';
    alert(`成功添加 ${added} 个域名监控，跳过 ${skipped} 个重复域名`);
}

// 添加单个监控
function addSingleMonitor(domain, interval, reload = true) {
    if (monitors.some(m => m.domain === domain)) {
        alert('该域名已在监控列表中');
        return false;
    }

    const monitor = {
        id: Date.now() + Math.random(),
        domain,
        interval,
        status: 'pending',
        lastCheck: null,
        active: true
    };

    monitors.push(monitor);
    saveMonitors();
    startMonitoring(monitor);
    if (reload) {
        loadMonitors();
    }
    return true;
}

// 加载监控列表
function loadMonitors() {
    const container = document.getElementById('monitorItems');
    const searchTerm = document.getElementById('searchDomain').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    const filteredMonitors = monitors.filter(monitor => {
        const matchesSearch = monitor.domain.toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || monitor.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    container.innerHTML = filteredMonitors.map(monitor => `
        <div class="monitor-item" data-id="${monitor.id}">
            <div class="monitor-info">
                <div class="monitor-domain">${monitor.domain}</div>
                <div class="monitor-interval">检测间隔: ${monitor.interval}分钟</div>
            </div>
            <div class="monitor-status">
                <span class="status-badge ${getStatusClass(monitor.status)}">
                    ${getStatusText(monitor.status)}
                </span>
                ${monitor.lastCheck ? `
                    <span class="last-check">上次检查: ${new Date(monitor.lastCheck).toLocaleString()}</span>
                    ${monitor.details ? `
                        <div class="status-details">
                            <button onclick="toggleDetails(${monitor.id})" class="details-btn">详情</button>
                            <div id="details-${monitor.id}" class="details-content" style="display: none;">
                                ${formatCheckDetails(monitor.details).split('\n').map(line => `<div>${line}</div>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                ` : ''}
            </div>
            <div class="monitor-actions">
                ${monitor.active ? 
                    `<button class="action-btn pause" onclick="pauseMonitor(${monitor.id})">暂停</button>` :
                    `<button class="action-btn resume" onclick="resumeMonitor(${monitor.id})">恢复</button>`
                }
                <button class="action-btn delete" onclick="deleteMonitor(${monitor.id})">删除</button>
            </div>
        </div>
    `).join('');

    updateMonitorCount();
}

// 更新监控数量
function updateMonitorCount() {
    const count = document.getElementById('monitorCount');
    count.textContent = monitors.length;
}

// 过滤监控列表
function filterMonitors() {
    loadMonitors();
}

// 过滤历史记录
function filterHistory() {
    const searchTerm = document.getElementById('searchHistory').value.toLowerCase();
    const filteredHistory = history.filter(record => 
        record.domain.toLowerCase().includes(searchTerm)
    );

    const container = document.getElementById('monitorHistory');
    container.innerHTML = filteredHistory.map(record => `
        <div class="history-item">
            <div class="history-info">
                <div class="history-domain">${record.domain}</div>
                <div class="history-time">${new Date(record.time).toLocaleString()}</div>
            </div>
            <div class="history-status ${record.status === 'safe' ? 'success' : 'error'}">
                ${record.details}
            </div>
        </div>
    `).join('');
}

// 批量操作
function pauseAllMonitors() {
    if (!confirm('确定要暂停所有监控吗？')) return;
    monitors.forEach(monitor => {
        monitor.active = false;
        if (monitorIntervals.has(monitor.id)) {
            clearInterval(monitorIntervals.get(monitor.id));
            monitorIntervals.delete(monitor.id);
        }
    });
    saveMonitors();
    loadMonitors();
}

function resumeAllMonitors() {
    if (!confirm('确定要恢复所有监控吗？')) return;
    monitors.forEach(monitor => {
        monitor.active = true;
        startMonitoring(monitor);
    });
    saveMonitors();
    loadMonitors();
}

function deleteAllMonitors() {
    if (!confirm('确定要删除所有监控吗？这将无法恢复！')) return;
    monitorIntervals.forEach(interval => clearInterval(interval));
    monitorIntervals.clear();
    monitors = [];
    saveMonitors();
    loadMonitors();
}

// 清空历史记录
function clearHistory() {
    if (!confirm('确定要清空所有历史记录吗？这将无法恢复！')) return;
    history = [];
    localStorage.setItem('monitorHistory', '[]');
    loadHistory();
}

// 开始监控
function startMonitoring(monitor) {
    if (!monitor.active) return;

    if (monitorIntervals.has(monitor.id)) {
        clearInterval(monitorIntervals.get(monitor.id));
    }

    checkDomain(monitor);

    const intervalId = setInterval(() => {
        checkDomain(monitor);
    }, monitor.interval * 60 * 1000);

    monitorIntervals.set(monitor.id, intervalId);
}

// 检查域名状态
async function checkDomain(monitor) {
    try {
        const response = await fetch(`/api/check-domain?domain=${encodeURIComponent(monitor.domain)}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        monitor.status = getOverallStatus(data);
        monitor.lastCheck = data.timestamp;
        monitor.details = data;

        addHistory({
            domain: monitor.domain,
            time: data.timestamp,
            status: monitor.status,
            details: formatCheckDetails(data)
        });
    } catch (error) {
        monitor.status = 'error';
        monitor.lastCheck = Date.now();
        monitor.details = { error: error.message };

        addHistory({
            domain: monitor.domain,
            time: Date.now(),
            status: 'error',
            details: error.message
        });
    }

    saveMonitors();
    loadMonitors();
}

// 获取整体状态
function getOverallStatus(data) {
    // 如果安全检查通过，网站就是安全的
    if (data.security.isSafe) {
        // 即使有403错误，只要能访问就不算错误
        if (data.website.accessible && data.ssl.valid && data.dns.hasRecords) {
            return 'safe';
        }
        // 如果SSL证书无效或DNS记录缺失，标记为警告
        if (!data.ssl.valid || !data.dns.hasRecords) {
            return 'warning';
        }
    }
    
    // 如果安全检查未通过，标记为不安全
    if (!data.security.isSafe) {
        return 'unsafe';
    }
    
    // 如果完全无法访问网站，标记为错误
    if (!data.website.accessible) {
        return 'error';
    }

    return 'warning';
}

// 格式化检查详情
function formatCheckDetails(data) {
    const details = [];

    // 安全检查
    if (data.security) {
        // 根据整体状态判断显示
        const overallStatus = getOverallStatus(data);
        details.push(`安全检查: ${overallStatus === 'safe' || overallStatus === 'warning' ? '✅ 安全' : '❌ 不安全'}`);
        if (data.security.details) {
            details.push(`安全状态: ${data.security.details}`);
        }
        
        // SSL证书状态
        if (data.ssl) {
            if (data.ssl.valid) {
                details.push(`SSL证书: ✅ 有效 (${data.ssl.issuer}, 剩余${data.ssl.daysRemaining}天)`);
            } else {
                details.push(`SSL证书: ❌ ${data.ssl.error || '无效'}`);
            }
        }

        // 网站可访问性
        if (data.website) {
            if (data.website.accessible) {
                details.push(`网站状态: ✅ 可访问 (${data.website.statusCode} ${data.website.statusMessage})`);
            } else {
                details.push(`网站状态: ❌ 不可访问 (${data.website.error})`);
            }
        }

        // DNS记录
        if (data.dns) {
            if (data.dns.hasRecords) {
                const records = [];
                if (data.dns.records.a?.length) records.push(`A记录: ${data.dns.records.a.join(', ')}`);
                if (data.dns.records.aaaa?.length) records.push(`AAAA记录: ${data.dns.records.aaaa.join(', ')}`);
                if (data.dns.records.mx?.length) records.push(`MX记录: ${data.dns.records.mx.length}个`);
                if (data.dns.records.txt?.length) records.push(`TXT记录: ${data.dns.records.txt.length}个`);
                details.push(`DNS记录: ✅ ${records.join('; ')}`);
            } else {
                details.push(`DNS记录: ❌ ${data.dns.error || '未找到记录'}`);
            }
        }
    }

    return details.join('\n');
}

// 暂停监控
function pauseMonitor(id) {
    const monitor = monitors.find(m => m.id === id);
    if (monitor) {
        monitor.active = false;
        if (monitorIntervals.has(id)) {
            clearInterval(monitorIntervals.get(id));
            monitorIntervals.delete(id);
        }
        saveMonitors();
        loadMonitors();
    }
}

// 恢复监控
function resumeMonitor(id) {
    const monitor = monitors.find(m => m.id === id);
    if (monitor) {
        monitor.active = true;
        startMonitoring(monitor);
        saveMonitors();
        loadMonitors();
    }
}

// 删除监控
function deleteMonitor(id) {
    if (!confirm('确定要删除此监控吗？')) return;

    if (monitorIntervals.has(id)) {
        clearInterval(monitorIntervals.get(id));
        monitorIntervals.delete(id);
    }

    monitors = monitors.filter(m => m.id !== id);
    saveMonitors();
    loadMonitors();
}

// 保存监控配置
function saveMonitors() {
    localStorage.setItem('monitors', JSON.stringify(monitors));
}

// 切换详情显示
function toggleDetails(id) {
    const details = document.getElementById(`details-${id}`);
    if (details) {
        details.style.display = details.style.display === 'none' ? 'block' : 'none';
    }
}

// 获取状态样式类
function getStatusClass(status) {
    switch (status) {
        case 'safe': return 'online';
        case 'unsafe': return 'offline';
        case 'warning': return 'warning';
        case 'error': return 'offline';
        default: return '';
    }
}

// 获取状态文本
function getStatusText(status) {
    switch (status) {
        case 'safe': return '正常';
        case 'unsafe': return '不安全';
        case 'warning': return '警告';
        case 'error': return '错误';
        case 'pending': return '等待检查';
        default: return status;
    }
}

// 历史记录管理
let history = JSON.parse(localStorage.getItem('monitorHistory') || '[]');

function addHistory(record) {
    history.unshift(record);
    if (history.length > 100) {
        history = history.slice(0, 100);
    }
    localStorage.setItem('monitorHistory', JSON.stringify(history));
    loadHistory();
}

function loadHistory() {
    filterHistory();
}

// 初始化所有活动监控
monitors.forEach(monitor => {
    if (monitor.active) {
        startMonitoring(monitor);
    }
}); 