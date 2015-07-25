// includes
var Db = require('mongodb').Db,
  ObjectID = require('mongodb').ObjectID,
  Server = require('mongodb').Server;
// config
var host = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var port = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : 27017;
var dbName = process.env['MONITOSHI_DB_NAME'] != null ? process.env['MONITOSHI_DB_NAME'] : 'monitoshi';
var collectionName = process.env['MONITOSHI_COLLECTION_NAME'] != null ? process.env['MONITOSHI_COLLECTION_NAME'] : 'monitoshi';
var idDyno = 'xxx1';

/**
 * Handle data about monitored services
 * this means to access the DB and get/set data
 * @class DataManager
 */
module.exports = DataManager = function(ready) {
  // connect to db
  console.log("Connecting to " + host + ":" + port);
  this.db = new Db(dbName, new Server(host, port, {}), {native_parser:true});
  this.db.open(function(err, db) {
    if(err) {
      ready(err);
    }
    else db.collection(collectionName, function(err, collection) {
      this.collection = collection;
      ready(err);
    }.bind(this));
  }.bind(this));
};


/**
 * get the next data to process and lock it
 * @return {object}
 * @param {function(err:String, result:object)} cbk
 */
DataManager.prototype.lockNext = function(cbk) {
  // findAndModify oldest __lastProcessed with __lockedBy='' + set flag __lockedBy=ID_DYNO
 this.collection.findAndModify({
      __enabled: true,
      __lockedBy: ''
    }, [['__lastProcessed', 'ascending']], {
      $set: {__lockedBy: idDyno}
    },
    {new: true},
  function(err, result) {
    cbk(err, result ? result.value : null);
  });
};


/**
* unlock the data after process, update the __lastProcessed date
* @param {string} id
* @param {function(err:String)} cbk
*/
DataManager.prototype.unlock = function(data, changes, cbk) {
// update __lastProcessed + set flag __lockedBy=''
 changes.__lockedBy = '';
  changes.__lastProcessed = Date.now();
  this.collection.findAndModify(
    data, [], {
      $set: changes
    },
    {new: true},
  function(err, result) {
    cbk(err, result ? result.value : null);
  });
};


/**
* unlock all the data locked with the given ID
* @param {function(err:String)} cbk
*/
DataManager.prototype.unlockAll = function(cbk) {
// findAndModify doc with flag __lockedBy==ID_DYNO   => __lockedBy=''
 this.collection.update({
      __lockedBy: idDyno
    }, {
      $set: {__lockedBy: ''}
    },
    {multi: true},
  function(err, result) {
    cbk(err, result ? result.value : null);
  });
};


/**
* enable a data for processing
* @param {string} id
* @param {function(err:String)} cbk
*/
DataManager.prototype.enable = function(id, cbk) {
  var data = {_id:ObjectID(id)};
 this.collection.findAndModify(
    data, [], {
      $set: {
        __enabled: true
      }
    },
    {new: true},
  function(err, result) {
    console.log('enable result:', err, result);
    cbk(err, result ? result.value : null);
  });
};


/**
* disable a data for processing
* @param {string} id
* @param {function(err:String)} cbk
*/
DataManager.prototype.disable = function(id, cbk) {
  var data = {_id:ObjectID(id)};
 this.collection.findAndModify(
    data, [], {
      $set: {
        __enabled: false
      }
    },
    {new: true},
  function(err, result) {
    console.log('disable result:', err, result);
    cbk(err, result ? result.value : null);
  });
};


/**
* add a data item
* @param {object} data
* @param {function(err:String)} cbk
*/
DataManager.prototype.add = function(data, cbk) {
//     => this.collection.update(selector, document, { upsert: true });
//     => with flag __enabled = false
 data.__enabled = false,
  data.__lockedBy = '';
  this.collection.insert([data], function(err, docs) {
    cbk(err, data);
  });
};


/**
* remove a data item
* @param {string} id
* @param {function(err:String)} cbk
*/
DataManager.prototype.del = function(id, cbk) {
  var data = {_id:ObjectID(id)};
 this.collection.findOne(function(err, data) {
      if(err) {
          cbk(err, data);
      }
      else this.collection.remove(data, function(err, removed) {
          cbk(err, data);
      });
  }.bind(this));
};
/* */


/**
* dump the db
* @param {function(err:String)} cbk
*/
DataManager.prototype.list = function(cbk) {
 this.collection.find().toArray(function(err, items) {
    cbk(err, items);
  });
};
