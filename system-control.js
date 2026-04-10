/**
 * System Control Module for Copilot GLI
 *
 * Provides full PC control: system info, process management,
 * app launching, clipboard, screenshots, power control, file ops.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec, execSync, spawn } = require('child_process');
const { clipboard, shell, screen, dialog, app, nativeImage } = require('electron');

class SystemControl {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
  }

  // ─── System Information ────────────────────────────────────

  getQuickInfo() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: os.uptime(),
      cpu: {
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length,
        speed: cpus[0]?.speed || 0,
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percentUsed: Math.round((usedMem / totalMem) * 100),
      },
      user: os.userInfo().username,
      homedir: os.homedir(),
      tmpdir: os.tmpdir(),
    };
  }

  async getDetailedInfo() {
    const si = require('systeminformation');

    const [cpu, mem, disk, graphics, battery, network, osInfo] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.graphics().catch(() => ({ controllers: [] })),
      si.battery().catch(() => ({})),
      si.networkInterfaces().catch(() => []),
      si.osInfo(),
    ]);

    return {
      os: {
        distro: osInfo.distro,
        release: osInfo.release,
        build: osInfo.build,
        arch: osInfo.arch,
        hostname: osInfo.hostname,
        serial: osInfo.serial,
      },
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        speed: cpu.speed,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        available: mem.available,
        percentUsed: Math.round((mem.used / mem.total) * 100),
        swapTotal: mem.swaptotal,
        swapUsed: mem.swapused,
      },
      disks: disk.map(d => ({
        fs: d.fs,
        type: d.type,
        size: d.size,
        used: d.used,
        available: d.available,
        mount: d.mount,
        percentUsed: d.use,
      })),
      gpu: graphics.controllers.map(g => ({
        model: g.model,
        vendor: g.vendor,
        vram: g.vram,
        driver: g.driverVersion,
      })),
      battery: {
        hasBattery: battery.hasBattery || false,
        percent: battery.percent || 0,
        isCharging: battery.isCharging || false,
        timeRemaining: battery.timeRemaining || 0,
      },
      network: (Array.isArray(network) ? network : []).slice(0, 5).map(n => ({
        iface: n.iface,
        ip4: n.ip4,
        mac: n.mac,
        type: n.type,
        speed: n.speed,
      })),
    };
  }

  // ─── Process Management ────────────────────────────────────

  async listProcesses() {
    const si = require('systeminformation');
    const procs = await si.processes();

    return procs.list
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 100)
      .map(p => ({
        pid: p.pid,
        name: p.name,
        cpu: Math.round(p.cpu * 10) / 10,
        mem: Math.round(p.mem * 10) / 10,
        memRss: p.memRss,
        state: p.state,
        user: p.user,
        command: p.command?.substring(0, 120),
        started: p.started,
      }));
  }

  killProcess(pid) {
    try {
      process.kill(pid, 'SIGTERM');
      return { success: true, pid };
    } catch (err) {
      // Try forceful kill on Windows
      try {
        execSync(`taskkill /PID ${pid} /F`, { timeout: 5000 });
        return { success: true, pid };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  }

  // ─── App Launcher ──────────────────────────────────────────

  launchApp(appPath, args = []) {
    try {
      const child = spawn(appPath, args, {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return { success: true, pid: child.pid };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  openUrl(url) {
    shell.openExternal(url);
    return { success: true };
  }

  openPath(filePath) {
    shell.openPath(filePath);
    return { success: true };
  }

  showInFolder(filePath) {
    shell.showItemInFolder(filePath);
    return { success: true };
  }

  // ─── Installed Apps (Windows) ──────────────────────────────

  async getInstalledApps() {
    return new Promise((resolve) => {
      const cmd = `powershell -NoProfile -Command "Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*,HKLM:\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* 2>$null | Where-Object {$_.DisplayName} | Select-Object DisplayName,DisplayVersion,Publisher,InstallDate | Sort-Object DisplayName | ConvertTo-Json -Compress"`;

      exec(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 15000 }, (err, stdout) => {
        if (err) { resolve([]); return; }
        try {
          const apps = JSON.parse(stdout);
          resolve(Array.isArray(apps) ? apps : [apps]);
        } catch {
          resolve([]);
        }
      });
    });
  }

  // ─── Clipboard ─────────────────────────────────────────────

  clipboardRead() {
    return {
      text: clipboard.readText(),
      html: clipboard.readHTML(),
      hasImage: !clipboard.readImage().isEmpty(),
    };
  }

  clipboardWrite(text) {
    clipboard.writeText(text);
    return { success: true };
  }

  clipboardClear() {
    clipboard.clear();
    return { success: true };
  }

  // ─── Screenshot ────────────────────────────────────────────

  async takeScreenshot() {
    try {
      const screenshot = require('screenshot-desktop');
      const imgBuffer = await screenshot();
      const base64 = imgBuffer.toString('base64');
      return { success: true, data: `data:image/png;base64,${base64}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async takeWindowScreenshot() {
    try {
      const img = await this.mainWindow.capturePage();
      const base64 = img.toPNG().toString('base64');
      return { success: true, data: `data:image/png;base64,${base64}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ─── Power Control ─────────────────────────────────────────

  async powerAction(action) {
    const commands = {
      shutdown: 'shutdown /s /t 5',
      restart: 'shutdown /r /t 5',
      sleep: 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0',
      lock: 'rundll32.exe user32.dll,LockWorkStation',
      logoff: 'shutdown /l',
      hibernate: 'shutdown /h',
    };

    const cmd = commands[action];
    if (!cmd) return { success: false, error: `Unknown action: ${action}` };

    // Lock doesn't need confirmation
    if (action === 'lock') {
      exec(cmd);
      return { success: true, action };
    }

    // Everything else needs user confirmation via dialog
    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'warning',
      buttons: ['Cancel', `Yes, ${action}`],
      defaultId: 0,
      title: `Confirm ${action}`,
      message: `Are you sure you want to ${action} your computer?`,
      detail: action === 'shutdown' ? 'Your computer will shut down in 5 seconds.' :
              action === 'restart' ? 'Your computer will restart in 5 seconds.' :
              `This will ${action} your computer.`,
    });

    if (result.response === 1) {
      exec(cmd);
      return { success: true, action };
    }

    return { success: false, error: 'Cancelled by user' };
  }

  cancelShutdown() {
    exec('shutdown /a');
    return { success: true };
  }

  // ─── File Operations ───────────────────────────────────────

  fileCreate(filePath, content = '') {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true, path: filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  fileDelete(filePath) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  fileRename(oldPath, newPath) {
    try {
      fs.renameSync(oldPath, newPath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  fileCopy(src, dest) {
    try {
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        fs.cpSync(src, dest, { recursive: true });
      } else {
        fs.copyFileSync(src, dest);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  fileInfo(filePath) {
    try {
      const stat = fs.statSync(filePath);
      return {
        success: true,
        info: {
          path: filePath,
          name: path.basename(filePath),
          size: stat.size,
          isDirectory: stat.isDirectory(),
          isFile: stat.isFile(),
          created: stat.birthtime,
          modified: stat.mtime,
          accessed: stat.atime,
          permissions: stat.mode.toString(8),
        },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ─── Volume Control (Windows) ──────────────────────────────

  setVolume(level) {
    const clamped = Math.max(0, Math.min(100, level));
    const cmd = `powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173); Start-Sleep -Milliseconds 100; $w = New-Object -ComObject WScript.Shell; 1..50 | ForEach-Object { $w.SendKeys([char]174) }; 1..${Math.round(clamped / 2)} | ForEach-Object { $w.SendKeys([char]175) }"`;
    exec(cmd);
    return { success: true, level: clamped };
  }

  muteToggle() {
    exec('powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"');
    return { success: true };
  }

  // ─── Display Info ──────────────────────────────────────────

  getDisplays() {
    const displays = screen.getAllDisplays();
    return displays.map(d => ({
      id: d.id,
      bounds: d.bounds,
      size: d.size,
      scaleFactor: d.scaleFactor,
      rotation: d.rotation,
      isPrimary: d.bounds.x === 0 && d.bounds.y === 0,
    }));
  }

  // ─── Notifications ─────────────────────────────────────────

  showNotification(title, body) {
    this.mainWindow?.webContents.send('system:notification', { title, body });
    return { success: true };
  }

  // ─── WiFi Networks (Windows) ────────────────────────────────

  async getWifiNetworks() {
    return new Promise((resolve) => {
      exec('netsh wlan show networks mode=bssid', { timeout: 10000 }, (err, stdout) => {
        if (err) { resolve([]); return; }

        const networks = [];
        const blocks = stdout.split(/\n(?=SSID \d)/);
        for (const block of blocks) {
          const ssidMatch = block.match(/SSID \d+ : (.+)/);
          const signalMatch = block.match(/Signal\s*:\s*(\d+)%/);
          const authMatch = block.match(/Authentication\s*:\s*(.+)/);
          if (ssidMatch && ssidMatch[1].trim()) {
            networks.push({
              ssid: ssidMatch[1].trim(),
              signal: signalMatch ? parseInt(signalMatch[1]) : 0,
              auth: authMatch ? authMatch[1].trim() : 'Unknown',
            });
          }
        }
        resolve(networks);
      });
    });
  }

  // ─── Run as Admin ──────────────────────────────────────────

  runElevated(command) {
    return new Promise((resolve) => {
      const cmd = `powershell -NoProfile -Command "Start-Process -Verb RunAs -FilePath 'cmd.exe' -ArgumentList '/c ${command.replace(/'/g, "''")}'"`; 
      exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
        resolve({
          success: !err,
          stdout: stdout || '',
          stderr: stderr || '',
          error: err?.message,
        });
      });
    });
  }
}

module.exports = SystemControl;
