'use strict'; 

const MONGODB_URI = process.env.MONGODB_URI;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const PREVIOUS_LOCATION = 'PREVIOUS_LOCATION';
const ENTER_LOCATION = 'ENTER_LOCATION';
const CORRECT_LOCATION = 'CORRECT_LOCATION';
const WRONG_LOCATION = 'WRONG_LOCATION';
const START_NEW = "START_NEW";
const START_OVER = "START_OVER";

const 
	request = require('request'),
	express = require('express'),
	mongoose = require('mongoose'),
	bodyParser = require('body-parser'),
	User = require('./models/user'),
	app = express().use(bodyParser.json());

mongoose.set('useCreateIndex', true);
mongoose.connect(MONGODB_URI, 
	{	
		dbName: 'weather_bot',
		useUnifiedTopology: true,
		useNewUrlParser: true
	});

var db = mongoose.connection;

db.on('error', console.error.bind(console, 'Connection error:'));
db.once('open', function() {
	console.log('Connected to weather_bot DB.');
});

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

	// Assume that the message is an address (either zip code or physical address)

	let response;

	if (received_message.text) {

		const address = received_message.text;

		if (validateZipCode(address)) {

			// user provides a zip code
			console.log("Received a zip code: " + address);

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

					const zip_code = extractZipcode(bodyObj);

					if (zip_code === null) {

						response = {
							"text": "Cannot find your zip code. Please be more specific."
						}

						callSendAPI(sender_psid, response);

					} else {

						const formattedAddress = bodyObj.results[0].formatted_address;
						console.log("Formatted address: " + formattedAddress);	

						const filter = { user_id: sender_psid };
						const update = { last_loc: zip_code };
						const options = { 
							upsert: true,
							new: true };

						User.findOneAndUpdate(filter, update, options).exec((err, cs) => {
							console.log('Update zip code to db: ', cs);
						});

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

						callSendAPI(sender_psid, response);

					}

				} else {

					response = {
						"text": "An error occured. Please re-enter your address."
					}

					callSendAPI(sender_psid, response);

				}

			});

		} else {

			// user provides an address
			console.log("Received an address: " + address);

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

					const zip_code = extractZipcode(bodyObj);

					if (zip_code === null) {

						response = {
							"text": "Cannot find your zip code. Please be more specific."
						}

						callSendAPI(sender_psid, response);

					} else {

						const formattedAddress = bodyObj.results[0].formatted_address;
						console.log("Formatted address: " + formattedAddress);

						const filter = { user_id: sender_psid };
						const update = { last_loc: zip_code };
						const options = { 
							upsert: true,
							new: true };

						User.findOneAndUpdate(filter, update, options).exec((err, cs) => {
							console.log('Update zip code to db: ', cs);
						});

						response = {
							"attachment": {
								"type": "template",
								"payload": {
									"template_type": "button",
									"text": `Is this your location: ${formattedAddress}. Is this correct?`,
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

						callSendAPI(sender_psid, response);

					}

				} else {

					response = {
						"text": "An error occured."
					}

					callSendAPI(sender_psid, response);
				}
			});

		}
	} 
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

		case PREVIOUS_LOCATION:
			handlePreviousLocation(sender_psid, received_postback);
			break;

		case ENTER_LOCATION:
			handleNewLocation(sender_psid, received_postback);
			break; 

		case CORRECT_LOCATION:
			getWeather(sender_psid);
			break;

		case WRONG_LOCATION:
			handleWrongLocationPostback(sender_psid, received_postback);
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

		const message = greeting + "Welcome to Weather Bot!";
		response = {
			"text": message,
		};

		callSendAPI(sender_psid, response);
		requestLocation(sender_psid);

	});

}

function getWeather(sender_psid) {

	console.log("Handling Correct Location Postback.");

	User.findOne({ user_id: sender_psid }, function(dbErr, user) {

		if(!dbErr) {

			const curr_zip = user.last_loc;
			console.log(`Querying for location ${curr_zip}`);
			request({
				"uri": "http://api.openweathermap.org/data/2.5/weather?",
				"qs": {
					"zip": curr_zip,
					"appid": OPENWEATHER_API_KEY
				},
				"method": "GET"

			}, (reqErr, res, body) => {

				if (!reqErr) {

					const bodyObj = JSON.parse(body);
					const name = bodyObj.name;

					const dataTime = new Date(bodyObj.dt * 1000);
					const currTime = new Date(); 
					const timeDifference = (currTime.getTime() - dataTime.getTime()) / 1000;
					const minDifference = Math.round(timeDifference / 60);
					const secDifference = (timeDifference % 60).toFixed(); 

					const description = bodyObj.weather[0].description;
					const icon = bodyObj.weather[0].icon;
					const tempKelvin = bodyObj.main.temp;
					const tempCelcius = (tempKelvin - 273.15).toFixed(2);
					const tempFahrenheit = (tempKelvin * 9 / 5 - 459.67).toFixed(2);

					const responseText = `Weather for ${name}: ${description}. \nTemperature: ${tempCelcius} ${String.fromCharCode(176)}C (${tempFahrenheit} ${String.fromCharCode(176)}F). \nLast updated: ${minDifference} minutes and ${secDifference} seconds ago.`;

					const firstResponse = {
						"text": responseText,
					}
					callSendAPI(sender_psid, firstResponse);

					console.log(`http://openweathermap.org/img/wn/${icon}@2x.png`);
					const secondResponse = {
						"attachment": {
							"type": "image",
							"payload": {
								"url": `http://openweathermap.org/img/wn/${icon}@2x.png`,
								"is_reusable": true
							}
						}
					}
					callSendAPI(sender_psid, secondResponse);

				} else {

					console.log(reqErr);

					const errorResponse = {
						"text": "Cannot get weather information. Please try again later."
					}

					callSendAPI(sender_psid, errorResponse);

				}

			});

		} else {

			console.log(dbErr);

		}

	});

}

function handleWrongLocationPostback(sender_psid, received_postback) {

	console.log("Handling Wrong Location Postback.");

	const response = {
		"text": "Please re-enter your zip code or address :)"
	}

	callSendAPI(sender_psid, response);

}

function handlePreviousLocation(sender_psid, received_postback) {

	console.log("Handling Previous Location Postback.");

	let response;

	User.findOne({ user_id: sender_psid }, function(dbErr, user) {

		if (!dbErr) {

			const curr_zip = user.last_loc;

			request({
				"uri": "https://maps.googleapis.com/maps/api/geocode/json?",
				"qs": {
					"address": curr_zip, 
					"key": GOOGLE_API_KEY 
				},
				"method": "GET"
			}, (reqErr, res, body) => {

				const bodyObj = JSON.parse(body);
				const locationStatus = bodyObj.status;

				if (locationStatus === "OK") {

					const zip_code = extractZipcode(bodyObj);

					const formattedAddress = bodyObj.results[0].formatted_address;
					console.log("Formatted address: " + formattedAddress);	

					const filter = { user_id: sender_psid };
					const update = { last_loc: zip_code };
					const options = { 
						upsert: true,
						new: true };

					User.findOneAndUpdate(filter, update, options).exec((err, cs) => {
						console.log('Update zip code to db: ', cs);
					});

					response = {
						"attachment": {
							"type": "template",
							"payload": {
								"template_type": "button",
								"text": `Your previous location is: ${formattedAddress}. Is this correct?`,
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

					callSendAPI(sender_psid, response);

				} else {

					response = {
						"text": "An error occured. Please re-enter your address."
					}

					callSendAPI(sender_psid, response);

				}

			});

		} else {

			console.log(dbErr);

			response = {
				"text": "Cannot find your previous location. Please enter a new location :)"
			}

			callSendAPI(sender_psid, response);

		}	

	});

}

function handleNewLocation(sender_psid, received_postback) {

	const response = {
		"text": "Please enter your zip code or address :)"
	}

	callSendAPI(sender_psid, response);

}

function handleStartNew(sender_psid, receive_postback) {

}

function handleStartOver(sender_psid, receive_postback) {

}

function requestLocation(sender_psid) {

	const response = {
		"attachment": {
			"type": "template",
			"payload": {
				"template_type": "button", 
				"text": "Would you like to use your previous location or a new location?",
				"buttons": [
					{
						"type": "postback", 
						"title": "Previous location",
						"payload": PREVIOUS_LOCATION
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

function extractZipcode(response) {

	let zip;
	const address_components = response.results[0].address_components;

	address_components.forEach((component) => {
		if (component.types[0] === 'postal_code') {
			zip = component.long_name;
		}
	})

	return zip; 

}

