const mongoose = require('mongoose'); // An Object-Document Mapper for Node.js
const assert = require('assert'); // N.B: Assert module comes bundled with Node.js.
mongoose.Promise = global.Promise; // Allows us to use Native promises without throwing error.

// Connect to a single MongoDB instance. The connection string could be that of remote server
// We assign the connection instance to a constant to be used later in closing the connection
const db = mongoose.connect('mongodb://instagram:Por.][12pPor.][12p@ds123695.mlab.com:23695/instagram', { useMongoClient: true });
var userId;
var password;

// Converts value to lowercase
function toLower(v) {
  return v.toLowerCase();
}

const targetUserSchema = mongoose.Schema({
    id: { type: String, set: toLower },
    providerId: { type: String, set: toLower }
  });
const TargetUser = mongoose.model('TargetUser', targetUserSchema);

/**
 * @function  [addTargetUser]
 * @returns {String} Status
 */
const addTargetUser = (userId) => {
    var modelUser = {id: userId, providerId: this.userId}

    return TargetUser.create(modelUser, (err) => {
      assert.equal(null, err);
      console.info('New user added');
    });
  };


const login = (userId, password) => {
    this.userId= userId;
    this.password= password;
}

const getCurrentUser = () => {
    return this.userId;
}

// Export all methods
module.exports = {  addTargetUser, login, getCurrentUser };