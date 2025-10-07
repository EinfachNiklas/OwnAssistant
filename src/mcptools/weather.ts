import 'dotenv/config';

const LATITUDE: string = process.env.LATITUDE!;
const LONGITUDE: string = process.env.LONGITUDE!;
const TIMEZONE: string = process.env.TIMEZONE ?? 'Europe/Berlin';
if(!LATITUDE || !LONGITUDE){
    throw new Error('Environment variable LATITUDE or LONGITUDE is not set but is required');
}

export interface Forecast {
    [date: string]: {
        temp_min: string,
        temp_max: string,
        rain_sum: string,
        showers_sum: string,
        snowfall_sum: string,
        precipitation_probability: string,
        wind_speed: string,
    }
}

export interface Current {
    [date: string]: {
        temp: string,
        rain: string,
        showers: string,
        snowfall: string,
        cloud_cover: string,
        precipitation: string,
        wind_speed: string,
    }
}

export async function get_forecast() {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
        latitude: LATITUDE,
        longitude: LONGITUDE,
        daily: "weather_code,temperature_2m_min,temperature_2m_max,rain_sum,showers_sum,snowfall_sum,precipitation_probability_max,wind_speed_10m_max",
        timezone: TIMEZONE
    }).toString());
    const weatherJson = await res.json();
    let forecast: Forecast = {};
    for (let i = 0; i < 7; i++) {
        const data = {
            temp_min: `${weatherJson["daily"]["temperature_2m_min"][i]}${weatherJson["daily_units"]["temperature_2m_min"]}`,
            temp_max: `${weatherJson["daily"]["temperature_2m_max"][i]}${weatherJson["daily_units"]["temperature_2m_max"]}`,
            rain_sum: `${weatherJson["daily"]["rain_sum"][i]}${weatherJson["daily_units"]["rain_sum"]}`,
            showers_sum: `${weatherJson["daily"]["showers_sum"][i]}${weatherJson["daily_units"]["showers_sum"]}`,
            snowfall_sum: `${weatherJson["daily"]["snowfall_sum"][i]}${weatherJson["daily_units"]["snowfall_sum"]}`,
            precipitation_probability: `${weatherJson["daily"]["precipitation_probability_max"][i]}${weatherJson["daily_units"]["precipitation_probability_max"]}`,
            wind_speed: `${weatherJson["daily"]["wind_speed_10m_max"][i]}${weatherJson["daily_units"]["wind_speed_10m_max"]}`,
        }
        forecast[weatherJson["daily"]["time"][i]] = data;
    }
    return forecast;
}

export async function get_current() {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
        latitude: LATITUDE,
        longitude: LONGITUDE,
        current: "temperature_2m,precipitation,cloud_cover,wind_speed_10m,snowfall,showers,rain",
        timezone: TIMEZONE
    }).toString());
    const weatherJson = await res.json();
    let current: Current = {};
    const data = {
        temp: `${weatherJson["current"]["temperature_2m"]}${weatherJson["current_units"]["temperature_2m"]}`,
        rain: `${weatherJson["current"]["rain"]}${weatherJson["current_units"]["rain"]}`,
        showers: `${weatherJson["current"]["showers"]}${weatherJson["current_units"]["showers"]}`,
        snowfall: `${weatherJson["current"]["snowfall"]}${weatherJson["current_units"]["snowfall"]}`,
        cloud_cover: `${weatherJson["current"]["cloud_cover"]}${weatherJson["current_units"]["cloud_cover"]}`,
        precipitation: `${weatherJson["current"]["precipitation"]}${weatherJson["current_units"]["precipitation"]}`,
        wind_speed: `${weatherJson["current"]["wind_speed_10m"]}${weatherJson["current_units"]["wind_speed_10m"]}`,
    }
    current[weatherJson["current"]["time"]] = data;
    return current;
}