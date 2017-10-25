var program = require('commander-plus');

// Require logic.js file and extract controller functions using JS destructuring assignment
const { addTargetUser, addUser, getUser, getCurrentUser } = require('./logic');
const { updateTargetFollowers, start, removeNotFollowers, login } = require('./up');
var user;
require('dotenv').load();

program
  .version('0.0.1')
  .description('Instagram upper');



var addTargetUserWithLogin = function(name){
    promntLogin( function(user, password){
        login(user, password);
        addTargetUser(name).then(function(){
            process.exit();
        });
    });
}



var updateTargetFollowersWitLogin = function(username){
    promntLogin( function(user, password){
        login(user, password);
        updateTargetFollowers(username).then(function(){
            console.log('Updated user ' +username +'.')
            process.exit();
        });
    });
}

var promntLogin = function(callback) {
    program.prompt('user: (default: quierobesarte.es) ', function(user){
        var typedUser;
        var typedPassword;
        if(!user){
            typedUser =  process.env.USER;
            typedPassword =  process.env.PWD;
            callback(typedUser, typedPassword);
        } else {
            typedUser = user;
            program.password('Password: ', '*', function(password){
                callback(typedUser, password);
                process.stdin.destroy();
            });
        }
    });
};


var startWitLogin = function(){
    promntLogin( function(user, password){
        login(user, password);
        start().then(function(){
            process.exit();
        });
    });
}

var removeWitLogin = function(){
    promntLogin( function(user, password){
        login(user, password);
        removeNotFollowers().then(function(){
            process.exit();
        });
    });
}



program
.version('0.0.1')
.usage('[options] <file ...>')
.option('-a, --addTargetUser <name>', 'Add a target user', addTargetUserWithLogin)
.option('-g, --getUser <name>', 'A float argument', getUser)
.option('-u, --update', 'Update target followers')
.option('-s, --start', 'Update target followers')
.option('-r, --remove', 'Remove not followers')
.parse(process.argv);

if (program.start){

    var username = process.env.USER;
    var pwd = process.env.PWD;
    if(username && pwd){
        start({id:username, password: pwd }).then(function(){
            process.exit();
        });
    } else {
        startWitLogin();
    }
    
}
if (program.remove){
    var username = process.env.USER;
    var pwd = process.env.PWD;
    if(username && pwd){
        removeNotFollowers({id:username, password: pwd }).then(function(){
            process.exit();
        });
    } else {
        removeWitLogin();
    }
}

if (program.update){
    var username = process.env.USER;
    var pwd = process.env.PWD;
    if(username && pwd){
        updateTargetFollowers({id:username, password: pwd }, program.args[0]).then(function(){
            process.exit();
        });
    } else {
        updateTargetFollowersWitLogin();
    }
}


