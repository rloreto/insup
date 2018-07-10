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
  '@ds129321.mlab.com:29321/instagram-stats', {
    useMongoClient: true
  }
);
mongoose.Promise = Promise;
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

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

var userSchema = new mongoose.Schema({
  username: String
});

var totalSchema = new mongoose.Schema({
  success: Number,
  timeout: Number,
  cancel: Number,
  pending: Number,
});
var daySchema = new mongoose.Schema({
  date: Date,
  success: [userSchema],
  timeout: [userSchema],
  cancel: [userSchema],
  pending: [userSchema]

});

var UserRequestReport = mongoose.model('UserRequestReport', {
  username: String,
  date: Date,
  total: totalSchema,
  days: [daySchema]
});


var reset = (username, targetUsername) => {
  return new Promise(function (resolve, reject) {
    UserRequest.find({},
      function (err, items) {
        if (!err) {
          var count = 0;

          items.forEach((item) => {
            if (item.changeAt) {
              item.changeAt = undefined;
            }

            item.state = 'Pending';
            item.save(() => {
              console.log(count)
              count++;
              if (count + 1 === items.length) {
                resolve();
              }
            });

          });


        } else {
          reject(err);
        }
      }
    );
  });
};

var addUserRequest = (username, targetUsername) => {
  return new Promise(function (resolve, reject) {
    UserRequest.create({
        username: username,
        targetUsername: targetUsername,
        created: new Date(),
        state: 'Pending'
      },
      function (err, items) {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      }
    );
  });
};
var updateUserRequest = (username, followers) => {
  target = followers;
  var promiseFn = (resolve, reject) => {
    var date = new Date();
    date.setDate(date.getDate() - 7);
    var counter = 0;
    UserRequest.find({
        state: 'Pending',
        username: username,
        created: {
          $gte: date
        }
      },
      function (err, items) {
        if (!err) {
          items.forEach(item => {
            var found = target.find(function (followers) {
              return followers.username === item.targetUsername;
            });
            if (found) {
              item.changeAt = new Date();
              item.state = 'Success';
              item.save(function (err, updateItem) {
                console.log('Update state to Success: ' + item.targetUsername);
                counter++;
                if (counter === items.length) {
                  resolve();
                }
              });
            } else {
              counter++;
              if (counter === items.length) {
                resolve();
              }
            }
          });
        } else {
          reject(err);
        }
      }
    );
    UserRequest.find({
        state: 'Pending',
        username: username,
        created: {
          $lt: date
        }
      },
      function (err, items) {
        if (!err) {
          items.forEach(item => {
            item.changeAt = new Date();
            item.state = 'Timeout';
            item.save();
          });
          resolve();
        } else {
          reject(err);
        }
      }
    );
  };
  return new Promise(promiseFn);
};

var prepareReportByMonth = (username, month, year) => {
  var startDate = new Date(Date.UTC(year, (month - 1), 1, 0, 0, 0, 0));
  var after = {
    month: month + 1,
    year: year
  };
  if (month === 11) {
    after.month = 0;
    after.year = year + 1;
  }

  var promise = new Promise(function (resolve, reject) {
    console.log("[Begin] Preparing " + month + "/" + year);
    UserRequest.find({
        username: username,
        created: {
          $gte: new Date(Date.UTC(year, (month - 1), 1, 0, 0, 0, 0))
        },
        created: {
          $lt: new Date(Date.UTC(after.year, (after.month - 1), 1, 0, 0, 0, 0))
        }
      },
      function (err, items) {
        let successCount = 0;
        let timeoutCount = 0;
        let cancelCount = 0;
        let pendingCount = 0;

        if (!err) {
          var days = [];
          var daysInMonth = new Date(year, (month - 1), 0).getDate();
          for (var i = 0; i < daysInMonth; i++) {
            var fromDate = new Date(startDate.getTime());
            fromDate.setDate(startDate.getDate() + i);
            var toDate = new Date(startDate.getTime());
            toDate.setDate(startDate.getDate() + (i + 1));
            var founds = items.filter(item => {
              if (item.state === 'Pending') {
                return fromDate <= item.created && item.created < toDate;
              } else {
                return fromDate <= item.changeAt && item.changeAt < toDate;
              }

            });

            if (founds && founds.length > 0) {
              var day = {
                date: fromDate,
                success: founds
                  .filter(item => item.state === 'Success')
                  .map(item => {
                    return {
                      username: item.targetUsername
                    };
                  }),
                pending: founds
                  .filter(item => item.state === 'Pending')
                  .map(item => {
                    return {
                      username: item.targetUsername
                    };
                  }),
                timeout: founds
                  .filter(item => item.state === 'Timeout')
                  .map(item => {
                    return {
                      username: item.targetUsername
                    };
                  }),
                cancel: founds
                  .filter(item => item.state === 'Cancel')
                  .map(item => {
                    return {
                      username: item.targetUsername
                    };
                  })
              };

              successCount += day.success.length;
              timeoutCount += day.timeout.length;
              cancelCount += day.cancel.length;
              pendingCount += day.pending.length;
              days.push(day);
            }
          }

          UserRequestReport.findOne({
            date: startDate,
            username: username
          }).then(item => {
            var total = {
              success: successCount,
              timeout: timeoutCount,
              pending: pendingCount,
              cancel: cancelCount
            };
            if (!item) {
              UserRequestReport.create({
                  days: days,
                  total: total,
                  username: username,
                  date: startDate
                },
                function (err, items) {
                  if (!err) {
                    console.log("[End] Preparing " + month + "/" + year);
                    resolve(item);
                  } else {
                    console.log("[Failed] Preparing " + month + "/" + year);
                    reject(err);
                  }
                }
              );
            } else {
              item.days = days;
              item.total = total;
              item.save(function (err, item) {
                console.log("[End] Preparing " + month + "/" + year);
                resolve(item);
              });
            }
          });
        } else {
          console.log("[Failed] Preparing " + month + "/" + year);
          reject(err);
        }
      }
    );
  });

  return promise;
};

var prepareReport = username => {
  targetUsername = username;
  var promise = new Promise(function (resolve, reject) {
    var now = new Date();
    var month = now.getMonth() + 1;
    var year = now.getFullYear();
    before = {
      month: month - 1,
      year: year
    };
    if (month === 1) {
      before.month = 11;
      before.year = year - 1;
    }

    Promise.all([
      prepareReportByMonth(targetUsername, before.month, before.year),
      prepareReportByMonth(targetUsername, month, year)
    ]).then((values) => {
      resolve(values);
    });
  });

  return promise;
};

module.exports = {
  addUserRequest,
  updateUserRequest,
  prepareReport,
  reset
};
