// src/services/raspberryPiService.js
// Service to receive measurements from Raspberry Pi

class RaspberryPiService {
  constructor() {
    this.listeners = [];
    this.wsConnection = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
  }

  // Method 1: WebSocket connection (RECOMMENDED - real-time)
  connectWebSocket(piUrl) {
    // piUrl should be like: ws://192.168.1.100:5000
    console.log('🔌 Attempting WebSocket connection to Raspberry Pi:', piUrl);
    
    try {
      this.wsConnection = new WebSocket(piUrl);
      
      this.wsConnection.onopen = () => {
        console.log('✅ WebSocket connected to Raspberry Pi');
        this.reconnectAttempts = 0;
      };
      
      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📦 Received measurement from Pi:', data);
          this.notifyListeners(data);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };
      
      this.wsConnection.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };
      
      this.wsConnection.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.attemptReconnect(piUrl);
      };
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      this.attemptReconnect(piUrl);
    }
  }

  attemptReconnect(piUrl) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connectWebSocket(piUrl);
      }, this.reconnectDelay);
    } else {
      console.error('❌ Max reconnection attempts reached. Please check Raspberry Pi connection.');
    }
  }

  // Method 2: HTTP Polling (fallback if WebSocket not available)
  startPolling(piUrl, interval = 5000) {
    // piUrl should be like: http://192.168.1.100:5000/latest_measurement
    console.log('🔄 Starting HTTP polling from Raspberry Pi:', piUrl);
    
    this.pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(piUrl);
        if (response.ok) {
          const data = await response.json();
          if (data && !data.processed) {
            console.log('📦 Received measurement via polling:', data);
            this.notifyListeners(data);
          }
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
    }, interval);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('⏹️ Stopped polling');
    }
  }

  // Register a listener for new measurements
  addListener(callback) {
    this.listeners.push(callback);
    console.log('👂 Listener added. Total listeners:', this.listeners.length);
  }

  // Remove a listener
  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
    console.log('👋 Listener removed. Remaining listeners:', this.listeners.length);
  }

  // Notify all listeners of new measurement
  notifyListeners(measurement) {
    this.listeners.forEach(callback => {
      try {
        callback(measurement);
      } catch (error) {
        console.error('❌ Error in listener callback:', error);
      }
    });
  }

  // Clean up connections
  disconnect() {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    this.stopPolling();
    this.listeners = [];
    console.log('🔌 Disconnected from Raspberry Pi');
  }

  // Send acknowledgment back to Pi (optional)
  async acknowledgeMeasurement(piUrl, measurementId) {
    try {
      await fetch(`${piUrl}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: measurementId, processed: true })
      });
      console.log('✅ Acknowledged measurement:', measurementId);
    } catch (error) {
      console.error('❌ Failed to acknowledge measurement:', error);
    }
  }
}

// Export singleton instance
export const raspberryPiService = new RaspberryPiService();