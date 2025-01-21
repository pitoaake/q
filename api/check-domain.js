const dns = require('dns');
const https = require('https');
const { promisify } = require('util');

// DNS解析方法转换为Promise
const dnsResolve4 = promisify(dns.resolve4);

// 检查单个黑名单
async function checkBlacklist(domain, blacklistDomain, blacklistName) {
    try {
        const lookupDomain = `${domain}.${blacklistDomain}`;
        await Promise.race([
            dnsResolve4(lookupDomain),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('DNS查询超时')), 15000)
            )
        ]);
        return {
            listed: true,
            description: `域名被列入${blacklistName}黑名单`
        };
    } catch (err) {
        if (err.message === 'DNS查询超时') {
            return {
                listed: false,
                description: `${blacklistName}黑名单检查超时，请稍后重试`
            };
        }
        return {
            listed: false,
            description: `域名未被列入${blacklistName}黑名单`
        };
    }
}

// 检查SURBL黑名单
async function checkSURBL(domain) {
    return checkBlacklist(domain, 'multi.surbl.org', 'SURBL');
}

// 检查Spamhaus黑名单
async function checkSpamhaus(domain) {
    return checkBlacklist(domain, 'zen.spamhaus.org', 'Spamhaus');
}

// 检查MXToolbox黑名单
async function checkMXToolbox(domain) {
    return checkBlacklist(domain, 'bl.mxtoolbox.com', 'MXToolbox');
}

// 检查SSL证书
async function checkSSL(domain) {
    return new Promise((resolve) => {
        const options = {
            hostname: domain,
            port: 443,
            method: 'HEAD',
            rejectUnauthorized: false,
            timeout: 10000
        };

        const req = https.request(options, (res) => {
            try {
                const cert = res.socket.getPeerCertificate();
                if (cert && Object.keys(cert).length > 0) {
                    const validTo = new Date(cert.valid_to);
                    const daysRemaining = Math.floor((validTo - Date.now()) / (1000 * 60 * 60 * 24));
                    
                    resolve({
                        valid: daysRemaining > 0,
                        issuer: cert.issuer?.CN || cert.issuer?.O || '未知',
                        daysRemaining: daysRemaining
                    });
                } else {
                    resolve({
                        valid: false,
                        error: '无法获取SSL证书信息'
                    });
                }
            } catch (error) {
                resolve({
                    valid: false,
                    error: error.message
                });
            }
        });

        req.on('error', (error) => {
            resolve({
                valid: false,
                error: error.message
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                valid: false,
                error: '连接超时'
            });
        });

        req.end();
    });
}

// 检查网站可访问性
async function checkWebsite(domain) {
    return new Promise((resolve) => {
        const checkHttps = () => {
            const req = https.request({
                hostname: domain,
                port: 443,
                method: 'HEAD',
                timeout: 10000
            }, (res) => {
                resolve({
                    accessible: true,
                    protocol: 'HTTPS',
                    statusCode: res.statusCode
                });
            });

            req.on('error', () => {
                checkHttp();
            });

            req.on('timeout', () => {
                req.destroy();
                checkHttp();
            });

            req.end();
        };

        const checkHttp = () => {
            const req = require('http').request({
                hostname: domain,
                method: 'HEAD',
                timeout: 10000
            }, (res) => {
                resolve({
                    accessible: true,
                    protocol: 'HTTP',
                    statusCode: res.statusCode
                });
            });

            req.on('error', (error) => {
                resolve({
                    accessible: false,
                    error: error.message
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    accessible: false,
                    error: '连接超时'
                });
            });

            req.end();
        };

        checkHttps();
    });
}

// 检查DNS记录
async function checkDNS(domain) {
    try {
        const [aRecords, mxRecords] = await Promise.all([
            dnsResolve4(domain).catch(() => []),
            promisify(dns.resolveMx)(domain).catch(() => [])
        ]);

        return {
            a: aRecords,
            mx: mxRecords
        };
    } catch (error) {
        return {
            error: error.message
        };
    }
}

// API处理函数
module.exports = async (req, res) => {
    try {
        const { domain } = req.query;
        
        if (!domain) {
            return res.status(400).json({
                error: '请提供域名参数'
            });
        }

        // 分别执行各项检查
        const results = {
            domain,
            blacklists: {},
            ssl: null,
            website: null,
            dns: null
        };

        try {
            results.blacklists = {
                surbl: await checkSURBL(domain),
                spamhaus: await checkSpamhaus(domain),
                mxtoolbox: await checkMXToolbox(domain)
            };
        } catch (error) {
            results.blacklists.error = error.message;
        }

        try {
            results.ssl = await checkSSL(domain);
        } catch (error) {
            results.ssl = { error: error.message };
        }

        try {
            results.website = await checkWebsite(domain);
        } catch (error) {
            results.website = { error: error.message };
        }

        try {
            results.dns = await checkDNS(domain);
        } catch (error) {
            results.dns = { error: error.message };
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({
            error: '检查失败: ' + error.message
        });
    }
}; 