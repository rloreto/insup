var process = require('process');
require('dotenv').load();
var mongoose = require('mongoose');
const clearInterval = require('timers');


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
db.on('error', console.error.bind(console, 'connection error:'));


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

var UserBase = mongoose.model('UserBase', {
  segment: String,
  userId: String,
  username: String,
  attempts: [],
  info: []
});

console.log('ssss');




/*debugger;
UserBase.find({ segment: 'quierobesarte.es'}, function(err,items) {
  if (!err) {
      if (items) {
          for(var j=0; j< items.length; j++) {
              items[j].remove(function(err) {
                  if (err) {
                    console.log(err);
                  }
                });
          }
      }
  }
})*/


var progressCounter = 0;

const migrate = (obj) => {
  var total = User.count({ segment: 'quierobesarte.es', requestNumber: {$gt:0} }).exec().then((total)=>{
    var pause = false;
    var count = 0;
    var intenalCount = 0;
    var pagTotal = 50;
    var pageCount =0;

    function loop() {
      if(!pause){
        if(intenalCount>= total){
          clearInterval(loopPointer)
        } else {
          pause = true;
          intenalCount = 0;
          pageCount++;
          User.find({ segment: 'quierobesarte.es', requestNumber: {$gt:0} }).limit(pagTotal).skip(pagTotal * pageCount).then(
            users => {
              if (users && users.length>0) {
                for(var i=0; i< users.length; i++) {
                  var originalUser = users[i];

                  UserBase.findOne({ username: originalUser.username, segment: 'weddings' }, function(err,user) {
                    if (!err) {
                      count++;
                      if (user) {
                      

                        user.set('unfollowBy', undefined);
                        user.set('attempts', []);

                        if(originalUser.requestNumber>0) {
                          if(user.attempts && user.attempts.length>0){
                            var found = user.attempts.find(function(item) {
                              return item.un === 'quierobesarte.es';
                            });
                            if (!found){
                              user.attempts.push({
                                un: 'quierobesarte.es',
                                n: originalUser.requestNumber
                              })
                            } 
                          } else {
                            user.attempts.push({
                              un: 'quierobesarte.es',
                              n: originalUser.requestNumber
                            })
                          }

                        }

                   
                     
                        if(originalUser.unfollowed) {
                          if(user.info && user.info.length>0){
                            var found = user.info.find(function(item) {
                              return item.un === 'quierobesarte.es';
                            });
                            if (!found){
                              user.info.push({
                                un: 'quierobesarte.es',
                                unfollowed: true,
                              })
                            } else {
                              found.unfollowed = true;
                            }
                          } else {
                            user.info.push({
                              un: 'quierobesarte.es',
                              unfollowed: true,
                            })
                          }
                         
                        }
                        if(originalUser.isFollower) {
                          if(user.info && user.info.length>0){
                            var found = user.info.find(function(item) {
                              return item.un === 'quierobesarte.es';
                            });
                            if (!found){
                              user.info.push({
                                un: 'quierobesarte.es',
                                isFollower: true
                              })
                            } else {
                              found.isFollower = true;
                            }
                          } else {
                            user.info.push({
                              un: 'quierobesarte.es',
                              isFollower: true
                            })
                          }
                        }

                        if(originalUser.isPrivate) {
                          user.isPrivate = originalUser.isPrivate;
                        }

                        user.save(function(err) {
                          intenalCount++;
                          console.log(count + ' ' + total);
                          if(intenalCount>=pagTotal){
                            pause = false;
                          }
                          if (err) {
                            console.log(err);
                          }
                        });
                      } else {
                        intenalCount++;
                        console.log(count + ' ' + total);
                        if(intenalCount>=pagTotal){
                          pause = false;
                        }
                      }
                    }
                  });
                }
              } 
            }
          );
        }
      }
    }
    loop();
    var loopPointer = setInterval(loop, 1000);
  });
};

migrate();

