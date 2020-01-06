const fs = require('fs');
const https = require('https');
const querystring = require('querystring');
const myLimits = require('./my-limits.json');
const alertThreshold = 7200000; // 2 hours in MS
const ok = { statusCode: 200 };
let lastAlertTime;

// Be sure to set the following as environment variables in AWS Lambda
// twilio_sid
// twilio_auth_token
// sendgrid_key
// sms_from_number
// sms_to_number
// to_email
// from_email

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 5000 }, (res) => {
      let body = '';

      res.on('data', function(chunk){
          body += chunk;
      });

      res.on('end', function(){
          const respose = JSON.parse(body);
          resolve(respose);
      });
    }).on('error', (e) => {
      const err = `Error: ${url}, ${e}`;
      reject(err);
    });
  });
}

// Text Message - Twilio
const sendTextMessage = (updates) => {
  return new Promise((resolve, reject) => {
    console.log('Sending SMS...');

    const id = process.env.twilio_sid;
    const key = process.env.twilio_auth_token;

    const smsBody = 
      `Compound Protocol Borrower Interest Rate Alert\n` + 
      `${updates}`;

    const headers = { 
      'Authorization': 'Basic ' + Buffer.from(`${id+':'+key}`).toString('base64'),
      'Content-Type':'application/x-www-form-urlencoded'
    };

    const params = querystring.stringify({
      Body: smsBody,
      From: process.env.sms_from_number,
      To: process.env.sms_to_number,
    });

    let twilioApiPath = `/2010-04-01/Accounts/${id}/Messages.json`;

    const options = {
      timeout: 3000,
      hostname: 'api.twilio.com',
      port: 443,
      path: twilioApiPath,
      method: 'POST',
      headers: headers
    };

    const req = https.request(options, (res) => {
      console.log('SMS Request Callback');
      const chunks = [];

      res.on('data', function (chunk) {
        chunks.push(chunk);
      });

      res.on('end', function () {
        console.log('SMS Request End');
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error('SMS Error: ', e.statusCode, e.statusMessage);
      reject();
    });

    req.write(params);
    req.end();
  });
};

// Text Message - SendGrid
function sendEmail(updates='') {
  return new Promise((resolve, reject) => {
    console.log('Sending Email...');

    const emailBody = 
      `<p>Compound Protocol Borrower Interest Rate Alert</p>` + 
      `<p>${updates}</p>`;

    const headers = { 
      'Authorization': 'Bearer ' + process.env.sendgrid_key,
      'Content-Type': 'application/json'
    };

    const body = {
      'personalizations': [
        {
          'to': [ { email: process.env.to_email } ],
          'subject': `Compound Protocol Borrower Interest Rate Alert`
        },
      ],
      'from': {
        'email': process.env.from_email,
        'name': 'Alerting & Monitoring'
      },
      'content': [{
        'type': 'text/html',
        'value': emailBody
      }]
    };

    const options = {
      timeout: 3000,
      hostname: 'api.sendgrid.com',
      port: 443,
      path: '/v3/mail/send',
      method: 'POST',
      headers: headers
    };

    const req = https.request(options, (res) => {
      console.log('Email Request Callback');
      const chunks = [];

      res.on('data', function (chunk) {
        chunks.push(chunk);
      });

      res.on('end', function () {
        console.log('Email Request End');
        let responseBody = Buffer.concat(chunks);
        if (responseBody) {
          console.error('Email Error: ', responseBody.toString());
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error('Email Error: ', e.statusCode, e.statusMessage);
      reject();
    });

    req.write(JSON.stringify(body));
    req.end();
  });
}

async function getCurrentBorrowRates() {
  const result = {};

  const cTokens = await get('https://api.compound.finance/api/v2/ctoken');

  cTokens.cToken.forEach((tok) => {
    result[tok.underlying_name] = +(+tok.borrow_rate.value * 100).toFixed(2);
  });

  return result;
}

function findExceedingBorrowRates(rates) {
  const result = [];

  for (let token in myLimits) {
    if (rates[token] && rates[token] > myLimits[token]) {
      result.push(token);
    }
  }

  return result;
}

function findMsSinceLastAlert(isoString) {
  const lastAlertTs = new Date(isoString).getTime();
  const nowTs = new Date().getTime();

  return nowTs - lastAlertTs;
}

function saveAlertTime(jsObject={}) {
  return new Promise((resolve, reject) => {
    fs.writeFile('/tmp/tmp.json', JSON.stringify(jsObject), function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
    });
  });
}

async function sendAlerts(exceedingTokens, rates) {
  let messageBody = '';

  exceedingTokens.forEach((token) => {
    messageBody += `The ${token} borrower interest rate ` +
      `(currently ${rates[token]}%) has exceeded your ` +
      `threshold of ${myLimits[token]}%. `;
  });

  await sendEmail(messageBody);
  await sendTextMessage(messageBody);

  await saveAlertTime({
    last_alert_time: new Date().toISOString()
  });

  return ok;
}

exports.handler = async (event) => {
  let tmp;
  try {
    tmp = require('/tmp/tmp.json');
  } catch(e) {
    tmp = {};
  }

  lastAlertTime = tmp.last_alert_time || "2020-01-01T00:00:00.000Z";

  const rates = await getCurrentBorrowRates();
  const exceedingTokens = findExceedingBorrowRates(rates);
  const msSinceLastAlert = findMsSinceLastAlert(lastAlertTime);

  console.log(rates);

  if (
    exceedingTokens.length > 0 &&
    alertThreshold < msSinceLastAlert
  ) {
    return sendAlerts(exceedingTokens, rates);
  } else {
    console.log('no alert sent');
    return ok;
  }
};
