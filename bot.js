import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { faker } from '@faker-js/faker';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import cfonts from 'cfonts';
import { promises as fs } from 'fs';
import axios from 'axios';
import ProxyChain from 'proxy-chain';

puppeteer.use(StealthPlugin());

function centerText(text, color = 'yellowBright') {
  const terminalWidth = process.stdout.columns || 80;
  const textLength = text.length;
  const padding = Math.max(0, Math.floor((terminalWidth - textLength) / 2));
  return ' '.repeat(padding) + chalk[color](text);
}

cfonts.say('NT EXHAUST', {
  font: 'block',
  align: 'center',
  colors: ['cyan', 'magenta'],
  background: 'transparent',
  letterSpacing: 1,
  lineHeight: 1,
  space: true,
  maxLength: '0'
});
console.log(centerText('=== Telegram Channel 🚀 : NT EXHAUST (@ntexhaust) ==='));
console.log(centerText('✪ ENERGY LABS AUTO REFF BOT ✪'));
console.log();

function getIpHeaders() {
  return {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36'
  };
}

async function getLocalIP() {
  try {
    const response = await axios.get('http://ip-api.com/json', { headers: getIpHeaders(), timeout: 10000 });
    return response.data.query || response.data.ip;
  } catch {
    return 'Error getting IP';
  }
}

async function validateProxy(proxy, localIP, ipServices = ['http://ip-api.com/json', 'http://api.ipify.org?format=json']) {
  let valid = false;
  let ip = null;
  let anonymizedProxy = null;

  try {
    anonymizedProxy = await ProxyChain.anonymizeProxy(proxy);
    for (const service of ipServices) {
      try {
        const response = await axios.get(service, {
          headers: getIpHeaders(),
          proxy: {
            host: '127.0.0.1',
            port: parseInt(anonymizedProxy.split(':').pop()),
            protocol: 'http'
          },
          timeout: 10000
        });
        ip = response.data.query || response.data.ip;
        if (ip && ip !== localIP) {
          valid = true;
          break;
        }
      } catch {
      }
    }
  } catch {
  }

  
  if (anonymizedProxy) {
    await ProxyChain.closeAnonymizedProxy(anonymizedProxy, true).catch(() => {});
  }

  return { valid, ip };
}

async function askForRegistrations() {
  const { count } = await inquirer.prompt([
    {
      type: 'input',
      name: 'count',
      message: ' Enter number of accounts to register:',
      validate: (value) => {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed) || parsed <= 0) {
          return 'Please enter a valid number greater than 0!';
        }
        return true;
      }
    }
  ]);
  return parseInt(count, 10);
}

async function askForReferralCode() {
  const { ref } = await inquirer.prompt([
    {
      type: 'input',
      name: 'ref',
      message: ' Enter referral code:'
    }
  ]);
  return ref.trim();
}

async function askForAlternativeReferralCode(currentRef) {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: ` Referral code "${currentRef}" is invalid. What would you like to do?`,
      choices: [
        'Enter a new referral code',
        'Continue without referral code',
        'Stop registration'
      ]
    }
  ]);

  if (action === 'Enter a new referral code') {
    const { newRef } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newRef',
        message: ' Enter new referral code:'
      }
    ]);
    return newRef.trim();
  } else if (action === 'Continue without referral code') {
    return '';
  } else {
    throw new Error(' Registration stopped by user.');
  }
}

async function askToContinueWithoutProxy() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: ' All proxies failed. Choose an action:',
      choices: [
        'Continue without proxy (high IP detection risk)',
        'Retry proxies after delay',
        'Stop registration'
      ]
    }
  ]);

  if (action === 'Continue without proxy (high IP detection risk)') {
    return 'continue';
  } else if (action === 'Retry proxies after delay') {
    return 'retry';
  } else {
    throw new Error('Registration stopped by user.');
  }
}

async function askForProxy() {
  const { useProxy } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useProxy',
      message: ' Do you want to use proxies?',
      default: false
    }
  ]);

  if (!useProxy) {
    console.log(chalk.yellowBright('⚠️ No Proxy Selected. Continuing Without Proxy.'));
    console.log();
    return { proxyList: [], proxyMode: null };
  }

  const { proxyMode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'proxyMode',
      message: ' Select proxy type:',
      choices: ['Rotating', 'Static']
    }
  ]);

  let proxyList = [];
  try {
    const proxyData = await fs.readFile('proxy.txt', 'utf8');
    proxyList = proxyData.split('\n').map(line => line.trim()).filter(Boolean);
    console.log(chalk.greenBright(`✔️ Loaded ${proxyList.length} Proxies. Validating...`));
    const localIP = await getLocalIP();
    const validProxies = [];
    for (const proxy of proxyList) {
      const result = await validateProxy(proxy, localIP);
      if (result.valid) {
        validProxies.push(proxy);
      }
    }
    proxyList = validProxies;
    console.log(chalk.greenBright(`✔️ Found ${proxyList.length} Valid Proxies.`));
    console.log();
    if (proxyList.length === 0) {
      console.log(chalk.yellowBright('☠️ No Valid Proxies Found. Continuing Without Proxy.'));
      console.log();
      return { proxyList: [], proxyMode: null };
    }
  } catch {
    console.log(chalk.yellowBright('☠️ proxy.txt Not Found. Continuing Without Proxy.'));
    console.log();
    return { proxyList: [], proxyMode: null };
  }

  return { proxyList, proxyMode };
}

function generateUserAgent() {
  let ua = faker.internet.userAgent();
  while (ua.includes('Googlebot') || ua.includes('bot') || ua.includes('Bot') || ua.includes('MSIE')) {
    ua = faker.internet.userAgent();
  }
  return ua;
}

function generateUserDetails() {
  const username = faker.internet.username().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const email = `${username}${Math.floor(Math.random() * 1000)}@gmail.com`;
  const password = faker.internet.password({ length: 8, prefix: username.slice(0, 4) });
  return { username, email, password };
}

async function saveAccount(account) {
  const fileName = 'accounts.json';
  let accounts = [];
  try {
    const data = await fs.readFile(fileName, 'utf8');
    accounts = JSON.parse(data);
  } catch {
    accounts = [];
  }
  accounts.push(account);
  try {
    await fs.writeFile(fileName, JSON.stringify(accounts, null, 2));
    console.log(chalk.greenBright('✔️ Account Data Saved to accounts.json'));
  } catch (err) {
    console.log(chalk.redBright(`✖ Failed to Save Account Data: ${err.message}`));
  }
}

async function countdown(ms) {
  const seconds = Math.floor(ms / 1000);
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(chalk.blueBright(`\r🕔 Waiting ${i} Seconds...`));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  process.stdout.write('\r' + ' '.repeat(50) + '\r');
}

async function main() {
  const count = await askForRegistrations();
  let referralCode = await askForReferralCode();
  const { proxyList, proxyMode } = await askForProxy();

  console.log(chalk.cyanBright('='.repeat(80)));
  console.log(chalk.whiteBright(`Proccesing Register ${count} Accounts`));
  console.log(chalk.yellowBright('Note: Avoid Aggressive Registration Without Proxies!'));
  console.log(chalk.cyanBright('='.repeat(80)));
  console.log();

  let successCount = 0;
  let failCount = 0;
  let availableProxies = [...proxyList];
  const localIP = await getLocalIP();

  for (let i = 0; i < count; i++) {
    console.log(chalk.cyanBright(`Account ${i + 1}/${count}`));
    const userDetails = generateUserDetails();
    const { username, email, password } = userDetails;

    let selectedProxy = null;
    let anonymizedProxy = null;
    let useProxy = proxyList.length > 0 && proxyMode;
    let accountIP = localIP;
    let proxyRetryCount = 0;
    const maxProxyRetries = 2;
    let pageLoadRetries = 2;

    if (useProxy) {
      while (proxyRetryCount < maxProxyRetries) {
        if (proxyMode === 'Rotating') {
          selectedProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
        } else {
          selectedProxy = availableProxies.shift();
          if (!selectedProxy) {
            console.log(chalk.redBright('✖ No Proxies Left for Static Mode.'));
            useProxy = false;
            break;
          }
        }
        console.log(chalk.blueBright(`Using Proxy: ${selectedProxy}`));

        const ipResult = await validateProxy(selectedProxy, localIP);
        if (ipResult.valid && ipResult.ip !== localIP) {
          accountIP = ipResult.ip;
          console.log(chalk.cyanBright(`Using IP: ${accountIP}`));
          break;
        } else {
          console.log(chalk.redBright('✖ Proxy Invalid or Using Local IP.'));
          proxyRetryCount++;
          if (proxyRetryCount < maxProxyRetries) {
            console.log(chalk.blueBright('➥ Trying Another Proxy...'));
            continue;
          } else {
            try {
              const action = await askToContinueWithoutProxy();
              if (action === 'continue') {
                useProxy = false;
                console.log(chalk.yellowBright(`➥ Continuing Without Proxy. Using IP: ${accountIP || 'Not Returned'}`));
                break;
              } else if (action === 'retry') {
                console.log(chalk.blueBright('➥ Retrying Proxies After Delay...'));
                await countdown(30000);
                proxyRetryCount = 0;
                continue;
              }
            } catch {
              console.log(chalk.redBright('✖ Registration Stopped.'));
              failCount++;
              return;
            }
          }
        }
      }
    } else {
      console.log(chalk.yellowBright(`➥ No Proxy Used. Using IP: ${accountIP || 'Not Returned'}`));
    }

    let browser;
    let browserArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
    if (useProxy && selectedProxy) {
      try {
        anonymizedProxy = await ProxyChain.anonymizeProxy(selectedProxy);
        browserArgs.push(`--proxy-server=${anonymizedProxy}`);
      } catch (err) {
        console.log(chalk.redBright(`✖ Failed to Setup Proxy: ${err.message}`));
        useProxy = false;
        accountIP = localIP;
        console.log(chalk.yellowBright(`➥ Continuing Without Proxy. Using IP: ${accountIP || 'Not Returned'}`));
      }
    }

    const spinner = ora('Launching Browser').start();
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: browserArgs,
        ignoreHTTPSErrors: true
      });
      spinner.succeed(chalk.greenBright(' Browser Launched'));
    } catch (err) {
      spinner.fail(chalk.redbright(` Failed to Launch Browser: ${err.message}`));
      if (anonymizedProxy) await ProxyChain.closeAnonymizedProxy(anonymizedProxy, true).catch(() => {});
      failCount++;
      continue;
    }

    let page;
    try {
      page = await browser.newPage();
      spinner.succeed(chalk.bold.greenBright(' Link Visited'));
    } catch (err) {
      spinner.fail(chalk.redBright(` Failed to Visited Link: ${err.message}`));
      await browser.close().catch(() => {});
      if (anonymizedProxy) await ProxyChain.closeAnonymizedProxy(anonymizedProxy, true).catch(() => {});
      failCount++;
      continue;
    }

    const userAgent = generateUserAgent();
    await page.setUserAgent(userAgent);

    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1280, height: 720 }
    ];
    const randomViewport = viewports[Math.floor(Math.random() * viewports.length)];
    await page.setViewport(randomViewport);

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'plugins', {
        configurable: true,
        get: () => ({
          length: 0,
          item: () => null,
          namedItem: () => null,
          [Symbol.iterator]: () => [].values()
        })
      });
      Object.defineProperty(window, 'WebGLRenderingContext', {
        configurable: true,
        get: () => undefined
      });
    });

    let pageLoaded = false;
    while (pageLoadRetries > 0 && !pageLoaded) {
      spinner.text = ' Loading Registration Page';
      spinner.start();
      try {
        await page.goto(`https://defi-energylabs.com/index?ref=${referralCode}`, { waitUntil: 'networkidle2', timeout: 60000 });
        spinner.succeed(chalk.bold.greenBright(' Registration Page Loaded'));
        pageLoaded = true;
      } catch (err) {
        pageLoadRetries--;
        spinner.fail(chalk.bold.redBright(` Failed to Load Page: ${err.message}`));
        if (pageLoadRetries > 0) {
          console.log(chalk.blueBright(`➥ Retrying (${pageLoadRetries} Attempts Left)...`));
          if (anonymizedProxy) {
            await ProxyChain.closeAnonymizedProxy(anonymizedProxy, true).catch(() => {});
            anonymizedProxy = null;
          }
          if (useProxy && selectedProxy) {
            try {
              anonymizedProxy = await ProxyChain.anonymizeProxy(selectedProxy);
              browserArgs = ['--no-sandbox', '--disable-setuid-sandbox', `--proxy-server=${anonymizedProxy}`];
            } catch (err) {
              console.log(chalk.redBright(`✖ Failed to Reset Proxy: ${err.message}`));
              useProxy = false;
              console.log(chalk.yellowBright(`➥ Continuing Without Proxy. Using IP: ${accountIP || 'Not Returned'}`));
              browserArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
            }
          }
          await page.close().catch(() => {});
          await browser.close().catch(() => {});
          spinner.text = 'Relaunching Browser';
          spinner.start();
          try {
            browser = await puppeteer.launch({
              headless: true,
              args: browserArgs,
              ignoreHTTPSErrors: true
            });
            page = await browser.newPage();
            await page.setUserAgent(generateUserAgent());
            await page.setViewport(viewports[Math.floor(Math.random() * viewports.length)]);
            spinner.succeed(chalk.bold.greenBright(' Browser Relaunched'));
          } catch (err) {
            spinner.fail(chalk.bold.redBright(` Failed to Relaunch Browser: ${err.message}`));
            failCount++;
            break;
          }
        }
      }
    }

    if (!pageLoaded) {
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
      if (anonymizedProxy) await ProxyChain.closeAnonymizedProxy(anonymizedProxy, true).catch(() => {});
      failCount++;
      continue;
    }

    try {
      await page.waitForSelector('#register-form', { visible: true, timeout: 10000 });
      await page.type('#register-username', username);
      await page.type('#register-email', email);
      await page.type('#register-password', password);
      await page.type('#register-confirm-password', password);
      if (referralCode) {
        await page.$eval('#register-referral', el => (el.value = ''));
        await page.type('#register-referral', referralCode);
      }
      spinner.succeed(chalk.bold.greenBright(' Registration Form Filled'));
    } catch (err) {
      spinner.fail(chalk.bold.redBright(` Failed to Fill Form: ${err.message}`));
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
      if (anonymizedProxy) await ProxyChain.closeAnonymizedProxy(anonymizedProxy, true).catch(() => {});
      failCount++;
      continue;
    }

    spinner.text = 'Submitting Registration';
    spinner.start();
    try {
      await Promise.all([
        page.click('button[name="register"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
      ]);
      if (page.url() === 'https://defi-energylabs.com/dashboard') {
        spinner.succeed(chalk.bold.greenBright(' Registration Successful'));
        await saveAccount({ username, email, password });
        successCount++;
      } else {
        throw new Error('Not redirected to dashboard');
      }
    } catch (err) {
      spinner.fail(chalk.bold.redBright(` Registration Failed: ${err.message}`));
      try {
        await page.waitForSelector('.alert.alert-danger', { timeout: 5000 });
        const errorMessage = await page.$eval('.alert.alert-danger p', el => el.textContent.trim());
        console.log(chalk.redBright(`Error: ${errorMessage}`));
        if (errorMessage.includes('Invalid referral code')) {
          referralCode = await askForAlternativeReferralCode(referralCode);
          console.log(chalk.blueBright(referralCode ? `➥ Using New Referral Code: ${referralCode}` : '➥ Continuing Without Referral Code'));
          await page.goto(`https://defi-energylabs.com/index?ref=${referralCode}`, { waitUntil: 'networkidle2', timeout: 60000 });
          await page.waitForSelector('#register-form', { visible: true, timeout: 10000 });
          await page.type('#register-username', username);
          await page.type('#register-email', email);
          await page.type('#register-password', password);
          await page.type('#register-confirm-password', password);
          if (referralCode) {
            await page.$eval('#register-referral', el => (el.value = ''));
            await page.type('#register-referral', referralCode);
          }
          spinner.text = 'Retrying Registration';
          spinner.start();
          await Promise.all([
            page.click('button[name="register"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
          ]);
          if (page.url() === 'https://defi-energylabs.com/dashboard') {
            spinner.succeed(chalk.bold.greenBright(' Registration Successful'));
            await saveAccount({ username, email, password });
            successCount++;
          } else {
            throw new Error('Retry failed: Not redirected to dashboard');
          }
        } else if (errorMessage.includes('This device has already been used')) {
          console.log(chalk.yellowBright(' Device Detection Triggered. Retrying...'));
          i--;
        } else {
          console.log(chalk.redBright(`✖ Registration Failed: ${errorMessage}`));
          failCount++;
        }
      } catch (innerErr) {
        console.log(chalk.redBright(`✖ Failed to Check Registration Status: ${innerErr.message}`));
        failCount++;
      }
    }

    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    if (anonymizedProxy) await ProxyChain.closeAnonymizedProxy(anonymizedProxy, true).catch(() => {});
    console.log();
    console.log(chalk.cyanBright(`Progress: ${i + 1}/${count} Accounts Processed (Success: ${successCount}, Failed: ${failCount})`));
    console.log(chalk.cyanBright('='.repeat(80)));
    console.log();

    if (i < count - 1) {
      const randomDelay = Math.floor(Math.random() * (90000 - 30000 + 1)) + 30000;
      await countdown(randomDelay);
    }
  }

  console.log(chalk.greenBright(`All Proccess Registration Completed`));
  console.log(chalk.greenBright(`Total Success: ${successCount}`));
  console.log(chalk.redBright(`Total Failed  : ${failCount}`));
  console.log();
}

main().catch(err => console.log(chalk.redBright(`✖ Error: ${err.message}`)));