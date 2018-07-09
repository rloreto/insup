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
  changeAt: Date
});

var userSchema = new mongoose.Schema({
  username: String
});

var daySchema = new mongoose.Schema({
    date: Date,
    success: [userSchema],
    timeout: [userSchema],
    cancel: [userSchema],
    pending: [[userSchema]]

});

var UserRequestReport = mongoose.model('UserRequestReport', {
  days: [
    daySchema
  ],
  date: Date
});

var addUserRequest = (username, targetUsername) => {
  return new Promise(function(resolve, reject) {
    UserRequest.create({ 
          username: username, 
          targetUsername: targetUsername, 
          created: new Date(), 
          state: 'Pending'
      }, function(err,items) {
          if (!err) {
              resolve();
          } else {
            reject(err);
          }
      });
  });
};
var updateUserRequest =  (followings) => {
  target = followings;
  var promiseFn = (resolve, reject) => {
    var date = new Date();
    date.setDate(date.getDate() -7);
    var counter = 0;
    UserRequest.find({
      "state": "Pending",
      "created": {"$gte": date}
    }, function(err,items) {
      if (!err) {
          items.forEach((item)=>{
            var found = target.find(function(following) {
              return following.username === item.targetUsername;
            });
            if(found) {
              item.changeAt= new Date();
              item.state = 'Success';
              item.save(function (err, updateItem) {
                console.log('Update state to Success: ' + item.targetUsername);
                counter++;
                if(counter === items.length) {
                  resolve();
                }
              })
            } else {
              counter++;
              if(counter === items.length) {
                resolve();
              }
            }
          })
          
      } else {
        reject(err);
      }
    });
    UserRequest.find({
      "state": "Pending",
      "created": {"$lt": date}
    }, function(err,items) {
      if (!err) {
        items.forEach((item)=>{
          item.changeAt= new Date();
          item.state = 'Timeout';
          item.save();
        });
          resolve();
      } else {
        reject(err);
      }
    });
  }
  return new Promise(promiseFn);
};

var prepareReportByMonth = (month, year) => {
  var startDate = new Date(year, month, 1, 0, 0, 0, 0);
  after = {month: month + 1 ,year: year};
  if(month === 12) {
    after.month = 1;
    after.year = year + 1;
  }

  var promise = new Promise(function(resolve, reject) {
    UserRequest.find({ 
      username: targetUsername, 
      created: {$gte: new Date(year, month, 1, 0, 0, 0, 0)},
      created: {$lt: new Date(after.year, after.month , 1, 0, 0, 0, 0)},
    }, function(err, items) {
      if (!err) {
          var days = [];
          var daysInMonth = new Date(year, month, 0).getDate();
          for (var i= 0; i<daysInMonth;i++) {
            var from = new Date(startDate.getTime());
            from.setDate(startDate.getDate() + i );
            var to = new Date(startDate.getTime());
            to.setDate(startDate.getDate() + (i + 1) );
            var founds = items.filter((item)=>{
              return from<=item.created && item.created<to;
            });
          
            if(founds && founds.length > 0) {

              var success = founds.filter((item) => item.state === 'Success');
              days.push({
                date: from,
                success: founds.filter((item) => item.state === 'Success').map((item)=> {
                  return {username: item.targetUsername}
                }),
                pending: founds.filter((item) => item.state === 'Pending').map((item)=> {
                  return {username: item.targetUsername}
                }),
                timeout: founds.filter((item) => item.state === 'Timeout').map((item)=> {
                  return {username: item.targetUsername}
                }),
                cancel: founds.filter((item) => item.state === 'Cancel').map((item)=> {
                  return {username: item.targetUsername}
                })
              });
            }
          }
          UserRequestReport.find({date: startDate }).then((item)=>{
            if(item) {
              UserRequestReport.create({ days: days, date: startDate }, function(err,item) {
                if (!err) {
                    resolve(item);
                } else {
                  reject(err);
                }
              })
            } else {
              item.days = days;
              item.save();
              resilve(item);
            }
          })

          
      } else {
        reject(err);
      }
    });
  });

  return promise;
}

var prepareReport = (username) => {
  targetUsername = username;
  var promise = new Promise(function(resolve, reject) {
    var now = new Date();
    var month = now.getMonth();
    var year = now.getFullYear();
    before = {month: month - 1 ,year: year};
    if(month === 1) {
      before.month = 12;
      before.year = year -1;
    };

    Promise.all([prepareReportByMonth(before.month, before.year),
    prepareReportByMonth(month, year)]).then((values)=>{
      debugger;
      resolve(values);
    });
  });

  return promise;
};

module.exports = { addUserRequest, updateUserRequest, prepareReport };
