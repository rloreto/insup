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

Date.prototype.addHours = function(h){
  this.setHours(this.getHours()+h);
  return this;
}


var util = require('util');

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

var progressCounter = 0;



const trace = (str, type) => {
  type = type || 'log';
  switch(type){
    case 'log':
      logger.log('[' + currentLoginUser.id + '] ' +str);
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
  var promise = new Promise(function(resolve, reject) {
    trace("Load configuration of user: " + username);
    User.findOne({ username: username }).then((user) => {
    var config;
      if (!user) {
        config  = {
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
          segments: ["weddings"]
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
      segments = config.segments 
      
      trace(JSON.stringify(config));
      trace("[OK]");

      getUserStatus().then((availablePercentByUserSegmets)=>{
        trace(`The user '${username}' has available a ${availablePercentByUserSegmets}% of users.`);
      });

      resolve(config);
      
    })
  });

  return promise;
}

const login = (userId, password) => {
  currentLoginUser = {
    id: userId,
    password: password
  };


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
    setUserConfig(userId).then((config)=>{
      setDevice(userId);
      resolve();
    })
  });
  return promise;

};

var device, storage;
var Client = require('instagram-private-api').V1;

const setDevice = (username) => {
  device = new Client.Device(username);
  storage = new Client.CookieFileStorage(
    __dirname + '/cookies/' + username + '.json'
  );
}

const updateTargetFollowers = (obj) => {
  var loginUser= { id: obj.id, password: obj.password }
  var targetUsername = obj.targetUserName;
  var force= obj.force;
  var currentSegment = obj.segment;
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

          getFollowers(targetUser, followerCount, true, force).then(function() {
            resolve();
          });
        });
      } else {
        var feeds = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        saveUpdateFollowers(1, feeds, user.id, currentLoginUser.id, currentSegment).then(function(followers) {
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
  ini.setHours(startHour);
  ini.setMinutes(0);
  ini.setSeconds(0);
  var end = new Date(ini.getTime());
  end.addHours(activityHours);

  return(ini <= now && now <= end);
}

const start = loginUser => {
  if (!isActivityPeriod()) {
    return removeNotFollowers(loginUser);
  } else {
    currentLoginUser = loginUser;
    setDevice(currentLoginUser.id);
    var promise = new Promise(function(resolve) {
      getUserInfo(loginUser).then(currentUserInfo => {
        var data = {
          currentUserInfo: currentUserInfo
        };
        var max = maxOperationsPerHour;
        var counter = 0;
        var iteration = 0;
        var doNext = true;
        var internalCounter = 0;
        var targetUsers = [];

        getUsers(maxGetUsers, loginUser.id).then(users => {
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
            if(loopCounter % loadConfigurationUpdateFrecuencySeconds === 0) {
              setUserConfig(loginUser.id);
            }

            if (!pause && !isLoading && targetUsers && targetUsers.length > 0) {
              isLoading = true;
              if (internalCounter + 1 > targetUsers.length) {
                internalCounter = 0;
                targetUsers = [];
                getUsers(maxGetUsers, loginUser.id).then(users => {
                  targetUsers = users;
                  isLoading = false;
                });
              } else {
                if(!startTime){
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
                            setInfo(item, currentLoginUser.id, 'isFollower', true)
                          }

                          item.save().then(resporesponsese => {
                            var follower = getInfo(respose, currentLoginUser.id, 'isFollower');
                            if (!follower) {
                              createRelationship(
                                respose.username,
                                segments,
                                onlyPublic
                              ).then(added => {
                                if (added) {
                                  counter++;
                                  if(counter % maxConsecutiveCreateOperations === 0) {
                                    pause = true;
                                    waitFor(waitBetweenOperationMinutes, function() {
                                      isLoading = false;
                                      pause = false;
                                    });
                                  }
                                }
                                isLoading = false;
                              }).catch((e)=>{
                                trace(e, 'error')
                                if (e && e.message === 'Please wait a few minutes before you try again.') {
                                  pause = true;
                                  waitFor(waitBetweenOperationMinutes, function() {
                                    isLoading = false;
                                    pause = false;
                                  });
                                }
                                isLoading = false;
                              });
                            } else {
                              isLoading = false;
                            }
                          });
                        }
                      );
                    } else if (item && item.isFaceEval) {
                      var follower = isFollower(
                        item.username,
                        data.currentUserInfo.followers
                      );

                      if(follower) {
                        setInfo(item, currentLoginUser.id, 'isFollower', true)
                      }
                      
                      item.save().then(response => {
                        item = response;
                        var follower = getInfo(response, currentLoginUser.id, 'isFollower');
                        if (!follower) {
                          createRelationship(item.username, segments, onlyPublic).then(added => {
                            if (added) {
                              trace('Created relationship: '+ item.username +' '+ (counter + 1) + ' (' + internalCounter + ') of ' + max + ' (' + (targetUsers.length - internalCounter) + ')');
                              counter++;
                              if(counter % maxConsecutiveCreateOperations === 0 && counter !== max) {
                                pause = true;
                                waitFor(waitBetweenOperationMinutes, function() {
                                  isLoading = false;
                                  pause = false;
                                });
                              }
                            } else {
                              trace('Ignore relationship: '+ item.username +' '+ (counter + 1) + ' (' + internalCounter + ') of ' + max + ' (' + (targetUsers.length - internalCounter) + ')');
                            }
                            isLoading = false;
                          }).catch((e)=>{     
                            if (e) {
                              trace(e)
                              trace('Error creating relationship: '+ item.username +' '+ (counter + 1) + ' (' + internalCounter + ') of ' + max + ' (' + (targetUsers.length - internalCounter) + ')');
                              if(e.name === 'ActionSpamError' || e.message === 'Please wait a few minutes before you try again.') {
                                pause = true;
                                waitFor(waitBetweenOperationMinutes, function() {
                                  isLoading = false;
                                  pause = false;
                                  isLoading = false;
                                });
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
                      if(!isShow){
                        trace('Next activity start at: ' +  timeLimit.toLocaleString());
                        isShow = true;
                      }
                    }
                  } else {
                    isLoading = false;
                    if(!isShow){
                      trace('Next activity start at: ' +  timeLimit.toLocaleString());
                      isShow = true;
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
      });
    });
    return promise;
  }
};

const removeNotFollowers = (loginUser, forze) => {
  currentLoginUser = loginUser;
  setDevice(currentLoginUser.id);
  var promise = new Promise(function(resolve) {
    getUserInfo(loginUser)
      .then(currentUserInfo => {
        //var users = getFollowingNotFollowers(currentUserInfo);
        var users = currentUserInfo.followings;
        if (users.length === 0) {
          users = currentUserInfo.followings;
        }
        return users;
      })
      .then(users => {
        users = users.reverse();
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
            start(loginUser);
          } else {
            if(loopCounter % loadConfigurationUpdateFrecuencySeconds === 0) {
              setUserConfig(loginUser.id);
            }

            if(!pause && !isLoading){
              isLoading = true;
              if(!startTime){
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
                        setUnfollowed(user.username, currentLoginUser.id, segments);
                      }
                      counter++;
                      trace('Destroying relationship ' + counter + ' of ' + max);
                      if(counter % maxConsecutiveRemoveOperations === 0 && counter !== max) {
                        pause = true;
                        waitFor(waitBetweenOperationMinutes, function() {
                          pause = false;
                          isLoading = false;
                        });
                      }
                      isLoading = false;
                      
                    }).catch((e)=>{
                      trace(e, 'error')
                      if(e.name === 'ActionSpamError' || e.message === 'Please wait a few minutes before you try again.') {
                        pause = true;
                        waitFor(waitBetweenOperationMinutes, function() {
                          pause = false;
                          isLoading = false;
                        });
                      } else {
                        isLoading = false;
                      }
                    });
                  } else {
                    isLoading = false;
                    if(!isShow){
                      trace('Next activity start at: ' +  timeLimit.toLocaleString());
                      isShow = true;
                    }
                  }
                } else {
                  isLoading = false;
                  if(!isShow){
                    trace('Next activity start at: ' +  timeLimit.toLocaleString());
                    isShow = true;
                  }  
                }
              }
            }
          }
        }
        loop();
        var loopPointer = setInterval(loop, 1000);
      });
  });

  return promise;
};

const setInfo = (user, currentUsername, property, value) => {
  if(user.info && user.info.length>0){
    var found = user.info.find(function(item) {
      return item.un === currentUsername && item[property];
    });
    if (!found){
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
  if(user.info && user.info.length>0){
    var found = user.info.find(function(item) {
      return item.un === currentUsername && item[property] !== undefined;
    });
    if (found){
      return found[property];
    }
  } 
}

const waitFor = (minutes, done) => {
  var total = minutes * 60 * 1000;
  var internalCounter = 0; 
  trace("Waiting " + minutes + " minutes for next loop...");
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

const getUsers = (numLimits, username) => {
  var promise = new Promise(function(resolve) {
  var query = UserBase.find({
      "attempts.un":  { "$ne": username },
      "$or": [{
          "info.un":  { "$eq": username },
          "info.unfollowed":  { "$ne": true}
        },
        {
          "info.un":  { "$ne": username }
        }
      ],
      "$or": [
      {
        "info.un":  { "$eq": username },
        "info.isFollower":  { "$ne": true}
      },
      {
        "info.un":  { "$ne": username }
      }
    ]
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

const createRelationship = (username, segments, onlyPublic) => {
  var promise = new Promise(function(resolve, reject) {
      getUserId(currentLoginUser, username)
      .then(response => {
        var user;
        if (!response.hasError) {
          user = response.data;
        } else {
          if (response.error.name === 'IGAccountNotFoundError') {
            var total = segments.length;
            var counter = 0 ;
            _.each(segments, (segment) => {
              UserBase.remove({ username: username, segment: segment }).then(err => {
                if (err.result.ok === 1) {
                  trace('removed:' + username);
                }
                counter++;
                if(counter == total) {
                  resolve(false);
                }
              });
            })
          }
          return;
        }

        if (user && !user.friendshipStatus.outgoing_request) {
          if (onlyPublic) {
            if (!user.friendshipStatus.is_private) {
              trace('Creating relationship to ' + username);
              return Client.Relationship.create(currentSession, user.id);
            } else {
              return getUserFromDb(username).then(
                user => {
                  if (user) {
                    user.isPrivate = true;
                  }
                  user.save();
                }
              );
              reject("!user.friendshipStatus.is_private");
            }
          } else {
            trace('Creating relationship to ' + username);
            return Client.Relationship.create(currentSession, user.id);
          }
        } else {
          var attempts = getAttempts(username, currentLoginUser.id);
          if (!attempts) {
            return getUserFromDb(username).then((item)=>{
              if (item) {
                setAttempts(item, currentLoginUser.id, 1);
                item.save();
              }
            })
          }
          reject("user.friendshipStatus.outgoing_request)");
        }
      }).catch(e => {
        reject(e);
      }).then(relationship => {
        if (relationship) {
          return getUserFromDb(username);
        } else {
          reject("no relationship");
        }
      })
      .then(user => {
        if (user) {
          var attempts = getAttempts(user, username);
          attempts++;
          setAttempts(user, currentLoginUser.id, attempts++);
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
    username: username
  });
  return user ? true : false;
};

const setUnfollowed = (username, unfollowBy, segments) => {
  _.each(segments, (segment)=>{
    UserBase.findOne({ segment: segment, username: username }, function(err, user) {
      if (!err) {
        if (user) {
          if(user.info && user.info.length > 0){
            var found = user.info.find(function(item) {
              return item.un === username;
            });
  
            if(!found) {
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
          user.save(function(err) {
            if (err) {
              trace(err,'error');
            }
          });
        }
      }
    });
  })
  
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
   
    const filter = _.assign(segmentFilter, { username: username});
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


const getUserInfo = (loginUser) => {
  var promise = new Promise(function(resolve) {
    Client.Session.create(device, storage, loginUser.id, loginUser.password)
      .then(function(session) {
        var data = {
          currentSession: session
        };
        return [data, Client.Account.searchForUser(session, loginUser.id)];
      })
      .spread(function(data, user) {
        data.followerCount = user._params.followerCount;
        data.currentUser = {
          id: user._params.id,
          name: user._params.username,
          currentSession: data.currentSession
        };
        trace('Getting ' + loginUser.id + ' followings');
        return [data, getFollowing(data.currentUser)];
      })
      .spread(function(data, followings) {
        trace('[OK]');
        data.followings = followings;
        trace('Getting ' + loginUser.id + ' followers');
        return [data, getFollowers(data.currentUser, data.followerCount, false, /*env === 'prod'*/ false)];
      })
      .spread(function(data, followers) {
        trace('[OK]');
        data.followers = followers;
        resolve(data);
      });
  });
  return promise;
};

const getFollowers = (user, followerCount, saveUsers, force) => {
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
      trace('Getting followers from live. NO CACHE');
      var timeoutObj = setInterval(function() {
        if (counter > followerCount) {
          clearInterval(timeoutObj);
          printPercent(100);
          fs.writeFileSync(cacheFile, JSON.stringify(feedsDone), 'utf-8');
          resolve(feedsDone);
        } else {
          //printPercent(parseInt(counter / followerCount * 100));
          if (getMore) {
            getMore = false;
            accountFollowers.get().then(function(results) {
              if (results && results.length > 0) {
                var data = _.flattenDeep(results);
                var followers = _.map(data, function(feed) {
                  return feed._params;
                });
                if (saveUsers) {
                  saveUpdateFollowers(page, followers, user.id).then(function(
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

const getUserStatus =  function() {
  var promise = new Promise((resolve) => {
    UserBase.count({ segment: 
      {
        "$in": segments 
      }
    }).then((total) => {
      UserBase.count({
        "segment": {
          "$in": segments
        },
        "$or": [
            {
                "attempts.un": {
                    "$eq": currentLoginUser.id
                },
                "attempts.n": {
                    "$lt": 1
                }
            },
            {
                "attempts.un": {
                    "$ne": currentLoginUser.id
                }
            },
            {
                "info.un": {
                    "$eq": currentLoginUser.id
                },
                "info.unfollowed": {
                    "$ne": true
                }
            }
        ]
      }).then((available) => {
        resolve((available / total * 100).toFixed(2) );
      });
    });
  });

  return promise;
}

const saveUpdateFollowers = (page, feeds, providerId) => {

  var total = feeds.length * segments.length;
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
      _.each(segments, (segment)=>{
        UserBase.findOne({ segment: segment, username: username }, (err,user) => {
          current = ((count/total) * 100).toFixed(2);
          if (!err) {
            var isNew;
            if (!user ) {
              user = {
                segment: segment,
                username: username,
                attempts: [],
                info: []
              };
              isNew = true;
            }
            
            if(!isNew && !getInfo(user, currentLoginUser.id, 'isFollower')){
              setInfo(user, currentLoginUser.id, 'isFollower', true);
            } 
            if(isNew) {
              UserBase.create(user, function(err, user) {
  
                if (err) {
                  trace(err, 'error');
                }
                trace(current + '% ' + 'Created new' + username + ' (segment: ' + segment + ')');
              });
            } else {
              user.save(function(err, user) {
                if (err) {
                  trace(err, 'error');
                }
                trace(current + '% ' + 'Update user: ' + username + ' (segment: ' + segment + ')');
              });
            }

          } else {
            debugger;
            console.log('err')
           
          } 
          count++;
          if (count >= total -1) {
            resolveSave(feeds);
          }
        });
      })
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
