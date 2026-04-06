# ESP32 RFID Module - Wiring Diagram

## Component List
- ESP32 DevKit V1
- MFRC522 RFID Reader
- 5V Buzzer (Active)
- 3x LEDs (Red, Green, Blue)
- 3x 220Ω Resistors (for LEDs) - Optional for ESP32 (can drive directly)
- Jumper Wires
- Micro USB cable
- 5V Power Supply (if needed)

## ESP32 Pinout Diagram

```
ESP32    ←→  MFRC522 RFID Reader
═════════════════════════════════════
3.3V    ←→  3.3V
GND     ←→  GND
GPIO18  ←→  SCK   (SPI Clock)
GPIO23  ←→  MOSI  (SPI Data In)
GPIO19  ←→  MISO  (SPI Data Out)
GPIO5   ←→  SDA   (Chip Select)
GPIO4   ←→  RST   (Reset)
```

## LED Connections
```
LED READ (Green)   - GPIO32 with 220Ω resistor
LED WRITE (Purple) - GPIO33 with 220Ω resistor
LED OK (Orange)    - GPIO26 with 220Ω resistor
GND ←→ All LED Cathodes (Negative)
```

## Buzzer Connection (PWM)
```
Buzzer (+) ← GPIO25 (PWM Output)
Buzzer (-) ← GND
```

## Full Wiring Summary

### MFRC522 Connections:
```
MFRC522 Pin    →  ESP32 GPIO
─────────────────────────────
3.3V          →  3.3V
GND           →  GND
SCK           →  GPIO18
MOSI          →  GPIO23
MISO          →  GPIO19
SDA           →  GPIO5
RST           →  GPIO4
```

### Buzzer Connection (PWM):
```
Buzzer Positive   →  GPIO25
Buzzer Negative   →  GND
```

### LED Connections:
```
Green LED (Read)   →  GPIO32 (through 220Ω resistor)
Purple LED (Write) →  GPIO33 (through 220Ω resistor)
Orange LED (OK)    →  GPIO26 (through 220Ω resistor)
All Cathodes       →  GND
```

## Pin Configuration in Code
```
config.h pins:
SS_PIN = 5         (GPIO5)
RST_PIN = 4        (GPIO4)
BUZZER_PIN = 25    (GPIO25) - PWM
LED_READ = 32      (GPIO32)
LED_WRITE = 33     (GPIO33)
LED_OK = 26        (GPIO26)
SPI_MISO = 19      (GPIO19)
SPI_MOSI = 23      (GPIO23)
SPI_SCK = 18       (GPIO18)
```

## Important Notes

1. **Power Supply**: ESP32 has better power management than ESP8266
   - USB power is usually sufficient
   - If powering externally, use 5V supply with good ground connection
   
2. **RFID Reader**: Needs stable 3.3V
   - Some readers work up to 5V
   - Check your MFRC522 board for operating voltage
   
3. **Read Distance**: Usually 2-4 cm
   - Keep away from metal/shields
   - Antenna should be clear
   
4. **Buzzer Type**: 
   - Active buzzer (has built-in oscillator) - just apply voltage
   - Passive buzzer - needs PWM frequency ~2-4kHz
   - Code supports both via PWM
   
5. **GPIO Notes**:
   - GPIO36/39 are input-only (use for sensors, not output)
   - GPIO34/35 are input-only
   - Avoid using GPIO0/2/15 if booting issues occur
   - GPIO25-26 are DAC pins (also PWM capable)

## Power Consumption Estimates

- ESP32: 80-160mA
- RFID Reader: 100-200mA
- LEDs: 10-30mA (x3)
- Buzzer: 50-100mA (when active)
- **Total**: 300-500mA peak

Use USB 5V adapter with at least 1A output for stable operation.

## Alternative Pin Configuration

If the default pins conflict with your setup, edit config.h:

```cpp
// Example: Use different LED pins
#define LED_READ 12    // GPIO12 instead of GPIO32
#define LED_WRITE 13   // GPIO13 instead of GPIO33
#define LED_OK 14      // GPIO14 instead of GPIO26
```

Just ensure:
- MFRC522 SPI pins (18, 19, 23, 4, 5) don't change (or update SPI.begin() call)
- Don't use GPIO16, 17 for SPI unless using HSPI
- Avoid GPIO0, GPIO2, GPIO15 for outputs (boot pins)

## Troubleshooting Connection Issues

1. **RFID not initialized**
   - Check power to MFRC522 (use multimeter)
   - Check all SPI connections
   - Try swapping MOSI/MISO if reversed
   
2. **Card detection fails**
   - Verify antenna is connected
   - Check RC values on MFRC522 board
   - Use oscilloscope to verify SPI clock
   
3. **SPI communication errors**
   - Reduce SPI clock speed if issues persist
   - Check for ground loops
   - Use shielded wires for long runs

4. **Buzzer not working**
   - Verify polarity (+ to GPIO25, - to GND)
   - Check if buzzer is active type
   - Verify GPIO25 is working (test with LED first)
   - Use multimeter to check voltage output

5. **LEDs dim or not working**
   - Check resistor values (220Ω is typical)
   - Verify GPIO is in OUTPUT mode
   - Check LED polarity (long leg is +)
   - Test with multimeter for GPIO voltage
