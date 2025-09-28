import 'dotenv/config';
import path from 'node:path';
import process from 'node:process';
import { calendar_v3, google } from 'googleapis';

const GOOGLE_SHARED_CALENDAR_ID = process.env.GOOGLE_SHARED_CALENDAR_ID;
if (!GOOGLE_SHARED_CALENDAR_ID) {
  throw new Error('GOOGLE_SHARED_CALENDAR_ID is not set but is required');
}

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CREDENTIALS_PATH = path.join(process.cwd(), 'google_auth.json');

const jwtClient = new google.auth.JWT({
    keyFile: CREDENTIALS_PATH,
    scopes: SCOPES
});
const calendar = google.calendar({ version: 'v3', auth: jwtClient });

export async function getEvents(timeMin: Date, timeMax: Date) {
    console.info(GOOGLE_SHARED_CALENDAR_ID);
    const result = await calendar.events.list({
        calendarId: GOOGLE_SHARED_CALENDAR_ID,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
    });
    const events = result.data.items;
    if (!events || events.length === 0) {
        console.info('No upcoming events found.');
        return;
    }
    console.info(events);
    return events;
}

export async function createEvent(title: string, start: Date, end: Date) {

    const event: calendar_v3.Schema$Event = {
        summary: title,
        start: { dateTime: start.toISOString(), timeZone: "Europe/Berlin" },
        end: { dateTime: end.toISOString(), timeZone: "Europe/Berlin" }
    }
    calendar.events.insert({
        calendarId: GOOGLE_SHARED_CALENDAR_ID,
        requestBody: event
    }, function (err, event) {
        if (err) {
            console.log('There was an error contacting the Calendar service: ' + err);
            return;
        }
        return event;
    });
}