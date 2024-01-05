/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const {authenticate} = require("@google-cloud/local-auth");
const {google} = require("googleapis");
// const {onRequest} = require("firebase-functions/v2/https");
// const logger = require("firebase-functions/logger");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/calendar"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}
let uniqueDates =[];
/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {String} firstDayOfMonth the first day of month.
 * @param {String} firstDayOfNextMonth the first day of next month.
 */
async function listEvents(auth, firstDayOfMonth, firstDayOfNextMonth) {
  const calendar = google.calendar({version: "v3", auth});
  const res = await calendar.events.list({
    calendarId:
"52376e42b65c7405be17210acb6b4c18f0bdcb7e9750ba34" +
"ec11aa12a1636e1c@group.calendar.google.com",
    timeMin: firstDayOfMonth,
    timeMax: firstDayOfNextMonth,
    singleEvents: true,
    orderBy: "startTime",
  });
  const events = res.data.items;
  const allDays = [];
  events.map((event) => {
    if (event.start.date) {
      return;
    } else if (event.start.dateTime) {
      const availableDay = {
        date: event.start.dateTime.slice(8, 10),
        summary: event.summary,
      };
      allDays.push(availableDay);
    }
  });
  let previousDay;
  let previousEvent;
  const availableDays = allDays.filter((day) => {
    if (previousDay === day.date &&
        day.summary === "Closed" && previousEvent === "Closed") {
      return day;
    }
    if (previousDay === day.date &&
        day.summary != "Fully booked." && day.summary != "Closed") {
      return day;
    }
    previousDay = day.date;
    previousEvent = day.summary;
  });
  uniqueDates = new Set(availableDays.map((day) => day.date));
}

const functions = require("firebase-functions");

let month;
let year;
exports.calculateMonthInfo = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const currentDate = req.body.currentDate;
    const inputDate = new Date(currentDate);
    month = inputDate.getMonth();
    year = inputDate.getFullYear();
    const firstDayOfMonth = new Date(year, month, 1);
    const weekdayOfFirstDay = firstDayOfMonth.getDay();
    const nextMonth = (month + 1) % 12;
    const nextMonthYear = year + Math.floor((month + 1) / 12);
    const firstDayOfNextMonth = new Date(nextMonthYear, nextMonth, 1);
    const lastDayOfThisMonth = new Date(nextMonthYear, nextMonth, 0);
    const daysInMonth = lastDayOfThisMonth.getDate();
    await authorize().then((auth) =>
      listEvents(auth, firstDayOfMonth.toISOString(),
          firstDayOfNextMonth.toISOString())).catch(console.error);
    const monthInfo = {
      weekdayOfFirstDay: weekdayOfFirstDay,
      firstDayOfNextMonth: firstDayOfNextMonth,
      daysInMonth: daysInMonth,
      availableDays: [...uniqueDates],
    };
    return res.status(200).json(monthInfo);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
});
