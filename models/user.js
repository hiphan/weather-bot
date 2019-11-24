const mongoose = require('mongoose');

const UserSchema = mongoose.Schema({
	user_id: {
		type: String,
		required: true,
		unique: true
	},
	last_loc: {
		type: String,
		required: true
	}, 
	created: {
		type: Date, 
		required: true
	}
}, 
{
	collection: 'userinfo'
}
);

const User = mongoose.model("User", UserSchema);
module.exports = User;