## Zeus Bot: A simple weather bot for Facebook Messenger ## 

This is my first Messenger bot created by following Facebook's [Quick Start guide](https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start). 
Zeus Bot is deployed on Heroku and can be found [here](https://weather-bot-messenger.herokuapp.com/).

---

### How Zeus Bot works ###
- Converts your address input to a valid zip code using Google Maps' Geocoding API.
- Retrieve weather information from [OpenWeatherMap API](https://openweathermap.org/api) and send you the results.
- Store your last requested location in MongoDB for the next use.

--- 
### Try It [Here](https://www.facebook.com/messages/t/113133066796857)!