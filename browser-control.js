/**
 * Browser Control Module for Copilot GLI
 *
 * Provides full browser automation via Puppeteer-core:
 * navigate, click, type, screenshot, scrape, execute JS.
 * Connects to existing Edge/Chrome installation (no Chromium download).
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class BrowserControl {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.browser = null;
    this.page = null;
    this.pages = new Map();
    this.pageIdCounter = 0;
    this.isConnected = false;
  }

  /**
   * Find the installed browser executable
   */
  findBrowserPath() {
    const paths = [
      // Edge (always on Windows)
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      // Chrome
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      // Brave
      `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
      // Chromium
      `${process.env.LOCALAPPDATA}\\Chromium\\Application\\chrome.exe`,
    ];

    for (const p of paths) {
      try {
        if (fs.existsSync(p)) return p;
      } catch { /* skip */ }
    }

    return null;
  }

  /**
   * Launch browser instance
   */
  async launch(options = {}) {
    if (this.browser && this.isConnected) {
      return { success: true, message: 'Browser already running' };
    }

    const puppeteer = require('puppeteer-core');
    const executablePath = options.executablePath || this.findBrowserPath();

    if (!executablePath) {
      return { success: false, error: 'No browser found. Install Chrome or Edge.' };
    }

    try {
      this.browser = await puppeteer.launch({
        executablePath,
        headless: options.headless || false,
        defaultViewport: options.viewport || { width: 1280, height: 800 },
        args: [
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-infobars',
          `--window-size=${options.width || 1280},${options.height || 800}`,
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      });

      this.isConnected = true;

      // Get the initial page
      const pages = await this.browser.pages();
      if (pages.length > 0) {
        this.page = pages[0];
        const id = `page-${++this.pageIdCounter}`;
        this.pages.set(id, this.page);
      }

      this.browser.on('disconnected', () => {
        this.isConnected = false;
        this.browser = null;
        this.page = null;
        this.pages.clear();
        this.sendStatus('disconnected');
      });

      this.sendStatus('connected');

      return {
        success: true,
        browser: path.basename(executablePath),
        pageId: Array.from(this.pages.keys())[0],
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(url, pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };

    try {
      // Auto-add protocol
      if (!url.match(/^https?:\/\//)) url = `https://${url}`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const title = await page.title();
      const currentUrl = page.url();

      return { success: true, title, url: currentUrl };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Click on an element
   */
  async click(selector, pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };

    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.click(selector);
      return { success: true, selector };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Type text into an element
   */
  async type(selector, text, options = {}, pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };

    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      if (options.clear) {
        await page.click(selector, { clickCount: 3 });
      }
      await page.type(selector, text, { delay: options.delay || 50 });
      return { success: true, selector, textLength: text.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Press a key
   */
  async pressKey(key, pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };

    try {
      await page.keyboard.press(key);
      return { success: true, key };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Take a screenshot of the page
   */
  async screenshot(options = {}, pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };

    try {
      const buffer = await page.screenshot({
        type: 'png',
        fullPage: options.fullPage || false,
        encoding: 'base64',
      });

      return { success: true, data: `data:image/png;base64,${buffer}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get page content / text
   */
  async getContent(pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };

    try {
      const title = await page.title();
      const url = page.url();
      const text = await page.evaluate(() => document.body?.innerText?.substring(0, 10000) || '');
      const html = await page.content();

      return {
        success: true,
        title,
        url,
        text: text.substring(0, 10000),
        htmlLength: html.length,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Extract data from page using selectors
   */
  async extract(selector, attribute = 'textContent', pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };

    try {
      const data = await page.evaluate((sel, attr) => {
        const elements = document.querySelectorAll(sel);
        return Array.from(elements).slice(0, 100).map(el => {
          if (attr === 'textContent') return el.textContent?.trim();
          if (attr === 'innerHTML') return el.innerHTML;
          if (attr === 'href') return el.href;
          if (attr === 'src') return el.src;
          return el.getAttribute(attr) || el.textContent?.trim();
        });
      }, selector, attribute);

      return { success: true, count: data.length, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Execute JavaScript on the page
   */
  async evaluate(code, pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };

    try {
      const result = await page.evaluate(code);
      return { success: true, result: JSON.stringify(result)?.substring(0, 5000) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Wait for selector
   */
  async waitFor(selector, timeout = 10000, pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };

    try {
      await page.waitForSelector(selector, { timeout });
      return { success: true, selector };
    } catch (err) {
      return { success: false, error: `Timeout waiting for: ${selector}` };
    }
  }

  /**
   * Scroll the page
   */
  async scroll(direction = 'down', amount = 500, pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };

    try {
      const y = direction === 'down' ? amount : -amount;
      await page.evaluate((scrollY) => window.scrollBy(0, scrollY), y);
      return { success: true, direction, amount };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Fill a form with multiple fields
   */
  async fillForm(fields, pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };

    const results = [];
    for (const field of fields) {
      try {
        await page.waitForSelector(field.selector, { timeout: 3000 });
        if (field.clear) {
          await page.click(field.selector, { clickCount: 3 });
          await page.keyboard.press('Backspace');
        }
        await page.type(field.selector, field.value, { delay: 30 });
        results.push({ selector: field.selector, success: true });
      } catch (err) {
        results.push({ selector: field.selector, success: false, error: err.message });
      }
    }

    return { success: true, results };
  }

  /**
   * Select from dropdown
   */
  async select(selector, value, pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };

    try {
      await page.select(selector, value);
      return { success: true, selector, value };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Go back/forward
   */
  async goBack(pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };
    await page.goBack({ waitUntil: 'domcontentloaded' });
    return { success: true, url: page.url() };
  }

  async goForward(pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };
    await page.goForward({ waitUntil: 'domcontentloaded' });
    return { success: true, url: page.url() };
  }

  /**
   * Reload page
   */
  async reload(pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };
    await page.reload({ waitUntil: 'domcontentloaded' });
    return { success: true, url: page.url() };
  }

  /**
   * Create new tab
   */
  async newTab(url = 'about:blank') {
    if (!this.browser || !this.isConnected) {
      return { success: false, error: 'Browser not running' };
    }

    try {
      const page = await this.browser.newPage();
      const id = `page-${++this.pageIdCounter}`;
      this.pages.set(id, page);
      this.page = page;

      if (url !== 'about:blank') {
        if (!url.match(/^https?:\/\//)) url = `https://${url}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }

      return { success: true, pageId: id, url: page.url(), title: await page.title() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Close a tab
   */
  async closeTab(pageId) {
    const page = this.pages.get(pageId);
    if (!page) return { success: false, error: 'Page not found' };

    await page.close();
    this.pages.delete(pageId);

    // Switch to another page
    const remaining = Array.from(this.pages.values());
    this.page = remaining.length > 0 ? remaining[remaining.length - 1] : null;

    return { success: true };
  }

  /**
   * List all open tabs
   */
  async listTabs() {
    const tabs = [];
    for (const [id, page] of this.pages) {
      try {
        tabs.push({
          id,
          url: page.url(),
          title: await page.title(),
          isActive: page === this.page,
        });
      } catch {
        tabs.push({ id, url: 'unknown', title: 'Unknown', isActive: page === this.page });
      }
    }
    return tabs;
  }

  /**
   * Switch active tab
   */
  switchTab(pageId) {
    const page = this.pages.get(pageId);
    if (!page) return { success: false, error: 'Page not found' };
    this.page = page;
    page.bringToFront();
    return { success: true, pageId };
  }

  /**
   * Get page cookies
   */
  async getCookies(pageId = null) {
    const page = this.getPage(pageId);
    if (!page) return { success: false, error: 'No active page' };

    const cookies = await page.cookies();
    return { success: true, cookies: cookies.slice(0, 50) };
  }

  /**
   * Get info about the browser instance
   */
  getInfo() {
    return {
      connected: this.isConnected,
      pages: this.pages.size,
      activePageId: Array.from(this.pages.entries())
        .find(([, p]) => p === this.page)?.[0] || null,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────

  getPage(pageId) {
    if (pageId) return this.pages.get(pageId) || this.page;
    return this.page;
  }

  sendStatus(status) {
    this.mainWindow?.webContents.send('browser:status', { status });
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.page = null;
      this.pages.clear();
      this.isConnected = false;
    }
    return { success: true };
  }

  destroy() {
    this.close().catch(() => {});
  }
}

module.exports = BrowserControl;
