let monthInfo;
let trackedDate = new Date();
let selectedDate;
async function fetchEvents(currentDate){
  const jsonDate = JSON.stringify(currentDate)
  const response = await fetch('http://localhost:3000/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currentDate : jsonDate
    }),
  });
  const data = await response.json();
  monthInfo = data;
  return response;
}

const createCalendar = () => {
  availableDays = monthInfo.availableDays.map((str) => {
    return parseInt(str, 10);
  })
  let currentRow = 3;
  let column = monthInfo.weekdayOfFirstDay
  const placeholder = document.getElementById('placeholder')
  for(let i = 0; i < column; i++){
    let newSpan = document.createElement('span');
    newSpan.classList.add('row-3');
    newSpan.classList.add('column-' + i);
    placeholder.insertAdjacentElement('afterend', newSpan);
  }
  for (let i = 1; i <= monthInfo.daysInMonth; i++){
    let newSpan = document.createElement('span');
    if(column == 7){
      currentRow++;
    }
    if (column > 7){
      column = column % 7;
    }
    column++;
    newSpan.classList.add('row-' + currentRow)
    newSpan.classList.add('column-' + column)
    newSpan.innerText = i;
    if(availableDays.includes(i)){
      newSpan.classList.add('open')
    }else{newSpan.classList.add('closed')}
    placeholder.insertAdjacentElement('afterend', newSpan)
  }
  if(column == 8){
    column = 2;
  }
  for(let i = column; i < 8; i++){
    let newSpan = document.createElement('span');
    newSpan.classList.add('row-' + currentRow);
    newSpan.classList.add('column-' + i);
    document.getElementById('placeholder').insertAdjacentElement('afterend', newSpan);
  }
}

const forwardOneMonth = async () => {
  const placeholder = document.getElementById('placeholder')
  let span = placeholder.nextElementSibling;

while (span !== null && span.tagName === 'SPAN') {
  const nextSpan = span.nextElementSibling;
  placeholder.parentNode.removeChild(span);
  span = nextSpan;
}
  trackedDate.setMonth(trackedDate.getMonth() + 1, 1)
  fetchAndCreateCalendar()
}

const backOneMonth = async () => {
  const placeholder = document.getElementById('placeholder')
  let span = placeholder.nextElementSibling;

while (span !== null && span.tagName === 'SPAN') {
  const nextSpan = span.nextElementSibling;
  placeholder.parentNode.removeChild(span);
  span = nextSpan;
}
  trackedDate.setMonth(trackedDate.getMonth() - 1, 1)
  fetchAndCreateCalendar()
}

const fetchAndCreateCalendar = async () => {
  document.getElementById('month-heading').innerText = trackedDate.toLocaleString('default', { month: 'long' });
  await fetchEvents(trackedDate);
  createCalendar();
  const openDays = document.getElementsByClassName('open');
  Array.from(openDays).forEach(element => {
    element.addEventListener('click', createBookingForm);
  });
  document.getElementById('close-dialog').addEventListener('click', closeBookingForm)
}

window.onload = function() {
  fetchAndCreateCalendar();
};

let forwardButton = document.getElementById('forward-button')
forwardButton.addEventListener('click', forwardOneMonth);
let backButton = document.getElementById('back-button')
backButton.addEventListener('click', backOneMonth)

const createBookingForm = async (event) => {
  selectedDate = new Date(trackedDate.getFullYear(), trackedDate.getMonth(), event.target.innerText)
  let blockedTimes;
  const fetchURL = 'http://localhost:3000/events/' + event.target.innerText
  await fetch(fetchURL).then(response => response.json()).then(data => blockedTimes = data);

  const timeSelector = document.getElementById('time-selector');
  // Clear the existing content of the modal
  timeSelector.innerHTML = '';
  // Re-populate the modal with the original set of time slots
  for (let i = 8; i <= 17; i++) {
    const option = document.createElement('option');
    option.id = i;
    option.value = i;
    option.textContent = i + ':00 - ' + (i + 1) + ':00';
    timeSelector.appendChild(option);
  }

  if (blockedTimes.length > 0) {
    const timeslots = timeSelector.children;
    blockedTimes.forEach((time) => {
      Array.from(timeslots).forEach(element => {
        if (time.start == element.id || (time.stop - 1) == element.id) {
          timeSelector.removeChild(element);
        }
      });
    });
  }

  const dialog = document.getElementById('booking-dialog')

  dialog.showModal();
}

const closeBookingForm = () =>{
  const dialog = document.getElementById('booking-dialog')
  dialog.close()
}

async function handleSubmit(event){
  event.preventDefault();

  const service = document.getElementById('service-dropdown').value;
  const time = document.getElementById('time-selector').value;
  const name = document.getElementById('name-input').value;
  const phone = document.getElementById('phone-input').value;

  const formData = {
    service: service,
    time: time,
    name: name,
    phone: phone
  };

  const fetchURL = 'http://localhost:3000/events/' + selectedDate.toISOString();
  let res = await fetch(fetchURL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(formData)
})
if(res.status === 200){
  showSuccessMessage()
}else console.log('Fatal error')
}

const submitButton = document.getElementById('submit-button');
submitButton.addEventListener('click', handleSubmit);

function showSuccessMessage() {
  const successMessage = document.getElementById('success-message');
  successMessage.classList.remove('hidden')
  successMessage.style.display = 'block';
  successMessage.classList.add('animate__fadeInDown');
  setTimeout(() => {
    successMessage.classList.add('animate__fadeOutUp');
    setTimeout(() => {
      successMessage.style.display = 'none';
      successMessage.classList.remove('animate__fadeInDown', 'animate__fadeOutUp');
      setTimeout(() => {
        location.reload(); // Reload the page after 1500 milliseconds (1500 seconds)
      }, 750);
    }, 500);
  }, 1500);
}

const form = document.getElementById("booking-form");

form.addEventListener("submit", function(event) {
  if (!form.checkValidity()) {
    event.preventDefault();
    // Display an error message or perform any other action
  }
});