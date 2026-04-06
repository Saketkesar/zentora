#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include "config.h"

// RFID Reader
MFRC522 rfid(SS_PIN, RST_PIN);
MFRC522::MIFARE_Key key;

// State Variables
bool writeMode = false;
bool readMode = false;
int currentUserId = -1;
unsigned long lastStatusCheck = 0;
unsigned long modeStartTime = 0;

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=== ESP32 RFID Module Started ===");
  Serial.println("Configuration: RFID Module Only (No LEDs/Buzzer)");
  
  // Connect WiFi
  connectWiFi();
  
  // Initialize SPI and RFID
  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, SS_PIN);
  rfid.PCD_Init();
  
  // Setup MFRC522 default key
  for (byte i = 0; i < 6; i++) {
    key.keyByte[i] = 0xFF;
  }
  
  Serial.println("✓ RFID Module Ready");
}

// ========== MAIN LOOP ==========
void loop() {
  // Check API status every 5 seconds
  if (millis() - lastStatusCheck >= STATUS_POLL_INTERVAL) {
    lastStatusCheck = millis();
    checkModuleStatus();
  }
  
  // Handle card operations based on current mode
  if (readMode) {
    handleReadMode();
  } else if (writeMode) {
    handleWriteMode();
  }
  
  delay(100);
}

// ========== FUNCTIONS ==========

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi Connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n✗ WiFi Failed - Restarting...");
    ESP.restart();
  }
}

void checkModuleStatus() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectWiFi();
    return;
  }
  
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/rfid/module/status";
  
  if (http.begin(url)) {
    int httpCode = http.GET();
    
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      
      // Parse JSON
      bool newWriteMode = payload.indexOf("\"write_enabled\":true") >= 0;
      bool newReadMode = payload.indexOf("\"read_enabled\":true") >= 0;
      
      // Extract user_id
      int userIdStart = payload.indexOf("\"user_id\":") + 10;
      int userIdEnd = payload.indexOf(",", userIdStart);
      if (userIdEnd < 0) userIdEnd = payload.indexOf("}", userIdStart);
      int newUserId = payload.substring(userIdStart, userIdEnd).toInt();
      
      // Mode changed
      if (newWriteMode != writeMode || newReadMode != readMode) {
        writeMode = newWriteMode;
        readMode = newReadMode;
        currentUserId = newUserId;
        modeStartTime = millis();
        
        if (writeMode) {
          Serial.println("→ MODE: WRITE ENABLED");
        } else if (readMode) {
          Serial.println("→ MODE: READ ENABLED");
        } else {
          Serial.println("→ MODE: IDLE");
        }
      }
    }
    
    http.end();
  }
}

void handleReadMode() {
  // Timeout check
  if (millis() - modeStartTime > CARD_READ_TIMEOUT) {
    Serial.println("✗ Read Timeout");
    readMode = false;
    return;
  }
  
  // Check for card
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  Serial.println("✓ Card detected - Reading...");
  
  // Read UUID
  byte blockAddr = 4;
  byte buffer[18];
  byte blockSize = 16;
  
  MFRC522::StatusCode status = rfid.PCD_Authenticate(
    MFRC522::PICC_CMD_MF_AUTH_KEY_A,
    blockAddr,
    &key,
    &rfid.uid
  );
  
  if (status != MFRC522::STATUS_OK) {
    Serial.println("✗ Auth failed");
    readMode = false;
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  
  status = rfid.MIFARE_Read(blockAddr, buffer, &blockSize);
  
  if (status != MFRC522::STATUS_OK) {
    Serial.println("✗ Read failed");
    readMode = false;
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  
  // Extract UUID
  String uuid = "";
  for (int i = 0; i < 16; i++) {
    if (buffer[i] != 0) {
      uuid += (char)buffer[i];
    }
  }
  
  Serial.print("✓ Read UUID: ");
  Serial.println(uuid);
  
  verifyReadCard(uuid);
  
  digitalWrite(LED_OK, LOW);
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  readMode = false;
}

void handleWriteMode() {
  // Timeout check
  if (millis() - modeStartTime > CARD_WRITE_TIMEOUT) {
    Serial.println("✗ Write Timeout");
    writeMode = false;
    return;
  }
  
  // Check for card
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  Serial.println("✓ Card detected - Writing...");
  
  // Get UUID
  String uuidToWrite = getUuidToWrite(currentUserId);
  
  if (uuidToWrite == "") {
    Serial.println("✗ Failed to get UUID");
    writeMode = false;
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  
  // Prepare data
  byte dataBlock[16];
  memset(dataBlock, 0, 16);
  for (int i = 0; i < 16 && i < (int)uuidToWrite.length(); i++) {
    dataBlock[i] = (byte)uuidToWrite[i];
  }
  
  // Write
  byte blockAddr = 4;
  MFRC522::StatusCode status = rfid.PCD_Authenticate(
    MFRC522::PICC_CMD_MF_AUTH_KEY_A,
    blockAddr,
    &key,
    &rfid.uid
  );
  
  if (status != MFRC522::STATUS_OK) {
    Serial.println("✗ Auth failed");
    writeMode = false;
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  
  status = rfid.MIFARE_Write(blockAddr, dataBlock, 16);
  
  if (status == MFRC522::STATUS_OK) {
    Serial.println("✓ UUID Written Successfully!");
    // Notify backend that write completed
    notifyWriteComplete(uuidToWrite);
  } else {
    Serial.println("✗ Write failed");
  }
  
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  writeMode = false;
}

String getUuidToWrite(int userId) {
  if (userId < 0) return "";
  
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/rfid/write/get-uuid?user_id=" + userId;
  
  if (http.begin(url)) {
    int httpCode = http.GET();
    
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      
      int uuidStart = payload.indexOf("\"uuid\":\"") + 8;
      int uuidEnd = payload.indexOf("\"", uuidStart);
      String uuid = payload.substring(uuidStart, uuidEnd);
      
      http.end();
      return uuid;
    }
    
    http.end();
  }
  
  return "";
}

void verifyReadCard(String uuid) {
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/rfid/read/verify";
  String jsonBody = "{\"tourist_uuid\":\"" + uuid + "\"}";
  
  if (http.begin(url)) {
    http.addHeader("Content-Type", "application/json");
    int httpCode = http.POST(jsonBody);
    
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      bool isValid = payload.indexOf("\"valid\":true") >= 0;
      
      if (isValid) {
        Serial.println("✓ Card is VALID");
      } else {
        Serial.println("✗ Card is INVALID");
      }
    }
    
    http.end();
  }
}

void notifyWriteComplete(String uuid) {
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/rfid/write/complete?uuid=" + uuid;
  
  if (http.begin(url)) {
    int httpCode = http.POST("");
    
    if (httpCode == HTTP_CODE_OK) {
      Serial.println("✓ Backend notified of write completion");
    } else {
      Serial.print("Write notify error: ");
      Serial.println(httpCode);
    }
    
    http.end();
  }
}
