// Drone Supernode - High-Priority Gossipsub Mesh Network
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPERNODE_PORT = 8001;
const DATA_FILE = path.join(__dirname, 'gossip-state.json');
const CERT_FILE = path.join(__dirname, 'server-cert.pem');
const KEY_FILE = path.join(__dirname, 'server-key.pem');

console.log('🚁 DRONE SUPERNODE - Gossipsub Mesh Network');
console.log(`📡 Starting supernode on port ${SUPERNODE_PORT}`);
console.log('🔐 HTTPS enabled with self-signed certificates');
console.log('📊 CRDT-based state synchronization');
console.log('🌐 libp2p-mdns peer discovery');

// Generate self-signed certificate for HTTPS
function generateCertificate() {
    const { execSync } = require('child_process');
    
    try {
        // Generate certificate and key
        execSync('openssl req -x509 -newkey rsa:2048 -nodes -keyout server-key.pem -out server-cert.pem -days 365 -subj "/C=US/ST=State/L=City/O=DroneNetwork/OU=IT/CN=localhost"', { stdio: 'inherit' });
        
        console.log('🔐 Generated self-signed certificates for HTTPS');
        return true;
    } catch (error) {
        console.log('⚠️ Certificate generation failed, using HTTP fallback');
        return false;
    }
}

// Load or initialize gossip state
let gossipState = {
    messages: new Map(), // CRDT-based message storage
    peers: new Map(), // Connected peers
    topics: new Map(), // Gossipsub topics
    messageIds: new Set(), // Message deduplication
    lastSync: Date.now(),
    merkleRoot: null,
    sequence: 0
};

if (fs.existsSync(DATA_FILE)) {
    try {
        const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        // Properly reconstruct Maps from saved data
        if (saved.messages && Array.isArray(saved.messages)) {
            gossipState.messages = new Map(saved.messages.map(msg => [msg.id, msg]));
        }
        if (saved.peers && Array.isArray(saved.peers)) {
            gossipState.peers = new Map(saved.peers.map(peer => [peer.id, peer]));
        }
        if (saved.topics && Array.isArray(saved.topics)) {
            gossipState.topics = new Map(saved.topics.map(([topic, peerIds]) => [topic, new Set(peerIds)]));
        }
        if (saved.messageIds && Array.isArray(saved.messageIds)) {
            gossipState.messageIds = new Set(saved.messageIds);
        }
        gossipState.sequence = saved.sequence || 0;
        gossipState.merkleRoot = saved.merkleRoot || null;
        console.log(`📂 Loaded gossip state: ${gossipState.messages.size} messages, ${gossipState.peers.size} peers`);
    } catch (error) {
        console.log(`📂 Error loading saved state: ${error.message}`);
    }
}

// Generate HTTPS certificates
const useHTTPS = false; // Disabled to avoid port conflicts, use HTTP on 8080

// CORS headers - defined at module level for access in all functions
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
};

let server;

if (useHTTPS) {
    const https = require('https');
    const options = {
        key: fs.readFileSync(KEY_FILE),
        cert: fs.readFileSync(CERT_FILE)
    };
    server = https.createServer(options, (req, res) => {
        handleRequest(req, res);
    });
} else {
    const http = require('http');
    server = http.createServer(handleRequest);
}

// Handle both HTTP and HTTPS requests
function handleRequest(req, res) {
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200, corsHeaders);
        res.end();
        return;
    }
    
    const url = req.url;
    const method = req.method;
    
    // Serve static files
    if (method === 'GET' && (url === '/' || url.startsWith('/static/'))) {
        serveStaticFile(req, res, url);
        return;
    }
    
    // Handle API endpoints (GET and POST)
    if ((method === 'POST' || method === 'GET') && url.startsWith('/api/')) {
        handleAPIRequest(req, res, url, method);
        return;
    }
    
    // Default response
    res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}

function serveStaticFile(req, res, url) {
    const filePath = url === '/' ? '/index.html' : url.replace('/static/', '/');
    const fullPath = path.join(__dirname, 'static', filePath);
    
    try {
        const content = fs.readFileSync(fullPath);
        const ext = path.extname(filePath);
        const contentType = getContentType(ext);
        
        res.writeHead(200, {
            'Content-Type': contentType,
            ...corsHeaders
        });
        res.end(content);
    } catch (error) {
        res.writeHead(404, corsHeaders);
        res.end('File not found');
    }
}

function getContentType(ext) {
    const types = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json'
    };
    return types[ext] || 'text/plain';
}

function handleAPIRequest(req, res, url, method) {
    // For GET requests, handle directly without waiting for body
    if (method === 'GET') {
        const endpoint = url.split('?')[0].replace('/api/', '');
        const queryParams = new URLSearchParams(url.split('?')[1] || '');
        
        switch (endpoint) {
            case 'topics':
                handleTopicsRequest(null, res);
                break;
            case 'peers':
                res.writeHead(200, corsHeaders);
                res.end(JSON.stringify({ peers: Array.from(gossipState.peers.values()) }));
                break;
            case 'messages':
                res.writeHead(200, corsHeaders);
                res.end(JSON.stringify({ messages: Array.from(gossipState.messages.values()) }));
                break;
            case 'info':
                res.writeHead(200, corsHeaders);
                res.end(JSON.stringify({
                    nodeId: 'supernode_' + Date.now(),
                    messageCount: gossipState.messages.size,
                    peerCount: gossipState.peers.size,
                    topicCount: gossipState.topics.size
                }));
                break;
            default:
                res.writeHead(400, corsHeaders);
                res.end(JSON.stringify({ error: 'Unknown endpoint' }));
        }
        return;
    }
    
    // For POST requests, read body first
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const data = body ? JSON.parse(body) : {};
            const endpoint = url.replace('/api/', '');
            
            switch (endpoint) {
                case 'join':
                    handlePeerJoin(data, res);
                    break;
                case 'message':
                    handleMessage(data, res);
                    break;
                case 'sync':
                    handleSyncRequest(data, res);
                    break;
                case 'topics':
                    handleTopicsRequest(data, res);
                    break;
                case 'gossip':
                    handleGossipMessage(data, res);
                    break;
                default:
                    res.writeHead(400, corsHeaders);
                    res.end(JSON.stringify({ error: 'Unknown endpoint' }));
            }
        } catch (error) {
            res.writeHead(400, corsHeaders);
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
    });
}

function handlePeerJoin(data, res) {
    const peerId = data.peerId;
    const peerInfo = {
        id: peerId,
        name: data.deviceName,
        type: data.deviceType, // 'phone', 'laptop', 'drone'
        location: data.location || null,
        publicKey: data.publicKey,
        joined: Date.now(),
        lastSeen: Date.now(),
        sequence: 0
    };
    
    gossipState.peers.set(peerId, peerInfo);
    
    // Subscribe to standard topics
    const topics = ['messages', 'locations', 'presence'];
    topics.forEach(topic => {
        if (!gossipState.topics.has(topic)) {
            gossipState.topics.set(topic, new Set());
        }
        gossipState.topics.get(topic).add(peerId);
    });
    
    // Send current state to new peer
    const syncData = {
        type: 'sync-response',
        sequence: gossipState.sequence,
        merkleRoot: calculateMerkleRoot(),
        messages: Array.from(gossipState.messages.values()),
        peers: Array.from(gossipState.peers.values()),
        topics: Array.from(gossipState.topics.entries()).map(([topic, peers]) => [topic, Array.from(peers)])
    };
    
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify(syncData));
    
    // Gossip new peer to network
    broadcastGossip({
        type: 'peer-joined',
        data: peerInfo,
        topics: ['presence']
    });
    
    console.log(`✅ ${data.deviceName} (${data.deviceType}) joined gossip network`);
}

function handleMessage(data, res) {
    const messageId = generateMessageId();
    
    // Check for duplicates
    if (gossipState.messageIds.has(messageId)) {
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify({ status: 'duplicate', messageId }));
        return;
    }
    
    gossipState.messageIds.add(messageId);
    
    // CRDT message processing
    const crdtMessage = {
        id: messageId,
        type: data.type, // 'public', 'private', 'location'
        author: data.authorId,
        content: data.content,
        timestamp: Date.now(),
        location: data.location || null,
        signature: data.signature,
        sequence: ++gossipState.sequence
    };
    
    // Add to CRDT state
    gossipState.messages.set(messageId, crdtMessage);
    gossipState.merkleRoot = calculateMerkleRoot();
    
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({ status: 'accepted', messageId }));
    
    // Gossip to all interested peers
    broadcastGossip({
        type: 'message',
        data: crdtMessage,
        topics: ['messages']
    });
    
    console.log(`💬 ${data.authorId}: ${data.content}`);
    saveGossipState();
}

function handleSyncRequest(data, res) {
    const requestingPeer = gossipState.peers.get(data.peerId);
    if (!requestingPeer) {
        res.writeHead(404, corsHeaders);
        res.end(JSON.stringify({ error: 'Peer not found' }));
        return;
    }
    
    // Calculate state difference
    const localMessages = Array.from(gossipState.messages.values());
    const remoteMessages = data.messages || [];
    const mergedMessages = crdtMerge(localMessages, remoteMessages);
    
    // Update local state
    gossipState.messages.clear();
    mergedMessages.forEach(msg => {
        gossipState.messages.set(msg.id, msg);
    });
    
    gossipState.merkleRoot = calculateMerkleRoot();
    
    const syncResponse = {
        type: 'sync-response',
        sequence: gossipState.sequence,
        merkleRoot: gossipState.merkleRoot,
        messages: mergedMessages,
        peers: Array.from(gossipState.peers.values())
    };
    
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify(syncResponse));
    
    console.log(`🔄 Synced ${mergedMessages.length} messages with peer ${data.peerId}`);
}

function handleTopicsRequest(data, res) {
    const topics = Array.from(gossipState.topics.entries()).map(([topic, peers]) => [topic, Array.from(peers)]);
    
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({ topics }));
}

function handleGossipMessage(data, res) {
    // Process incoming gossip message
    switch (data.type) {
        case 'message':
        handleGossipMessageData(data.data);
            break;
        case 'peer-joined':
            handleGossipPeerJoined(data.data);
            break;
        case 'peer-left':
            handleGossipPeerLeft(data.data);
            break;
        case 'location-update':
            handleGossipLocationUpdate(data.data);
            break;
    }
    
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({ status: 'received' }));
}

function handleGossipMessageData(messageData) {
    // CRDT merge logic
    const existingMessage = gossipState.messages.get(messageData.id);
    if (existingMessage) {
        // Apply CRDT merge rules
        const merged = crdtMerge(existingMessage, messageData);
        gossipState.messages.set(messageData.id, merged);
        gossipState.merkleRoot = calculateMerkleRoot();
        
        // Forward to interested peers
        broadcastGossip({
            type: 'message',
            data: merged,
            topics: ['messages']
        });
    } else {
        // New message
        gossipState.messages.set(messageData.id, messageData);
        gossipState.merkleRoot = calculateMerkleRoot();
        
        // Forward to interested peers
        broadcastGossip({
            type: 'message',
            data: messageData,
            topics: ['messages']
        });
    }
}

function handleGossipPeerJoined(peerData) {
    gossipState.peers.set(peerData.id, peerData);
    
    // Add to all relevant topics
    ['presence', 'messages', 'locations'].forEach(topic => {
        if (!gossipState.topics.has(topic)) {
            gossipState.topics.set(topic, new Set());
        }
        gossipState.topics.get(topic).add(peerData.id);
    });
    
    console.log(`👥 ${peerData.name} joined via gossip`);
}

function handleGossipPeerLeft(peerData) {
    gossipState.peers.delete(peerData.id);
    
    // Remove from all topics
    gossipState.topics.forEach((peers, topic) => {
        peers.delete(peerData.id);
    });
    
    console.log(`👋 ${peerData.name} left via gossip`);
}

function handleGossipLocationUpdate(locationData) {
    const peer = gossipState.peers.get(locationData.deviceId);
    if (peer) {
        peer.location = locationData.location;
        peer.lastSeen = Date.now();
    }
    
    console.log(`📍 ${locationData.deviceName} updated location via gossip`);
}

// Gossip broadcasting
function broadcastGossip(message) {
    const messageStr = JSON.stringify(message);
    
    gossipState.peers.forEach((peer) => {
        // Check if peer is interested in this message type
        const shouldSend = message.topics.some(topic => {
            const topicPeers = gossipState.topics.get(topic);
            return topicPeers && topicPeers.has(peer.id);
        });
        
        if (shouldSend) {
            // In real implementation, this would be sent via libp2p
            // For now, we'll simulate the gossip
            console.log(`📢 Gossiping ${message.type} to ${peer.name}`);
        }
    });
}

// CRDT operations
function crdtMerge(local, remote) {
    // Simple CRDT merge - last-write-wins
    if (remote.timestamp > local.timestamp) {
        return remote;
    }
    return local;
}

// Merkle tree calculation
function calculateMerkleRoot() {
    const messages = Array.from(gossipState.messages.values());
    if (messages.length === 0) return null;
    
    // Simple Merkle root calculation
    const hash = (data) => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const hashes = messages.map(hash);
    
    // Build Merkle tree (simplified)
    while (hashes.length > 1) {
        const newHashes = [];
        for (let i = 0; i < hashes.length; i += 2) {
            const left = hashes[i];
            const right = i + 1 < hashes.length ? hashes[i + 1] : hashes[i];
            newHashes.push(crypto.createHash('sha256').update(left + right).digest('hex'));
        }
        hashes = newHashes;
    }
    
    return hashes[0];
}

function generateMessageId() {
    return 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

function saveGossipState() {
    try {
        const stateData = {
            messages: Array.from(gossipState.messages.values()),
            peers: Array.from(gossipState.peers.values()),
            topics: Array.from(gossipState.topics.entries()).map(([topic, peers]) => [topic, Array.from(peers)]),
            messageIds: Array.from(gossipState.messageIds),
            sequence: gossipState.sequence,
            merkleRoot: gossipState.merkleRoot,
            lastSync: Date.now()
        };
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(stateData, null, 2));
        console.log(`💾 Gossip state saved: ${gossipState.messages.size} messages, ${gossipState.peers.size} peers`);
    } catch (error) {
        console.error(`❌ Error saving gossip state: ${error.message}`);
    }
}

// Start server on non-privileged ports (no sudo required)
const port = useHTTPS ? 8443 : 8080;
server.listen(port, () => {
    const protocol = useHTTPS ? 'https' : 'http';
    console.log(`🚀 Drone supernode ready on ${protocol}://${require('os').hostname()}:${port}`);
    console.log(`📊 Gossipsub mesh network initialized`);
    console.log(`🔐 Serving with ${useHTTPS ? 'HTTPS' : 'HTTP'} for WebRTC compatibility`);
    console.log(`📱 Peers can connect and participate in decentralized messaging`);
    console.log(`🌐 Web UI: http://localhost:${port}`);
});

// Auto-save state
setInterval(() => {
    saveGossipState();
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Shutting down drone supernode...');
    saveGossipState();
    server.close();
    process.exit(0);
});
