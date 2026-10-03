export type User = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  state: string | null;
  district: string | null;
  pin_code: string | null;
  acres: number | null;
  current_crop: string | null;
  language: string;
  theme: string;
};

export type TokenResponse = { access_token: string; refresh_token: string; user: User };

export type Soil = { n: number; p: number; k: number; moisture: number; temperature: number; ph: number };

export type ForecastDay = {
  date: string;
  tmax: number;
  tmin: number;
  precip_mm: number;
  humidity: number | null;
  wind_kmh: number | null;
  condition: string;
  rain_chance: number | null;
};

export type Baseline = { temp_c: number; humidity: number; wind_kmh: number; condition: string; observed: string };

export type Forecast = {
  location: string;
  provider: string;
  days: ForecastDay[];
  baseline: Baseline | null;
  fetched_at: string;
  cached?: boolean;
};

export type CropResult = {
  crop: string;
  score: number;
  components: Record<"agronomic" | "ml_model" | "regional", { value: number; weight: number }>;
  feature_fit: Record<string, number>;
  limiting_factors: string[];
  yield_potential_t_ha: number;
  yield_range_t_ha: [number, number];
  in_season: boolean;
  harvest_window: { earliest: string; latest: string; duration_days: [number, number] };
  regional_share_pct: number | null;
};

export type CropPrediction = {
  id: string;
  recommended: string;
  crops: CropResult[];
  state: string | null;
  model: {
    accuracy: number;
    chance_accuracy: number;
    ml_weight: number;
    census_year: string;
    data_quality_warning: string | null;
  };
};

export type RiskFactor = {
  code: string;
  score: number;
  weight: number;
  contribution: number;
  detail: string;
  available: boolean;
};

export type RiskResult = {
  id: string;
  crop: string;
  score: number;
  level: "low" | "moderate" | "high";
  factors: RiskFactor[];
  main_causes: string[];
  prevention: { title: string; text: string }[];
  insurance: string;
  weather: { provider: string | null; location: string | null };
  query_tags: string[];
};

export type ChatReply = {
  answer: string;
  sources: { title: string; source: string }[];
  mode: "llm" | "extractive";
  session_id: string;
  lang: string;
};

export type Dashboard = {
  user: { name: string; state: string | null; district: string | null; current_crop: string | null };
  recent_predictions: { id: string; created_at: string; recommended: string; top: { crop: string; score: number }[] }[];
  latest_risk: { crop: string; score: number; level: string; main_causes: string[]; created_at: string } | null;
  weather: { location: string; provider: string; days: ForecastDay[]; baseline: Baseline | null } | null;
  regional_insights: {
    state: string | null;
    census_year: string;
    top_crops: { crop: string; area_ha: number; share_pct: number }[];
  };
  sensor_readings: number;
};

export type Locations = { states: { name: string; districts: string[] }[]; crops: string[] };
