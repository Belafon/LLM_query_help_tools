# Quick Start - PowerShell Manager

## Single Command Setup

### 1. Install all dependencies (first time only):
```bash
npm install
cd backend
npm install
cd ..
```

### 2. Start both frontend and backend:
```bash
npm run dev
```

That's it! This single command will:
- Start the backend PowerShell service on `http://localhost:3001`
- Start the frontend React application on `http://localhost:3000`
- Open your browser automatically to the application
- Show logs from both services with [0] and [1] prefixes

## What happens when you run `npm run dev`:
- ✅ Backend PowerShell service starts first
- ✅ Frontend React application starts
- ✅ Both run concurrently in the same terminal
- ✅ You can see logs from both services
- ✅ Use `Ctrl+C` to stop both services at once

## Alternative: Manual Start
If you prefer to start services separately:

**Terminal 1 (Backend):**
```bash
npm run backend
```

**Terminal 2 (Frontend):**
```bash
npm run frontend
```

## First Time Setup Summary:
```bash
# Clone and setup (if needed)
git clone [repository-url]
cd LLM_query_help_tools

# Install all dependencies
npm install && cd backend && npm install && cd ..

# Start everything
npm run dev
```

Your PowerShell Manager will be available at `http://localhost:3000`!