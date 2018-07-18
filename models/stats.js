var Mongoose = require('mongoose').Mongoose;
var mongoose = new Mongoose();
var Promise = require('bluebird');

var user_mongo = process.env.USER_MONGO;
var pwd_mongo = process.env.PWD_MONGO;

var UserRequest = mongoose.model('UserRequest', {
  username: String,
  targetUsername: String,
  created: Date,
  state: {
    type: String,
    enum: ['Pending', 'Success', 'Timeout', 'Cancel']
  },
  changeAt: Date
});

var UserSchema = new mongoose.Schema({
  username: String
});

var TotalSchema = new mongoose.Schema({
  success: Number,
  timeout: Number,
  cancel: Number,
  pending: Number,
  noMachineFollowers: Number
});
var DaySchema = new mongoose.Schema({
  date: Date,
  success: Number,
  timeout: Number,
  cancel: Number,
  pending: Number,
  noMachineFollowers: Number
});

var DayDetailSchema = new mongoose.Schema({
  date: Date,
  success: [UserSchema],
  timeout: [UserSchema],
  cancel: [UserSchema],
  pending: [UserSchema],
  noMachineFollowers: [UserSchema]

});

var UserRequestReport = mongoose.model('UserRequestReport', {
  username: String,
  date: Date,
  total: TotalSchema,
  days: [DaySchema],
  detailDays: [DayDetailSchema]
});

mongoose.connect(
  'mongodb://' +
  user_mongo +
  ':' +
  pwd_mongo +
  '@ds129321.mlab.com:29321/instagram-stats', {
    useMongoClient: true
  }
);
mongoose.Promise = Promise;
var db = mongoose.connection;
db.on('error', function (err) {
  console.log(err);
});

module.exports = {
  UserRequest,
  UserRequestReport
};
