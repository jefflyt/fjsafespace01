# uHoo API Reference

> Source: [uHoo APIs for Business Account](https://documenter.getpostman.com/view/180333/TzeRopef)
> Last verified: 2026-05-04

## Authentication

uHoo uses a `code` + `access_token` model.

1. Login to [https://web.getuhoo.com](https://web.getuhoo.com)
2. Go to **My Account** → **API** → **Generate Client ID**
3. Use `/v1/generatetoken` to get an access token
4. Use the token as `Bearer` in the `Authorization` header for all subsequent API calls

**Base URL:** `https://api.uhooinc.com/v1`

### POST /v1/generatetoken

Generate an access token from a client code.

**Request:**

```text
POST https://api.uhooinc.com/v1/generatetoken
Content-Type: application/x-www-form-urlencoded

code=<your_client_code>
```

**Response:**

```json
{
    "access_token": "6f86116375442bf414fb0d7f",
    "refresh_token": "f2a00ce7b11b5a68a371c4ce",
    "token_type": "Bearer",
    "expires_in": 600
}
```

> **Note:** Token expires in **600 seconds (10 minutes)**. When a new token is created, the old one is automatically invalidated (HTTP 401). A `refresh_token` is returned but its usage is not documented in the Postman collection.

---

## Endpoints

### GET /v1/devicelist

List all devices associated with the Business account.

**Request:**

```text
GET https://api.uhooinc.com/v1/devicelist
Authorization: Bearer <access_token>
```

**Response:**

```json
[
    {
        "deviceName": "Device 1",
        "macAddress": "xxxxxxxxxxxx",
        "serialNumber": "xxxxxxxxxxxxxxxxxxxxxxxx",
        "floorNumber": 1,
        "roomName": "Office Space",
        "timezone": "(UTC-08:00) Pacific Time (US and Canada)",
        "utcOffset": "-07:00",
        "ssid": "WiFi1"
    }
]
```

> **Note:** `macAddress` is the device MAC address, or IMEI for SIM versions of uHoo Aura. This endpoint has a **daily API call limit** — returns HTTP 400 when exceeded, reset at midnight UTC.

### POST /v1/devicedata

Get sensor data from a device.

**Request:**

```text
POST https://api.uhooinc.com/v1/devicedata
Authorization: Bearer <access_token>
Content-Type: application/x-www-form-urlencoded

macAddress=xxxxxxxxxxxx
mode=minute
```

**Parameters:**

| Parameter | Required | Description |
|---|---|---|
| `macAddress` | Yes | Device MAC address (from `/devicelist`) |
| `mode` | Yes | `minute`, `hour`, or `day` |
| `limit` | No | Max data points to return (`minute` mode only) |
| `prevDateTime` | No | Start timestamp: `YYYY-MM-DD hh:mm:ss` (`minute` mode only) |
| `timestampStart` | No | Range start: `YYYY-MM-DD hh:mm:ss` (`minute` mode only) |
| `timestampEnd` | No | Range end: `YYYY-MM-DD hh:mm:ss` (`minute` mode only) |

**Mode behavior:**

| Mode | Behavior |
|---|---|
| `minute` | Return most recent data point(s). Use `limit` for multiple points. Use `prevDateTime` or `timestampStart`/`timestampEnd` for historical ranges. Returns 404 if device has no data. |
| `hour` | Return minute-by-minute data of the last 60 minutes. Returns 404 if device was offline in the last 60 minutes. |
| `day` | Return hourly averages of the last 24 hours. Returns 404 if device was offline in the last 24 hours. |

**Response:**

```json
{
    "data": [
        {
            "virusIndex": 5,
            "temperature": 25,
            "humidity": 85.9,
            "pm25": 1,
            "tvoc": 0,
            "co2": 519,
            "co": 0,
            "airPressure": 1012.6,
            "ozone": 4.2,
            "no2": 0.3,
            "timestamp": 1619964490
        }
    ],
    "sensorlist": {
        "pm25": "1",
        "tvoc": "1",
        "co": "0",
        "co2": "519",
        "airPressure": "1012.6",
        "ozone": "4.2",
        "no2": "0.3",
        "temperature": "25",
        "humidity": "85.9",
        "virusIndex": "5"
    },
    "usersettings": {
        "temperature": "°C",
        "humidity": "%",
        "pm1": "μg/m^3",
        "pm25": "μg/m^3",
        "pm4": "μg/m^3",
        "pm10": "μg/m^3",
        "ch2o": "ppb",
        "tvoc": "ppb",
        "co": "ppm",
        "co2": "ppm",
        "no2": "ppb",
        "ozone": "ppb",
        "light": "lux",
        "sound": "dBA",
        "airPressure": "mbar"
    },
    "count": 1
}
```

---

## Available Metrics

### API Response Fields (from actual /v1/devicedata response)

The uHoo API returns **10 sensor metrics** in each `data` array entry:

| uHoo API Field | Internal Name | Unit | Range | Description |
|---|---|---|---|---|
| `co2` | `co2_ppm` | ppm | 300–5000 | Carbon dioxide |
| `pm25` | `pm25_ugm3` | μg/m³ | 0–500 | Fine particulate matter |
| `tvoc` | `tvoc_ppb` | ppb | 0–2000 | Total volatile organic compounds |
| `temperature` | `temperature_c` | °C | -10–60 | Temperature |
| `humidity` | `humidity_rh` | %RH | 0–100 | Relative humidity |
| `co` | `co_ppb` | ppm | 0–1000 | Carbon monoxide |
| `airPressure` | `pressure_hpa` | mbar | 870–1085 | Atmospheric pressure |
| `ozone` | `o3_ppb` | ppb | 0–300 | Ozone |
| `no2` | `no2_ppb` | ppb | 0–500 | Nitrogen dioxide |
| `virusIndex` | *(proprietary)* | — | 0–10 | uHoo Virus Index score |

Plus: `timestamp` (Unix epoch seconds)

### Response Objects

| Object | Purpose |
|---|---|
| `data[]` | Array of sensor readings, one per data point |
| `sensorlist` | Current sensor values as strings — use to detect available sensors on the device |
| `usersettings` | Unit definitions for each metric — supports future device configs (pm1, pm4, pm10, ch2o/formaldehyde, light, sound) |
| `count` | Number of data points returned |

### CSV-Only Metrics

These additional metrics appear in CSV exports but are **not** in the API `data` array:

| CSV Column | Internal Name | Unit | Description |
|---|---|---|---|
| `no_ppb` | `no_ppb` | ppb | Nitric oxide |
| `voc_ppb` | `voc_ppb` | ppb | Individual VOC (separate from TVOC) |
| `noise_dba` | `noise_dba` | dBA | Sound level |
| `pm10_ugm3` | `pm10_ugm3` | μg/m³ | Coarse particulate matter |
| `aqi_index` | `aqi_index` | AQI | Air Quality Index (calculated) |

---

## Rate Limits

- **Daily API call limit** — both `/devicelist` and `/devicedata` count toward a daily quota. When exceeded, returns HTTP 400 until reset at **midnight UTC**.
- **Token generation** — no published limit. Each new token invalidates the previous one.

### Recommended polling strategy

For continuous monitoring integration (R2+):

| Action | Interval | Reason |
|---|---|---|
| Generate token | Every 9 minutes (tokens last 10 min) | Avoid 401 errors |
| Refresh device list | Once per hour | Devices don't change often |
| Poll device data | Every 1 minute | uHoo recommends matching device data frequency |
| Historical bulk fetch | Use `mode=hour` or `mode=day` | Get 60 or 24 data points in one call |

### Token lifecycle

- Tokens expire in **600 seconds (10 minutes)**
- When a new token is generated, the old one is **immediately invalidated**
- HTTP 403 = current token expired → generate a new one
- HTTP 401 = old token was replaced by a new one → use the latest token
- Store `access_token` + creation time; regenerate before expiry

### Error codes

| HTTP Status | Meaning | Action |
|---|---|---|
| `200` | Success | Parse response |
| `400` | Bad request OR daily limit exceeded | Check parameters or wait for midnight UTC reset |
| `401` | Unauthorized — old/invalidated token | Use the latest token |
| `403` | Forbidden — expired token | Re-generate token |
| `404` | Not found — device has no data for the requested mode/time | Check device is online |
| `500` | Server error | Retry with exponential backoff |

---

## Integration Notes

### Current Integration (CSV Upload)

The platform currently ingests data via **CSV file upload** only:

- Parsed by `backend/app/skills/data_ingestion/csv_parser.py`
- Supports column aliasing for alternate uHoo export headers
- All 16 metrics are processed
- No direct API integration with uHoo yet

### Future Integration (Direct API)

Potential future R2/R3 work:

- Poll `/v1/devicedata` on schedule for continuous monitoring
- Requires storing client code and managing token lifecycle (10-min expiry)
- API provides 10 metrics vs 16 from CSV — 6 metrics gap (NO, individual VOC, noise, PM10, AQI)
- The `usersettings` object suggests some devices may support additional fields (pm1, pm4, ch2o/formaldehyde, light, sound)
- Daily API call limit must be respected — reset at midnight UTC
- Use `sensorlist` object to detect available sensors dynamically

### Column Aliases (already mapped in csv_parser.py)

The parser maps these alternate uHoo headers to internal names:

| Alternate Header | Internal Name |
|---|---|
| `Sampling Location` | `zone_name` |
| `Date and Time` | `timestamp` |
| `CO2` | `co2_ppm` |
| `CO` | `co_ppb` |
| `PM2.5` | `pm2_5_ugm3` |
| `Humidity` / `Relative Humidity` | `humidity_rh` |
| `Temperature` | `temperature_c` |
| `TVOC` | `tvoc_ppb` |
| `O3` / `Ozone` | `o3_ppb` |
| `NO` | `no_ppb` |
| `NO2` | `no2_ppb` |
| `VOC` | `voc_ppb` |
| `PRS` / `Air Pressure` | `pressure_hpa` |
| `Noise Level` / `Noise_Level` / `Sound` | `noise_dba` |
| `PM10` | `pm10_ugm3` |
| `Air Quality Index` / `AQI` | `aqi_index` |

---

## Limitations

1. **Postman server rejects requests** — uHoo blocks Postman's user-agent. All testing must be done from your own server/cloud.
2. **No webhook/streaming** — data must be polled; no real-time push.
3. **API vs CSV metric gap** — API provides 10 metrics (including virusIndex), CSV provides 16. The API is missing: NO (nitric oxide), VOC (individual), noise/dBA, PM10, and AQI (calculated). The `usersettings` object suggests some devices may support additional fields (pm1, pm4, ch2o/formaldehyde, light/lux).
4. **Business account required** — personal uHoo accounts don't have API access.
5. **Daily API call limit** — undocumented quota. Returns HTTP 400 when exceeded, reset at midnight UTC.
