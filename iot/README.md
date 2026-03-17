# RFID + Blockchain IoT (ESP8266 + RC522)

This folder contains example Arduino sketches for writing and verifying RFID tags with an ESP8266 and MFRC522 reader. The verify script posts to the server `/api/rfid/verify` endpoint and drives a simple LED indicator for success/failure.

Hardware:
- NodeMCU/ESP-12E (ESP8266)
- MFRC522 RC522 RFID reader
- 2x LEDs (Green for valid, Red for invalid) with resistors
- Optional OLED (SSD1306) for status text

Wiring (ESP8266 <-> RC522):
- RST -> D3
- SDA(SS) -> D8
- MOSI -> D7
- MISO -> D6
- SCK -> D5
- 3.3V & GND as usual

## Server endpoint
- Verify: `POST https://zentora.local/api/rfid/verify` body: `{ "tag_id": "<hex or ascii id>" }`
- Response: `{ ok, user_id, name_masked, tourist_id, valid_from, valid_to, valid }`

If you use IP instead of hostname, ensure your certificate includes IP SAN or use `http://<ip>:8001` in dev.

## Sketches
- `rfid_write.ino`: Reads a card and writes a provided Blockchain ID string to sector 1, block 0 (demo). Shows an animation via LED.
- `rfid_verify.ino`: Reads card UID (or stored string), sends to server, and displays verification status with animation (green tick / red cross).

Configure WiFi SSID/PASS and API URL at the top of the sketches.
