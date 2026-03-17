#include <ESP8266WiFi.h>
#include <SPI.h>
#include <MFRC522.h>

// Pins
#define SS_PIN D8
#define RST_PIN D3

MFRC522 mfrc522(SS_PIN, RST_PIN);

// Configure
const char* WIFI_SSID = "Wi-Fi";
const char* WIFI_PASS = "";
String BLOCKCHAIN_ID = "BLOCKCHAIN-ID-PLACEHOLDER"; // Set from Serial for demo

// LEDs
#define LED_OK D2
#define LED_BUSY D1

void setup() {
  pinMode(LED_OK, OUTPUT); digitalWrite(LED_OK, LOW);
  pinMode(LED_BUSY, OUTPUT); digitalWrite(LED_BUSY, LOW);
  Serial.begin(115200);
  SPI.begin();
  mfrc522.PCD_Init();
  Serial.println("RFID Write: Ready. Enter Blockchain ID via Serial.");
}

void loop() {
  if (Serial.available()) {
    BLOCKCHAIN_ID = Serial.readStringUntil('\n');
    BLOCKCHAIN_ID.trim();
    Serial.print("Set Blockchain ID: "); Serial.println(BLOCKCHAIN_ID);
  }
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    delay(100);
    return;
  }
  digitalWrite(LED_BUSY, HIGH);
  // For demo, we write to sector 1 block 4 (16 bytes). Truncate/Pad as needed.
  byte blockAddr = 4;
  MFRC522::MIFARE_Key key;
  for (byte i = 0; i < 6; i++) key.keyByte[i] = 0xFF; // default key A

  byte dataBlock[16];
  memset(dataBlock, 0, 16);
  for (int i = 0; i < 16 && i < BLOCKCHAIN_ID.length(); i++) dataBlock[i] = BLOCKCHAIN_ID[i];

  MFRC522::StatusCode status = mfrc522.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, blockAddr, &key, &mfrc522.uid);
  if (status != MFRC522::STATUS_OK) {
    Serial.println("Auth failed");
    digitalWrite(LED_BUSY, LOW);
    delay(500);
    return;
  }
  status = mfrc522.MIFARE_Write(blockAddr, dataBlock, 16);
  if (status == MFRC522::STATUS_OK) {
    Serial.println("Write Success");
    digitalWrite(LED_OK, HIGH); delay(700); digitalWrite(LED_OK, LOW);
  } else {
    Serial.println("Write Failed");
  }
  digitalWrite(LED_BUSY, LOW);
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  delay(1000);
}
