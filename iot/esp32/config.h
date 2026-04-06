// ========== ESP32 RFID Configuration ==========

// WiFi
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASS "YOUR_WIFI_PASSWORD"

// API Server
#define API_BASE_URL "http://192.168.x.x:8001"  // Replace with your backend IP
#define DEVICE_ID "ESP32_RFID_001"

// RFID Pins (SPI)
#define SS_PIN 5       // GPIO5 (D5)
#define RST_PIN 4      // GPIO4 (D4)

// NOTE: No buzzer or LED pins - RFID module only

// SPI Configuration
#define SPI_MISO 19    // GPIO19 (MISO)
#define SPI_MOSI 23    // GPIO23 (MOSI)
#define SPI_SCK 18     // GPIO18 (SCK)

// Timing
#define STATUS_POLL_INTERVAL 5000  // Check API every 5 seconds (ms)
#define CARD_READ_TIMEOUT 30000    // Timeout waiting for card (ms)
#define CARD_WRITE_TIMEOUT 30000   // Timeout waiting for card (ms)
