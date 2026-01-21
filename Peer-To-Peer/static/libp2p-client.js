// Browser-based libp2p Client for Gossipsub Mesh Network
class GossipsubClient {
    constructor() {
        this.nodeId = this.generateNodeId();
        this.privateKey = this.generateKeyPair();
        this.publicKey = this.privateKey.publicKey;
        this.peers = new Map();
        this.messages = new Map(); // CRDT message store
        this.topics = new Set(['messages', 'locations', 'presence']);
        this.sequence = 0;
        this.merkleRoot = null;
        this.isConnected = false;
        this.supernodeUrl = this.detectSupernode();
        this.location = null;
        
        this.initializeClient();
    }
    
    generateNodeId() {
        return 'node_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    }
    
    generateKeyPair() {
        // Simple key pair generation (in production, use proper crypto)
        const privateKey = {
            publicKey: 'pub_' + Math.random().toString(36).substr(2, 16),
            privateKey: 'priv_' + Math.random().toString(36).substr(2, 16)
        };
        return privateKey;
    }
    
    detectSupernode() {
        // Auto-detect supernode on local network
        const protocols = ['https', 'http'];
        const hosts = ['localhost', '127.0.0.1', 'drone.local'];
        const ports = [8001, 443, 80];
        
        for (const protocol of protocols) {
            for (const host of hosts) {
                for (const port of ports) {
                    const url = `${protocol}://${host}:${port}`;
                    if (this.testConnection(url)) {
                        console.log(`🚁 Detected supernode at: ${url}`);
                        return url;
                    }
                }
            }
        }
        
        // Fallback to localhost
        return 'http://localhost:8001';
    }
    
    testConnection(url) {
        try {
            // Simple connection test
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `${url}/api/topics`, false);
            xhr.send();
            return xhr.status === 200;
        } catch (error) {
            return false;
        }
    }
    
    async initializeClient() {
        console.log('🔧 Initializing libp2p client...');
        
        // Get user location
        this.location = await this.getCurrentLocation();
        
        // Connect to supernode
        await this.connectToSupernode();
        
        // Start gossip protocol
        this.startGossipProtocol();
        
        // Start periodic sync
        this.startPeriodicSync();
        
        console.log('✅ Gossipsub client ready');
    }
    
    async getCurrentLocation() {
        if (navigator.geolocation) {
            return new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                            alt: position.coords.altitude,
                            accuracy: position.coords.accuracy,
                            timestamp: Date.now()
                        });
                    },
                    (error) => {
                        console.warn('📍 Location access denied:', error);
                        resolve(null);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 60000
                    }
                );
            });
        }
        return null;
    }
    
    async connectToSupernode() {
        try {
            console.log('🔗 Connecting to supernode:', this.supernodeUrl);
            
            const response = await fetch(`${this.supernodeUrl}/api/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    peerId: this.nodeId,
                    deviceName: this.getDeviceName(),
                    deviceType: this.getDeviceType(),
                    location: this.location,
                    publicKey: this.publicKey
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.isConnected = true;
                
                // Sync with network state
                await this.syncWithNetwork(data);
                
                console.log('✅ Connected to gossip network');
                this.updateConnectionStatus(true);
            } else {
                throw new Error('Failed to join network');
            }
        } catch (error) {
            console.error('❌ Failed to connect to supernode:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false);
            
            // Retry connection
            setTimeout(() => this.connectToSupernode(), 5000);
        }
    }
    
    async syncWithNetwork(networkData) {
        console.log('🔄 Syncing with network state...');
        
        // Load network messages into CRDT store
        if (networkData.messages) {
            networkData.messages.forEach(msg => {
                this.messages.set(msg.id, msg);
            });
            this.sequence = networkData.sequence || 0;
            this.merkleRoot = networkData.merkleRoot;
        }
        
        // Load network peers
        if (networkData.peers) {
            networkData.peers.forEach(peer => {
                if (peer.id !== this.nodeId) {
                    this.peers.set(peer.id, peer);
                }
            });
        }
        
        console.log(`📊 Synced ${this.messages.size} messages, ${this.peers.size} peers`);
        
        // Update UI
        this.updateUI();
    }
    
    startGossipProtocol() {
        // Start periodic gossip messages
        setInterval(() => {
            this.gossipToPeers();
        }, 10000); // Gossip every 10 seconds
        
        // Start heartbeat
        setInterval(() => {
            this.sendHeartbeat();
        }, 30000); // Heartbeat every 30 seconds
    }
    
    async gossipToPeers() {
        if (!this.isConnected) return;
        
        try {
            // Send gossip messages to supernode
            await fetch(`${this.supernodeUrl}/api/gossip`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'heartbeat',
                    peerId: this.nodeId,
                    timestamp: Date.now(),
                    sequence: this.sequence
                })
            });
            
            console.log('📢 Sent gossip to network');
        } catch (error) {
            console.error('❌ Gossip failed:', error);
        }
    }
    
    async sendHeartbeat() {
        if (!this.isConnected) return;
        
        try {
            await fetch(`${this.supernodeUrl}/api/gossip`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'heartbeat',
                    peerId: this.nodeId,
                    timestamp: Date.now()
                })
            });
        } catch (error) {
            console.error('❌ Heartbeat failed:', error);
        }
    }
    
    startPeriodicSync() {
        // Sync with network every 60 seconds
        setInterval(async () => {
            if (this.isConnected) {
                await this.requestSync();
            }
        }, 60000);
    }
    
    async requestSync() {
        try {
            const response = await fetch(`${this.supernodeUrl}/api/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    peerId: this.nodeId,
                    sequence: this.sequence,
                    merkleRoot: this.merkleRoot,
                    messages: Array.from(this.messages.values())
                })
            });
            
            if (response.ok) {
                const syncData = await response.json();
                await this.processSyncResponse(syncData);
            }
        } catch (error) {
            console.error('❌ Sync request failed:', error);
        }
    }
    
    async processSyncResponse(syncData) {
        // CRDT merge logic
        const localMessages = Array.from(this.messages.values());
        const remoteMessages = syncData.messages || [];
        const mergedMessages = this.crdtMerge(localMessages, remoteMessages);
        
        // Update local state
        this.messages.clear();
        mergedMessages.forEach(msg => {
            this.messages.set(msg.id, msg);
        });
        
        this.sequence = syncData.sequence || this.sequence;
        this.merkleRoot = syncData.merkleRoot;
        
        console.log(`🔄 Processed sync: ${mergedMessages.length} messages`);
        this.updateUI();
    }
    
    crdtMerge(local, remote) {
        // CRDT merge - last-write-wins with conflict resolution
        const merged = new Map();
        const allMessages = [...local, ...remote];
        
        // Group by ID and apply CRDT rules
        allMessages.forEach(msg => {
            const existing = merged.get(msg.id);
            if (!existing || msg.timestamp > existing.timestamp) {
                merged.set(msg.id, msg);
            }
        });
        
        return Array.from(merged.values());
    }
    
    // Public API
    async sendMessage(content, type = 'public') {
        if (!this.isConnected) {
            console.error('❌ Not connected to network');
            return false;
        }
        
        const messageId = this.generateMessageId();
        const message = {
            id: messageId,
            type: type,
            author: this.nodeId,
            content: content,
            timestamp: Date.now(),
            location: this.location,
            signature: this.signMessage(content),
            sequence: ++this.sequence
        };
        
        try {
            const response = await fetch(`${this.supernodeUrl}/api/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: type,
                    authorId: this.nodeId,
                    content: content,
                    location: this.location,
                    signature: message.signature
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'accepted') {
                    // Add to local CRDT store
                    this.messages.set(messageId, message);
                    this.updateUI();
                    console.log(`✅ Message sent: ${content}`);
                    return true;
                }
            }
        } catch (error) {
            console.error('❌ Failed to send message:', error);
        }
        
        return false;
    }
    
    async updateLocation(location) {
        this.location = location;
        
        if (!this.isConnected) return;
        
        try {
            await fetch(`${this.supernodeUrl}/api/gossip`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'location-update',
                    deviceId: this.nodeId,
                    deviceName: this.getDeviceName(),
                    location: location
                })
            });
            
            console.log('📍 Location updated:', location);
        } catch (error) {
            console.error('❌ Failed to update location:', error);
        }
    }
    
    signMessage(content) {
        // Simple signature (in production, use proper crypto)
        return 'sig_' + crypto.createHash('sha256')
            .update(content + this.privateKey.privateKey)
            .digest('hex')
            .substr(0, 16);
    }
    
    generateMessageId() {
        return 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    getDeviceName() {
        return window.app ? window.app.currentUser.name : 'Gossip User';
    }
    
    getDeviceType() {
        const ua = navigator.userAgent;
        if (/Mobile|Android|iPhone|iPad/.test(ua)) {
            return 'phone';
        } else if (/Tablet/.test(ua)) {
            return 'tablet';
        } else {
            return 'laptop';
        }
    }
    
    updateConnectionStatus(connected) {
        const indicator = document.getElementById('connection-indicator');
        const text = document.getElementById('connection-text');
        const status = document.querySelector('.connection-status');
        
        if (indicator && text && status) {
            if (connected) {
                indicator.style.color = '#28a745';
                text.textContent = `Gossip Network (${this.peers.size + 1} nodes)`;
                status.classList.remove('disconnected');
                status.classList.add('connected');
            } else {
                indicator.style.color = '#dc3545';
                text.textContent = 'Disconnected from Gossip Network';
                status.classList.remove('connected');
                status.classList.add('disconnected');
            }
        }
    }
    
    updateUI() {
        if (window.app) {
            // Update messages
            window.app.messages.public = Array.from(this.messages.values())
                .filter(msg => msg.type === 'public')
                .sort((a, b) => a.timestamp - b.timestamp);
            
            // Update user list
            window.app.users.clear();
            this.peers.forEach((peer, id) => {
                window.app.users.set(id, {
                    id: id,
                    name: peer.name || peer.id,
                    status: 'Online',
                    location: peer.location,
                    isPublic: false
                });
            });
            
            // Update UI components
            window.app.updateUserList();
            window.app.displayPublicMessages();
            
            console.log(`🎨 UI updated: ${window.app.messages.public.length} messages, ${window.app.users.size} users`);
        }
    }
    
    // Network information
    getNetworkInfo() {
        return {
            nodeId: this.nodeId,
            connectedToSupernode: this.isConnected,
            supernodeUrl: this.supernodeUrl,
            peers: this.peers.size,
            messages: this.messages.size,
            sequence: this.sequence,
            merkleRoot: this.merkleRoot,
            location: this.location,
            deviceType: this.getDeviceType()
        };
    }
    
    disconnect() {
        this.isConnected = false;
        this.updateConnectionStatus(false);
        console.log('🔌 Disconnected from gossip network');
    }
}

// Initialize gossip client
if (typeof window !== 'undefined') {
    window.gossipClient = new GossipsubClient();
    
    // Wait for app to be initialized
    setTimeout(() => {
        if (typeof window.app !== 'undefined') {
            console.log('🔧 Integrating Gossipsub Client with app...');
            
            // Override app methods to use gossip client
            window.app.broadcastMessage = function(message) {
                if (window.gossipClient) {
                    console.log('📢 Broadcasting via Gossipsub:', message);
                    return window.gossipClient.sendMessage(message.content, 'public');
                }
            };
            
            window.app.sendPrivateMessageToUser = function(message) {
                if (window.gossipClient) {
                    console.log('📤 Sending private via Gossipsub:', message);
                    return window.gossipClient.sendMessage(message.content, 'private');
                }
            };
            
            window.app.broadcastUserProfile = function() {
                if (window.gossipClient) {
                    console.log('👤 Broadcasting profile via Gossipsub');
                    // Profile updates are handled automatically via gossip
                }
            };
            
            // Override connection status
            window.app.updateConnectionStatus = function() {
                if (window.gossipClient) {
                    window.gossipClient.updateConnectionStatus(window.gossipClient.isConnected);
                }
            };
            
            console.log('✅ Gossipsub Client integration complete!');
        }
    }, 2000);
}
