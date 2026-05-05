export interface DayForecast {
  date: string; // YYYY-MM-DD
  weatherCode: number;
  tempMax: number;
  tempMin: number;
}

export async function getWeekForecast(): Promise<DayForecast[]> {
  const lat = process.env.WEATHER_LAT;
  const lon = process.env.WEATHER_LON;
  if (!lat || !lon) return [];

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.daily.time as string[]).map((date: string, i: number) => ({
    date,
    weatherCode: data.daily.weather_code[i] as number,
    tempMax: Math.round(data.daily.temperature_2m_max[i] as number),
    tempMin: Math.round(data.daily.temperature_2m_min[i] as number),
  }));
}
