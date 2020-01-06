# Compound Protocol Interest Alert System

A borrower interest rate monitor for the [Compound Protocol](https://compound.finance/). An AWS Lambda Function alerts the user via text message and email when the borrower interest rates go over their selected threshold. Interest rates rise and fall autonomously, based on supply and demand of assets in the market.

## What is Compound?
Compound is an open-source, autonomous protocol built for developers, to unlock a universe of new financial applications. Interest and borrowing, for the open financial system.

<a href="https://compound.finance/?ref=github&user=ajb413&repo=compound-interest-alerts">
    <img alt="Compound Finance" src="https://raw.githubusercontent.com/ajb413/compound-interest-alerts/master/compound-finance-logo.png" width=260 height=60/>
</a>

## How This Works
An AWS Lambda Function runs every 15 minutes using the cron scheduler. 
It checks the current interest rate for borrowers ([Borrow Rate](https://compound.finance/developers/ctokens#borrow-rate)) for each asset in the Compound Protocol by using Compound's API. It then checks the rates against your pre-defined thresholds (my-limits.json). If they are exceeded, the Lambda triggers an email ([SendGrid](https://sendgrid.com/)) and text message ([Twilio](https://www.twilio.com/)) to the user.

This script does not access the blockchain directly. That functionality will be added later.

## Requirements
- [AWS](https://aws.amazon.com/) Account
- [Twilio](https://www.twilio.com/) Account
- [SendGrid](https://sendgrid.com/) Account

## Installation
- Make an AWS, Twilio, and SendGrid account if you haven't already.
- Create a Lambda Function in the AWS console, in any region, with Node.js (12 or later) as the runtime.
- Set the following environment variables for the Lambda Function:
  - `twilio_sid` Twilio Account SID
  - `twilio_auth_token` Twilio Auth Token
  - `sendgrid_key` Sendgrid API Key
  - `sms_from_number` Phone number that your Twilio account sends SMSs from.
  - `sms_to_number` Your phone number.
  - `to_email` Your email address.
  - `from_email` Email that your SendGrid account sends emails from.
- Create `index.js` and `my-limits.json` in the Lambda editor.
- Copy the contents of the files over. Set your alert limits in the JSON file as percentages.
- Set a CloudWatch Event that executes the function every 15 minutes `rate(15 minutes)` which is similar to cron from Unix.
- Click the test button at the top of the page to test the function. Once you are ready, click Actions, and Publish a new version.

