/**
 * DigitalPersona U.are.U 4500 Web Service & Web API Client
 * Designed for DigitalPersona OneTouch Web SDK / WAEC Biometric Client Prerequisites
 */

// Common ports where DigitalPersona Web SDK / Web Agent / WAEC Biometric Service listen
const DP_PORTS = [8000, 8632, 8080, 9000, 9001];

export const digitalPersonaService = {
    /**
     * Probe local endpoints to check if DigitalPersona U.are.U driver service is active
     */
    checkConnection: async () => {
        for (const port of DP_PORTS) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1000);

                const res = await fetch(`http://127.0.0.1:${port}/api/status`, {
                    mode: 'cors',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (res.ok) {
                    const data = await res.json();
                    return { connected: true, port, data };
                }
            } catch {
                // Safe check ignore
            }
        }
        return { connected: false };
    },

    /**
     * Capture fingerprint from DigitalPersona U.are.U 4500 reader
     * Safely tries Web API REST endpoints and WebSockets with zero uncaught exceptions
     */
    captureFingerprint: async () => {
        // 1. Try local HTTP / HTTPS REST ports
        for (const port of DP_PORTS) {
            for (const protocol of ['http', 'https']) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 1500);

                    const res = await fetch(`${protocol}://127.0.0.1:${port}/capture`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        mode: 'cors',
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (res.ok) {
                        const data = await res.json();
                        const template = data.template || data.Data || data.data || data.minutiae || data.sample;
                        // Valid fingerprint templates are long base64 strings usually > 100 chars
                        if (template && typeof template === 'string' && template.length > 50) {
                            return { success: true, template, port, protocol };
                        }
                    }
                } catch {
                    // Ignore network / CORS errors on unallocated ports
                }
            }
        }

        // 2. Try WebSocket connection (DP Web SDK standard `ws://127.0.0.1:8000` or `ws://127.0.0.1:8632`)
        for (const port of [8000, 8632, 9000, 9001]) {
            for (const wsProtocol of ['ws', 'wss']) {
                try {
                    const template = await new Promise((resolve) => {
                        let socket = null;
                        let timer = null;

                        try {
                            socket = new WebSocket(`${wsProtocol}://127.0.0.1:${port}/capture`);
                        } catch {
                            return resolve(null);
                        }

                        timer = setTimeout(() => {
                            try { socket.close(); } catch { }
                            resolve(null);
                        }, 1200);

                        socket.onopen = () => {
                            try { socket.send(JSON.stringify({ command: 'capture' })); } catch { }
                        };

                        socket.onmessage = (evt) => {
                            clearTimeout(timer);
                            try { socket.close(); } catch { }
                            try {
                                const msg = JSON.parse(evt.data);
                                const val = msg.template || msg.Data || msg.data || msg.sample;
                                if (val && typeof val === 'string' && val.length > 50) return resolve(val);
                            } catch {
                                if (typeof evt.data === 'string' && evt.data.length > 50) {
                                    return resolve(evt.data);
                                }
                            }
                            resolve(null);
                        };

                        socket.onerror = () => {
                            clearTimeout(timer);
                            try { socket.close(); } catch { }
                            resolve(null);
                        };
                    });

                    if (template) {
                        return { success: true, template, port, protocol: wsProtocol };
                    }
                } catch {
                    // Ignore connection errors
                }
            }
        }

        return { success: false, message: 'DigitalPersona driver bridge not responding' };
    }
};
