require('dotenv').load();
var process = require('process');
var env = process.env.ENVIRONMENT || 'dev';
var maxOperationsPerHour;
var maxRemoveOperationsPerHour;
var startHour;
var activityHours;
var maxGetUsers;
var onlyPublic;
var maxConsecutiveCreateOperations;
var maxConsecutiveRemoveOperations;
var waitBetweenOperationMinutes;
var segments;
var logger;
var userInfo;
var dropboxAccessToken = 'lX12IoOo7ewAAAAAAACBhOHAvV1Y65p8mV_MTyLF4q-LZu7_1zjrSbXmZEH_J34v';
const pendingDays = 7;
const {
  addUserRequest,
  updateUserRequest,
  prepareReport,
  reset
} = require('./stats');

Date.prototype.addHours = function (h) {
  this.setHours(this.getHours() + h);
  return this;
}

var XLSX = require('xlsx');
require('isomorphic-fetch'); // or another library of choice.
var Dropbox = require('dropbox').Dropbox;
var util = require('util');

const fs = require('fs');
require('dotenv').load();

var _ = require('lodash');
var Promise = require('bluebird');
const eachAsync = require('each-async');

const {
  getFaceInfo
} = require('./face');
if (!fs.existsSync('./tmp/')) {
  fs.mkdirSync('./tmp/');
}
UserBase = require('./models/instagram').UserBase;
User = require('./models/instagram').User;
KeyUser = require('./models/instagram').KeyUser;
UserDayFollwerKey = require('./models/instagram').UserDayFollwerKey;

var device, storage;
var Client = require('instagram-private-api').V1;


var progressCounter = 0;

const trace = (str, type) => {
  type = type || 'log';
  switch (type) {
    case 'log':
      logger.log('[' + currentLoginUser.username + '] ' + str);
      console.log(str);
      break;
    case 'error':
      logger.error(str);
      console.error(str);
      break;
    case 'warn':
      logger.warn(str);
      console.warn(str);
      break;
    case 'info':
      logger.info(str);
      console.info(str);
      break;
  }

}
const setUserConfig = (username) => {
  return new Promise(function (resolve, reject) {
    trace("Load configuration of user: " + username);
    User.findOne({
      username: username
    }).then((user) => {
      var config;
      if (!user) {
        config = {
          maxOperationsPerHour: 60,
          maxRemoveOperationsPerHour: 60,
          startHour: 8,
          activityHours: 16,
          maxGetUsers: 1000,
          onlyPublic: false,
          maxConsecutiveCreateOperations: 5,
          maxConsecutiveRemoveOperations: 5,
          waitBetweenOperationMinutes: 3,
          loadConfigurationUpdateFrecuencyMinutes: 5,
          likesPerNewPublicRelationship: 0,
          segments: ["weddings"]
        };
      } else {
        config = {
          maxOperationsPerHour: user.maxOperationsPerHour,
          maxRemoveOperationsPerHour: user.maxRemoveOperationsPerHour,
          startHour: user.startHour,
          activityHours: user.activityHours,
          maxGetUsers: user.maxGetUsers,
          onlyPublic: user.onlyPublic,
          maxConsecutiveCreateOperations: user.maxConsecutiveCreateOperations,
          maxConsecutiveRemoveOperations: user.maxConsecutiveRemoveOperations,
          waitBetweenOperationMinutes: user.waitBetweenOperationMinutes,
          loadConfigurationUpdateFrecuencyMinutes: user.loadConfigurationUpdateFrecuencyMinutes,
          likesPerNewPublicRelationship: user.likesPerNewPublicRelationship,
          segments: user.segments
        };
      }


      maxOperationsPerHour = config.maxOperationsPerHour
      maxRemoveOperationsPerHour = config.maxRemoveOperationsPerHour
      startHour = config.startHour
      activityHours = config.activityHours
      maxGetUsers = config.maxGetUsers
      onlyPublic = config.onlyPublic
      maxConsecutiveCreateOperations = config.maxConsecutiveCreateOperations
      maxConsecutiveRemoveOperations = config.maxConsecutiveRemoveOperations
      waitBetweenOperationMinutes = config.waitBetweenOperationMinutes
      loadConfigurationUpdateFrecuencyMinutes = config.loadConfigurationUpdateFrecuencyMinutes
      likesPerNewPublicRelationship = config.likesPerNewPublicRelationship
      segments = config.segments

      trace(JSON.stringify(config));
      trace("[OK]");

      getUserStatus().then((availablePercentByUserSegmets) => {
        trace(`The user '${username}' has available a ${availablePercentByUserSegmets}% of users.`);
      });

      getUserInfo(currentLoginUser, env !== 'dev', true).then(function (info) {
        userInfo = {
          currentUserInfo: info
        };

        if (userInfo && userInfo.currentUserInfo && userInfo.currentUserInfo.followers) {
          console.log('[Begin] Updating user requested.');
          //reset(currentLoginUser.username).then(() => {
          //return updateUserRequest(currentLoginUser.username, userInfo.currentUserInfo.followers);
          //})
          updateUserRequest(currentLoginUser.username, userInfo.currentUserInfo.followers)
            .then(() => {
              console.log('[End] Updating user requested.');
              console.log('[Begin] Generating report user request data.');
              return prepareReport(currentLoginUser.username, userInfo.currentUserInfo.followers);
            })
            .then((data) => {
              console.log('[End] Generating report user request data.');
              resolve(config);
            })
        }
      });


    })
  });
}
const login = (userId, password) => {
  currentLoginUser = {
    username: userId,
    password: password
  };


  const console_stamp = require('console-stamp')
  var dir = './logs/';

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  dir = './logs/' + userId.replace('.', '_');

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  const output = fs.createWriteStream('./logs/' + userId.replace('.', '_') + '/out.log');
  const errorOutput = fs.createWriteStream('./logs/' + userId.replace('.', '_') + '/err.log');
  logger = new console.Console(output, errorOutput);


  console_stamp(logger, {
    stdout: output,
    stderr: errorOutput,
    pattern: 'dd-mm-yyyy HH:MM:ss.l'
  });

  setDevice(userId);

  var promise = new Promise(function (resolve, reject) {
    setUserConfig(userId).then((config) => {

      resolve();
    })
  });
  return promise;

};

const setDevice = (username) => {
  device = new Client.Device(username);
  storage = new Client.CookieFileStorage(
    __dirname + '/cookies/' + username + '.json'
  );
}

const updateTargetFollowers = (obj) => {
  var loginUser = {
    username: obj.username,
    password: obj.password
  }
  var targetUsername = obj.targetUserName;
  var force = obj.force;
  var currentSegment = obj.segment;
  currentLoginUser = loginUser;
  setDevice(currentLoginUser.username);
  var currentSession;
  var followers;
  var promise = new Promise(function (resolve) {
    var setId = function (name, id) {
      var targetIndex = _.findIndex(targetUsers, function (userName) {
        return userName === name;
      });
      if (targetIndex < 0) {
        return;
      }
      targetUsers[targetIndex].id = id;
    };

    getUserId(loginUser, targetUsername).then(response => {
      var user;
      if (!response.hasError) {
        user = response.data;
      }
      var cacheFile = './tmp/' + targetUsername + '_followers.json';
      if (!fs.existsSync(cacheFile) || force) {
        Client.Session.create(
          device,
          storage,
          loginUser.username,
          loginUser.password
        ).then(function (session) {
          trace('Procesing...');

          var followerCount = user.followerCount;
          var targetUser = {
            id: user.id,
            name: targetUsername,
            currentSession: session
          };

          getFollowers(targetUser, followerCount, true, force).then(function () {
            resolve();
          });
        });
      } else {
        var feeds = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        saveUpdateFollowers(1, feeds, user.id, currentLoginUser.username, currentSegment).then(function (followers) {
          resolve();
        });
      }
    });
  });

  return promise;
};

const isActivityPeriod = () => {
  var now = new Date();

  var ini = new Date();
  var lastDay = new Date()
  lastDay.setDate(lastDay.getDate() - 1);
  lastDay.setHours(startHour);
  lastDay.setMinutes(0);
  lastDay.setSeconds(0);
  lastDay.addHours(activityHours);

  if (now <= lastDay) {
    var temp = new Date();
    ini = new Date(temp.setDate(temp.getDate() - 1));
  }

  ini.setHours(startHour);
  ini.setMinutes(0);
  ini.setSeconds(0);

  var end = new Date(ini.getTime());
  end.addHours(activityHours);

  return (ini <= now && now <= end);
}

const start = loginUser => {
  if (!isActivityPeriod()) {
    removeNotFollowers(loginUser);
  } else {
    currentLoginUser = loginUser;
    setDevice(currentLoginUser.username);

    var max = maxOperationsPerHour;
    var counter = 0;
    var iteration = 0;
    var doNext = true;
    var internalCounter = 0;
    var targetUsers = [];
    getUsers(maxGetUsers, loginUser.username).then(users => {
      targetUsers = users;
      internalCounter = 0;
    });
    var startTime;
    var pause = false;
    var isLoading = false;
    var timeLimit;
    var isShow = false;
    var loopCounter = 0;
    var loadConfigurationUpdateFrecuencySeconds = loadConfigurationUpdateFrecuencyMinutes * 60;

    function loop() {
      loopCounter++;

      if (!isActivityPeriod()) {
        clearInterval(loopPointer);
        removeNotFollowers(loginUser);
      } else {
        if (loopCounter % loadConfigurationUpdateFrecuencySeconds === 0) {
          setUserConfig(loginUser.username);
        }

        if (!pause && !isLoading && targetUsers && targetUsers.length > 0) {
          isLoading = true;
          if (internalCounter + 1 > targetUsers.length) {
            internalCounter = 0;
            targetUsers = [];
            getUsers(maxGetUsers, loginUser.username).then(users => {
              targetUsers = users;
              isLoading = false;
            });

          } else {
            if (!startTime) {
              startTime = new Date();
              timeLimit = new Date(startTime.getTime()).addHours(1);
            }

            if (new Date() > timeLimit) {
              startTime = null;
              counter = 0;
              isLoading = false;
              isShow = false;
            } else {
              if (counter < max) {
                var item = targetUsers[internalCounter];
                internalCounter++;
                if (item) {
                  var follower = isFollower(
                    item.username,
                    userInfo.currentUserInfo.followers
                  );

                  if (follower) {
                    setInfo(item, currentLoginUser.username, 'isFollower', true)
                  }

                  item.save().then(response => {
                    item = response;
                    var follower = getInfo(response, currentLoginUser.username, 'isFollower');
                    if (!follower) {
                      createRelationship(item.username, segments, onlyPublic)
                        .then(data => {
                          if (data && data.user && data.session) {
                            addLikesToUser(data.user, data.session)
                            addUserRequest(loginUser.username, item.username)
                              .then(() => {
                                //console.log();
                                return null;
                              })
                              .catch((ex) => {
                                //TODO: Hande exception.
                              });
                            trace('Created relationship: ' + item.username + ' ' + (counter + 1) + ' (' + internalCounter + ') of ' + max + ' (' + (targetUsers.length - internalCounter) + ')');
                            counter++;
                            if (counter % maxConsecutiveCreateOperations === 0 && counter !== max) {
                              pause = true;
                              waitFor(waitBetweenOperationMinutes, function () {
                                isLoading = false;
                                pause = false;
                              });
                            }
                          } else {
                            trace('Ignore relationship: ' + item.username + ' ' + (counter + 1) + ' (' + internalCounter + ') of ' + max + ' (' + (targetUsers.length - internalCounter) + ')');
                          }
                          isLoading = false;
                          return null;
                        })
                        .catch((e) => {
                          if (e) {
                            trace('Error creating relationship: ' + item.username + ' ' + (counter + 1) + ' (' + internalCounter + ') of ' + max + ' (' + (targetUsers.length - internalCounter) + ')');
                            if (e.name === 'ActionSpamError' || e.message === 'Please wait a few minutes before you try again.' ||
                              e.name === 'TooManyFollowsError' || e.message === 'Account has just too much follows') {
                              pause = true;
                              waitFor(waitBetweenOperationMinutes, function () {
                                isLoading = false;
                                pause = false;
                                isLoading = false;
                              });
                            } else if (e.message === "user.friendshipStatus.outgoing_request") {
                              trace('Ignore follower relationship (outgoing_request): ' + item.username + ' ' + (counter + 1) + ' (' + internalCounter + ') of ' + max + ' (' + (targetUsers.length - internalCounter) + ')');
                            } else {
                              trace(e);
                            }
                          }
                          isLoading = false;
                        })
                    } else {
                      trace('Ignore follower relationship: ' + item.username + ' ' + (counter + 1) + ' (' + internalCounter + ') of ' + max + ' (' + (targetUsers.length - internalCounter) + ')');
                      isLoading = false;
                    }

                  });
                } else {
                  isLoading = false;
                  if (!isShow) {
                    trace('Next activity start at: ' + timeLimit.toLocaleString());
                    isShow = true;
                  }
                }
              } else {
                isLoading = false;
                if (!isShow) {
                  isShow = true;
                  trace('Next activity start at: ' + timeLimit.toLocaleString());

                }
              }
            }
          }
        }
        iteration++;
      }
    }
    loop();
    var loopPointer = setInterval(loop, 1000);


  }
};

addLikesToUser = (user, session) => {

  if (likesPerNewPublicRelationship && user && !user.isPrivate) {
    var feed = new Client.Feed.UserMedia(session, user.id);
    Promise.mapSeries(_.range(0, likesPerNewPublicRelationship), function () {
        return feed.get();
      })
      .then(function (results) {
        var media = _.flatten(results);
        if (media && media.length > 0) {
          var ids = _.range(1, media.length);
          ids = shuffle(ids);
          var promises = [Client.Like.create(session, media[0].id)];
          if (ids.length > 0) {
            for (var i = 0; i < likesPerNewPublicRelationship - 1; i++) {
              promises.push(Client.Like.create(session, media[ids[i]].id));
            }
          }
          Promise.all(promises).then((data) => {
            data.forEach((currentValue, index) => {
              trace("Created like to username: " + user.username + " [" + (index + 1) + "/ " + likesPerNewPublicRelationship + "]");
            })
          });
        }
      })
  }

};

const removeNotFollowers = (loginUser, forze) => {
  currentLoginUser = loginUser;
  setDevice(currentLoginUser.username);
  updateKeyUsers(loginUser.username).then((object) => {
    removeUsers();
  }).catch((e) => {
    removeUsers();
  });
};

const removeUsers = () => {
  var followings = userInfo.currentUserInfo.followings;
  if (followings.length === 0) {
    followings = userInfo.currentUserInfo.followings;
  }
  followings = followings.reverse();

  KeyUser.find({
    userId: currentLoginUser.username
  }).then((keyUsers) => {
    if (!keyUsers) {
      keyUsers = [];
    } else {
      keyUsers = keyUsers.map((ku => ku.username));
    }
    var users = followings.filter(x => !keyUsers.includes(x.username));

    var max = maxRemoveOperationsPerHour;
    var counter = 0;
    var internalCounter = 0;
    var startTime;
    var pause = false;
    var isLoading = false;
    var timeLimit;
    var isShow = false;
    var loopCounter = 0;
    var loadConfigurationUpdateFrecuencySeconds = loadConfigurationUpdateFrecuencyMinutes * 60;

    function loop() {
      loopCounter++;
      var date = new Date();
      var currentHour = date.getHours();

      if (isActivityPeriod() && !forze) {
        clearInterval(loopPointer);
        start(currentLoginUser);
      } else {
        if (loopCounter % loadConfigurationUpdateFrecuencySeconds === 0) {
          updateKeyUsers(currentLoginUser.username).then((object) => {
            setUserConfig(currentLoginUser.username);
          }).catch((e) => {
            setUserConfig(currentLoginUser.username);
          });
        }

        if (!pause && !isLoading) {
          isLoading = true;
          if (!startTime) {
            startTime = new Date();
            timeLimit = new Date(startTime.getTime()).addHours(1);
          }

          if (new Date() > timeLimit) {
            counter = 0;
            isLoading = false;
            startTime = null;
            isShow = false;
            pause = false;
          } else {
            if (counter < max) {
              var item = users[internalCounter];
              internalCounter++;
              if (item) {
                destroyRelationship(item.username).then(user => {
                  if (user) {
                    setUnfollowed(user.username, currentLoginUser.username, segments);
                  }
                  counter++;
                  trace('Destroying relationship ' + counter + ' of ' + max);
                  if (counter % maxConsecutiveRemoveOperations === 0 && counter !== max) {
                    pause = true;
                    waitFor(waitBetweenOperationMinutes, function () {
                      pause = false;
                      isLoading = false;
                    });
                  }
                  isLoading = false;

                }).catch((e) => {
                  if (e && e.code && e.code == 101) {
                    //trace('the user ' + item.username + ' is in the keyuser list. This user was not destroyed.', 'log')
                  } else {
                    trace(e, 'error');
                  }

                  if (e.name === 'ActionSpamError' || e.message === 'Please wait a few minutes before you try again.' ||
                    e.name === 'TooManyFollowsError' || e.message === 'Account has just too much follows') {
                    pause = true;
                    waitFor(waitBetweenOperationMinutes, function () {
                      pause = false;
                      isLoading = false;
                    });
                  } else {
                    isLoading = false;
                  }
                });
              } else {
                isLoading = false;
                if (!isShow) {
                  trace('Next activity start at: ' + timeLimit.toLocaleString());
                  isShow = true;
                }
              }
            } else {
              isLoading = false;
              if (!isShow) {
                trace('Next activity start at: ' + timeLimit.toLocaleString());
                isShow = true;
              }
            }
          }
        }
      }
    }
    loop();
    var loopPointer = setInterval(loop, 1000);

  })


}

const setInfo = (user, currentUsername, property, value) => {
  if (user.info && user.info.length > 0) {
    var found = user.info.find(function (item) {
      return item.un === currentUsername && item[property];
    });
    if (!found) {
      var obj = {
        un: currentUsername
      }
      obj[property] = value;

      user.info.push(obj)
    } else {
      found[property] = value;
    }
  } else {
    var obj = {
      un: currentUsername
    }
    obj[property] = value;
    user.info.push(obj)
  }
}

const getInfo = (user, currentUsername, property) => {
  if (user.info && user.info.length > 0) {
    var found = user.info.find(function (item) {
      return item.un === currentUsername && item[property] !== undefined;
    });
    if (found) {
      return found[property];
    }
  }
}

const waitFor = (minutes, done) => {
  var total = minutes * 60 * 1000;
  var internalCounter = 0;
  trace("Waiting " + minutes + " minutes for next loop...");
  var internalPointer = setInterval(function () {
    internalCounter++;
    var remainingMs = (total - (internalCounter * 1000)) / 1000
    if (remainingMs % 60 === 0) {
      trace('Remaining time: ' + remainingMs / 60 + ' minutes');
    }
    if ((internalCounter * 1000) > total) {
      clearInterval(internalPointer);
      if (done) {
        done();
      }
    }
  }, 1000);
}

const getUsers = (numLimits, username) => {

  var promise = new Promise(function (resolve) {

    var filter = {
      "attempts.un": {
        "$ne": username
      },
      "$or": [{
          "info.un": {
            "$eq": username
          },
          "info.unfollowed": {
            "$ne": true
          }
        },
        {
          "info.un": {
            "$ne": username
          }
        }
      ],
      "$or": [{
          "info.un": {
            "$eq": username
          },
          "info.isFollower": {
            "$ne": true
          }
        },
        {
          "info.un": {
            "$ne": username
          }
        }
      ]
    };


    if (segments && segments.length > 0) {
      _.forEach(segments, (segment) => {
        filter["$and"] = [];

        var segmentsIntenal = {
          "$or": []
        }
        segmentsIntenal["$or"].push({
          segment: segment
        })
        filter["$and"].push(segmentsIntenal);
      });
    }

    var query = UserBase.find(filter);

    if (numLimits && Number.isInteger(numLimits)) {
      query = query.limit(numLimits);
    }
    query.sort({
      order: 1
    }).then(users => {
      trace('Recieved ' + users.length + ' new users.');
      resolve(users);
    });
  });

  return promise;
};

_.bind(start, this);
_.bind(removeNotFollowers, this);

const createRelationship = (username, segments, onlyPublic) => {
  var promise = new Promise(function (resolve, reject) {
    getUserId(currentLoginUser, username)
      .then(response => {
        var user;
        if (!response.hasError) {
          user = response.data;
        } else {
          if (response.error.name === 'IGAccountNotFoundError') {
            var total = segments.length;
            var counter = 0;
            _.each(segments, (segment) => {
              UserBase.remove({
                username: username,
                segment: segment
              }).then(err => {
                if (err.result.ok === 1) {
                  trace('removed:' + username);
                }
                counter++;
                if (counter == total) {
                  resolve(false);
                  return null;
                }
              });
            })
          }
          return null;
        }

        if (user && !user.friendshipStatus.outgoing_request) {
          if (onlyPublic) {
            if (!user.friendshipStatus.is_private) {
              trace('Creating relationship to ' + username);
              return [user, response.session, Client.Relationship.create(currentSession, user.id)];
            } else {
              return getUserFromDb(username).then(
                user => {
                  if (user) {
                    user.isPrivate = true;
                  }
                  user.save();
                }
              );
              const error = new Error();
              error.message = "!user.friendshipStatus.is_private";
              reject(error);
            }
          } else {
            trace('Creating relationship to ' + username);
            return [user, response.session, Client.Relationship.create(currentSession, user.id)];
          }
        } else {
          var attempts = getAttempts(username, currentLoginUser.username);
          if (!attempts) {
            getUserFromDb(username).then((item) => {
              if (item) {
                setAttempts(item, currentLoginUser.username, 1);
                item.save();
              }
            })

          }
          const error = new Error();
          error.message = "user.friendshipStatus.outgoing_request";
          reject(error);
          return [];
        }
      }).catch(e => {
        reject(e);
      }).spread((user, session, relationship) => {
        if (relationship) {
          return [user, session, getUserFromDb(username)];
        } else {
          return [];
        }
      }).spread((user, session, userDb) => {
        if (userDb) {
          var attempts = getAttempts(userDb, username);
          attempts++;
          setAttempts(userDb, currentLoginUser.username, attempts++);
          userDb.save((err, response) => {
            if (!err) {
              trace('[OK]');
              resolve({
                user: user,
                session: session
              });
            }
          });
        }
      });

  });

  return promise;
};

const destroyRelationship = username => {
  var promise = new Promise(function (resolve, reject) {
    getUserId(currentLoginUser, username).then(response => {
        var user;
        if (!response.hasError) {
          user = response.data;
        }
        if (user && !user.friendshipStatus.outgoing_request) {
          trace('Destroy relationship with ' + username);
          return Client.Relationship.destroy(currentSession, user.id);
        } else {
          resolve();
        }
      })
      .catch(e => {
        reject(e);
      })
      .then(relationship => {
        if (relationship) {
          trace('[OK]');
          return getUserFromDb(username);
        } else {
          resolve();
        }
      })
      .then(user => {
        resolve(user);
      });
  });
  return promise;
};

const getAttempts = (user, currentUsername) => {
  if (user.attempts && user.attempts.length > 0) {
    var found = user.attempts.find(function (item) {
      return item.un === currentUsername;
    });
    if (found) {
      return found.n;
    }
  }
  return 0;
}

const setAttempts = (user, currentUsername, value) => {
  if (user.attempts && user.attempts.length > 0) {
    var found = user.attempts.find(function (item) {
      return item.un === currentUsername
    });
    if (!found) {
      user.attempts.push({
        un: currentUsername,
        n: value
      })
    } else {
      found.n = value;
    }
  } else {
    user.attempts.push({
      un: currentUsername,
      n: value
    })
  }

}

const getFollowingNotFollowers = userInfo => {
  return _.differenceBy(userInfo.followings, userInfo.followers, 'id');
};

const isFollower = (username, providerFollowers) => {
  var user = _.find(providerFollowers, {
    username: username
  });
  return user ? true : false;
};

const setUnfollowed = (username, unfollowBy, segments) => {
  _.each(segments, (segment) => {
    UserBase.findOne({
      segment: segment,
      username: username
    }, function (err, user) {
      if (!err) {
        if (user) {
          if (user.info && user.info.length > 0) {
            var found = user.info.find(function (item) {
              return item.un === username;
            });

            if (!found) {
              user.info.push({
                un: unfollowBy,
                unfollowed: true
              });
            } else {
              found.unfollowed = true;
            }

          } else {
            user.info.push({
              un: unfollowBy,
              unfollowed: true
            });
          }
          user.save(function (err) {
            if (err) {
              trace(err, 'error');
            }
          });
        }
      }
    });
  })

};

shuffle = function (array) {
  var tmp, current, top = array.length;
  if (top)
    while (--top) {
      current = Math.floor(Math.random() * (top + 1));
      tmp = array[current];
      array[current] = array[top];
      array[top] = tmp;
    }
  return array;
}

const getUserId = (loginUser, username) => {
  var promise = new Promise(function (resolve) {
    Client.Session.create(device, storage, loginUser.username, loginUser.password)
      .then(function (session) {
        var data = {
          currentSession: session
        };
        currentSession = session;
        return [session, Client.Account.searchForUser(session, username)];
      })
      .spread(function (session, user) {
        resolve({
          hasError: false,
          data: user._params,
          session: session
        });
      })
      .catch(function (e) {
        resolve({
          hasError: true,
          error: e
        });
      });
  });
  return promise;
};

const getUserFromDb = (username) => {
  var promise = new Promise(function (resolve, reject) {

    var segmentFilter = {}
    if (segments && segments.length > 0) {
      segmentFilter["$or"] = [];
      _.forEach(segments, (segment) => {
        segmentFilter["$or"].push({
          segment: segment
        })
      });
    }

    const filter = _.assign(segmentFilter, {
      username: username
    });
    UserBase.find(filter).then(
      users => {
        if (users && users.length > 0) {
          for (var i = 1; i < users.length; i++) {
            trace('Duplicates for username: ' + username);
            var id = users[i].get('id');
            UserBase.remove({
              _id: id
            }).then((response) => {
              if (response.result && !response.result.ok) {
                reject(response);
              }
              trace('Removed duplicate item ' + id);
            })
          }
          resolve(users[0]);
        } else {
          resolve();
        }
      }
    );
  });
  return promise;
}

const getUserInfoByUserName = (loginUser, username) => {
  return gettUserInfo(loginUser, username);
};


const getUserInfo = (loginUser, useCacheData, useLightFollowers) => {
  var promise = new Promise(function (resolve) {
    Client.Session.create(device, storage, loginUser.username, loginUser.password)
      .then(function (session) {
        var data = {
          currentSession: session
        };
        return [data, Client.Account.searchForUser(session, loginUser.username)];
      })
      .spread(function (data, user) {
        data.followerCount = user._params.followerCount;
        data.currentUser = {
          id: user._params.id,
          name: user._params.username,
          currentSession: data.currentSession
        };
        trace('Getting ' + loginUser.username + ' followings');
        return [data, getFollowing(data.currentUser)];
      })
      .spread(function (data, followings) {
        trace('[OK]');
        data.followings = followings;
        trace('Getting ' + loginUser.username + ' followers');
        return [data, getFollowers(data.currentUser, data.followerCount, false, useCacheData, useLightFollowers)];
      })
      .spread(function (data, response) {
        trace('[OK]');
        data.itemfollowers = [];
        data.lightMode = false;
        if (response && response.followers) {
          data.followers = response.followers;
        }
        if (response) {
          data.lightMode = response.lightMode;
        }
        resolve(data);
      });
  });
  return promise;
};

const containsAnyKeyFollower = (partiaFollowers, keyFollowers) => {
  var found;
  for (i = 0; i < keyFollowers.length; i++) {
    var keyFollower = keyFollowers[i];
    for (j = 0; j < partiaFollowers.length; j++) {
      var currentFollower = partiaFollowers[j];
      if (currentFollower === keyFollower) {
        return true;
      }
    }
  }
  return false;
};

const getFollowers = (user, followerCount, saveUsers, useCacheData, useLightFollowers) => {
  var accountFollowers = new Client.Feed.AccountFollowers(
    user.currentSession,
    user.id
  );
  var page = 1;
  var getMore = true;
  var dayFollowers = false;
  var counter = 0;
  var feedsDone = [];
  var cacheFile = './tmp/' + user.name + '_followers.json';

  var promise = new Promise(function (resolve) {
    if (!fs.existsSync(cacheFile) || useCacheData) {
      trace('Getting followers from live. NO CACHE');
      Promise.all([
        getDayFollowers(true)
      ]).then((data) => {
        var lastKeyFollowers = data[0];
        var lightMode = (lastKeyFollowers && lastKeyFollowers.length > 0) && useLightFollowers;
        var timeoutObj = setInterval(function () {
          if (counter > followerCount) {
            clearInterval(timeoutObj);
            printPercent(100);
            fs.writeFileSync(cacheFile, JSON.stringify(feedsDone), 'utf-8');
            var obj = {
              lightMode: lightMode,
              followers: feedsDone
            }
            resolve(obj);
          } else {
            if (env === 'dev') {
              printPercent(counter / followerCount * 100.0);
            }

            if (getMore) {
              getMore = false;
              accountFollowers.get().then(function (results) {
                if (results && results.length > 0) {
                  var data = _.flattenDeep(results);
                  var followers = _.map(data, function (feed) {
                    return feed._params;
                  });
                  var contains = false;
                  if (lightMode) {
                    contains = containsAnyKeyFollower(followers.map((f) => f.username), lastKeyFollowers);
                  }

                  if (!contains) {
                    if (!dayFollowers) {
                      setDayFollowers(followers);
                      dayFollowers = true;
                    }
                    if (saveUsers) {
                      saveUpdateFollowers(page, followers, user.id).then(function (followers) {
                        Array.prototype.push.apply(feedsDone, followers);
                        getMore = true;
                        counter += followers.length;
                        page++;
                      });
                    } else {
                      Array.prototype.push.apply(feedsDone, followers);
                      getMore = true;
                      counter += followers.length;
                      page++;
                    }
                  } else {
                    getMore = false;
                    counter = followerCount + 1;
                  }

                } else {
                  counter = followerCount + 1;
                }
              });
            }
          }
        }, 100);
      });

    } else {
      trace('Getting followers from CACHE')
      var feeds = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      printPercent(100);
      resolve(feeds);
    }
  });

  return promise;
};

const getFollowing = user => {
  var accountFollowing = new Client.Feed.AccountFollowing(
    user.currentSession,
    user.id
  );
  var promise = new Promise(function (resolve) {
    accountFollowing.get().then(function (results) {
      var data = _.flattenDeep(results);
      var feeds = _.map(data, function (feed) {
        return feed._params;
      });

      resolve(feeds);
    });
  });

  return promise;
};

const getUserStatus = function () {
  var promise = new Promise((resolve) => {
    UserBase.count({
      segment: {
        "$in": segments
      }
    }).then((total) => {
      UserBase.count({
        "segment": {
          "$in": segments
        },
        "$or": [{
            "attempts.un": {
              "$eq": currentLoginUser.username
            },
            "attempts.n": {
              "$lt": 1
            }
          },
          {
            "attempts.un": {
              "$ne": currentLoginUser.username
            }
          },
          {
            "info.un": {
              "$eq": currentLoginUser.username
            },
            "info.unfollowed": {
              "$ne": true
            }
          }
        ]
      }).then((available) => {
        resolve((available / total * 100).toFixed(2));
      });
    });
  });

  return promise;
};

const saveUpdateFollowers = (page, feeds, providerId) => {

  var total = feeds.length * segments.length;
  var count = 0;
  providerId = providerId | 0;
  var promise = new Promise(function (resolveSave) {
    _.forEach(feeds, function (value, index) {
      var userId = value.id;
      var username = value.username;

      var pictureUrl = value.profilePicUrl;
      if (!pictureUrl) {
        pictureUrl = value.picture;
      }
      _.each(segments, (segment) => {
        UserBase.findOne({
          segment: segment,
          username: username
        }, (err, user) => {
          current = ((count / total) * 100).toFixed(2);
          if (!err) {
            var isNew;
            if (!user) {
              user = {
                segment: segment,
                username: username,
                attempts: [],
                info: [{
                  un: currentLoginUser.username,
                  isFollower: true
                }]
              };
              isNew = true;
            }

            var isFollower = getInfo(user, currentLoginUser.username, 'isFollower');
            if (!isNew && !isFollower) {
              setInfo(user, currentLoginUser.username, 'isFollower', true);
            }
            if (isNew) {
              UserBase.create(user, function (err, user) {

                if (err) {
                  trace(err, 'error');
                }
                //trace(current + '% ' + 'Created new' + username + ' (segment: ' + segment + ')');
              });
            } else {
              user.save(function (err, user) {
                if (err) {
                  trace(err, 'error');
                }
                //trace(current + '% ' + 'Update user: ' + username + ' (segment: ' + segment + ')');
              });
            }

          } else {

            console.log('err')

          }
          count++;
          if (count >= total - 1) {
            resolveSave(feeds);
          }
        });
      })
    });
  });

  return promise;
};

const createFile = filename => {
  fs.open(filename, 'r', function (err, fd) {
    if (err) {
      fs.writeFile(filename, '', function (err) {
        if (err) {
          trace(err, 'error');
        }
        trace('The file was saved!');
      });
    } else {
      trace('The file exists!');
    }
  });
};

const setDayFollowers = (lastFollowers) => {
  if (!currentLoginUser || !currentLoginUser.username) {
    return;
  }
  var date = new Date();
  var utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
  getDayFollowers().then((followers) => {
    if (!followers) {
      UserDayFollwerKey.create({
        date: utcDate,
        username: currentLoginUser.username,
        keyFollowers: lastFollowers.map((f) => f.username).reverse()
      })
    }
  })
};

const getDayFollowers = (last) => {
  if (!currentLoginUser || !currentLoginUser.username) {
    return;
  }
  return new Promise(function (resolve, reject) {
    var date = new Date();
    var utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
    if (last) {
      utcDate.setDate(utcDate.getDate() - pendingDays);
    }
    UserDayFollwerKey.findOne({
      date: utcDate,
      username: currentLoginUser.username
    }).then((response) => {
      if (response && response.keyFollowers) {
        resolve(response.keyFollowers)
      } else {
        resolve()
      }

    }).catch((err) => {
      reject(err);
    })
  });
};

const updateKeyUsers = (targetUsername) => {
  console.log('Update key user from dropbox to: ' + targetUsername);
  let counter = 0;
  var promise = new Promise(function (resolve, reject) {
    readExcel(targetUsername).then((usernames) => {
      usernames.forEach((username) => {
        var item = username["Instagram Usernames"];
        KeyUser.findOne({
          username: item,
          userId: targetUsername
        }).then((user) => {
          if (!user) {
            KeyUser.create({
              username: item,
              userId: targetUsername
            }).then((user) => {
              counter++;
              if (counter >= usernames.length) {
                console.log(counter + ' users procesed!');
                console.log('[Ok]');
                resolve();
              }
            }).catch((err) => {
              console.log(err);
              counter++;
              if (counter >= usernames.length) {
                console.log(counter + ' users procesed!');
                console.log('[Ok]');
                resolve();
              }
            });
          } else {
            counter++;
            if (counter >= usernames.length) {
              console.log(counter + ' users procesed!');
              console.log('[Ok]');
              resolve();
            }
          }
        });
      });
    }).catch((err) => {
      console.log(err.message);
      console.log('[Failed]');
      reject(err);
    });
  });
  return promise;
};

const readExcel = (username) => {

  var promise = new Promise(function (resolve, reject) {
    const error = new Error();
    var dbx = new Dropbox({
      accessToken: dropboxAccessToken
    });
    dbx.filesListFolder({
        path: ''
      })
      .then(function (response) {
        var promises = [];
        if (response.entries) {
          var promise;
          response.entries.forEach((item) => {
            if (item.path_lower.indexOf(username) > 0) {
              promise = dbx.filesDownload({
                path: item.path_lower
              });
              return;
            }
          })
          if (promise) {
            return promise;
          } else {
            error.message = "Dropbox file not found";
            reject(error);
          }
        } else {
          error.message = "Dropbox file not found";
          reject(error);
        }
      })
      .catch(function (err) {
        reject(err);
      })
      .then((data) => {
        if (!data) {
          reject();
        } else {
          var workbook = XLSX.read(data.fileBinary, {
            type: 'buffer'
          });
          const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
          /*fs.writeFile(data.name, data.fileBinary, 'binary', function (err) {
            if (err) { throw err; }
            console.log('File: ' + data.name + ' saved.');
          });*/
          resolve(json);
        }
      })
      .catch((err) => {
        debugger;
      });
  });
  return promise;
};

const printPercent = (number, post) => {
  if (!post) {
    post = '';
  }
  trace(number + '% ' + post);
};

module.exports = {
  login,
  updateTargetFollowers,
  start,
  removeNotFollowers,
  updateKeyUsers
};
