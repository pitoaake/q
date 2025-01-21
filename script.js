// 检查域名
async function checkDomain() {
    const domain = document.getElementById('domain').value.trim();
    if (!domain) {
        alert('请输入域名');
        return;
    }

    try {
        const response = await fetch(`/api/check-domain?domain=${encodeURIComponent(domain)}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        displayResult(data);
    } catch (error) {
        alert('检查域名时发生错误: ' + error.message);
    }
}

// 显示检查结果
function displayResult(data) {
    const result = document.getElementById('result');
    result.style.display = 'block';

    // 更新时间戳
    const timestamp = new Date().toLocaleString();
    result.querySelector('.timestamp').textContent = `检测时间: ${timestamp}`;

    // 安全状态
    const securityDetails = result.querySelector('.status-details');
    const isSafe = !data.blacklists.surbl.listed && 
                  !data.blacklists.spamhaus.listed &&
                  !data.blacklists.mxtoolbox.listed;
    
    securityDetails.innerHTML = `
        <div class="status ${isSafe ? 'safe' : 'unsafe'}">
            ${isSafe ? '✅ 安全' : '❌ 不安全'}
        </div>
        <p>黑名单检测${isSafe ? '通过' : '未通过'}</p>
    `;

    // 黑名单检查
    const blacklistDetails = result.querySelector('.blacklist-details');
    blacklistDetails.innerHTML = `
        <div class="blacklist-item">
            <span class="label">SURBL:</span>
            <span class="value ${!data.blacklists.surbl.listed ? 'safe' : 'unsafe'}">
                ${data.blacklists.surbl.description}
            </span>
        </div>
        <div class="blacklist-item">
            <span class="label">Spamhaus:</span>
            <span class="value ${!data.blacklists.spamhaus.listed ? 'safe' : 'unsafe'}">
                ${data.blacklists.spamhaus.description}
            </span>
        </div>
        <div class="blacklist-item">
            <span class="label">MXToolbox:</span>
            <span class="value ${!data.blacklists.mxtoolbox.listed ? 'safe' : 'unsafe'}">
                ${data.blacklists.mxtoolbox.description}
            </span>
        </div>
    `;

    // SSL证书状态
    const sslDetails = result.querySelector('.ssl-details');
    if (data.ssl.valid) {
        sslDetails.innerHTML = `
            <div class="status safe">✅ 有效</div>
            <p>颁发者: ${data.ssl.issuer}</p>
            <p>剩余天数: ${data.ssl.daysRemaining}天</p>
        `;
    } else {
        sslDetails.innerHTML = `
            <div class="status unsafe">❌ 无效</div>
            <p>错误: ${data.ssl.error || '无效证书'}</p>
        `;
    }

    // 网站状态
    const websiteDetails = result.querySelector('.website-details');
    if (data.website.accessible) {
        websiteDetails.innerHTML = `
            <div class="status safe">✅ 可访问</div>
            <p>协议: ${data.website.protocol}</p>
            <p>状态码: ${data.website.statusCode}</p>
        `;
    } else {
        websiteDetails.innerHTML = `
            <div class="status unsafe">❌ 不可访问</div>
            <p>错误: ${data.website.error}</p>
        `;
    }

    // DNS记录
    const dnsDetails = result.querySelector('.dns-details');
    if (data.dns.a?.length || data.dns.mx?.length) {
        const records = [];
        if (data.dns.a?.length) {
            records.push(`A记录: ${data.dns.a.join(', ')}`);
        }
        if (data.dns.mx?.length) {
            records.push(`MX记录: ${data.dns.mx.map(mx => mx.exchange).join(', ')}`);
        }
        dnsDetails.innerHTML = `
            <div class="status safe">✅ 已找到记录</div>
            <p>${records.join('<br>')}</p>
        `;
    } else {
        dnsDetails.innerHTML = `
            <div class="status unsafe">❌ 未找到记录</div>
            <p>${data.dns.error || '无DNS记录'}</p>
        `;
    }
}

// 添加到监控
function addToMonitor() {
    const domain = document.getElementById('domain').value.trim();
    if (!domain) {
        alert('请输入域名');
        return;
    }

    // 获取当前监控列表
    let monitors = JSON.parse(localStorage.getItem('monitors') || '[]');
    
    // 检查是否已存在
    if (monitors.some(m => m.domain === domain)) {
        alert('该域名已在监控列表中');
        return;
    }

    // 添加新监控
    monitors.push({
        id: Date.now() + Math.random(),
        domain,
        interval: 60, // 默认1小时检查一次
        status: 'pending',
        lastCheck: null,
        active: true
    });

    // 保存更新后的监控列表
    localStorage.setItem('monitors', JSON.stringify(monitors));
    
    alert('已添加到监控列表');
    window.location.href = 'monitor.html';
}

// 按下回车键时触发检查
document.getElementById('domain').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        checkDomain();
    }
}); 