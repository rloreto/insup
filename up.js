var segment = 'nachodelriobodas';

var userId;
var password;
var loopTime = 60 * 60 * 1000;

var maxOperationsPerHour;
var maxRemoveOperationsPerHour;
var upPeriodStart;
var upPeriodEnd;
var maxGetUsers;
var onlyPublic;
var maxConsecutiveCreateOperations;
var maxConsecutiveRemoveOperations;
var waitBetweenOperationMinutes;
var segments;
var logger;



var util = require('util');
var process = require('process');
const fs = require('fs');
require('dotenv').load();

var mongoose = require('mongoose');
var _ = require('lodash');
var Promise = require('bluebird');
const eachAsync = require('each-async');

const { getFaceInfo } = require('./face');
if (!fs.existsSync('./tmp/')) {
  fs.mkdirSync('./tmp/');
}

var user_mongo = process.env.USER_MONGO;
var pwd_mongo = process.env.PWD_MONGO;


mongoose.connect(
  'mongodb://' +
    user_mongo +
    ':' +
    pwd_mongo +
    '@ds123695.mlab.com:23695/instagram',
  { useMongoClient: true }
);
mongoose.Promise = Promise;
var db = mongoose.connection;


var UserBase = mongoose.model('UserBase', {
  segment: String,
  userId: String,
  username: String,
  attempts: [],
  unfollowBy: []
});

var User = mongoose.model('User', {
  username: String,
  maxOperationsPerHour: Number,
  maxRemoveOperationsPerHour: Number,
  attemupPeriodStartpts: Number,
  upPeriodStart: Number,
  maxGetUsers: Number,
  onlyPublic: Boolean,
  maxConsecutiveCreateOperations: Number,
  maxConsecutiveRemoveOperations: Number,
  waitBetweenOperationMinutes: Number,
  segments: []
});

var progressCounter = 0;

const trace = (str, type) => {
  type = type || 'log';
  switch(type){
    case 'log':
      logger.log('[' + segment + '] ' +str);
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

const loadUserConfig = (username) => {
  var promise = new Promise(function(resolve, reject) {
    User.findOne({ username: username }).then((user) => {
      if (user) {
        resolve({
          maxOperationsPerHour: user.maxOperationsPerHour,
          maxRemoveOperationsPerHour: user.maxRemoveOperationsPerHour,
          upPeriodStart: user.upPeriodStart,
          upPeriodEnd: user.upPeriodEnd,
          maxGetUsers: user.maxGetUsers,
          onlyPublic: user.onlyPublic,
          maxConsecutiveCreateOperations: user.maxConsecutiveCreateOperations,
          maxConsecutiveRemoveOperations: user.maxConsecutiveRemoveOperations,
          waitBetweenOperationMinutes: user.waitBetweenOperationMinutes,
          segments: user.segments
        });
      } else {
        resolve({})
      }
    })
  });

  return promise;
}

const login = (userId, password) => {
  const console_stamp = require('console-stamp')
  var dir = './logs/';

  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
  }
  dir = './logs/' + userId.replace('.','_');

  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
  }
  const output = fs.createWriteStream('./logs/' + userId.replace('.','_') + '/out.log');
  const errorOutput = fs.createWriteStream('./logs/' + userId.replace('.','_') +'/err.log');
  logger = new console.Console(output, errorOutput);
  db.on('error', logger.error.bind(logger, 'connection error:'));

  console_stamp(logger, {
    stdout: output,
    stderr: errorOutput,
    pattern: 'dd-mm-yyyy HH:MM:ss.l'
  });

  var promise = new Promise(function(resolve, reject) {
    loadUserConfig(userId).then((config)=>{
      console.log(config);
      maxOperationsPerHour = config.maxOperationsPerHour || 60;
      maxRemoveOperationsPerHour = config.maxRemoveOperationsPerHour || 60;
      upPeriodStart = config.upPeriodStart || 10;
      upPeriodEnd = config.upPeriodEnd || 22;
      maxGetUsers = config.maxGetUsers || 1000;
      onlyPublic = config.onlyPublic || false;
      maxConsecutiveCreateOperations = config.maxConsecutiveCreateOperations || 5;
      maxConsecutiveRemoveOperations = config.maxConsecutiveRemoveOperations || 5;
      waitBetweenOperationMinutes = config.waitBetweenOperationMinutes || 3
      segments = config.segments || ["weddings"]
      setDevice(userId);
      this.userId = userId;
      this.password = password;
      this.currentLoginUser = {
        id: userId,
        password: password
      };
      resolve();
    })
  });
  return promise;

};

var segment, device, storage;
var Client = require('instagram-private-api').V1;

const setDevice = (username) => {
  segment = username;
  device = new Client.Device(segment);
  storage = new Client.CookieFileStorage(
    __dirname + '/cookies/' + segment + '.json'
  );
}

const updateTargetFollowers = (obj) => {
  var loginUser= { id: obj.id, password: obj.password }
  var targetUsername = obj.targetUserName;
  var force= obj.force;
  var segment= obj.segment;

  currentLoginUser = loginUser;
  setDevice(currentLoginUser.id);
  var currentSession;
  var followers;
  var promise = new Promise(function(resolve) {
    var setId = function(name, id) {
      var targetIndex = _.findIndex(targetUsers, function(userName) {
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
          loginUser.id,
          loginUser.password
        ).then(function(session) {
          trace('Procesing...');

          var followerCount = user.followerCount;
          var targetUser = {
            id: user.id,
            name: targetUsername,
            currentSession: session
          };

          getFollowers(targetUser, followerCount, true, force, segment).then(function() {
            resolve();
          });
        });
      } else {
        var feeds = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        saveUpdateFollowers(1, feeds, user.id, segment).then(function(followers) {
          resolve();
        });
      }
    });
  });

  return promise;
};

const start = loginUser => {
  currentLoginUser = loginUser;
  setDevice(currentLoginUser.id);
  var promise = new Promise(function(resolve) {
    getCurrentUserInfo(loginUser).then(currentUserInfo => {
      var data = {
        currentUserInfo: currentUserInfo
      };
      var max = maxOperationsPerHour;
      var counter = 0;
      var iteration = 0;
      var doNext = true;
      var internalCounter = 0;
      var globalCounter = 0;
      var targetUsers = [];

      getUsers(maxGetUsers).then(users => {
        targetUsers = users;
      });

      function loop() {
        var date = new Date();
        var currentHour = date.getHours();
  
        var pause = false;

        if (!(upPeriodStart < currentHour && currentHour <= upPeriodEnd)) {
          clearInterval(loopPointer);
          removeNotFollowers(loginUser);
        } else {
          function internalLoop() {
            if (!pause && targetUsers && targetUsers.length > 0) {
              if (internalCounter + 1 > targetUsers.length) {
                internalCounter = 0;
                targetUsers = [];
                getUsers(maxGetUsers).then(users => {
                  targetUsers = users;
                });
              } else {
                if (counter >= max) {
                  clearInterval(internalPointer);
                  counter = 0;
                  doNext = true;
                } else {
                  if (doNext) {
                    var item = targetUsers[internalCounter];
                    internalCounter++;
                    doNext = false;
                    globalCounter++;

                    //TODO Remove
                    item.isFaceEval = true;

                    if (item && !item.isFaceEval) {
                      getFaceInfo(item.pictureUrl.replace('s150x150', '')).then(
                        faceInfo => {
                          if (faceInfo) {
                            item.gender = faceInfo.gender;
                            item.age = faceInfo.age;
                            item.lipMakeup = faceInfo.makeup.lipMakeup;
                            item.eyeMakeup = faceInfo.makeup.eyeMakeup;
                          }
                          item.isFaceEval = true;
                          var follower = isFollower(
                            item.username,
                            data.currentUserInfo.followers
                          );

                          if(follower) {
                            setInfo(item, segment, 'isFollower', true)
                          }

                          item.save().then(respose => {
                            var follower = getInfo(item, segment, 'isFollower');
                            if (!follower) {
                              createRelationship(
                                item.username,
                                onlyPublic
                              ).then(added => {
                                if (added) {
                                  counter++;
                                  if(counter % maxConsecutiveCreateOperations === 0) {
                                    pause = true;
                                    waitFor(waitBetweenOperationMinutes, function() {
                                      pause = false;
                                      doNext = true;
                                    });
                                  }
                                }
                                doNext = true;
                              }).catch((e)=>{
                                trace(e, 'error')
                                if (e && e.message === 'Please wait a few minutes before you try again.') {
                                  pause = true;
                                  waitFor(waitBetweenOperationMinutes, function() {
                                    pause = false;
                                    doNext = true;
                                  });
                                }
                                doNext = true;
                              });
                            } else {
                              doNext = true;
                            }
                            trace(counter + '-' + globalCounter);
                          });
                        }
                      );
                    } else if (item && item.isFaceEval) {
                      var follower = isFollower(
                        item.username,
                        data.currentUserInfo.followers
                      );

                      if(follower) {
                        setInfo(item, segment, 'isFollower', true)
                      }
                      
                      item.save().then(respose => {
                        var follower = getInfo(item, segment, 'isFollower');
                        if (!follower) {
                          createRelationship(item.username).then(added => {
                            if (added) {
                              trace('Created relationship: '+ item.username +' '+ (counter + 1) + ' (' + globalCounter + ') of ' + max + ' (' + (targetUsers.length - internalCounter) + ')');
                              counter++;
                              if(counter % maxConsecutiveCreateOperations === 0) {
                                pause = true;
                                waitFor(waitBetweenOperationMinutes, function() {
                                  pause = false;
                                  doNext = true;
                                });
                              }
                            } else {
                              trace('Ignore relationship: '+ item.username +' '+ (counter + 1) + ' (' + globalCounter + ') of ' + max + ' (' + (targetUsers.length - internalCounter) + ')');
                            }
                            doNext = true;
                          }).catch((e)=>{     
                            if (e) {
                              trace(e)
                              trace('Error creating relationship: '+ item.username +' '+ (counter + 1) + ' (' + globalCounter + ') of ' + max + ' (' + (targetUsers.length - internalCounter) + ')');
                              if(e.name === 'ActionSpamError' || e.message === 'Please wait a few minutes before you try again.') {
                                pause = true;
                                waitFor(waitBetweenOperationMinutes, function() {
                                  pause = false;
                                  doNext = true;
                                });
                              }
                            } 
                            doNext = true;
                          })
                        } else {
                          doNext = true;
                          trace('Ignore follower relationship: ' + item.username + ' ' + (counter + 1) + ' (' + globalCounter + ') of ' + max + ' (' + (targetUsers.length - internalCounter) + ')');
                        }
                        
                        
                      });
                    } else {
                      doNext = true;
                    }
                  }
                }
              }
            }
          }
          internalLoop();
          var internalPointer = setInterval(internalLoop, 500);
          iteration++;
        }
      }

      loop();
      var loopPointer = setInterval(loop, loopTime);
    });
  });
  return promise;
};

const removeNotFollowers = (loginUser, forze) => {
  currentLoginUser = loginUser;
  setDevice(currentLoginUser.id);
  var promise = new Promise(function(resolve) {
    getCurrentUserInfo(loginUser)
      .then(currentUserInfo => {
        var users = getFollowingNotFollowers(currentUserInfo);
        if (users.length === 0) {
          users = currentUserInfo.followings;
        }
        return users;
      })
      .then(users => {
        users = users.reverse();
        var max = maxRemoveOperationsPerHour;
        var counter = 0;
        var doNext = true;
        var globalCounter = 0;
        var pause = false;
        function loop() {
          var date = new Date();
          var currentHour = date.getHours();

          if (
            upPeriodStart < currentHour &&
            currentHour <= upPeriodEnd &&
            !forze
          ) {
            clearInterval(loopPointer);
            start(loginUser);
          } else {
            function internalLoop() {
              if(!pause){
                if (counter >= max) {
                  clearInterval(internalPointer);
                  counter = 0;
                  doNext = true;
                } else {
                  if (doNext) {
                    var item = users[globalCounter];
                    doNext = false;
                    globalCounter++;
                    if (item) {
                      destroyRelationship(item.username).then(user => {
                        if (user) {
                          setUnfollowed(user.username);
                        }
                        counter++;
                        if(counter % maxConsecutiveRemoveOperations === 0) {
                          pause = true;
                          waitFor(waitBetweenOperationMinutes, function() {
                            pause = false;
                            internalPointer = setInterval(internalLoop, 500);
                          });
                        }
                        doNext = true;
                        trace('Destroying relationship ' + counter + ' of ' + max);
                      }).catch((e)=>{
                        trace(e, 'error')
                        if(e.name === 'ActionSpamError' || e.message === 'Please wait a few minutes before you try again.') {
                          pause = true;
                          waitFor(waitBetweenOperationMinutes, function() {
                            pause = false;
                            internalPointer = setInterval(internalLoop, 500);
                          });
                        }
                      });
                    }
                  }
                }
              }
            }
            
            internalLoop();
            var internalPointer = setInterval(internalLoop, 500);
          }
        }

        loop();
        var loopPointer = setInterval(loop, loopTime);
      });
  });

  return promise;
};

const setInfo = (user, currentUsername, property, value) => {
  debugger;
  if(user.info && user.info.length>0){
    var found = user.info.find(function(item) {
      return item.un === currentUsername;
    });
    if (!found){
      var obj = {
        un: currentUsername
      }
      obj[property] = value;

      user.info.push(onj)
    } else {
      obj[property] = value;
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
  if(user.info && user.info.length>0){
    var found = user.info.find(function(item) {
      return item.un === currentUsername;
    });
    if (found){
      return found[property];
    }
  } 
}

const waitFor = (minutes, done) => {
  var total = minutes * 60 * 1000;
  var internalCounter = 0; 
  trace("Waiting " + minutes + " for next loop...");
  var internalPointer = setInterval(function(){
    internalCounter++;
    var remainingMs = (total - (internalCounter * 1000))/1000
    if(remainingMs % 60 === 0) {
      trace('Remaining time: ' + remainingMs / 60 + ' minutes');
    }
    if((internalCounter *  1000) > total){
      clearInterval(internalPointer);
      if(done){
        done();
      }
    }
  }, 1000);
}

const getUsers = numLimits => {
  var promise = new Promise(function(resolve) {
  var query = UserBase.find({
      /*"$or": [
        "attempts.un":  { "$eq": segment },
        "attempts.un":  { "$lt": 1 },
      ],*/
      "attempts.un":  { "$ne": segment }
    });
    if (numLimits && Number.isInteger(numLimits)) {
      query = query.limit(numLimits);
    }
    query.sort({ order: 1 }).then(users => {
      trace('Recieved ' + users.length + ' new users.');
      resolve(users);
    });
  });

  return promise;
};

_.bind(start, this);
_.bind(removeNotFollowers, this);

const createRelationship = (username, onlyPublic) => {
  var promise = new Promise(function(resolve, reject) {
      getUserId(currentLoginUser, username)
      .then(response => {
        var user;
        if (!response.hasError) {
          user = response.data;
        } else {
          if (response.error.name === 'IGAccountNotFoundError') {
            UserBase.remove({ username: username, segment: segment }).then(err => {
              if (err.result.ok === 1) {
                trace('removed:' + username);
              }
              resolve(false);
            });
          }
          return;
        }

        if (user && !user.friendshipStatus.outgoing_request) {
          if (onlyPublic) {
            if (!user.friendshipStatus.is_private) {
              trace('Creating relationship to ' + username);
              return Client.Relationship.create(currentSession, user.id);
            } else {
              getUserFromDb(username).then(
                user => {
                  if (user) {
                    user.isPrivate = true;
                  }
                  user.save();
                }
              );
              reject();
            }
          } else {
            trace('Creating relationship to ' + username);
            return Client.Relationship.create(currentSession, user.id);
          }
        } else {
          var attempts = getAttempts(username, segment);
          if (!attempts) {
            getUserFromDb(username).then((item)=>{
              if (item) {
                setAttempts(item, segment, 1);
                item.save();
              }
            })
          }
          reject();
        }
      }).catch(e => {
        reject(e);
      }).then(relationship => {
        if (relationship) {
          return getUserFromDb(username);
        } else {
          reject();
        }
      })
      .then(user => {
        if (user) {
          var attempts = getAttempts(user, segment);
          attempts++;
          setAttempts(user, segment, attempts++);
          user.save((err, response) => {
            if(!err){
              trace('[OK]');
              resolve(true);
            }
          });
        } else {
          resolve(false);
        }
      });
    
  });

  return promise;
};

const destroyRelationship = username => {
  var promise = new Promise(function(resolve, reject) {
    getUserId(currentLoginUser, username)
      .then(response => {
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
        trace('[OK]');
        if (relationship) {
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
  if(user.attempts && user.attempts.length>0){
    var found = user.attempts.find(function(item) {
      return item.un === currentUsername;
    });
    if (found){
      return found.n;
    }
  } 
  return 0;
}

const setAttempts = (user, currentUsername, value) => {
  if(user.attempts && user.attempts.length>0){
    var found = user.attempts.find(function(item) {
      return item.un === currentUsername
    });
    if (!found){
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
    username: parseInt(username)
  });
  return user ? true : false;
};

const setUnfollowed = username => {
  UserBase.findOne({ segment: segment, username: username }, function(err, user) {
    if (!err) {
      if (user) {
        if(user.attempts && user.attempts.length>0){
          var found = user.attempts.find(function(item) {
            return item.un === segment;
          });

          if(!found) {
            user.unfollowBy.push({
              un: segment
            });
          }

        } else {
          user.unfollowBy.push({
            un: segment
          });
        }
        user.save(function(err) {
          if (err) {
            trace(err,'error');
          }
        });
      }
    }
  });
};

const getUserId = (loginUser, username) => {
  var promise = new Promise(function(resolve) {
    Client.Session.create(device, storage, loginUser.id, loginUser.password)
      .then(function(session) {
        var data = {
          currentSession: session
        };
        currentSession = session;
        return Client.Account.searchForUser(session, username);
      })
      .then(function(user) {
        resolve({ hasError: false, data: user._params });
      })
      .catch(function(e) {
        resolve({ hasError: true, error: e });
      });
  });
  return promise;
};

const getUserFromDb = (username) => {
  var promise = new Promise(function(resolve, reject) {

    var segmentFilter = {}
    if(segments && segments.length>0){
      segmentFilter["$or"] = [];
      _.forEach(segments, (segment) => {
        segmentFilter["$or"].push({
          segment: segment
        })
      });
    }
    debugger;
    const filter = _.assign(segmentFilter, { username: username });
    UserBase.find(filter).then(
      users => {
        if (users && users.length>0) {
          for(var i=1; i<users.length; i++) {
            trace('Duplicates for username: ' + username);
            var id = users[i].get('id');
            UserBase.remove({_id: id}).then((response)=>{
              if (response.result && !response.result.ok) {
                reject(response);
              } 
              trace('Removed duplicate item ' +  id);
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

const getCurrentUserInfo = loginUser => {
  return gettUserInfo(loginUser, segment);
};

const gettUserInfo = (loginUser, targerUsername) => {
  var promise = new Promise(function(resolve) {
    Client.Session.create(device, storage, loginUser.id, loginUser.password)
      .then(function(session) {
        var data = {
          currentSession: session
        };
        return [data, Client.Account.searchForUser(session, targerUsername)];
      })
      .spread(function(data, user) {
        data.followerCount = user._params.followerCount;
        data.currentUser = {
          id: user._params.id,
          name: user._params.username,
          currentSession: data.currentSession
        };
        trace('Getting ' + targerUsername + ' followings');
        return [data, getFollowing(data.currentUser)];
      })
      .spread(function(data, followings) {
        trace('[OK]');
        data.followings = followings;
        trace('Getting ' + targerUsername + ' followers');
        return [data, getFollowers(data.currentUser, data.followerCount)];
      })
      .spread(function(data, followers) {
        trace('[OK]');
        data.followers = followers;
        resolve(data);
      });
  });
  return promise;
};

const getFollowers = (user, followerCount, saveUsers, force, segment) => {
  var accountFollowers = new Client.Feed.AccountFollowers(
    user.currentSession,
    user.id
  );
  var page = 1;
  var getMore = true;
  var counter = 0;
  var feedsDone = [];
  var cacheFile = './tmp/' + user.name + '_followers.json';

  var promise = new Promise(function(resolve) {
    if (!fs.existsSync(cacheFile) || force) {
      var timeoutObj = setInterval(function() {
        if (counter > followerCount) {
          clearInterval(timeoutObj);
          printPercent(100);
          fs.writeFileSync(cacheFile, JSON.stringify(feedsDone), 'utf-8');
          resolve(feedsDone);
        } else {
          printPercent(parseInt(counter / followerCount * 100));
          if (getMore) {
            getMore = false;
            accountFollowers.get().then(function(results) {
              if (results && results.length > 0) {
                var data = _.flattenDeep(results);
                var followers = _.map(data, function(feed) {
                  return feed._params;
                });
                if (saveUsers) {
                  saveUpdateFollowers(page, followers, user.id, segment).then(function(
                    followers
                  ) {
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
                counter = followerCount + 1;
              }
            });
          }
        }
      }, 1000);
    } else {
      var feeds = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
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
  var promise = new Promise(function(resolve) {
    accountFollowing.get().then(function(results) {
      var data = _.flattenDeep(results);
      var feeds = _.map(data, function(feed) {
        return feed._params;
      });
      resolve(feeds);
    });
  });

  return promise;
};

const saveUpdateFollowers = (page, feeds, providerId, segment) => {
  var total = feeds.length;
  var count = 0;
  providerId = providerId | 0;
  var promise = new Promise(function(resolveSave) {
    _.forEach(feeds, function(value, index) {
      var userId = value.id;
      var username = value.username;

      var pictureUrl = value.profilePicUrl;
      if (!pictureUrl) {
        pictureUrl = value.picture;
      }
      //trace(index);
      UserBase.findOne({ segment: segment, username: username }, function(
        err,
        user
      ) {
        if (!err) {
          if (!user) {
            user = new UserBase({
              segment: segment,
              username: username
            });

            user.save(function(err) {
              if (err) {
                trace(err, 'error');
              }
              trace('Added new user: ' + username + ' to segment: ' + segment);
            });
          } 
        }

        count++;
        if (count === total) {
          resolveSave(feeds);
        }
      });
    });
  });

  return promise;
};



const createFile = filename => {
  fs.open(filename, 'r', function(err, fd) {
    if (err) {
      fs.writeFile(filename, '', function(err) {
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

const printPercent = (number, post) => {
  if (!post) {
    post = '';
  }
  trace(number + '% ' + post);
};

module.exports = { login, updateTargetFollowers, start, removeNotFollowers };
