#include <ESP8266WiFi.h>
#include <SPI.h>
#include <MFRC522.h>

// NodeMCU (ESP8266) pin map requested:
// 3.3V -> RC522 3.3V
// GND  -> RC522 GND
// D3   -> RC522 RST
// D6   -> RC522 MISO
// D7   -> RC522 MOSI
// D5   -> RC522 SCK
// D4   -> RC522 SDA(SS)

#define RST_PIN D3
#define SS_PIN  D4

MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200); // CH340 COM9 on Windows; /dev/ttyUSB0 on Linux
  while (!Serial) { delay(10); }
  SPI.begin();
  mfrc522.PCD_Init();
  Serial.println("READY");
}

String uidToHex(const MFRC522::Uid *uid) {
  String s="";
  for (byte i=0;i<uid->size;i++) {
    if (uid->uidByte[i] < 0x10) s += "0";
    s += String(uid->uidByte[i], HEX);
  }
  s.toUpperCase();
  return s;
}

void loop() {
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }
  String tag = uidToHex(&mfrc522.uid);
  Serial.print("TAG:");
  Serial.println(tag);
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  delay(300);
}
