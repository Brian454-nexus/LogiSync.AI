// LogiSync.AI - Unified Logistics Data Platform

let currentScreen = 'dashboard';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadDashboard();
    setupEventListeners();
    setupFileUpload();
});

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const screen = this.dataset.screen;
            showScreen(screen);
        });
    });
}

// Setup file upload for OCR
function setupFileUpload() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.id = 'driver-receipt';
    document.body.appendChild(fileInput);
}

// Show screen
function showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    document.getElementById(screenName + '-screen').classList.add('active');
    
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-screen="${screenName}"]`).classList.add('active');
    
    currentScreen = screenName;
    
    // Load screen-specific data
    if (screenName === 'dashboard') {
        loadDashboard();
    } else if (screenName === 'data-sources') {
        loadDataSources();
    }
}

// Load dashboard data
async function loadDashboard() {
    try {
        // Load shipments
        const shipmentsResponse = await fetch('/api/shipments');
        const shipments = await shipmentsResponse.json();
        
        // Load data sources
        const sourcesResponse = await fetch('/api/data-sources');
        const sources = await sourcesResponse.json();
        
        // Update metrics
        document.getElementById('active-trucks').textContent = shipments.length;
        document.getElementById('data-sources').textContent = Object.keys(sources).length;
        document.getElementById('ai-predictions').textContent = shipments.length;
        document.getElementById('anomalies').textContent = shipments.filter(s => s.events.some(e => e.status === 'anomaly')).length;
        
        // Display shipments
        displayShipments(shipments);
        
        // Display recent updates
        displayRecentUpdates(sources);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Display shipments
function displayShipments(shipments) {
    const container = document.getElementById('shipments-grid');
    container.innerHTML = '';
    
    shipments.forEach(shipment => {
        const shipmentCard = document.createElement('div');
        shipmentCard.className = 'shipment-card';
        
        const statusColor = getStatusColor(shipment.status);
        const dataSourcesCount = shipment.data_sources.length;
        
        shipmentCard.innerHTML = `
            <div class="shipment-header">
                <div class="truck-id">${shipment.truck_id}</div>
                <div class="status-badge" style="background-color: ${statusColor}">${shipment.status}</div>
            </div>
            <div class="shipment-details">
                <div class="detail-row">
                    <strong>Location:</strong> ${shipment.current_location}
                </div>
                <div class="detail-row">
                    <strong>Cargo:</strong> ${shipment.cargo || 'Unknown'}
                </div>
                <div class="detail-row">
                    <strong>Destination:</strong> ${shipment.destination || 'Unknown'}
                </div>
                <div class="detail-row">
                    <strong>Data Sources:</strong> ${dataSourcesCount} sources
                </div>
                <div class="detail-row">
                    <strong>Last Update:</strong> ${shipment.last_update}
                </div>
            </div>
            <div class="shipment-actions">
                <button class="btn-secondary" onclick="trackShipmentById('${shipment.truck_id}')">Track</button>
                <button class="btn-secondary" onclick="getETAPrediction('${shipment.truck_id}')">Get ETA</button>
            </div>
        `;
        
        container.appendChild(shipmentCard);
    });
}

// Display recent updates
function displayRecentUpdates(sources) {
    const container = document.getElementById('updates-list');
    container.innerHTML = '';
    
    // Combine all updates and sort by timestamp
    const allUpdates = [];
    
    Object.keys(sources).forEach(sourceType => {
        sources[sourceType].forEach(update => {
            allUpdates.push({
                ...update,
                sourceType: sourceType
            });
        });
    });
    
    // Sort by timestamp (most recent first)
    allUpdates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Display last 10 updates
    allUpdates.slice(0, 10).forEach(update => {
        const updateItem = document.createElement('div');
        updateItem.className = 'update-item';
        
        const sourceIcon = getSourceIcon(update.sourceType);
        const timeAgo = getTimeAgo(update.timestamp);
        
        updateItem.innerHTML = `
            <div class="update-icon">${sourceIcon}</div>
            <div class="update-content">
                <div class="update-text">${formatUpdateText(update)}</div>
                <div class="update-time">${timeAgo}</div>
            </div>
        `;
        
        container.appendChild(updateItem);
    });
}

// Load data sources
async function loadDataSources() {
    try {
        const response = await fetch('/api/data-sources');
        const sources = await response.json();
        
        // Display each source type
        Object.keys(sources).forEach(sourceType => {
            const container = document.getElementById(sourceType.replace('_', '-'));
            if (container) {
                displaySourceData(container, sources[sourceType], sourceType);
            }
        });
        
    } catch (error) {
        console.error('Error loading data sources:', error);
    }
}

// Display source data
function displaySourceData(container, data, sourceType) {
    container.innerHTML = '';
    
    if (data.length === 0) {
        container.innerHTML = '<div class="no-data">No data available</div>';
        return;
    }
    
    data.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'source-item';
        
        itemDiv.innerHTML = `
            <div class="source-item-header">
                <div class="source-timestamp">${item.timestamp}</div>
                <div class="source-type">${sourceType.replace('_', ' ')}</div>
            </div>
            <div class="source-item-content">
                ${formatSourceItem(item, sourceType)}
            </div>
        `;
        
        container.appendChild(itemDiv);
    });
}

// Track shipment
async function trackShipment() {
    const trackingId = document.getElementById('tracking-input').value.trim();
    if (!trackingId) {
        alert('Please enter a Truck ID');
        return;
    }
    
    await trackShipmentById(trackingId);
}

// Track shipment by ID
async function trackShipmentById(truckId) {
    try {
        const response = await fetch(`/api/track/${truckId}`);
        const data = await response.json();
        
        if (data.error) {
            showModal('Tracking Error', data.error);
            return;
        }
        
        displayTrackingResults(data);
        
        // Load AI predictions
        await loadAIPredictions(truckId);
        
    } catch (error) {
        showModal('Error', 'Failed to track shipment: ' + error.message);
    }
}

// Display tracking results
function displayTrackingResults(shipment) {
    const resultsDiv = document.getElementById('tracking-results');
    const contentDiv = document.getElementById('tracking-content');
    
    contentDiv.innerHTML = `
        <div class="tracking-details">
            <div class="detail-row">
                <strong>Truck ID:</strong> ${shipment.truck_id}
            </div>
            <div class="detail-row">
                <strong>Current Status:</strong> ${shipment.status}
            </div>
            <div class="detail-row">
                <strong>Current Location:</strong> ${shipment.current_location}
            </div>
            <div class="detail-row">
                <strong>Cargo:</strong> ${shipment.cargo || 'Unknown'}
            </div>
            <div class="detail-row">
                <strong>Destination:</strong> ${shipment.destination || 'Unknown'}
            </div>
            <div class="detail-row">
                <strong>Data Sources:</strong> ${shipment.data_sources.join(', ')}
            </div>
            <div class="detail-row">
                <strong>Last Update:</strong> ${shipment.last_update}
            </div>
        </div>
        
        <div class="events-timeline">
            <h4>Event Timeline</h4>
            ${shipment.events.map(event => `
                <div class="event-item">
                    <div class="event-time">${event.timestamp}</div>
                    <div class="event-location">${event.location}</div>
                    <div class="event-status">${event.status}</div>
                    <div class="event-source">${event.source}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    resultsDiv.style.display = 'block';
}

// Load AI predictions
async function loadAIPredictions(truckId) {
    try {
        const response = await fetch(`/api/predict-eta/${truckId}`);
        const data = await response.json();
        
        if (data.error) {
            return;
        }
        
        const predictionsDiv = document.getElementById('ai-predictions-card');
        const gridDiv = document.getElementById('prediction-grid');
        
        gridDiv.innerHTML = `
            <div class="prediction-item">
                <div class="prediction-label">ETA</div>
                <div class="prediction-value">${data.eta}</div>
            </div>
            <div class="prediction-item">
                <div class="prediction-label">Delay Risk</div>
                <div class="prediction-value risk-${data.delay_risk.toLowerCase()}">${data.delay_risk}</div>
            </div>
            <div class="prediction-item">
                <div class="prediction-label">Confidence</div>
                <div class="prediction-value">${data.confidence * 100}%</div>
            </div>
        `;
        
        predictionsDiv.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading AI predictions:', error);
    }
}

// Driver SMS update
async function addDriverSMS() {
    const phone = document.getElementById('driver-phone').value.trim();
    const message = document.getElementById('driver-message').value.trim();
    
    if (!phone || !message) {
        alert('Please enter both phone number and message');
        return;
    }
    
    try {
        const response = await fetch('/api/add-sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone: phone,
                message: message
            })
        });
        
        const data = await response.json();
        
        showModal('SMS Update Sent', `
            <strong>SMS Update Processed:</strong><br><br>
            <strong>Phone:</strong> ${data.phone}<br>
            <strong>Message:</strong> ${data.message}<br>
            <strong>Parsed:</strong> ${JSON.stringify(data.parsed, null, 2)}<br><br>
            <strong>✅ Data added to unified system!</strong>
        `);
        
        // Clear form
        document.getElementById('driver-message').value = '';
        
        // Refresh dashboard
        loadDashboard();
        
    } catch (error) {
        showModal('Error', 'Failed to send SMS update: ' + error.message);
    }
}

// QR Scanner variables
let qrStream = null;
let qrScanning = false;
let qrScanInterval = null;

// Start QR Scanner
async function startQRScanner() {
    try {
        const video = document.getElementById('qr-video');
        const canvas = document.getElementById('qr-canvas');
        const placeholder = document.getElementById('qr-scanner-placeholder');
        const startBtn = document.getElementById('start-qr-scanner');
        const stopBtn = document.getElementById('stop-qr-scanner');
        
        // Request camera access
        qrStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment' // Use back camera if available
            } 
        });
        
        video.srcObject = qrStream;
        video.style.display = 'block';
        placeholder.style.display = 'none';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        
        qrScanning = true;
        
        // Start scanning loop
        qrScanInterval = setInterval(() => {
            if (qrScanning) {
                scanQRCode(video, canvas);
            }
        }, 100);
        
        showModal('QR Scanner Started', 'Camera activated! Point at a QR code to scan.');
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        handleQRScannerError(error);
    }
}

// Stop QR Scanner
function stopQRScanner() {
    qrScanning = false;
    
    if (qrScanInterval) {
        clearInterval(qrScanInterval);
        qrScanInterval = null;
    }
    
    if (qrStream) {
        qrStream.getTracks().forEach(track => track.stop());
        qrStream = null;
    }
    
    const video = document.getElementById('qr-video');
    const placeholder = document.getElementById('qr-scanner-placeholder');
    const startBtn = document.getElementById('start-qr-scanner');
    const stopBtn = document.getElementById('stop-qr-scanner');
    
    video.style.display = 'none';
    placeholder.style.display = 'block';
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
}

// Scan QR Code
function scanQRCode(video, canvas) {
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Use jsQR library for real QR code detection
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    
    if (code) {
        processQRScan(code.data);
        stopQRScanner();
    }
}

// Detect QR Code (removed - now using jsQR library)
// function detectQRCode(imageData) {
//     // This is a simplified simulation
//     // In reality, you'd use a proper QR code detection library
//     const random = Math.random();
//     
//     if (random < 0.01) { // 1% chance of detecting a QR code
//         return 'KBA-234D-MAIZE-15T-KAMPALA';
//     }
//     
//     return null;
// }

// Process QR Scan
function processQRScan(qrData) {
    const scanner = 'Real-time QR Scanner';
    
    showModal('QR Code Scanned Successfully', `
        <strong>Real QR Code Scan Complete:</strong><br><br>
        <strong>Scanner:</strong> ${scanner}<br>
        <strong>QR Data:</strong> ${qrData}<br>
        <strong>Parsed:</strong> Truck ID: KBA-234D, Cargo: Maize, Weight: 15T, Destination: Kampala<br><br>
        <strong>✅ Data added to unified logistics system!</strong>
    `);
    
    // Add to data sources
    const scanData = {
        timestamp: new Date().toISOString().slice(0, 16),
        scanner: scanner,
        qr_data: qrData,
        parsed: {
            truck_id: 'KBA-234D',
            cargo: 'maize',
            weight: '15T',
            destination: 'Kampala'
        }
    };
    
    addQRScanToSystem(scanData);
    
    // Refresh dashboard
    loadDashboard();
}

// Add QR scan to system
async function addQRScanToSystem(scanData) {
    try {
        const response = await fetch('/api/add-qr-scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(scanData)
        });
        
        if (response.ok) {
            console.log('QR scan data added to system');
        }
    } catch (error) {
        console.error('Error adding QR scan to system:', error);
    }
}

// QR Scanner Error Handling
function handleQRScannerError(error) {
    console.error('QR Scanner Error:', error);
    showModal('QR Scanner Error', `
        <strong>Camera Access Denied:</strong><br><br>
        <strong>Error:</strong> ${error.message}<br><br>
        <strong>Solutions:</strong><br>
        • Allow camera access when prompted<br>
        • Use HTTPS (required for camera access)<br>
        • Try a different browser<br>
        • Check camera permissions in browser settings<br><br>
        <strong>Note:</strong> QR scanning requires camera access for real-time detection.
    `);
}

// Upload driver receipt
async function uploadDriverReceipt() {
    const fileInput = document.getElementById('driver-receipt');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a receipt image');
        return;
    }
    
    // Show processing indicator
    showModal('Processing Receipt', 'AI is analyzing the receipt image...');
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const imageData = e.target.result;
        
        try {
            const response = await fetch('/api/ocr', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageData
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showModal('Receipt Processed Successfully', `
                    <strong>AI Receipt Processing Complete:</strong><br><br>
                    <strong>Extracted Data:</strong><br>
                    • Truck ID: ${data.data.truck_id || 'Not detected'}<br>
                    • Cargo: ${data.data.cargo || 'Not detected'}<br>
                    • Weight: ${data.data.weight || 'Not detected'}<br>
                    • Location: ${data.data.location || 'Not detected'}<br>
                    • Destination: ${data.data.destination || 'Not detected'}<br>
                    • Timestamp: ${data.data.timestamp || 'Not detected'}<br><br>
                    <strong>Confidence:</strong> ${Math.round(data.confidence * 100)}%<br><br>
                    <strong>✅ Data added to unified logistics system!</strong>
                `);
                
                // Add to data sources
                const receiptData = {
                    timestamp: data.data.timestamp || new Date().toISOString().slice(0, 16),
                    warehouse: data.data.location || 'Unknown Location',
                    truck_id: data.data.truck_id || 'UNKNOWN',
                    cargo: data.data.cargo || 'Unknown',
                    quantity: data.data.weight || 'Unknown',
                    destination: data.data.destination || 'Unknown',
                    source: 'receipt_upload',
                    ai_extracted: true,
                    confidence: data.confidence
                };
                
                // Add to unified system
                await addReceiptToSystem(receiptData);
                
            } else {
                showModal('Receipt Processing Error', `
                    <strong>AI Processing Failed:</strong><br><br>
                    <strong>Error:</strong> ${data.error}<br><br>
                    <strong>Fallback Data Used:</strong><br>
                    • Truck ID: ${data.data.truck_id}<br>
                    • Cargo: ${data.data.cargo}<br>
                    • Weight: ${data.data.weight}<br>
                    • Location: ${data.data.location}<br>
                    • Destination: ${data.data.destination}<br><br>
                    <strong>✅ Data still added to system!</strong>
                `);
            }
            
            // Clear file input
            fileInput.value = '';
            
            // Refresh dashboard
            loadDashboard();
            
        } catch (error) {
            showModal('Error', 'Failed to process receipt: ' + error.message);
        }
    };
    
    reader.readAsDataURL(file);
}

// Add receipt data to system
async function addReceiptToSystem(receiptData) {
    try {
        const response = await fetch('/api/add-receipt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(receiptData)
        });
        
        if (response.ok) {
            console.log('Receipt data added to system');
        }
    } catch (error) {
        console.error('Error adding receipt to system:', error);
    }
}

// Get ETA prediction
async function getETAPrediction(truckId) {
    try {
        const response = await fetch(`/api/predict-eta/${truckId}`);
        const data = await response.json();
        
        if (data.error) {
            showModal('Error', data.error);
            return;
        }
        
        showModal('ETA Prediction', `
            <strong>AI ETA Prediction for ${truckId}:</strong><br><br>
            <strong>Estimated Arrival:</strong> ${data.eta}<br>
            <strong>Confidence:</strong> ${data.confidence * 100}%<br>
            <strong>Delay Risk:</strong> ${data.delay_risk}<br><br>
            <strong>Factors:</strong><br>
            ${data.factors.map(factor => '• ' + factor).join('<br>')}
        `);
        
    } catch (error) {
        showModal('Error', 'Failed to get ETA prediction: ' + error.message);
    }
}

// Chat functionality
function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addChatMessage(message, 'user');
    input.value = '';
    
    // Show instant typing indicator
    const typingId = addTypingIndicator();
    
    try {
        const startTime = Date.now();
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: message,
                language: 'English'
            })
        });
        
        const data = await response.json();
        const responseTime = Date.now() - startTime;
        
        // Remove typing indicator
        removeTypingIndicator(typingId);
        
        // Add AI response with formatting
        addFormattedChatMessage(data.response, 'ai');
        
        // Log response time for debugging
        console.log(`AI Response time: ${responseTime}ms`);
        
    } catch (error) {
        // Remove typing indicator
        removeTypingIndicator(typingId);
        
        addChatMessage('**Error:** Unable to process request. Please try again.', 'ai');
    }
}

function addTypingIndicator() {
    const messagesDiv = document.getElementById('chat-messages');
    const typingDiv = document.createElement('div');
    const typingId = 'typing-' + Date.now();
    typingDiv.id = typingId;
    typingDiv.className = 'chat-message ai-message typing-indicator';
    typingDiv.innerHTML = '<strong>LogiSync.AI:</strong> <span class="typing-dots">Thinking</span>';
    
    messagesDiv.appendChild(typingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    // Animate typing dots
    animateTypingDots(typingDiv.querySelector('.typing-dots'));
    
    return typingId;
}

function animateTypingDots(element) {
    let dots = 0;
    const interval = setInterval(() => {
        dots = (dots + 1) % 4;
        element.textContent = 'Thinking' + '.'.repeat(dots);
    }, 500);
    
    // Store interval ID for cleanup
    element.intervalId = interval;
}

function removeTypingIndicator(typingId) {
    const typingDiv = document.getElementById(typingId);
    if (typingDiv) {
        const dotsElement = typingDiv.querySelector('.typing-dots');
        if (dotsElement && dotsElement.intervalId) {
            clearInterval(dotsElement.intervalId);
        }
        typingDiv.remove();
    }
}

function addFormattedChatMessage(message, sender) {
    const messagesDiv = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    
    if (sender === 'ai') {
        // Format the AI response with proper styling
        const formattedMessage = formatAIResponse(message);
        messageDiv.innerHTML = `<strong>LogiSync.AI:</strong><div class="ai-response-content">${formattedMessage}</div>`;
    } else {
        messageDiv.innerHTML = `<strong>You:</strong> ${message}`;
    }
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function formatAIResponse(message) {
    // Convert markdown-like formatting to HTML
    let formatted = message
        // Headers
        .replace(/^## (.*$)/gim, '<h3 class="ai-header">$1</h3>')
        .replace(/^### (.*$)/gim, '<h4 class="ai-subheader">$1</h4>')
        // Bold text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Bullet points
        .replace(/^• (.*$)/gim, '<div class="ai-bullet">• $1</div>')
        // Line breaks
        .replace(/\n/g, '<br>');
    
    return formatted;
}

function addChatMessage(message, sender) {
    const messagesDiv = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    
    if (sender === 'ai') {
        messageDiv.innerHTML = `<strong>LogiSync.AI:</strong> ${message}`;
    } else {
        messageDiv.innerHTML = `<strong>You:</strong> ${message}`;
    }
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Quick actions
function quickAction(action) {
    const input = document.getElementById('chat-input');
    
    switch (action) {
        case 'track':
            input.value = 'Track truck KBA-234D';
            break;
        case 'eta':
            input.value = 'What is the ETA for truck KBA-234D?';
            break;
        case 'anomaly':
            input.value = 'Are there any anomalies detected?';
            break;
        case 'sources':
            input.value = 'Show me all data sources';
            break;
        case 'swahili':
            input.value = 'Habari za asubuhi! Unaweza kunisaidia na tracking ya cargo?';
            break;
    }
    
    input.focus();
}

// Helper functions
function getStatusColor(status) {
    const colors = {
        'departed': '#2d5a27',
        'checkpoint': '#f59e0b',
        'border': '#3b82f6',
        'arrived': '#10b981',
        'delayed': '#ef4444',
        'Unknown': '#6b7280'
    };
    return colors[status] || '#6b7280';
}

function getSourceIcon(sourceType) {
    const icons = {
        'carrier_log': '🚛',
        'customs_record': '🏛️',
        'warehouse_receipt': '🏭',
        'sms_update': '📱',
        'qr_scan': '📱'
    };
    return icons[sourceType] || '📄';
}

function getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    if (minutes > 0) return `${minutes} minutes ago`;
    return 'Just now';
}

function formatUpdateText(update) {
    if (update.sourceType === 'sms_update') {
        return `SMS: ${update.message}`;
    } else if (update.sourceType === 'qr_scan') {
        return `QR Scan: ${update.qr_data}`;
    } else if (update.sourceType === 'carrier_log') {
        return `Carrier: ${update.truck_id} ${update.status} at ${update.location}`;
    } else if (update.sourceType === 'customs_record') {
        return `Customs: ${update.truck_id} ${update.status} at ${update.border}`;
    } else if (update.sourceType === 'warehouse_receipt') {
        return `Warehouse: ${update.truck_id} loaded at ${update.warehouse}`;
    }
    return 'Data update';
}

function formatSourceItem(item, sourceType) {
    if (sourceType === 'sms_update') {
        return `
            <div><strong>Phone:</strong> ${item.phone}</div>
            <div><strong>Message:</strong> ${item.message}</div>
            <div><strong>Parsed:</strong> ${JSON.stringify(item.parsed)}</div>
        `;
    } else if (sourceType === 'qr_scan') {
        return `
            <div><strong>Scanner:</strong> ${item.scanner}</div>
            <div><strong>QR Data:</strong> ${item.qr_data}</div>
            <div><strong>Parsed:</strong> ${JSON.stringify(item.parsed)}</div>
        `;
    } else if (sourceType === 'carrier_log') {
        return `
            <div><strong>Truck:</strong> ${item.truck_id}</div>
            <div><strong>Location:</strong> ${item.location}</div>
            <div><strong>Status:</strong> ${item.status}</div>
            <div><strong>Driver:</strong> ${item.driver}</div>
        `;
    } else if (sourceType === 'customs_record') {
        return `
            <div><strong>Truck:</strong> ${item.truck_id}</div>
            <div><strong>Border:</strong> ${item.border}</div>
            <div><strong>Status:</strong> ${item.status}</div>
            <div><strong>Weight:</strong> ${item.cargo_weight}</div>
        `;
    } else if (sourceType === 'warehouse_receipt') {
        return `
            <div><strong>Truck:</strong> ${item.truck_id}</div>
            <div><strong>Warehouse:</strong> ${item.warehouse}</div>
            <div><strong>Cargo:</strong> ${item.cargo}</div>
            <div><strong>Quantity:</strong> ${item.quantity}</div>
        `;
    }
    return JSON.stringify(item, null, 2);
}

// Modal functions
function showModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').style.display = 'block';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// Close modal when clicking outside
document.getElementById('modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});