import FileProcessor from '../pages/FileProcessor';
import PowerShellManager from '../pages/PowerShellManager';
import HotkeyManager from '../pages/HotkeyManager';

// Central registry of all pages
const pageRegistry = [
  {
    path: '/',
    name: 'File Processor',
    component: FileProcessor,
  },
  {
    path: '/powershell',
    name: 'PowerShell Manager',
    component: PowerShellManager,
  },
  {
    path: '/hotkeys',
    name: 'Hotkey Manager',
    component: HotkeyManager,
  },
  // Add more pages here as you create them
  // Example:
  // {
  //   path: '/settings',
  //   name: 'Settings',
  //   component: Settings,
  // }
];

export default pageRegistry;