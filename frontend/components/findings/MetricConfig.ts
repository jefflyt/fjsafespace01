// Thresholds from rule_engine.py — single source of truth for metric display

export interface MetricConfig {
  key: string;
  label: string;
  symbol: string;
  unit: string;
  goodBand: [number, number];
  watchBand: [number, number][];
  criticalBand: [number, number][];
  yAxisDomain: [number, number];
}

export const METRIC_CONFIGS: Record<string, MetricConfig> = {
  co2_ppm: {
    key: "co2_ppm",
    label: "CO2",
    symbol: "CO₂",
    unit: "ppm",
    goodBand: [300, 800],
    watchBand: [[800, 1200]],
    criticalBand: [[1200, 9999]],
    yAxisDomain: [0, 1500],
  },
  co_ppb: {
    key: "co_ppb",
    label: "CO",
    symbol: "CO",
    unit: "ppb",
    goodBand: [0, 248],
    watchBand: [[248, 500]],
    criticalBand: [[500, 1000]],
    yAxisDomain: [0, 600],
  },
  pm25_ugm3: {
    key: "pm25_ugm3",
    label: "PM2.5",
    symbol: "PM2.5",
    unit: "μg/m³",
    goodBand: [0, 12],
    watchBand: [[12, 35]],
    criticalBand: [[35, 500]],
    yAxisDomain: [0, 50],
  },
  humidity_rh: {
    key: "humidity_rh",
    label: "Humidity",
    symbol: "RH",
    unit: "%RH",
    goodBand: [30, 60],
    watchBand: [[20, 30], [60, 70]],
    criticalBand: [[0, 20], [70, 100]],
    yAxisDomain: [0, 80],
  },
  temperature_c: {
    key: "temperature_c",
    label: "Temperature",
    symbol: "Temp",
    unit: "°C",
    goodBand: [20, 26],
    watchBand: [[17, 20], [26, 30]],
    criticalBand: [[-10, 10], [30, 60]],
    yAxisDomain: [10, 35],
  },
  tvoc_ppb: {
    key: "tvoc_ppb",
    label: "TVOC",
    symbol: "TVOC",
    unit: "ppb",
    goodBand: [0, 220],
    watchBand: [[220, 660]],
    criticalBand: [[660, 2000]],
    yAxisDomain: [0, 800],
  },
  o3_ppb: {
    key: "o3_ppb",
    label: "Ozone",
    symbol: "O₃",
    unit: "ppb",
    goodBand: [0, 50],
    watchBand: [[50, 100]],
    criticalBand: [[100, 300]],
    yAxisDomain: [0, 120],
  },
  no_ppb: {
    key: "no_ppb",
    label: "Nitric Oxide",
    symbol: "NO",
    unit: "ppb",
    goodBand: [0, 50],
    watchBand: [[50, 200]],
    criticalBand: [[200, 500]],
    yAxisDomain: [0, 250],
  },
  no2_ppb: {
    key: "no2_ppb",
    label: "Nitrogen Dioxide",
    symbol: "NO₂",
    unit: "ppb",
    goodBand: [0, 53],
    watchBand: [[53, 100]],
    criticalBand: [[100, 500]],
    yAxisDomain: [0, 150],
  },
  voc_ppb: {
    key: "voc_ppb",
    label: "VOC",
    symbol: "VOC",
    unit: "ppb",
    goodBand: [0, 220],
    watchBand: [[220, 660]],
    criticalBand: [[660, 2000]],
    yAxisDomain: [0, 800],
  },
  pressure_hpa: {
    key: "pressure_hpa",
    label: "Pressure",
    symbol: "PRS",
    unit: "hPa",
    goodBand: [990, 1030],
    watchBand: [[970, 990], [1030, 1050]],
    criticalBand: [[870, 970], [1050, 1085]],
    yAxisDomain: [960, 1040],
  },
  noise_dba: {
    key: "noise_dba",
    label: "Noise",
    symbol: "Noise",
    unit: "dBA",
    goodBand: [0, 50],
    watchBand: [[50, 70]],
    criticalBand: [[70, 140]],
    yAxisDomain: [0, 90],
  },
  pm10_ugm3: {
    key: "pm10_ugm3",
    label: "PM10",
    symbol: "PM10",
    unit: "μg/m³",
    goodBand: [0, 45],
    watchBand: [[45, 150]],
    criticalBand: [[150, 600]],
    yAxisDomain: [0, 200],
  },
  aqi_index: {
    key: "aqi_index",
    label: "AQI",
    symbol: "AQI",
    unit: "",
    goodBand: [0, 50],
    watchBand: [[50, 100]],
    criticalBand: [[100, 500]],
    yAxisDomain: [0, 150],
  },
};

export const METRIC_KEYS = Object.keys(METRIC_CONFIGS);
