import path from 'node:path';
import process from 'node:process';
import { calendar_v3, google } from 'googleapis';

const GOOGLE_SHARED_CALEDNAR_ID = process.env.GOOGLE_SHARED_CALENDAR_ID;
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CREDENTIALS_PATH = path.join(process.cwd(), 'google_auth.json');

const jwtClient = new google.auth.JWT({
    keyFile: CREDENTIALS_PATH,
    scopes: SCOPES
}
)
const calendar = google.calendar({ version: 'v3', auth: jwtClient });
async function listEvents() {
    const result = await calendar.events.list({
        calendarId: GOOGLE_SHARED_CALEDNAR_ID,
        timeMin: new Date().toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
    });
    const events = result.data.items;
    if (!events || events.length === 0) {
        console.log('No upcoming events found.');
        return;
    }
    console.log('Upcoming 10 events:');

    for (const event of events) {
        const start = event.start?.dateTime ?? event.start?.date;
        console.log(`${start} - ${event.summary}`);
    }
}


async function createEvent(title:string, start: Date, end: Date) {

    const event: calendar_v3.Schema$Event = {
        summary: title,
        start: {dateTime: start.toISOString(), timeZone: "Europe/Berlin"},
        end: {dateTime: end.toISOString(), timeZone: "Europe/Berlin"}
    }
    calendar.events.insert({
        calendarId: GOOGLE_SHARED_CALEDNAR_ID,
        requestBody: event
    }, function (err, event) {
        if (err) {
            console.log('There was an error contacting the Calendar service: ' + err);
            return;
        }
        console.log('Event created: %s', event?.data.summary);
    });
}