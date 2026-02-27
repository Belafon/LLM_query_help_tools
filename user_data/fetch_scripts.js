const fs = require('fs');
const path = require('path');

try {
    const settingsPath = path.join(__dirname, 'settings.json');
    let currentWorkspace = 'Default';
    
    if (fs.existsSync(settingsPath)) {
        try {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if (settings.currentWorkspace) {
                currentWorkspace = settings.currentWorkspace;
            }
        } catch (e) {}
    }
    
    const scriptsPath = path.join(__dirname, 'workspaces', currentWorkspace, 'scripts.json');
    const usagePath = path.join(__dirname, 'usage.log');
    
    // Load usage stats
    const usageStats = {};
    if (fs.existsSync(usagePath)) {
        const usageContent = fs.readFileSync(usagePath, 'utf8');
        const lines = usageContent.split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            const parts = line.split('|');
            if (parts.length >= 2) {
                const timestamp = parts[0]; // AHK timestamp format YYYYMMDDHH24MISS
                const id = parts[1].trim();
                // Keep the latest timestamp for each ID
                if (!usageStats[id] || timestamp > usageStats[id]) {
                    usageStats[id] = timestamp;
                }
            }
        }
    }
    
    if (fs.existsSync(scriptsPath)) {
        const content = fs.readFileSync(scriptsPath, 'utf8');
        const data = JSON.parse(content);
        const scripts = data['powershell-scripts'] || {};
        
        // Convert to array for sorting
        const scriptArray = [];
        for (const [id, script] of Object.entries(scripts)) {
            scriptArray.push({
                id: id,
                ...script,
                lastUsed: usageStats[id] || '00000000000000' // Default to old date
            });
        }
        
        // Sort by lastUsed descending, then by name
        scriptArray.sort((a, b) => {
            if (b.lastUsed !== a.lastUsed) {
                return b.lastUsed.localeCompare(a.lastUsed);
            }
            return (a.name || '').localeCompare(b.name || '');
        });
        
        console.log("---START---");
        for (const script of scriptArray) {
            const contentBase64 = Buffer.from(script.content || '').toString('base64');
            // Output: ID|Name|Description|Base64Content|RunInBackground
            // Sanitize Name and Description to remove pipes and newlines
            const name = (script.name || '').replace(/\|/g, '-').replace(/[\r\n]+/g, ' ');
            const desc = (script.description || '').replace(/\|/g, '-').replace(/[\r\n]+/g, ' ');
            const runInBackground = script.runInBackground ? '1' : '0';

            console.log(`${script.id}|${name}|${desc}|${contentBase64}|${runInBackground}`);
        }
        console.log("---END---");
    }
} catch (e) {
    console.error("Error:", e.message);
}
