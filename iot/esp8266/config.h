// ========== ESP8266 RFID Configuration ==========

// WiFi
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASS "YOUR_WIFI_PASSWORD"

// API Server
// 🔧 AUTOMATICALLY UPDATED BY setup.sh - Leave as is
#define API_BASE_URL "http://192.168.x.x:8001"
#define DEVICE_ID "ESP8266_RFID_001"

// RFID Pins (SPI)
#define SS_PIN D8      // GPIO15
#define RST_PIN D3     // GPIO0

// NOTE: No buzzer or LED pins - RFID module only

// Timing
#define STATUS_POLL_INTERVAL 5000  // Check API every 5 seconds (ms)
#define CARD_READ_TIMEOUT 30000    // Timeout waiting for card (ms)
#define CARD_WRITE_TIMEOUT 30000   // Timeout waiting for card (ms)
