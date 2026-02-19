/**
 * Cross-platform launcher script
 * Detects the OS and launches the appropriate GUI launcher
 */

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const platform = os.platform();
const userDataDir = path.join(__dirname, '..', 'user_data');

console.log(`Detected platform: ${platform}`);

if (platform === 'win32') {
  // Windows: Launch AutoHotkey
  const ahkScript = path.join(userDataDir, 'launcher_gui.ahk');

  if (!fs.existsSync(ahkScript)) {
    console.error(`AutoHotkey script not found: ${ahkScript}`);
    process.exit(1);
  }

  console.log('Starting AutoHotkey launcher...');
  console.log('Press Ctrl+F4 to open the script launcher.');

  // Use 'start' to launch AHK without blocking
  const proc = spawn('cmd.exe', ['/c', 'start', '""', ahkScript], {
    cwd: userDataDir,
    detached: true,
    stdio: 'ignore'
  });

  proc.unref();
  console.log('AutoHotkey launcher started.');

} else if (platform === 'linux' || platform === 'darwin') {
  // Linux/Mac: Launch shell script
  const shellScript = path.join(userDataDir, 'launcher_gui.sh');

  if (!fs.existsSync(shellScript)) {
    console.error(`Shell script not found: ${shellScript}`);
    console.error('Please ensure launcher_gui.sh exists in the user_data directory.');
    process.exit(1);
  }

  // Make sure it's executable
  try {
    fs.chmodSync(shellScript, 0o755);
  } catch (e) {
    // Ignore chmod errors on systems that don't support it
  }

  console.log('Linux/Mac launcher ready.');
  console.log('');
  console.log('To use the launcher, set up a global hotkey in your desktop environment:');
  console.log(`  Command: ${shellScript} --show`);
  console.log('');
  console.log('Or run it manually:');
  console.log(`  ${shellScript} --show`);
  console.log('');
  console.log('Supported GUI tools: rofi, dmenu, zenity, fzf');

  // Run once to show the launcher
  if (process.argv.includes('--show')) {
    const proc = spawn(shellScript, ['--show'], {
      cwd: userDataDir,
      stdio: 'inherit'
    });

    proc.on('exit', (code) => {
      process.exit(code || 0);
    });
  }

} else {
  console.error(`Unsupported platform: ${platform}`);
  console.error('This application supports Windows, Linux, and macOS.');
  process.exit(1);
}
