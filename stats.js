var process = require('process');
require('dotenv').load();
var Promise = require('bluebird');

UserRequest = require('./models/stats').UserRequest;
UserRequestReport = require('./models/stats').UserRequestReport;
UserDayFollwerKey = require('./models/instagram').UserDayFollwerKey;

const pendingDays = 7;

var reset = (username) => {
  return new Promise(function (resolve, reject) {
    UserRequest.find({
        username: username
      },
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

Array.prototype.contains = function (k, callback) {
  var self = this;
  return (function check(i) {
    if (i >= self.length) {
      return callback(false);
    }

    if (self[i] === k) {
      return callback(true);
    }

    return process.nextTick(check.bind(null, i + 1));
  }(0));
}

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
  pendingProcesed = false;
  timeoutPorcesed = false;
  var promiseFn = (resolve, reject) => {
    var date = new Date();
    date.setDate(date.getDate() - pendingDays);
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
          var promises = [];
          var followersMap = target.map(function (item) {
            return item.username;
          });
          console.log("[Begin] Matching requested users and followers");
          items.forEach(item => {
            var found = followersMap.find(function (username) {
              return username === item.targetUsername;
            });

            if (found) {
              counter++;
              //item.changeAt = item.created; 
              item.changeAt = new Date();
              item.state = 'Success';
              promises.push(item.save());
            }
          });
          console.log("[End] Matching requested users and followers");
          if (promises) {
            console.log("[Begin] Update state in the repository");
            return Promise.all(promises).then((item) => {
              console.log('Updated ' + counter + ' state to Success');
              console.log("[End] Update state in the repository");
              pendingProcesed = true;
              resolveFn(resolve);
            })
          } else {
            pendingProcesed = true;
            resolveFn(resolve);
          }

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
          timeoutPorcesed = true;
          resolveFn(resolve);
        } else {
          reject(err);
        }
      }
    );
  };

  var resolveFn = (resolve) => {
    if (resolve && pendingProcesed && timeoutPorcesed) {
      target = undefined;
      resolve();
    }
  }

  return new Promise(promiseFn);
};

var prepareReportByMonth = (username, month, year, followers) => {
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
    var perPage = 30;


    UserRequest.count({
      username: username
    }).then((num) => {
      var counter = 0;

      var n = parseInt(num / 30) + 1;
      var promises = [];



      for (var i = 0; i < n; i++) {
        var p = UserRequest.find({
            username: username,
            created: {
              $gte: new Date(Date.UTC(year, (month - 1), 1, 0, 0, 0, 0))
            },
            created: {
              $lt: new Date(Date.UTC(after.year, (after.month - 1), 1, 0, 0, 0, 0))
            }
          })
          .limit(perPage)
          .skip(perPage * i)
          .exec();
        promises.push(p);
      }

      return Promise.all(promises).then((items) => {
        items = [].concat.apply([], items);
        var entity = buildUserRequestReportEntity(items, username, month, year, true);
        return updateUserRequestReport(entity, username, month, year, followers).then((item) => {
          resolve(item);
        }).catch((err) => {
          reject(err);
        });
      });
    })

  });

  return promise;
};

var buildUserRequestReportEntity = (items, username, month, year, detailEntity) => {
  let successCount = 0;
  let timeoutCount = 0;
  let cancelCount = 0;
  let pendingCount = 0;
  var days = [];
  var detailDays = [];
  var startDate = new Date(Date.UTC(year, (month - 1), 1, 0, 0, 0, 0));
  var daysInMonth = new Date(year, (month - 1), 0).getDate();
  for (var i = 0; i < daysInMonth; i++) {
    var fromDate = new Date(startDate.getTime());
    fromDate.setDate(startDate.getDate() + i);
    var toDate = new Date(startDate.getTime());
    toDate.setDate(startDate.getDate() + (i + 1));
    var founds = items.filter(item => {
      if (item.state === 'Success') {
        return fromDate <= item.changeAt && item.changeAt < toDate;
      } else {
        return fromDate <= item.created && item.created < toDate;
      }
    });

    if (founds && founds.length > 0) {
      var detailDay = {
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

      var day = {
        date: fromDate,
        success: detailDay.success.length,
        pending: detailDay.pending.length,
        timeout: detailDay.timeout.length,
        cancel: detailDay.cancel.length
      };
      successCount += day.success;
      timeoutCount += day.timeout;
      cancelCount += day.cancel;
      pendingCount += day.pending;
      days.push(day);

      if (detailEntity) {
        detailDays.push(detailDay);
      }
    }
  }

  return {
    days: days,
    detailDays: detailDays,
    total: {
      success: successCount,
      timeout: timeoutCount,
      pending: pendingCount,
      cancel: cancelCount
    },
    username: username,
    date: startDate
  };
}

var updateUserRequestReport = (entity, username, month, year, followers) => {
  var startDate = new Date(Date.UTC(year, (month - 1), 1, 0, 0, 0, 0));
  var promise = new Promise(function (resolve, reject) {

    updateNoMachineFollowers(entity, followers).then((item) => {
        return UserRequestReport.remove({
          date: startDate,
          username: username
        });
      })
      .then((item) => {
        return UserRequestReport.create(entity)
      }).then((item) => {
        console.log("[End] Preparing " + month + "/" + year);
        resolve(item);
      }).catch((err) => {
        console.log("[Failed] Preparing " + month + "/" + year);
        reject(err);
      });
  });



  return promise;
}

const getLastDayFollowersByDays = (followers) => {
  return new Promise((resolve, reject) => {
    if (!currentLoginUser || !currentLoginUser.username) {
      return;
    }
    var promises = []
    for (var i = 0; i <= pendingDays; i++) {
      var date = new Date();
      var utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
      utcDate.setDate(utcDate.getDate() - i);
      promises.push(UserDayFollwerKey.findOne({
        date: utcDate,
        username: currentLoginUser.username
      }).exec());
    }
    var dayFollowers = [];
    return Promise.all(promises).then((data) => {
      var usernamesFollowers = followers.map((f) => f.username);
      for (var i = 0; i < data.length; i++) {
        var indexBegin, indexEnd;
        indexBegin = getFirstMatch(data[i].keyFollowers, usernamesFollowers);

        if (i + 1 === data.length) {
          indexEnd = usernamesFollowers.length - 1;
          break;
        } else {
          indexEnd = getFirstMatch(data[i + 1].keyFollowers, usernamesFollowers);
        }

        var realFollowers = followers.slice(indexBegin, indexEnd);
        dayFollowers.push({
          day: data[i].date,
          followers: realFollowers
        });
      }
      resolve(dayFollowers);
    });
  });
};

const getFirstMatch = (data, followers) => {
  for (i = 0; i < data.length; i++) {
    var username = data[i];
    var index = followers.indexOf(username);
    if (index >= 0) {
      return index;
    }
  }
}

var updateNoMachineFollowers = (reportData, followers) => {
  return new Promise(function (resolve, reject) {
    var machineFollowers = [];
    var noMachineFollowers = [];

    [].concat.apply([], reportData.detailDays).forEach((item) => {
      machineFollowers = machineFollowers.concat(item.success.map((s) => s.username));
    });


    getLastDayFollowersByDays(followers).then((data) => {
      data.forEach((item) => {
        var current = {
          date: item.day,
          followers: []
        }

        item.followers.forEach((username) => {
          if (machineFollowers.indexOf(username < 0)) {
            current.followers.push(username);
          }
        });
        noMachineFollowers.push(current);
      })

      reportData.detailDays.forEach((day) => {
        var nomachine = noMachineFollowers.find(i => i.date.getDate() === day.date.getDate() && i.date.getMonth() === day.date.getMonth() && i.date.getYear() === day.date.getYear());
        if (nomachine) {
          day.noMachineFollowers = nomachine.followers;
        }
      });

      resolve(reportData);
    }).catch((err) => {
      console.log(err);
      reject(err)
    });
  });
}

var prepareReport = (username, followers) => {
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

    return Promise.all([
      prepareReportByMonth(targetUsername, before.month, before.year, followers),
      prepareReportByMonth(targetUsername, month, year, followers)
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
