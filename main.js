const axios = require("axios");
const {
    chromium
} = require("playwright");

const token = "8496844359:AAHnmQhDqj641wSTI19NOPm0Mdn5fTZYR3U";
const chatId = "5625039569";

async function sendTelegram(message) {
    if (!token || !chatId) return;
    const now = new Date();
    const hkTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const timeStr = hkTime.toISOString().replace("T", " ").substr(0, 19) + " HKT";
    const fullMessage = `🎉 Netlib 运行通知\n\n运行时间：${timeStr}\n\n${message}`;
    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: fullMessage
        }, {
            timeout: 10000
        });
        console.log("✅ Telegram 通知发送成功");
    } catch (e) {
        console.log("⚠️ Telegram 发送失败");
    }
}

async function checkAndClickAgreement(page) {
    const buttonSelector = 'button[role="checkbox"][aria-label="请勾选协议"]';
    let result = {
        success: false,
        message: "",
        clickedCount: 0,
        finalStatus: ""
    };

    try {
        console.log("查找协议按钮...");
        
        // 等待按钮出现，设置5秒超时
        await page.waitForSelector(buttonSelector, { 
            timeout: 5000,
            state: 'visible'
        });
        
        console.log("找到协议按钮，开始检查状态...");
        
        let maxAttempts = 5; // 最大尝试次数，避免无限循环
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            attempts++;
            console.log(`第 ${attempts} 次检查...`);
            
            // 获取当前 aria-checked 状态
            const isChecked = await page.$eval(buttonSelector, button => 
                button.getAttribute('aria-checked') === 'true'
            );
            
            if (isChecked) {
                console.log("协议已勾选，无需点击");
                result.success = true;
                result.message = "协议已勾选";
                result.finalStatus = "checked";
                break;
            } else {
                console.log("协议未勾选，执行点击...");
                
                // 点击按钮
                await page.click(buttonSelector);
                result.clickedCount++;
                
                // 等待点击后的响应
                await page.waitForTimeout(1000);
                
                // 再次检查状态
                const newIsChecked = await page.$eval(buttonSelector, button => 
                    button.getAttribute('aria-checked') === 'true'
                );
                
                if (newIsChecked) {
                    console.log("点击成功，协议已勾选");
                    result.success = true;
                    result.message = "点击成功，协议已勾选";
                    result.finalStatus = "checked_after_click";
                    break;
                } else {
                    console.log("点击后协议仍未勾选，准备重试...");
                    
                    if (attempts >= maxAttempts) {
                        result.message = `点击 ${maxAttempts} 次后协议仍未勾选`;
                        result.finalStatus = "failed_after_attempts";
                    }
                }
            }
        }
        
    } catch (error) {
        console.error("操作协议按钮时发生错误:", error);
        result.message = `错误: ${error.message}`;
        result.finalStatus = "error";
    }
    
    return result;
}


async function loginWithAccount() {
    const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    let page;
    let result = "";
    try {
        page = await browser.newPage();
        page.setDefaultTimeout(30000);
        await page.goto("https://wappass.baidu.com/passport/login?u=https://fanyi.baidu.com/m/profile#/sms_login_new", {
            waitUntil: "networkidle"
        });
        await page.waitForTimeout(3000);
        
        console.log("输入手机号");
        const inputSelector = 'input[type="tel"][input-type="all"]';
        const isInputExists = await page.waitForSelector(inputSelector, { 
            timeout: 5000,
            state: 'visible'
        }).then(() => true).catch(() => false);
        if (!isInputExists) {
            console.log("未找到手机号输入框");
        }
        await page.fill(inputSelector, "18177053882");
        const inputValue = await page.$eval(inputSelector, input => input.value);
        console.log("当前值:", inputValue);
        
        console.log("点击");
        const agreementResult = await checkAndClickAgreement(page);
        console.log(`${agreementResult.success}${agreementResult.message}`);
        
        result = await page.content();
        console.log(result);
    } catch (e) {} finally {
        if (page) await page.close();
        await browser.close();
    }
    return result;
}

async function main() {
    const result = await loginWithAccount();
    await sendTelegram(result.length);
}

main().catch(console.error);