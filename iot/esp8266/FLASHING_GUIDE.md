# ESP8266 RFID Module - Flashing Guide

## Prerequisites

1. **Arduino IDE** installed (https://www.arduino.cc/en/software)
2. **ESP8266 Board Package** installed (Add to Board Manager):
   - Arduino IDE → Preferences → Additional Boards Manager URLs
   - Add: `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
   - Then: Tools → Board Manager → Search "ESP8266" → Install

3. **Libraries** (Arduino IDE → Manage Libraries):
   - `MFRC522` by Miguel Balboa
   - `ESP8266WiFi` (built-in)
   - `ESP8266HTTPClient` (built-in)

## Setup Steps

### 1. Configure WiFi Credentials
Edit `config.h`:
```cpp
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASS "YOUR_WIFI_PASSWORD"
#define API_BASE_URL "http://192.168.x.x:8001"  // Your backend IP
```

### 2. Install Libraries in Arduino IDE

**Search and Install:**
- MFRC522 (latest version)

**Verify Built-in Libraries:**
- Go to Tools → Manage Libraries
- Confirm ESP8266WiFi and ESP8266HTTPClient are available

### 3. Open Arduino IDE

1. File → Open → `rfid_read_write.ino`
2. The IDE will create a folder with the sketches
3. Copy `config.h` to the same folder

### 4. Configure Board Settings

**Tools Menu:**
```
Board            → NodeMCU 1.0 (ESP-12E Module)
Upload Speed     → 115200
Flash Size       → 4MB
Flash Mode       → DIO
Flash Frequency  → 40MHz
CPU Frequency    → 80MHz
Port             → COM3 (or /dev/ttyUSB0 on Linux/Mac)
```

### 5. Compile Sketch

1. Sketch → Verify/Compile
2. Wait for green message: "Compilation Complete"
3. Should show: "Sketch uses X bytes of program space"

### 6. Flash to Device

1. Connect ESP8266 via Micro USB cable
2. Check Port in Tools menu
3. Sketch → Upload
4. Wait for message: "Hard resetting via RTS pin..."
5. Serial Monitor shows boot messages

### 7. Verify Operation

1. After upload, open **Serial Monitor** (Ctrl+Shift+M)
2. Set Baud Rate to **115200**
3. Should see:
```
=== RFID Module Started ===
Connecting to WiFi: YOUR_SSID
✓ WiFi Connected
IP: 192.168.x.x
✓ RFID Module Ready
```

4. You'll see status updates:
```
→ MODE: IDLE
→ MODE: READ ENABLED
→ MODE: WRITE ENABLED
✓ Card detected - Reading...
✓ Read UUID: a1b2c3d4e5f6...
```

## Troubleshooting

### Issue: "Board not recognized"
- Install CH340 driver (Windows/Mac)
- Check USB cable (data cable, not just power)
- Try different USB port

### Issue: "RFID not connecting"
- Check SPI pins (D5, D6, D7, D8)
- Verify 3.3V is stable (use oscilloscope)
- Check GND connection
- RFID reader needs good power supply

### Issue: "WiFi fails to connect"
- Verify SSID/Password in config.h
- Check WiFi signal strength
- Restart the device
- Check if WiFi is 2.4GHz (5GHz not supported)

### Issue: "API connection fails"
- Check backend IP in config.h
- Verify backend is running: `docker ps`
- Check firewall allows port 8001
- Verify device is on same network

### Issue: "Card not reading/writing"
- Check antenna is not blocked
- Try different RFID card (test if card is MIFARE Classic)
- Check distance (should be 2-4cm)
- Verify RST and SDA pins

## API Endpoints Used

Your ESP8266 calls these endpoints:

1. **Status Check** (every 5 seconds)
   ```
   GET http://backend:8001/api/rfid/module/status
   Response: {"write_enabled":true/false, "read_enabled":true/false, "user_id":X}
   ```

2. **Get UUID to Write**
   ```
   GET http://backend:8001/api/rfid/write/get-uuid?user_id=1
   Response: {"ok":true, "uuid":"a1b2c3d4e5f6..."}
   ```

3. **Verify Read Card**
   ```
   POST http://backend:8001/api/rfid/read/verify
   Body: {"tourist_uuid":"a1b2c3d4e5f6..."}
   Response: {"ok":true, "valid":true, "name":"John", ...}
   ```

## Serial Monitor Debug Output

**Normal Read:**
```
✓ Card detected - Reading...
✓ Read UUID: a1b2c3d4e5f6789
✓ Card is VALID
```

**Failed Write:**
```
✓ Card detected - Writing...
✗ Auth failed
```

**Mode Changes:**
```
→ MODE: IDLE
→ MODE: WRITE ENABLED
✓ Card detected - Writing...
→ MODE: IDLE
```

## Performance Notes

- **Read Time**: 2-3 seconds
- **Write Time**: 2-3 seconds
- **Status Poll**: Every 5 seconds
- **Max Cards/Minute**: ~10-15 (depends on card quality)
- **Memory**: ~50KB used, ~200KB available

## Advanced Configuration

Edit `config.h` to adjust:

```cpp
// Reduce status poll interval for faster response
#define STATUS_POLL_INTERVAL 2000  // 2 seconds

// Increase timeout if cards are slow
#define CARD_READ_TIMEOUT 45000   // 45 seconds

// Different pins? Update here:
#define SS_PIN D8      // Your CS pin
#define RST_PIN D3     // Your RESET pin
```

## Next Steps

1. Go to: http://127.0.0.1:3000/admin/rfid
2. Search for a tourist
3. Click "Write" button
4. Place card on reader within 30 seconds
5. ESP8266 LED will turn on and card will be written
6. Click "Read" button
7. Tap card to verify data

Done! Your ESP8266 RFID module is now integrated with Zentora! 🎉
