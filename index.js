'use strict'; 

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GET_STARTED = "GET_STARTED"

const 
	request = require('request'),
	express = require('express'),
	bodyParser = require('body-parser'),
	app = express().use(bodyParser.json());

app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

app.post('/webhook', (req, res) => {

	let body = req.body;

	if (body.object == 'page') {

		body.entry.forEach(function(entry) {
			entry.messaging.forEach(function(webhook_event) {
				console.log(webhook_event);

				let sender_psid = webhook_event.sender.id;
				let sender_first_name = webhook_event.sender.fist_name;
				console.log('Sender ID: ' + sender_psid);

				if (webhook_event.message) {
					handleMessage(sender_psid, webhook_event.message);
				} else if (webhook_event.postback) {
					if (webhook_event.postback.payload == GET_STARTED) {
						handleGetStartedPostback(sender_psid, sender_first_name);
					} else {
						handleGetStartedPostback(sender_psid, sender_first_name);
					}
				}
			});
		});

	res.status(200).send('EVENT_RECEIVED');

	} else {

		res.sendStatus(404);

	}

});

app.get('/webhook', (req, res) => {

	const VERIFY_TOKEN = process.env.VERIFICATION_TOKEN;

	let mode = req.query['hub.mode'];
	let token = req.query['hub.verify_token'];
	let challenge = req.query['hub.challenge'];

	if (mode && token) {

		if (mode == 'subscribe' && token == VERIFY_TOKEN) {

			console.log('WEBHOOK_VERIFIED');
			res.status(200).send(challenge);

		} else {

			res.sendStatus(403);

		}

	}
});

app.get('/setup', (req, res) => {

	setupGetStarted(res);

})

function setupGetStarted(res) { 
	let start_body = { 
		"get_started": {
			"payload": GET_STARTED
		}
	}

	request({
		"uri": "https://graph.facebook.com/v2.6/me/messages",
		"qs": { "access_token": PAGE_ACCESS_TOKEN },
		"method": "POST",
		"json": start_body
	}, (err, res, body) => {
		if (!err) {
			console.log("Got starting button!")
		} else {
			console.log("Unable to get starting button: " + err);
		}
	})
}

function handleGetStartedPostback(sender_psid, sender_first_name) {
	let response = "Hello ${sender_first_name} (dumbass!). Welcome to Weather Bot!";

	callSendAPI(sender_psid, response);
}

function handleMessage(sender_psid, received_message) {
	let response;

	if (received_message.text) {
		response = {
			"text": "Hello this is a response from WB."
		}
	}

	callSendAPI(sender_psid, response);
}

function handlePostback(sender_psid, received_postback) {

}

function callSendAPI(sender_psid, response) {

	let request_body = {
	    "recipient": {
	      "id": sender_psid
	    },
	    "message": response
	}

	request({
		"uri": "https://graph.facebook.com/v2.6/me/messages",
	    "qs": { "access_token": PAGE_ACCESS_TOKEN },
	    "method": "POST",
	    "json": request_body
	}, (err, res, body) => {
	    if (!err) {
	      console.log('Message sent!')
	    } else {
	      console.error("Unable to send message:" + err);
	    }
  	}); 
}