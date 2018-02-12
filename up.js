var segment = 'nachodelriobodas';

var userId;
var password;
var maxOperationsPerHour = 60;
var maxRemoveOperationsPerHour = 60;
var upPeriodStart = 10;
var upPeriodEnd = 22;
var maxGetUsers = 1000;
var loopTime = 60 * 60 * 1000;
var onlyPublic = false;
var maxConsecutiveCreateOperations = 5;
var maxConsecutiveRemoveOperations = 5;
var waitBetweenOperationMinutes = 3

var sleepms = require('sleep-ms');
require('console-stamp')(console, '[HH:MM:ss.l]');
var util = require('util');
var fs = require('fs');
var process = require('process');
require('dotenv').load();
var segment = process.env.USER_INSTAGRAM
var Client = require('instagram-private-api').V1;
var device = new Client.Device(segment);
var storage = new Client.CookieFileStorage(
  __dirname + '/cookies/' + segment + '.json'
);
var mongoose = require('mongoose');
var _ = require('lodash');
var Promise = require('bluebird');
const eachAsync = require('each-async');

const { getFaceInfo } = require('./face');
if (!fs.existsSync('./tmp/')) {
  fs.mkdirSync('./tmp/');
}

var User = mongoose.model('User', {
  segment: String,
  userId: String,
  username: String,
  isFollower: Boolean,
  isPrivate: Boolean,
  providerId: String,
  createdDate: Date,
  requestDate: Date,
  requestNumber: { type: Number, default: 0 },
  pictureUrl: String,
  order: Number,
  gender: String,
  age: Number,
  eyeMakeup: Boolean,
  lipMakeup: Boolean,
  isFaceEval: Boolean,
  unfollowed: Boolean
});

var progressCounter = 0;

const login = (userId, password) => {
  this.userId = userId;
  this.password = password;
  this.currentLoginUser = {
    id: userId,
    password: password
  };
  var user_mongo = process.env.USER_MONGO;
  var pwd_mongo = process.env.PWD_MONGO;
  this.segment = userId;
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
  db.on('error', console.error.bind(console, 'connection error:'));
};

const updateTargetFollowers = (loginUser, targetUsername, force) => {
  currentLoginUser = loginUser;
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
          console.log('Procesing...');

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
        saveUpdateFollowers(1, feeds, user.id).then(function(followers) {
          resolve();
        });
      }
    });
  });

  return promise;
};

const getUsers = numLimits => {
  var promise = new Promise(function(resolve) {
    var query = User.find({
      requestNumber: 0,
      unfollowed: { $ne: true },
      isFollower: { $ne: true },
      isPrivate: { $ne: true }
    });
    if (numLimits && Number.isInteger(numLimits)) {
      query = query.limit(numLimits);
    }
    query.sort({ order: 1 }).then(users => {
      console.log('Recieved ' + users.length + ' new users.');
      resolve(users);
    });
  });

  return promise;
};

const start = loginUser => {
  currentLoginUser = loginUser;
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
                          item.isFollower = isFollower(
                            item.userId,
                            data.currentUserInfo.followers
                          );
                          item.save().then(respose => {
                            //if(!item.isFollower && item.gender === "female"){
                            if (!item.isFollower) {
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
                                console.log(e)
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
                            console.log(counter + '-' + globalCounter);
                          });
                        }
                      );
                    } else if (item && item.isFaceEval) {
                      item.isFollower = isFollower(
                        item.userId,
                        data.currentUserInfo.followers
                      );
                      item.save().then(respose => {
                        //if(!item.isFollower && item.gender === "female"){
                        if (!item.isFollower) {
                          createRelationship(item.username).then(added => {
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
                            console.log(e)
                            if (e && e.message === 'Please wait a few minutes before you try again.') {
                              pause = true;
                              waitFor(waitBetweenOperationMinutes, function() {
                                pause = false;
                                doNext = true;
                              });
                            }
                            doNext = true;
                          })
                        } else {
                          doNext = true;
                        }
                        console.log(
                          counter +
                            1 +
                            '-' +
                            globalCounter +
                            '-' +
                            (targetUsers.length - internalCounter)
                        );
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



const waitFor = (minutes, done) => {
  var total = minutes * 60 * 1000;
  var internalCounter = 0; 
  console.log("Waiting " + minutes + "for next loop...");
  var internalPointer = setInterval(function(){
    internalCounter++;
    var remainingMs = (total - (internalCounter * 1000))/1000
    if(remainingMs % 60 === 0) {
      console.log('Remaining time: ' + remainingMs / 60 + ' minutes');
    }
    if((internalCounter *  1000) > total){
      clearInterval(internalPointer);
      if(done){
        done();
      }
    }
  }, 1000);
}

const removeNotFollowers = (loginUser, forze) => {
  currentLoginUser = loginUser;

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
          if(!pause){
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
                      }).catch((e)=>{
                        console.log(e)
                        if (e && e.message === 'Please wait a few minutes before you try again.') {
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
            User.remove({ username: username }).then(err => {
              if (err.result.ok === 1) {
                console.log('removed:' + username);
              }
              resolve(false);
            });
          }
          return;
        }

        if (user && !user.friendshipStatus.outgoing_request) {
          if (onlyPublic) {
            if (!user.friendshipStatus.is_private) {
              console.log('Creating relationship to ' + username);
              return Client.Relationship.create(currentSession, user.id);
            } else {
              getUserFromDb(segment, username).then(
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
            console.log('Creating relationship to ' + username);
            return Client.Relationship.create(currentSession, user.id);
          }
        } else {
          if (user && !user.requestNumber) {
            getUserFromDb(segment, username).then((item)=>{
              if (item) {
                (item.requestDate = Date.now()), (item.requestNumber = 1);
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
          console.log('OK');
          return getUserFromDb(segment, username);
        } else {
          reject();
        }
      })
      .then(user => {
        if (user) {
          user.requestDate = Date.now();
          user.requestNumber += 1;
          user.save(response => {
            resolve(true);
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
          console.log('Destroy relationship with ' + username);
          return Client.Relationship.destroy(currentSession, user.id);
        } else {
          resolve();
        }
      })
      .catch(e => {
        reject(e);
      })
      .then(relationship => {
        console.log('[OK]');
        if (relationship) {
          return getUserFromDb(segment, username);
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
const getFollowingNotFollowers = userInfo => {
  return _.differenceBy(userInfo.followings, userInfo.followers, 'id');
};

const isFollower = (userId, providerFollowers) => {
  var user = _.find(providerFollowers, {
    id: parseInt(userId)
  });
  return user ? true : false;
};

const setUnfollowed = username => {
  User.findOne({ segment: segment, username: username }, function(err, user) {
    if (!err) {
      if (user) {
        user.unfollowed = true;
        user.save(function(err) {
          if (err) {
            console.log(err);
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

const getUserFromDb = (segment, username) => {
  var promise = new Promise(function(resolve, reject) {
    User.find({ segment: segment, username: username }).then(
      users => {
        if (users && users.length>0) {
          for(var i=1; i<users.length; i++) {
            console.log('Duplicates for username: ' + username);
            var id = users[i].get('id');
            User.remove({_id: id}).then((response)=>{
              if (response.result && !response.result.ok) {
                reject(response);
              } 
              console.log('Removed duplicate item ' +  id);
            })
          }
          resolve(users[0]);
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
        console.log('Getting ' + targerUsername + ' followings');
        return [data, getFollowing(data.currentUser)];
      })
      .spread(function(data, followings) {
        console.log('[OK]');
        data.followings = followings;
        console.log('Getting ' + targerUsername + ' followers');
        return [data, getFollowers(data.currentUser, data.followerCount)];
      })
      .spread(function(data, followers) {
        console.log('[OK]');
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

const saveUpdateFollowers = (page, feeds, providerId) => {
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
      //console.log(index);
      User.find({ segment: segment, username: username }, function(
        err,
        users
      ) {
        if (!err) {
          if (!users || (users && users.length === 0)) {
            user = new User({
              providerId: providerId,
              segment: segment,
              userId: userId,
              username: username,
              createdDate: Date.now(),
              order: (index + 1) * page,
              pictureUrl: pictureUrl,
              requestNumber: 0
            });
          } else {
            user = users[0]
            user.order = (index + 1) * page;
          }

          user.save(function(err) {
            if (err) {
              console.log(err);
            }
          });
        }
        printPercent(
          parseInt(count / total * 100),
          "Saving user '" + user.username + "'"
        );
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
          console.log(err);
        }
        console.log('The file was saved!');
      });
    } else {
      console.log('The file exists!');
    }
  });
};

const printPercent = (number, post) => {
  if (!post) {
    post = '';
  }
  console.log(number + '% ' + post);
};

module.exports = { login, updateTargetFollowers, start, removeNotFollowers };
