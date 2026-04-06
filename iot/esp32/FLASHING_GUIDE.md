# ESP32 RFID Module - Arduino IDE Flashing Guide

## Prerequisites

- Arduino IDE 2.0+ installed (https://www.arduino.cc/en/software)
- ESP32 compatible USB cable (Micro USB)
- Your ESP32 DevKit V1 board
- MFRC522 RFID reader + cards for testing
- Optional: CH340 driver if board not recognized (https://github.com/HeQingbao/ch340_install)

## Step 1: Install Arduino IDE

1. Download Arduino IDE 2.0 or higher from https://www.arduino.cc/en/software
2. Install and launch the application
3. Accept any security prompts

## Step 2: Add ESP32 Board Support

1. Open Arduino IDE → **Preferences** (Arduino → Preferences on macOS)
2. Find "Additional Boards Manager URLs" field
3. Paste this URL:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Click OK

## Step 3: Install ESP32 Arduino Core

1. Go to **Tools → Board → Boards Manager**
2. Search for "esp32"
3. Click on "esp32 by Espressif Systems"
4. Click **Install** (takes ~2 minutes for full download)
5. Wait for installation to complete
6. Close Boards Manager

## Step 4: Install MFRC522 Library

1. Go to **Tools → Manage Libraries** (or Sketch → Include Library → Manage Libraries)
2. Search for "MFRC522"
3. Look for "MFRC522 by GithubCommunity" or "MFRC522 by miguelbalboa"
4. Click **Install**
5. Close Library Manager

## Step 5: Install ArduinoJson Library

1. Go to **Tools → Manage Libraries**
2. Search for "ArduinoJson"
3. Click on "ArduinoJson by Benoit Blanchon"
4. Click **Install** (choose version 6.x)
5. Close Library Manager

## Step 6: Connect ESP32 to Computer

1. Connect ESP32 to your computer via Micro USB cable
2. Wait 2-3 seconds for driver to load
3. On macOS: System should detect "/dev/cu.usbserial-XXXX"
4. On Windows: Check Device Manager for "COM" port
5. On Linux: Should appear as "/dev/ttyUSB0"

**If not detected:**
- Try different USB cable
- Check Device Manager (Windows) or System Report (macOS)
- Install CH340 drivers: https://github.com/HeQingbao/ch340_install
- Restart Arduino IDE after installing drivers

## Step 7: Configure Arduino IDE for ESP32

1. Go to **Tools** menu and set:

   | Setting | Value |
   |---------|-------|
   | Board | ESP32 Dev Module |
   | Upload Speed | 921600 |
   | CPU Frequency | 240 MHz (WiFi/BT) |
   | Flash Frequency | 80 MHz |
   | Flash Mode | DIO |
   | Flash Size | 4MB (32Mb) |
   | Partition Scheme | Default 4MB with spiffs |
   | Core Debug Level | Info |
   | PSRAM | Disabled |
   | Port | /dev/cu.usbserial-XXXX (your port) |

2. Double-check all settings match above

## Step 8: Load and Configure Your Sketch

1. Open **File → Open**
2. Navigate to `/iot/esp32/rfid_read_write.ino`
3. Also open the accompanying `config.h` file in the same directory
4. Edit `config.h` with YOUR settings:

   ```cpp
   #define WIFI_SSID "Your_WiFi_Network"
   #define WIFI_PASSWORD "Your_Password"
   #define API_HOST "192.168.1.X"  // Your backend IP
   #define API_PORT 8000
   ```

5. Save both files (Ctrl+S or Cmd+S)

## Step 9: Compile the Sketch

1. Click **Sketch → Verify/Compile** (or Ctrl+K / Cmd+K)
2. Wait for compilation to complete (30-60 seconds)
3. Check the black message area at the bottom:
   - ✅ Success shows: "Compilation complete."
   - ❌ Errors show red error messages

**If errors occur:**
- Check that config.h is in the same folder
- Verify all libraries are installed
- Make sure pin numbers make sense
- Check for typos in WiFi SSID/password

## Step 10: Upload to ESP32

1. Click **Sketch → Upload** (or Ctrl+U / Cmd+U)
2. Arduino automatically compiles first, then uploads
3. Watch the bottom message area
4. You should see:
   ```
   Connecting...
   Uploading...
   .... (progress dots)
   Uploaded successfully
   ```
5. Upload usually takes 10-30 seconds

**If upload fails:**
- Make sure correct PORT is selected (Tools → Port)
- Try holding BOOT button during upload
- Check USB cable connection
- Try lower baud rate: Tools → Upload Speed → 115200

## Step 11: Verify Installation

1. Click **Tools → Serial Monitor** (or Ctrl+Shift+M / Cmd+Shift+M)
2. Set baud rate to **115200** in bottom-right dropdown
3. Press ESP32 EN/RESET button
4. You should see boot messages:
   ```
   [INFO] ESP32 RFID Module Starting...
   [INFO] Connecting to WiFi...
   [INFO] WiFi connected! IP: 192.168.X.X
   [INFO] Checking API connection...
   [INFO] API OK, entering main loop...
   ```

5. Every 5 seconds you should see:
   ```
   [DEBUG] Checking module status...
   [DEBUG] Mode: read_enabled=false, write_enabled=false
   ```

**If you see errors:**
- WiFi won't connect: Check SSID/password in config.h
- API connection failed: Check API_HOST IP address and backend is running
- No output: Check baud rate is 115200
- Garbage text: Wrong baud rate selected

## Step 12: Test the Hardware

1. In Serial Monitor, watch for status updates
2. From admin dashboard:
   - Click "Read Mode" button
   - You should see: `[INFO] Mode changed: read_enabled=true`
   - Bring RFID card close (within 2cm)
   - You should see card data received
   - Green LED should light up
   - Buzzer should beep 3x on success

3. Try "Write Mode":
   - Click "Write Mode" button
   - Select a tourist user
   - Bring blank RFID card
   - Purple LED should light up
   - Buzzer beeps when writing
   - Orange LED beeps on success

## Step 13: Monitor and Troubleshoot

Keep Serial Monitor open while testing. You'll see:

```
[DEBUG] Checking module status...
[DEBUG] HTTP Response: 200
{"write_enabled":false,"read_enabled":true,"user_id":1}
[DEBUG] Read mode enabled
[DEBUG] Waiting for card (timeout: 30s)
[INFO] Card detected! UID: A1B2C3D4
[DEBUG] Calling /api/rfid/read/verify
[DEBUG] Verification successful!
[INFO] Beeping 3x (success)
```

### Common Issues in Serial Monitor:

| Issue | Cause | Solution |
|-------|-------|----------|
| `[ERROR] WiFi connection failed` | Wrong SSID/password | Check config.h |
| `[ERROR] Failed to connect to API` | Backend not running or wrong IP | Verify backend server running |
| `[DEBUG] HTTP Response: 404` | API endpoint not found | Update backend code |
| `[WARNING] No card detected (timeout)` | Card too far or not present | Bring card closer |
| `[ERROR] Authentication failed` | RFID key mismatch | Check MFRC522 default key |
| `[INFO] Beeping 1x (error)` | Card verification failed | Check card UID in database |
| Garbage characters/wrong baud | Serial monitor wrong speed | Set to 115200 |

## Advanced Configuration

### Pin Customization

Edit `config.h` to change pins if needed:

```cpp
#define SS_PIN 5           // MFRC522 Chip Select
#define RST_PIN 4          // MFRC522 Reset
#define BUZZER_PIN 25      // Buzzer PWM pin
#define LED_READ 32        // Green LED
#define LED_WRITE 33       // Purple LED
#define LED_OK 26          // Orange LED
```

Then recompile and upload.

### Change Poll Frequency

Edit in the main code loop (near the end of rfid_read_write.ino):

```cpp
delay(5000);  // Check every 5 seconds - change to whatever you want
```

### Buzzer Frequency

Edit these lines if buzzer tone is too high/low:

```cpp
ledcWriteTone(BUZZER_CHANNEL, 880);  // Hz for success tone
ledcWriteTone(BUZZER_CHANNEL, 400);  // Hz for error tone
```

### Debug Output Level

Change this line to control verbosity:

```cpp
#define DEBUG_MODE 1  // 0=silent, 1=info, 2=verbose
```

## Flashing Multiple ESP32 Boards

To flash the same code to multiple boards:

1. Prepare first board as above
2. Plug in second board
3. Change Tools → Port to new board's port
4. Click Upload (Sketch → Upload)
5. Arduino remembers your settings
6. Repeat for each additional board

## Updating Code Over WiFi (OTA)

For future updates without USB cable:

1. Upload once via USB as above
2. Add OTA support (requires code changes - not included in basic version)
3. Upload future changes wirelessly

(Advanced feature - ask if you want OTA setup)

## Rollback/Recovery

If something goes wrong:

1. Close Serial Monitor
2. Hold BOOT button on ESP32
3. Verify/Compile the sketch (Ctrl+K)
4. Start Upload (Ctrl+U)
5. When upload starts, release BOOT button
6. Board should reflash

If totally bricked:

1. Download ESP32 flasher tool: https://github.com/espressif/esptool
2. Use command: `esptool.py --port /dev/cu.usbserial-XXXX erase_flash`
3. Then upload normally from Arduino IDE

## Getting Help

Check things in this order:

1. **Serial Monitor output** - Shows what device is doing
2. **config.h settings** - Wrong WiFi or API will show immediately
3. **Arduino IDE board settings** - Must match ESP32 Dev Module exactly
4. **Library versions** - Make sure latest MFRC522 library installed
5. **USB cable** - Try different cable, sometimes they're defective
6. **Backend logs** - Check if API is receiving requests

## Success Checklist

- [ ] Arduino IDE opens without errors
- [ ] ESP32 board shows in Tools → Board
- [ ] MFRC522 library installed
- [ ] ArduinoJson library installed
- [ ] ESP32 shows in Tools → Port
- [ ] config.h has correct WiFi SSID/password
- [ ] config.h has correct API_HOST IP
- [ ] Sketch compiles without errors
- [ ] Upload succeeds and shows "Uploaded successfully"
- [ ] Serial Monitor shows WiFi connected message
- [ ] Serial Monitor shows API OK message
- [ ] Every 5 seconds you see status check messages
- [ ] Test: Read Mode works with RFID card
- [ ] Test: Write Mode works with blank RFID card
- [ ] LEDs light up during operations
- [ ] Buzzer beeps on success/error
- [ ] Serial Monitor shows no error messages during operation

Once everything checks out, your ESP32 is ready for deployment!
