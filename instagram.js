var program = require('commander-plus');

const console_stamp = require('console-stamp')
const fs = require('fs');
const output = fs.createWriteStream('./stdout.log');
const errorOutput = fs.createWriteStream('./stderr.log');
const logger = new console.Console(output, errorOutput);
console_stamp(logger, {
  stdout: output,
  stderr: errorOutput,
  pattern: 'HH:MM:ss.l'
});

const {
  updateTargetFollowers,
  start,
  removeNotFollowers,
  login,
  updateKeyUsers
} = require('./up');
var user;
require('dotenv').load();

program.version('0.0.1').description('Instagram upper');

var promntLogin = function(callback) {
  program.prompt('user: (default: quierobesarte.es) ', function(user) {
    var typedUser;
    var typedPassword;
    if (!user) {
      typedUser = process.env.USER;
      typedPassword = process.env.PWD;
      callback(typedUser, typedPassword);
    } else {
      typedUser = user;
      program.password('Password: ', '*', function(password) {
        callback(typedUser, password);
        process.stdin.destroy();
      });
    }
  });
};

var startWitLogin = function() {
  promntLogin(function(user, password) {
    login(user, password);
    start().then(function() {
      process.exit();
    });
  });
};

var removeWitLogin = function() {
  promntLogin(function(user, password) {
    login(user, password);
    removeNotFollowers().then(function() {
      process.exit();
    });
  });
};



program
  .version('0.0.1')
  .usage('[options] <file ...>')
  .option('-u, --update', 'Update target followers')
  .option('-s, --start', 'Update target followers')
  .option('-r, --remove', 'Remove not followers')
  .option('-k, --updateKeyUsers <csv> <targetUserName>', 'Update key users')
  .parse(process.argv);


if (
  (program.args.length === 0 || program.start) &&
  !program.remove &&
  !program.update
) {
  var username = process.env.USER_INSTAGRAM || program.args[0];
  var pwd = process.env.PWD_INSTAGRAM || program.args[1];
  if (username && pwd) {
    login(username, pwd).then(()=>{
      start({ id: username, password: pwd }).then(function() {
        process.exit();
      }).catch((e)=>{
        logger.error(e);
      });
    });
  } else {
    startWitLogin();
  }
}


if (program.updateKeyUsers && !program.remove && !program.update) {

  if(program.rawArgs.length <5) {
    throw "The csv file and targetUserName parameters are requited.";
  }
  var targetUsername = program.rawArgs[4];
  var csv = program.rawArgs[3];


  if(!csv) {
    throw "The csv file is requidred";
    process.exit();
  }

  if(!targetUsername) {
    throw "The targetUserName is requidred";
    process.exit();
  }

  updateKeyUsers(csv, targetUsername).then(function() {
    process.exit();
  }).catch((e)=>{
    logger.error(e);
  });

}

if (program.remove && !program.update) {
  var username = process.env.USER_INSTAGRAM || program.args[0];
  var pwd = process.env.PWD_INSTAGRAM || program.args[1];

  if (username && pwd) {
    login(username, pwd).then(()=>{
      removeNotFollowers({ id: username, password: pwd }, true).then(function() {
        console.log("done");
        process.exit();
      }).catch((e)=>{
        logger.error(e);
      });
    });
    
  } else {
    removeWitLogin();
  }
}

if (program.update && !program.remove) {
  var username = process.env.USER_INSTAGRAM || program.args[0];
  var pwd = process.env.PWD_INSTAGRAM || program.args[1];
  var force = false;
  var segment = '';
  var targetUserName = '';

  program.rawArgs.forEach((item)=>{
    if(item === '--force') {
      force = true;
    }
    if(item.indexOf('--segment')>=0) {
      segment = item.split('=')[1];
    }

    if(item.indexOf('--targetUserName')>=0) {
      targetUserName = item.split('=')[1];
    }
  })
  if (username && pwd) {
    login(username, pwd).then(()=>{
      debugger;
      updateTargetFollowers(
        { id: username, password: pwd, targetUserName, force, segment  },
        program.args[0],
        force
      ).then(function() {
        process.exit();
      }).catch((e)=>{
        logger.error(e);
      });
    });
  } else {
    updateTargetFollowersWitLogin(program.args[0],force);
  }
}
