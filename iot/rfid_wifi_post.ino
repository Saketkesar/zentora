#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

// Wiring (NodeMCU):
// D4 -> RC522 SDA(SS)
// D3 -> RC522 RST
// D6 -> RC522 MISO
// D7 -> RC522 MOSI
// D5 -> RC522 SCK

#define RST_PIN D3
#define SS_PIN  D4

MFRC522 mfrc522(SS_PIN, RST_PIN);

const char* WIFI_SSID = "Wi-Fi"; // Open network (no password)
// Set your API host (IP or hostname) serving FastAPI, default dev port 8001
const char* API_HOST = "192.168.0.100"; // TODO: replace with your backend IP
const uint16_t API_PORT = 8001;

String uidToHex(const MFRC522::Uid *uid) {
  String s="";
  for (byte i=0;i<uid->size;i++) { if (uid->uidByte[i] < 0x10) s += "0"; s += String(uid->uidByte[i], HEX); }
  s.toUpperCase(); return s;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID);
  Serial.print("WiFi: connecting to "); Serial.println(WIFI_SSID);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(300);
    Serial.print('.');
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi: connected, IP "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi: connect timeout");
  }
}

void postVerifyTag(const String &tag, const String &payload) {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (WiFi.status() != WL_CONNECTED) { Serial.println("ERR:WIFI"); return; }
  WiFiClient client;
  HTTPClient http;
  String url = String("http://") + API_HOST + ":" + String(API_PORT) + "/api/rfid/verify";
  if (!http.begin(client, url)) { Serial.println("ERR:HTTP_BEGIN"); return; }
  http.addHeader("Content-Type", "application/json");
  StaticJsonDocument<256> doc;
  if (tag.length()) doc["tag_id"] = tag;
  // If payload starts with 0x777... assume it's a hex-prefixed Tourist UUID or blockchain id
  if (payload.length()) {
    if (payload.startsWith("0x") || payload.startsWith("0X")) {
      // Heuristic: if it's 0x + 32+ hex chars, treat as tourist_uuid with 0x prefix preserved for backend to normalize
      doc["tourist_uuid"] = payload;
      // Also send as blockchain_id for lookup by chain if system bound that way
      doc["blockchain_id"] = payload;
    } else {
      // Fallback: send as blockchain_id only
      doc["blockchain_id"] = payload;
    }
  }
  String body; serializeJson(doc, body);
  int code = http.POST(body);
  if (code > 0) {
    String resp = http.getString();
    Serial.print("HTTP "); Serial.print(code); Serial.print(" "); Serial.println(resp);
  } else {
    Serial.print("ERR:HTTP "); Serial.println(code);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(5); }
  SPI.begin();
  mfrc522.PCD_Init();
  connectWiFi();
  Serial.println("READY");
}

unsigned long lastPost = 0;
String lastTag = "";

void loop() {
  if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
    String tag = uidToHex(&mfrc522.uid);
    // Attempt to read a small data payload from a known block (e.g., block 4)
    String payload = "";
    {
      MFRC522::MIFARE_Key key; for (byte i=0;i<6;i++) key.keyByte[i] = 0xFF;
      byte blockAddr = 4; // demo block
      MFRC522::StatusCode status = mfrc522.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, blockAddr, &key, &mfrc522.uid);
      if (status == MFRC522::STATUS_OK) {
        byte buffer[18]; byte size = sizeof(buffer);
        status = mfrc522.MIFARE_Read(blockAddr, buffer, &size);
        if (status == MFRC522::STATUS_OK) {
          // Convert ASCII bytes to String (stop at null)
          char temp[17];
          for (int i=0;i<16;i++) temp[i] = (char)buffer[i]; temp[16] = '\0';
          payload = String(temp); payload.trim();
        }
      }
    }
    if (tag != lastTag || (millis() - lastPost) > 2000) {
      Serial.print("TAG:"); Serial.println(tag);
      if (payload.length()) { Serial.print("PAYLOAD:"); Serial.println(payload); }
      postVerifyTag(tag, payload);
      lastTag = tag;
      lastPost = millis();
    }
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
  }
}
