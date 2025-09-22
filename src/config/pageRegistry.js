import FileProcessor from '../pages/FileProcessor';

// Central registry of all pages
const pageRegistry = [
  {
    path: '/',
    name: 'File Processor',
    component: FileProcessor,
    icon: '📁'
  },
  // Add more pages here as you create them
  // Example:
  // {
  //   path: '/settings',
  //   name: 'Settings',
  //   component: Settings,
  //   icon: '⚙️'
  // }
];

export default pageRegistry;