#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN D8
#define RST_PIN D3
MFRC522 mfrc522(SS_PIN, RST_PIN);

const char* WIFI_SSID = "Wi-Fi";
const char* WIFI_PASS = "YOUR_PASS";
// Use http during development if cert is not trusted: e.g., "http://<ip>:8001"
String API_URL = "https://zentora.local/api/rfid/verify";

#define LED_OK D2
#define LED_FAIL D1

void blinkOK() { digitalWrite(LED_OK, HIGH); delay(400); digitalWrite(LED_OK, LOW); }
void blinkFail() { for (int i=0;i<2;i++){ digitalWrite(LED_FAIL, HIGH); delay(200); digitalWrite(LED_FAIL, LOW); delay(150);} }

void setup() {
  pinMode(LED_OK, OUTPUT); digitalWrite(LED_OK, LOW);
  pinMode(LED_FAIL, OUTPUT); digitalWrite(LED_FAIL, LOW);
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println(" connected");
  SPI.begin();
  mfrc522.PCD_Init();
}

String uidToStr(MFRC522::Uid *uid) {
  String out="";
  for (byte i = 0; i < uid->size; i++) {
    if (uid->uidByte[i] < 0x10) out += "0";
    out += String(uid->uidByte[i], HEX);
  }
  out.toUpperCase();
  return out;
}

void loop() {
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) { delay(100); return; }
  String tag = uidToStr(&mfrc522.uid);
  Serial.print("Tag: "); Serial.println(tag);

  // HTTPS with insecure (trust all) for demo; swap to proper cert validation in production
  std::unique_ptr<BearSSL::WiFiClientSecure>client(new BearSSL::WiFiClientSecure);
  client->setInsecure();
  HTTPClient https;
  if (https.begin(*client, API_URL)) {
    https.addHeader("Content-Type", "application/json");
    String body = String("{\"tag_id\":\"") + tag + "\"}";
    int code = https.POST(body);
    if (code > 0) {
      String payload = https.getString();
      Serial.println(payload);
      if (payload.indexOf("\"valid\":true") >= 0) blinkOK(); else blinkFail();
    } else {
      Serial.printf("HTTP error: %d\n", code); blinkFail();
    }
    https.end();
  } else {
    Serial.println("HTTPS begin failed"); blinkFail();
  }
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  delay(1000);
}
