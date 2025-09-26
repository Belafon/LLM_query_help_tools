import FileProcessor from '../pages/FileProcessor';
import PowerShellManager from '../pages/PowerShellManager';

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
  // Add more pages here as you create them
  // Example:
  // {
  //   path: '/settings',
  //   name: 'Settings',
  //   component: Settings,
  // }
];

export default pageRegistry;