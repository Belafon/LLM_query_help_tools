# PowerShell Backend Service

A simple Node.js backend service for executing PowerShell scripts with real-time communication via WebSockets.

## Features

- Execute PowerShell scripts in real-time
- Handle user input for interactive scripts
- WebSocket communication for live output
- Session management for multiple concurrent executions
- Graceful process termination

## Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The service will run on `http://localhost:3001` by default.

## API

### WebSocket Messages

#### Execute Script
```json
{
  "type": "execute",
  "script": "Get-Process | Select-Object -First 5",
  "scriptName": "List Processes"
}
```

#### Send User Input
```json
{
  "type": "input",
  "sessionId": "uuid-session-id",
  "input": "user input text"
}
```

#### Terminate Execution
```json
{
  "type": "terminate",
  "sessionId": "uuid-session-id"
}
```

### Response Messages

- `execution_start` - Script execution started
- `output` - Script output data
- `error` - Error messages
- `execution_complete` - Script finished
- `input_sent` - User input was sent
- `terminated` - Script was terminated

## Health Check

GET `/health` - Returns service status

## Requirements

- Node.js 14+
- PowerShell (available on Windows by default)
- Windows operating system (for PowerShell execution)