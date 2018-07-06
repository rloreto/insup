var process = require('process');
require('dotenv').load();
var Mongoose = require('mongoose').Mongoose;
var mongoose = new Mongoose();
var Promise = require('bluebird');


var user_mongo = process.env.USER_MONGO;
var pwd_mongo = process.env.PWD_MONGO;


mongoose.connect(
  'mongodb://' +
    user_mongo +
    ':' +
    pwd_mongo +
    '@ds129321.mlab.com:29321/instagram-stats',
  { useMongoClient: true }
);
mongoose.Promise = Promise;
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));


var UserRequest = mongoose.model('UserRequest', {
  username: String,
  targetUsername: String,
  created: Date,
  state: {type: String, enum: ['Pending', 'Success', 'Timeout', 'Cancel']} ,
  lastStateChage: Date
});

const addUserRequest = (username, targetUsername) => {
    UserRequest.create({ 
          username: username, 
          targetUsername: targetUsername, 
          created: new Date(), 
          state: 'Pending'
      });
};

module.exports = { addUserRequest };
