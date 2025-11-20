const axios = require('axios');
const { chromium } = require('playwright');

const token = "8496844359:AAHnmQhDqj641wSTI19NOPm0Mdn5fTZYR3U";
const chatId = "5625039569";

async function sendTelegram(message) {
    if (!token || !chatId) return;
    const now = new Date();
    const hkTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const timeStr = hkTime.toISOString().replace('T', ' ').substr(0, 19) + " HKT";
    const fullMessage = `🎉 Netlib 登录通知\n\n登录时间：${timeStr}\n\n${message}`;
    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: fullMessage
        }, {
            timeout: 10000
        });
        console.log('✅ Telegram 通知发送成功');
    } catch (e) {
        console.log('⚠️ Telegram 发送失败');
    }
}

async function solveSliderCaptcha(page) {
    try {
        console.log('🔍 检测到滑块验证码，尝试解决...');
        
        // 等待滑块元素加载
        await page.waitForSelector('.slider-handle', { timeout: 5000 });
        
        // 获取滑块和轨道尺寸
        const sliderHandle = await page.$('.slider-handle');
        const sliderTrack = await page.$('.slider');
        
        const handleBox = await sliderHandle.boundingBox();
        const trackBox = await sliderTrack.boundingBox();
        
        // 计算需要滑动的距离（轨道宽度 - 滑块宽度）
        const slideDistance = trackBox.width - handleBox.width - 10; // 留一些边距
        
        console.log(`📏 需要滑动的距离: ${slideDistance}px`);
        
        // 模拟人类滑动行为
        await sliderHandle.hover();
        await page.mouse.down();
        
        // 分段滑动，模拟人类行为
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const currentX = handleBox.x + (slideDistance * i) / steps;
            await page.mouse.move(currentX, handleBox.y + handleBox.height / 2, {
                steps: 2
            });
            await page.waitForTimeout(100 + Math.random() * 50); // 随机延迟
        }
        
        await page.mouse.up();
        console.log('✅ 滑块滑动完成');
        
        // 等待验证结果
        await page.waitForTimeout(3000);
        
        // 检查是否验证成功
        const isSuccess = await page.evaluate(() => {
            return document.querySelector('.slider').classList.contains('success');
        });
        
        if (isSuccess) {
            console.log('🎉 滑块验证成功');
            return true;
        } else {
            console.log('❌ 滑块验证可能失败');
            return false;
        }
        
    } catch (error) {
        console.log('❌ 滑块验证解决失败:', error.message);
        return false;
    }
}

async function loginWithAccount() {
    const browser = await chromium.launch({
        headless: false, // 设置为false便于调试，生产环境可改为true
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    let page;
    let result = "";
    
    try {
        page = await browser.newPage();
        page.setDefaultTimeout(60000);
        
        // 监听控制台日志和网络请求
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('response', response => {
            if (response.url().includes('logging') || response.url().includes('verify')) {
                console.log('RESPONSE:', response.status(), response.url());
            }
        });
        
        await page.goto('https://bbs.binmt.cc/member.php?mod=logging&action=login&mobile=2', {
            waitUntil: 'networkidle'
        });
        
        await page.waitForTimeout(3000);
        
        // 检查是否有滑块验证码
        const hasCaptcha = await page.$('.slider-handle') !== null;
        
        if (hasCaptcha) {
            console.log('🛡️ 检测到滑块验证，开始解决...');
            const captchaSuccess = await solveSliderCaptcha(page);
            
            if (!captchaSuccess) {
                // 如果第一次失败，尝试刷新重试
                console.log('🔄 第一次验证失败，刷新页面重试...');
                await page.reload();
                await page.waitForTimeout(3000);
                
                const retrySuccess = await solveSliderCaptcha(page);
                if (!retrySuccess) {
                    throw new Error('滑块验证多次失败');
                }
            }
        }
        
        // 继续登录流程
        console.log('✅ 验证通过，继续登录...');
        
        // 这里添加你的登录代码
        // await page.fill('#username', 'your_username');
        // await page.fill('#password', 'your_password');
        // await page.click('.login-btn');
        
        result = await page.content();
        
    } catch (error) {
        console.log('❌ 登录过程出错:', error.message);
        result = `错误: ${error.message}`;
    } finally {
        if (page) await page.close();
        await browser.close();
    }
    
    return result;
}

async function main() {
    try {
        const result = await loginWithAccount();
        await sendTelegram(`登录结果: ${result.length > 100 ? '页面加载成功' : '可能失败'}`);
    } catch (error) {
        await sendTelegram(`登录失败: ${error.message}`);
    }
}

main().catch(console.error);
