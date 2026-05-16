export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
}

export interface DayForecast {
  date: string; // YYYY-MM-DD
  weatherCode: number;
  tempMax: number;
  tempMin: number;
}

export interface WeatherData {
  current: CurrentWeather | null;
  forecast: DayForecast[];
}

export async function getWeatherData(): Promise<WeatherData> {
  const lat = process.env.WEATHER_LAT;
  const lon = process.env.WEATHER_LON;
  if (!lat || !lon) return { current: null, forecast: [] };

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&current=weather_code,temperature_2m,apparent_temperature` +
    `&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { current: null, forecast: [] };

  const data = await res.json();

  const current: CurrentWeather = {
    temperature: Math.round(data.current.temperature_2m as number),
    apparentTemperature: Math.round(data.current.apparent_temperature as number),
    weatherCode: data.current.weather_code as number,
  };

  const forecast: DayForecast[] = (data.daily.time as string[]).map(
    (date: string, i: number) => ({
      date,
      weatherCode: data.daily.weather_code[i] as number,
      tempMax: Math.round(data.daily.temperature_2m_max[i] as number),
      tempMin: Math.round(data.daily.temperature_2m_min[i] as number),
    })
  );

  return { current, forecast };
}

export async function getWeekForecast(): Promise<DayForecast[]> {
  const data = await getWeatherData();
  return data.forecast;
}
