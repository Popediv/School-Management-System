/**
 * Patimo SMS - USB Biometric Scanner Bridge Service
 * 
 * Runs on localhost:8080 to bridge physical USB scanners (DigitalPersona U.are.U 4500, Futronic, etc.)
 * with the Patimo SMS Web Application.
 */

const http = require('http');
const PORT = 8080;

// Memory store for pending hardware scan
let activeHardwareScan = null;

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Status check endpoint
    if (url.pathname === '/api/status' || url.pathname === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            status: 'online',
            service: 'Patimo SMS Biometric Bridge',
            port: PORT,
            readyForFinger: true
        }));
    }

    // Capture endpoint — waits for actual hardware scan event
    if (url.pathname === '/capture' || url.pathname === '/api/capture') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};

                    // If a hardware template was pushed from SDK / scanner service
                    if (activeHardwareScan) {
                        const template = activeHardwareScan;
                        activeHardwareScan = null; // consume scan
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({
                            success: true,
                            template,
                            message: 'Fingerprint captured from hardware reader'
                        }));
                    } else {
                        // No finger scanned on the hardware glass yet
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({
                            success: false,
                            waitingForFinger: true,
                            message: 'No finger touch detected on scanner glass. Place finger on scanner.'
                        }));
                    }
                } catch {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, message: 'Scan error' }));
                }
            });
            return;
        }
    }

    // Push endpoint for hardware SDK / scanner service when finger is touched on optical glass
    if (url.pathname === '/push-scan' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body);
                if (parsed.template || parsed.data) {
                    activeHardwareScan = parsed.template || parsed.data;
                    console.log(`[Biometric Hardware] Finger touched sensor! Template registered.`);
                }
            } catch { }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'registered' }));
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`====================================================`);
    console.log(`  Patimo SMS Biometric Scanner Bridge Listening:8080 `);
    console.log(`  Waiting for physical finger touch on scanner glass `);
    console.log(`====================================================`);
});
