#include <ESP8266WiFi.h>
#include <SPI.h>
#include <MFRC522.h>

// Pins per your mapping:
// D4 -> RC522 SDA(SS)
// D3 -> RC522 RST
// D6 -> RC522 MISO
// D7 -> RC522 MOSI
// D5 -> RC522 SCK

#define RST_PIN D3
#define SS_PIN  D4

MFRC522 mfrc522(SS_PIN, RST_PIN);

// MIFARE Classic default key (factory)
static MFRC522::MIFARE_Key keyA;

// Data blocks to use for payload storage
static const byte kBlockStart = 4; // sector 1, block 4
static const byte kBlocks = 2;     // use block 4 and 5 (total 32 bytes)

String uidToHex(const MFRC522::Uid *uid) {
  String s="";
  for (byte i=0;i<uid->size;i++) { if (uid->uidByte[i] < 0x10) s += "0"; s += String(uid->uidByte[i], HEX); }
  s.toUpperCase(); return s;
}

bool authBlock(byte block) {
  for (byte i = 0; i < 6; i++) keyA.keyByte[i] = 0xFF;
  MFRC522::StatusCode status = mfrc522.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, block, &keyA, &mfrc522.uid);
  return status == MFRC522::STATUS_OK;
}

bool writeBlock(byte block, const byte *data16) {
  if (!authBlock(block)) return false;
  MFRC522::StatusCode status = mfrc522.MIFARE_Write(block, (byte*)data16, 16);
  return status == MFRC522::STATUS_OK;
}

bool readBlock(byte block, byte *out16) {
  if (!authBlock(block)) return false;
  byte size = 18; // 16 data + 2 CRC
  MFRC522::StatusCode status = mfrc522.MIFARE_Read(block, out16, &size);
  return status == MFRC522::STATUS_OK;
}

void halt() {
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(5); }
  SPI.begin();
  mfrc522.PCD_Init();
  Serial.println("READY");
}

void handleScan() {
  // Wait up to ~5s for a card
  unsigned long start = millis();
  while (millis() - start < 5000) {
    if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
      // Check supported card type (MIFARE Classic 1K/4K)
      byte t = mfrc522.PICC_GetType(mfrc522.uid.sak);
      if (!(t == MFRC522::PICC_TYPE_MIFARE_MINI || t == MFRC522::PICC_TYPE_MIFARE_1K || t == MFRC522::PICC_TYPE_MIFARE_4K)) {
        Serial.println("ERR:UNSUPPORTED_PICC");
        halt();
        return;
      }
      String tag = uidToHex(&mfrc522.uid);
      Serial.print("TAG:"); Serial.println(tag);
      halt();
      Serial.println("OK");
      return;
    }
    delay(50);
  }
  Serial.println("ERR:TIMEOUT");
}

void handleRead() {
  // Expect a card already present, try a short window
  unsigned long start = millis();
  while (millis() - start < 3000) {
    if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
      byte t = mfrc522.PICC_GetType(mfrc522.uid.sak);
      if (!(t == MFRC522::PICC_TYPE_MIFARE_MINI || t == MFRC522::PICC_TYPE_MIFARE_1K || t == MFRC522::PICC_TYPE_MIFARE_4K)) {
        Serial.println("ERR:UNSUPPORTED_PICC"); halt(); return;
      }
      // Read two consecutive blocks (32 bytes)
      byte buf16[18];
      byte all[32]; memset(all, 0, 32);
      bool ok = true;
      for (byte i=0;i<kBlocks;i++) {
        memset(buf16, 0, sizeof(buf16));
        if (!readBlock(kBlockStart + i, buf16)) { ok = false; break; }
        for (int j=0;j<16;j++) {
          all[i*16 + j] = buf16[j];
        }
      }
      if (!ok) { Serial.println("ERR:READ"); halt(); return; }
      // Convert to printable string up to first NUL
      char out[33];
      for (int i=0;i<32;i++) {
        char c = (char)all[i];
        if (c == 0) { out[i] = 0; break; }
        out[i] = (c >= 32 && c <= 126) ? c : 0;
        if (out[i] == 0) { out[i] = 0; break; }
        if (i == 31) out[32] = 0;
      }
      out[32] = 0;
      Serial.print("READ:"); Serial.println(out);
      halt();
      Serial.println("OK");
      return;
    }
    delay(40);
  }
  Serial.println("ERR:TIMEOUT");
}

void handleWrite(String payload) {
  // Truncate/pad to 32 bytes and write across two blocks
  byte data32[32]; memset(data32, 0, 32);
  int pLen = payload.length();
  if (pLen > 32) pLen = 32;
  for (int i=0;i<pLen; i++) data32[i] = (byte)payload[i];
  unsigned long start = millis();
  while (millis() - start < 5000) {
    if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
      byte t = mfrc522.PICC_GetType(mfrc522.uid.sak);
      if (!(t == MFRC522::PICC_TYPE_MIFARE_MINI || t == MFRC522::PICC_TYPE_MIFARE_1K || t == MFRC522::PICC_TYPE_MIFARE_4K)) { Serial.println("ERR:UNSUPPORTED_PICC"); halt(); return; }
      bool ok = true;
      for (byte i=0;i<kBlocks;i++) {
        if (!writeBlock(kBlockStart + i, &data32[i*16])) { ok = false; break; }
      }
      Serial.println(ok ? "WRITE_OK" : "WRITE_ERR");
      halt();
      return;
    }
    delay(40);
  }
  Serial.println("ERR:TIMEOUT");
}

String inbuf;

void loop() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (inbuf.length() == 0) continue;
      String cmd = inbuf; inbuf = "";
      cmd.trim();
      if (cmd.equalsIgnoreCase("PING")) { Serial.println("PONG"); }
      else if (cmd.equalsIgnoreCase("SCAN")) { handleScan(); }
      else if (cmd.equalsIgnoreCase("READ")) { handleRead(); }
      else if (cmd.startsWith("WRITE:")) { String payload = cmd.substring(6); handleWrite(payload); }
      else { Serial.println("ERR:UNKNOWN"); }
    } else {
      inbuf += c;
      if (inbuf.length() > 128) inbuf = ""; // guard
    }
  }
}
