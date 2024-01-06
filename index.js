const express = require('express');
const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
const cors = require('cors');
const mongoose = require('mongoose')
const productSchema = require('./product.js')
const Image = require('./image.js');
const { ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors())

const uri = process.env.MONGO_URI;
const calendarId = process.env.CALENDAR_ID;
mongoose.connect(uri);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
  console.log('Connected to the database successfully');
});

  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/calendar',
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });

const calendar = google.calendar({ version: 'v3', auth });

const product = db.model("product", productSchema);

try {
  app.listen(3000, () =>  {
    console.log('Server running on port 3000')
  });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}


async function listEvents(firstDayOfMonth, firstDayOfNextMonth) {
  try{
  let uniqueDates = [];
  const res = await calendar.events.list({
    calendarId: calendarId,
    timeMin: firstDayOfMonth,
    timeMax: firstDayOfNextMonth,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = res.data.items;
  const allDays = [];
  const currentDate = new Date();
  const currentTime = currentDate.getTime();
  events.map((event) => {
    if (event.start.date) {
      return
    } else if (event.start.dateTime) {
      let eventDate = new Date(event.start.dateTime);
      const eventTime = eventDate.getTime();
      if(eventTime < currentTime){
        return;
      }
      let availableDay = {
        date: event.start.dateTime.slice(8, 10),
        summary: event.summary
      }
      allDays.push(availableDay)
    }
  })
  let previousDay;
  let previousEvent;
  let availableDays = allDays.filter((day) => {
    if (previousDay === day.date && day.summary === 'Closed' && previousEvent === 'Closed') {
      return day;
    }
    if (previousDay === day.date && day.summary != 'Fully booked.' && day.summary != 'Closed') {
      return day;
    }
    previousDay = day.date;
    previousEvent = day.summary;
  })
  uniqueDates = new Set(availableDays.map(day => day.date));

  return uniqueDates;}
  catch (error) {
    console.error('Failed to list events:', error);
    throw error;
  }
}
let month;
let year;
app.post('/events', async (req, res) => {
  try{
  let currentDate = JSON.parse(req.body.currentDate); //parse data from request body
  const inputDate = new Date(currentDate);
  month = inputDate.getMonth(); //get month and year from requested date
  year = inputDate.getFullYear();
  const firstDayOfMonth = new Date(year, month, 1); //create date object for first day of month
  const weekdayOfFirstDay = firstDayOfMonth.getDay(); //get weekday of first day of month
  const nextMonth = (month + 1) % 12; //get month of next month
  const nextMonthYear = year + Math.floor((month + 1) / 12); //get year of next month to handle year changes
  const firstDayOfNextMonth = new Date(nextMonthYear, nextMonth, 1); //create date object for first day of next month
  const lastDayOfThisMonth = new Date(nextMonthYear, nextMonth, 0) //create date object for last day of this month
  const daysInMonth = lastDayOfThisMonth.getDate(); //get number of days in this month
  const uniqueDates = await listEvents(firstDayOfMonth.toISOString(), 
    firstDayOfNextMonth.toISOString()).catch(console.error); //get all events from all days in this month
  const monthInfo = { //create object to send to client with all relevant data
    weekdayOfFirstDay: weekdayOfFirstDay,
    firstDayOfNextMonth: firstDayOfNextMonth,
    daysInMonth: daysInMonth,
    availableDays: [...uniqueDates]
  };
  res.send(monthInfo)}catch (error) { //send object to client
    console.error('Failed to post event:', error);
    res.status(500).send({error: 'Failed to post event.'});
  }
})

app.get('/events/:dayNumber', async (req, res) => {
  try{
  const response = await getDayEvents(req.params.dayNumber);
  const blockedTimes = [];
  response.forEach(event => {
    let eventStart = event.start.dateTime.slice(11, 13)
    let eventStop = event.end.dateTime.slice(11, 13)
    const eventDetails = {
      start: parseInt(eventStart, 10),
      stop: parseInt(eventStop, 10)
    }
    blockedTimes.push(eventDetails)
  })
  res.send(blockedTimes)}
  catch (error) {
    console.error('Failed to get events for day:', error);
    res.status(500).send({error: 'Failed to get events for day.'});
  }
})

app.post('/events/:dayISOString', async (req, res) => {
    try{
      const chosenDay = req.params.dayISOString.slice(0, 11);
  let chosenTimeString;
  if (req.body.time < 10) {
    chosenTimeString = chosenDay + '0' + req.body.time + ':00:00'
  }
  else { chosenTimeString = chosenDay + req.body.time + ':00:00' }
  let endingHour = parseInt(req.body.time) + 1;
  let endingTimeString;
  if (endingHour < 10) {
    endingTimeString = chosenDay + '0' + endingHour + ':00:00'
  }
  else { endingTimeString = chosenDay + endingHour + ':00:00' }
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

  await insertEvent(eventData).then(res.sendStatus(200))}catch (error) {
    console.error('Failed to post event for day:', error);
    res.status(500).send({error: 'Failed to post event for day.'});
  }
})

async function insertEvent(eventData) {
  try{
  const response = await calendar.events.insert({
    calendarId: calendarId,
    resource: eventData
  })
  return response
}catch (error) {
  console.error('Failed to insert event:', error);
  throw error;
}
}

async function getDayEvents(requestedDay) {
  try {
    let requestedDateStart = new Date(year, month, requestedDay, 0)
    let requestedDateEnd = new Date(year, month, requestedDay, 24)
    const res = await calendar.events.list({
      calendarId: calendarId,
      timeMin: requestedDateStart.toISOString(),
      timeMax: requestedDateEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    const events = res.data.items;
    const bookedEvents = events.filter(event => {
      if (event.summary != 'Closed') {
        return event
      }
    })
    return bookedEvents
  }
  catch (error) {
    console.error('Failed to get day events:', error);
    throw error;
  }
}

app.get('/products', async (req, res) => {
  try {
    const products = await product.find();
    if (products) {
      res.send(products)
    }
    else res.send({ error: 'Products could not be retrieved.' })
  } catch (error) {
    console.error('Failed to get products:', error);
    res.status(500).send({ error: 'Failed to get products.' });
  }
})

app.get('/products/:imageId', async (req, res) => {
  try {
    const hexObjectId = req.params.imageId.toString('hex')
    const requestedImage = await Image.findOne({ _id: new ObjectId(hexObjectId) })
    if (requestedImage) {
      res.send(requestedImage.data)
    } else {
      console.log('something went wrong')
      res.status(500).send({ error: 'Failed to get image.' });
    }
  } catch (error) {
    console.error('Failed to get image:', error);
    res.status(500).send({ error: 'Failed to get image.' });
  }
})