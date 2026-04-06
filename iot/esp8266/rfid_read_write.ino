#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
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
  delay(500);
  
  Serial.println("\n\n=== RFID Module Started ===");
  Serial.println("Configuration: RFID Module Only (No LEDs/Buzzer)");
  
  // Connect WiFi
  connectWiFi();
  
  // Initialize RFID
  SPI.begin();
  rfid.PCD_Init();
  
  // Setup MFRC522 default key (0xFFFFFFFFFFFF)
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
  
  WiFiClient client;
  HTTPClient http;
  
  String url = String(API_BASE_URL) + "/api/rfid/module/status";
  
  if (http.begin(client, url)) {
    int httpCode = http.GET();
    
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      
      // Parse JSON: {"write_enabled": true/false, "read_enabled": true/false, "user_id": X}
      bool newWriteMode = payload.indexOf("\"write_enabled\":true") >= 0;
      bool newReadMode = payload.indexOf("\"read_enabled\":true") >= 0;
      
      // Extract user_id
      int userIdStart = payload.indexOf("\"user_id\":") + 10;
      int userIdEnd = payload.indexOf(",", userIdStart);
      int newUserId = payload.substring(userIdStart, userIdEnd).toInt();
      
      // Mode changed - update state
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
    } else {
      Serial.print("HTTP Error: ");
      Serial.println(httpCode);
    }
    
    http.end();
  } else {
    Serial.println("Failed to connect to API");
  }
}

void handleReadMode() {
  // Wait for card tap with timeout
  if (millis() - modeStartTime > CARD_READ_TIMEOUT) {
    Serial.println("✗ Read Timeout - No card detected");
    readMode = false;
    return;
  }
  
  // Check if card is present
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  Serial.println("✓ Card detected - Reading...");
  
  // Read UUID from card (block 4, sector 1)
  byte blockAddr = 4;
  byte buffer[18];
  byte blockSize = 16;
  
  // Authenticate
  MFRC522::StatusCode status = rfid.PCD_Authenticate(
    MFRC522::PICC_CMD_MF_AUTH_KEY_A, 
    blockAddr, 
    &key, 
    &rfid.uid
  );
  
  if (status != MFRC522::STATUS_OK) {
    Serial.println("✗ Authentication failed");
    readMode = false;
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  
  // Read block
  status = rfid.MIFARE_Read(blockAddr, buffer, &blockSize);
  
  if (status != MFRC522::STATUS_OK) {
    Serial.println("✗ Read failed");
    readMode = false;
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  
  // Extract UUID (strip null bytes)
  String uuid = "";
  for (int i = 0; i < 16; i++) {
    if (buffer[i] != 0) {
      uuid += (char)buffer[i];
    }
  }
  
  Serial.print("✓ Read UUID: ");
  Serial.println(uuid);
  
  // Send to backend for verification
  verifyReadCard(uuid);
  
  // Cleanup
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  readMode = false;
}

void handleWriteMode() {
  // Wait for card tap with timeout
  if (millis() - modeStartTime > CARD_WRITE_TIMEOUT) {
    Serial.println("✗ Write Timeout - No card detected");
    writeMode = false;
    return;
  }
  
  // Check if card is present
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  Serial.println("✓ Card detected - Writing...");
  
  // Get UUID to write
  String uuidToWrite = getUuidToWrite(currentUserId);
  
  if (uuidToWrite == "") {
    Serial.println("✗ Failed to get UUID");
    writeMode = false;
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  
  // Prepare data block (16 bytes)
  byte dataBlock[16];
  memset(dataBlock, 0, 16);
  for (int i = 0; i < 16 && i < uuidToWrite.length(); i++) {
    dataBlock[i] = (byte)uuidToWrite[i];
  }
  
  // Write to block 4
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
  
  // Write block
  status = rfid.MIFARE_Write(blockAddr, dataBlock, 16);
  
  if (status == MFRC522::STATUS_OK) {
    Serial.println("✓ UUID Written Successfully!");
    // Notify backend that write completed
    notifyWriteComplete(uuidToWrite);
  } else {
    Serial.println("✗ Write failed");
  }
  
  // Cleanup
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  writeMode = false;
}

String getUuidToWrite(int userId) {
  if (userId < 0) return "";
  
  WiFiClient client;
  HTTPClient http;
  
  String url = String(API_BASE_URL) + "/api/rfid/write/get-uuid?user_id=" + userId;
  
  if (http.begin(client, url)) {
    int httpCode = http.GET();
    
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      
      // Extract UUID from JSON: {"uuid": "xxxxx"}
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
  WiFiClient client;
  HTTPClient http;
  
  String url = String(API_BASE_URL) + "/api/rfid/read/verify";
  String jsonBody = "{\"tourist_uuid\":\"" + uuid + "\"}";
  
  if (http.begin(client, url)) {
    http.addHeader("Content-Type", "application/json");
    int httpCode = http.POST(jsonBody);
    
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      
      // Check if valid
      bool isValid = payload.indexOf("\"valid\":true") >= 0;
      
      if (isValid) {
        Serial.println("✓ Card is VALID");
      } else {
        Serial.println("✗ Card is INVALID");
      }
    } else {
      Serial.print("Verify Error: ");
      Serial.println(httpCode);
    }
    
    http.end();
  }
}

void notifyWriteComplete(String uuid) {
  WiFiClient client;
  HTTPClient http;
  
  String url = String(API_BASE_URL) + "/api/rfid/write/complete?uuid=" + uuid;
  
  if (http.begin(client, url)) {
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
