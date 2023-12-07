const express = require('express');
const fs = require('fs').promises;
const fileSystem = require('fs')
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const cors = require('cors');
const mongoose = require('mongoose')
const productSchema = require('./product.js')
const Image = require('./image.js');
const { ObjectId } = require('mongodb');

const app = express();
app.use(express.json());
app.use(cors())

const uri = "mongodb+srv://base216ball:Guitar1046@cluster0.q2c72yq.mongodb.net/BlackStallionSalon?retryWrites=true&w=majority"
mongoose.connect(uri);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('Connected to the database successfully');
});


const product = db.model("product", productSchema);

app.listen(3000, () =>  {
    console.log('Server running on port 3000')
});

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

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
    type: 'authorized_user',
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

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */

let uniqueDates =[];
async function listEvents(auth, firstDayOfMonth, firstDayOfNextMonth) {
  const calendar = google.calendar({version: 'v3', auth});
  const res = await calendar.events.list({
    calendarId: '52376e42b65c7405be17210acb6b4c18f0bdcb7e9750ba34ec11aa12a1636e1c@group.calendar.google.com',
    timeMin: firstDayOfMonth,
    timeMax: firstDayOfNextMonth,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = res.data.items;
  const allDays = []
  events.map((event) => {
    if(event.start.date){
      return
    }else if (event.start.dateTime){
      let availableDay = {
        date : event.start.dateTime.slice(8, 10),
        summary : event.summary
      }
      allDays.push(availableDay)
    }})
    let previousDay;
    let previousEvent;
    let availableDays = allDays.filter((day) => {
      if(previousDay === day.date && day.summary === 'Closed' && previousEvent === 'Closed'){
        return day;
      }
      if(previousDay === day.date && day.summary != 'Fully booked.' && day.summary != 'Closed'){
        return day;
      }
      previousDay = day.date;
      previousEvent = day.summary;
    })
    uniqueDates = new Set(availableDays.map(day => day.date));
}
let month;
let year;
app.post('/events', async (req ,res) => {
  let currentDate = JSON.parse(req.body.currentDate);
  const inputDate = new Date(currentDate);
  month = inputDate.getMonth();
  year = inputDate.getFullYear();
  const firstDayOfMonth = new Date(year, month, 1);
  const weekdayOfFirstDay = firstDayOfMonth.getDay();
  const nextMonth = (month + 1) % 12;
  const nextMonthYear = year + Math.floor((month + 1) / 12);
  const firstDayOfNextMonth = new Date(nextMonthYear, nextMonth, 1);
  const lastDayOfThisMonth = new Date(nextMonthYear, nextMonth, 0)
  const daysInMonth = lastDayOfThisMonth.getDate();
  await authorize().then((auth) => listEvents(auth, firstDayOfMonth.toISOString(), 
  firstDayOfNextMonth.toISOString())).catch(console.error);
  const monthInfo = {
    weekdayOfFirstDay : weekdayOfFirstDay,
    firstDayOfNextMonth : firstDayOfNextMonth,
    daysInMonth : daysInMonth,
    availableDays : [...uniqueDates]
};
  res.send(monthInfo)
})

app.get('/events/:dayNumber', async (req, res) => {
  const response = await authorize().then((auth) => getDayEvents(auth, req.params.dayNumber))
  const blockedTimes = [];
  response.forEach(event => {
    let eventStart = event.start.dateTime.slice(11,13)
    let eventStop = event.end.dateTime.slice(11,13)
    const eventDetails = {
      start : parseInt(eventStart, 10),
      stop: parseInt(eventStop, 10)
    }
    blockedTimes.push(eventDetails)
  })
  res.send(blockedTimes)
})

app.post('/events/:dayISOString', async (req, res)=> {
  const chosenDay = req.params.dayISOString.slice(0, 11);
  let chosenTimeString;
  if(req.body.time < 10){
    chosenTimeString = chosenDay + '0' + req.body.time + ':00:00'
  }
  else {chosenTimeString = chosenDay + req.body.time + ':00:00'}
  let endingHour = parseInt(req.body.time) + 1;
  let endingTimeString;
  if(endingHour < 10){
    endingTimeString = chosenDay + '0' + endingHour + ':00:00'
  }
  else {endingTimeString = chosenDay + endingHour + ':00:00'}
  // Data for the new event
const eventData = {
  summary: req.body.name + "'s " + req.body.service,
  description: req.body.name + ' ' + req.body.service + ' ' + req.body.phone,
  start: {
    dateTime: chosenTimeString,
    timeZone: 'America/Los_Angeles'
  },
  end: {
    dateTime: endingTimeString,
    timeZone: 'America/Los_Angeles'
  }
};

await authorize().then(auth => insertEvent(auth, eventData)).then(res.sendStatus(200))  
})

async function insertEvent(auth, eventData){
  const calendar = google.calendar({version: 'v3', auth});
// Make a POST request to the Google Calendar API
const response = await calendar.events.insert({
  calendarId: '52376e42b65c7405be17210acb6b4c18f0bdcb7e9750ba34ec11aa12a1636e1c@group.calendar.google.com',
  resource: eventData
})
return response
}

async function getDayEvents(auth, requestedDay) {
  let requestedDateStart = new Date(year, month, requestedDay, 0)
  let requestedDateEnd = new Date(year, month, requestedDay, 24)
  const calendar = google.calendar({version: 'v3', auth});
  const res = await calendar.events.list({
    calendarId: '52376e42b65c7405be17210acb6b4c18f0bdcb7e9750ba34ec11aa12a1636e1c@group.calendar.google.com',
    timeMin: requestedDateStart.toISOString(),
    timeMax: requestedDateEnd.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = res.data.items;
const bookedEvents = events.filter(event => {
  if(event.summary != 'Closed'){
    return event
  }
})
return bookedEvents}

app.get('/products', async (req, res) => {
  const products = await product.find();
  if(products){
    res.send(products)
  }
  else res.send({error : 'Products could not be retrieved.'})
})

app.get('/products/:imageId', async (req, res) => {
  const hexObjectId = req.params.imageId.toString('hex')
  const requestedImage = await Image.findOne({_id : new ObjectId(hexObjectId)})
  if(requestedImage){
    res.send(requestedImage.data)
  } else console.log('something went wrong')
})
