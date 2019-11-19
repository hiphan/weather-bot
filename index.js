'use strict'; 

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const CURRENT_LOCATION = "CURRENT_LOCATION";
const ENTER_LOCATION = "ENTER_LOCATION";
const CORRECT_LOCATION = "CORRECT_LOCATION";
const WRONG_LOCATION = "WRONG_LOCATION"

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
			entry.messaging.forEach((webhook_event) => {

				console.log(webhook_event);

				let sender_psid = webhook_event.sender.id;
				console.log('Sender ID: ' + sender_psid);

				if (webhook_event.message) {
					if (sender_psid != 113133066796857) {
						handleMessage(sender_psid, webhook_event.message);
					}
				} else if (webhook_event.postback) {
					handlePostback(sender_psid, webhook_event.postback);		
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

			console.log('Webhook verifed.');
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
			"payload": "GET_STARTED"
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

function handleMessage(sender_psid, received_message) {

	let response;

	if (received_message.text) {

		const address = received_message.text;
		console.log("This is the address: " + address);

		if (validateZipCode(address)) {

			// user provides a zip code
			console.log("Received a zip code.");

			request({
				"uri": "https://maps.googleapis.com/maps/api/geocode/json?",
				"qs": {
					"address": address, 
					"key": GOOGLE_API_KEY 
				},
				"method": "GET"
			}, (err, res, body) => {

				const bodyObj = JSON.parse(body);
				const locationStatus = bodyObj.status;

				if (locationStatus === "OK") {

					const formattedAddress = bodyObj.results[0].formatted_address;
					console.log("Formatted address: " + formattedAddress);

					response = {
						"attachment": {
							"type": "template",
							"payload": {
								"template_type": "button",
								"text": `You are in ${formattedAddress}. Is this correct?`,
								"buttons": [
									{
										"type": "postback",
										"title": "Yes!",
										"payload": CORRECT_LOCATION
									}, 
									{
										"type": "postback",
										"title": "No!",
										"payload": WRONG_LOCATION
									}
								]
							}
						}
					}

				} else {

					response = {
						"text": "An error occured."
					}

				}

			});

		} else {

			// user provides an address
			console.log("Received an address.");

			request({
				"uri": "https://maps.googleapis.com/maps/api/geocode/json?",
				"qs": {
					"address": address,
					"key": GOOGLE_API_KEY
				},
				"method": "GET"
			}, (err, res, body) => {

				const bodyObj = JSON.parse(body);
				const locationStatus = bodyObj.status;

				if (locationStatus === "OK") { 

					const formattedAddress = bodyObj.results[0].formatted_address;
					console.log("Formatted address: " + formattedAddress);
					console.log("1");
					response = {
						"attachment": {
							"type": "template",
							"payload": {
								"template_type": "button",
								"text": `You are in ${formattedAddress}. Is this correct?`,
								"buttons": [
									{
										"type": "postback",
										"title": "Yes!",
										"payload": CORRECT_LOCATION
									}, 
									{
										"type": "postback",
										"title": "No!",
										"payload": WRONG_LOCATION
									}
								]
							}
						}
					}

				} else {

					response = {
						"text": "An error occured."
					}

				}
			});

		}
	} 

	console.log(response);
	callSendAPI(sender_psid, response);
}

function handlePostback(sender_psid, received_postback) {

	console.log("Handling postback...");
	const payload = received_postback.payload;
	let response; 

	switch(payload) 
	{
		case "qr":
			handleGetStartedPostback(sender_psid, received_postback);
			break;

		case CURRENT_LOCATION:
			requestCurrentLocation(sender_psid, received_postback);
			break;

		case ENTER_LOCATION:
			requestNewLocation(sender_psid, received_postback);
			break; 

		default: 
			console.log("Missing logic...");
	}

}

function handleGetStartedPostback(sender_psid, received_postback) {

	console.log("Handling GS postback...");

	request({
		"uri": `https://graph.facebook.com/v2.6/${sender_psid}`,
		"qs": { 
			"access_token": PAGE_ACCESS_TOKEN,
			"fields": "first_name"
		},
		"method": "GET",
	}, (err, res, body) => {

		let response;
		let greeting = "";

		if (!err) {

			const bodyObj = JSON.parse(body);
			const first_name = bodyObj.first_name;
			greeting = "Hello " + first_name + "! ";

		} else {

			console.log("Cannot get first name.");

		} 

		const message = greeting + "Welcome to Weather Bot...";
		response = {
			"text": message,
		};

		callSendAPI(sender_psid, response);
		requestLocation(sender_psid);

	});

}

function requestCurrentLocation(sender_psid, received_postback) {

	// Since location quick reply is deprecated, this will call hanldNewLocation
	requestNewLocation(sender_psid, received_postback);

}

function requestNewLocation(sender_psid, received_postback) {

	const response = {
		"text": "Please enter your zip code or address :)"
	}

	callSendAPI(sender_psid, response);

}

function requestLocation(sender_psid) {
	let response = {
		"attachment": {
			"type": "template",
			"payload": {
				"template_type": "button", 
				"text": "Would you like to use your current location or enter a location?",
				"buttons": [
					{
						"type": "postback", 
						"title": "Current location",
						"payload": CURRENT_LOCATION
					}, 
					{
						"type": "postback",
						"title": "New location",
						"payload": ENTER_LOCATION
					}
				] 
			}
		}
	}
	callSendAPI(sender_psid, response);
}

function callSendAPI(sender_psid, response) {
	console.log("2");

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

function validateZipCode(zip) {
	const regex = RegExp('^[0-9]{5}(?:-[0-9]{4})?$');
	return regex.test(zip);
}