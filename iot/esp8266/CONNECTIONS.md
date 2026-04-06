# ESP8266 RFID Module - Wiring Diagram

## Component List
- ESP8266 (NodeMCU 1.0)
- MFRC522 RFID Reader
- 5V Buzzer (Active or passive with transistor)
- 3x LEDs (Red, Green, Blue or Green/Purple/Orange)
- 3x 220Ω Resistors (for LEDs)
- Jumper Wires
- Micro USB cable

## Pinout Diagram

```
ESP8266  ←→  MFRC522 RFID Reader
══════════════════════════════════
3V3     ←→  3.3V
GND     ←→  GND
D5      ←→  SCK   (SPI Clock)
D7      ←→  MOSI  (SPI Data In)
D6      ←→  MISO  (SPI Data Out)
D8      ←→  SDA   (Chip Select)
D3      ←→  RST   (Reset)
```

## LED Connections
```
LED READ (Green)  - D1 (GPIO5) with 220Ω resistor
LED WRITE (Purple)- D2 (GPIO4) with 220Ω resistor
LED OK (Orange)   - D0 (GPIO16) with 220Ω resistor
GND ←→ All LED Cathodes (Negative)
```

## Buzzer Connection
```
Buzzer (+) ← D4 (GPIO2)
Buzzer (-) ← GND
```

## Full Wiring Summary
```
MFRC522 Side:
├─ 3.3V → ESP8266 3V3
├─ GND → ESP8266 GND
├─ SCK → ESP8266 D5
├─ MOSI → ESP8266 D7
├─ MISO → ESP8266 D6
├─ SDA → ESP8266 D8
└─ RST → ESP8266 D3

Buzzer:
├─ Positive → ESP8266 D4
└─ Negative → ESP8266 GND

LEDs (each with 220Ω resistor):
├─ Green LED → D1
├─ Purple LED → D2
├─ Orange/Red LED → D0
└─ All Negatives → GND

Power:
├─ Micro USB → Computer/USB Power
```

## Pin Configuration in Code
```
config.h pins:
SS_PIN = D8       (GPIO15)
RST_PIN = D3      (GPIO0)
BUZZER_PIN = D4   (GPIO2)
LED_READ = D1     (GPIO5)
LED_WRITE = D2    (GPIO4)
LED_OK = D0       (GPIO16)
```

## Important Notes

1. **Power Supply**: Use a stable 5V USB power supply. Weak power can cause RFID reader failures
2. **Antenna**: Keep RFID antenna away from metal objects
3. **Read Distance**: Usually 2-4 cm depending on card type
4. **Card Type**: Tested with MIFARE Classic 1K (ISO14443A)
5. **Timing**: Maximum read/write time ~5-10 seconds per operation
