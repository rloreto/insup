var Mongoose = require('mongoose').Mongoose;
var mongoose = new Mongoose();
var Promise = require('bluebird');

var user_mongo = process.env.USER_MONGO;
var pwd_mongo = process.env.PWD_MONGO;


var UserBase = mongoose.model('UserBase', {
  segment: String,
  username: String,
  attempts: [],
  info: []
});

var User = mongoose.model('User', {
  username: String,
  maxOperationsPerHour: Number,
  maxRemoveOperationsPerHour: Number,
  attemstartHourpts: Number,
  startHour: Number,
  activityHours: Number,
  maxGetUsers: Number,
  onlyPublic: Boolean,
  maxConsecutiveCreateOperations: Number,
  maxConsecutiveRemoveOperations: Number,
  waitBetweenOperationMinutes: Number,
  loadConfigurationUpdateFrecuencyMinutes: Number,
  segments: []
});

var KeyUser = mongoose.model('KeyUser', {
  userId: String,
  username: String
});

var UserDayFollwerKey = mongoose.model('UserDayFollwerKey', {
  date: Date,
  username: String,
  keyFollowers: [String]
});

mongoose.connect(
  'mongodb://' +
  user_mongo +
  ':' +
  pwd_mongo +
  '@ds123695.mlab.com:23695/instagram', {
    useMongoClient: true
  }
);
mongoose.Promise = Promise;
var db = mongoose.connection;
db.on('error', function (err) {
  console.log(err);
});

module.exports = {
  UserBase,
  User,
  KeyUser,
  UserDayFollwerKey
};
