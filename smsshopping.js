var argv = require('optimist').argv;
var sys = require('util');
var fs = require('fs');
var _ = require('underscore');
var Backbone = require('backbone');
var smsd = require('sms');
//var smsd = require('sms');
var dirty = require('dirty');

var verboseMode = argv.v || false;
var runDir = argv.d || process.cwd();
var db = dirty(runDir + '/list.db');
var db2 = dirty(runDir + '/hashes.db');
var watchFilename = 'message.txt';

// DEMO TASKS

if (argv.demo) {

	var task = detectTask('Kaufe am Do 3x Butter bei Aldi Hohe Str');
	console.log(task);

	var task = detectTask('Einkauf am Do bei Aldi Hohe Str?');
	console.log(task);

	var task = detectTask('Geschäft Aldi Hohe Str?');
	console.log(task);

	var task = detectTask('Butter gekauft');
	console.log(task);

	var task = detectTask('Schema');
	console.log(task);

	var task = detectTask('Memo Das ist der eigentliche Notiztext');
	console.log(task);

}	

var Item = Backbone.Model.extend({
	defaults: {
		due: null,
		quantity: 1,
		product: '',
		trader: '',
		store: '',
        origin: ''
	}
});

var Items = Backbone.Collection.extend({
	model: Item
});

var list = new Items();
var hashes = [];
var phoneNumber = null;

if (argv.cmd || argv.try) {

    loadData(function dataLoaded() {
		phoneNumber = argv.to;
        var isDataChanged = executeTask( detectTask(argv.cmd || argv.try) );
        if (isDataChanged) {
            saveData();
        }
    });

} else {

    initialize();

}

function initialize () {
	loadData(function dataLoaded() {
		readTasks(function(tasks){
            var isDataChanged = false;
//            if (verboseMode) {
//                console.log(tasks);
//            }
			for (var i=0; i<tasks.length; i++) {
                isDataChanged = isDataChanged || executeTask(tasks[i]);
                if (i === tasks.length-1 && isDataChanged) {
                    saveData();
                }
			}
		});
	});
}

function readTasks (callback) {
	var tasks = [];
	//smsd.fetchMessagesFromGateway(function filterMessages(storedMessages) { // fetches directly from gateway
	smsd.readMessagesFromDb(function filterMessages(storedMessages) { // reads from data source
        var newMessageDetected = false;
		storedMessages.forEach(function (message) {
            if (hashes && hashes.length>0 && _.indexOf(hashes, message.get('hash'))>-1) {
                // ignore message
                if (verboseMode) {
                    console.log("ignore " + message.get('hash'));
                }
            } else {
                newMessageDetected = true;
                hashes.push(message.get('hash'));
                var task = detectTask(message.get('message'));
                if (!_.isEmpty(task)) {
					phoneNumber = message.get('phoneNumber');
                    tasks.push(task);
                }
            }
		});
        if (newMessageDetected) {
            saveHashes();
        }
		callback(tasks);
	});
}
	
function zeroFill (val) {
	val = new String(val);
	if (val.length === 1) val = '0' + val;
	return val;
}	
	
function logToFile (filename, text, next) {
	var d = new Date();
	var date = d.getFullYear() + '-' + zeroFill(d.getMonth()+1) + '-' + zeroFill(d.getDate()) + ' ' + zeroFill(d.getHours()) + ':' + zeroFill(d.getMinutes()) + ':' + zeroFill(d.getSeconds());
	fs.appendFile(filename, date + "\t" + text + "\n", 'utf8', next);
}	
	
function logTask (task) {
	logToFile('smsshopping.log', task, function(err){
		//if (err) throw err;
	});
}	
	
function logUnknown (message) {
	logToFile('unknown.log', message, function(err){
		//if (err) throw err;
	});
}	
	
function logMemo (memo) {
	logToFile('memo.log', memo, function(err){
		//if (err) throw err;
	});
}	
	
function executeTask (task) {
    var isDataChanged = false;
    if (verboseMode || argv.try) {
        console.log("execute: " + task.origin);
        //console.log(task);
    }
	if (task.command != 'memo') {
		logTask(task.origin);
	}
	switch (task.command) {
		case 'add':
            isDataChanged = true;
			var product = {
				due: task.due,
				quantity: task.quantity || 1,
				product: task.product,
				trader: task.trader || '',
				store: task.store || '',
                origin: task.origin
			};
			list.add(product);
            if (task.forceReply) {
				reply(new Backbone.Collection(product), ' wurde hinzugefügt.');
			}
			break;
		case 'ls':
			var filter = {};
            var matchGiven = [];
			if (task.due) filter.due = task.due;
            if (task.trader) {
                // add trader filter
                filter.trader = task.trader;
            }
			if (task.store) filter.store = task.store;
            if (_.isEmpty(filter)) {
                matchGiven = list;
            } else {
                matchGiven = list.where(filter);
            }
            if (task.trader) {
                filter.trader = '';
                var matchAny = list.where(filter);
                matchGiven = _.union(matchGiven, matchAny);
            }
//			console.log("match...");
//			console.log(JSON.stringify(match));
			reply(matchGiven, ' ist einzukaufen.');
			break;
        case 'rm':
            var filter = {};
            var matchGiven = [];
            if (task.product) filter.product = task.product;
            matchGiven = list.where(filter);
//			console.log("match...");
//			console.log(JSON.stringify(matchGiven));
            remove(matchGiven, task.forceReply);
            break;
        case 'man':
            submitReply(phoneNumber, 'Setzen und abfragen: (Kaufe|Einkauf)( am Do)( 3x)( Butter)( bei Aldi)( Hohe Str)(?) / Löschen: Butter gekauft');
            break;
		case 'memo':
			logMemo(phoneNumber+"\t"+task.origin.replace(/^memo /i,''));
			break;
	}
    return isDataChanged;
}

function reply (collection, appendix) {
    var messages = [];
    collection.forEach(function (model){
        messages.push(model.get('product'));
    });
    var text = messages.join(', ');
    submitReply(phoneNumber, text + appendix);
}

function remove (collection, forceReply) {
    var messages = [];
    collection.forEach(function (model){
        messages.push(model.get('product'));
    });
    var text = messages.join(', ') || 'Nichts';
	list.remove(collection);
	saveData();
	if (forceReply) {
		submitReply(phoneNumber, text + ' wurde entfernt.');
	}
}

function submitReply (to, message) {
    if (argv.try) {
        console.log("reply to " + (to || '???') + ": " + message);
		console.log("Message not sent in TRY mode!");
    } else if (verboseMode) {
        console.log("reply to " + (to || '???') + ": " + message);
    }
	if (!argv.try && to && message) {

	// this is a workaround for bug in optimist, please give phone numbers by a leading plus sign including country code
		var to = new String(to);
		to = (to.indexOf('+') !== 0) ? '+' + to : to;

		smsd.sendMessage({
			to: to,
			message: message,
			success: function(response) {
				//console.log(response);
			}
		});
	}
}

function loadData (callback) {
	db.on('load', function() {
		list = new Items(db.get('list') || []);
        hashes = db2.get('hashes') || [];
		callback();
	});
//	callback();
}

function removeMessages (callback) {
	smsd.removeMessagesFromGateway(callback);
}

function saveHashes () {
    db2.set("hashes", hashes, function hashesSaved (){
    });
}

function saveData () {
	db.set("list", list, function listSaved (){
        writeDataToFile(watchFilename, list);
        if (verboseMode) {
            console.log("list saved..");
//        console.log(list);
        }
	});
}

function detectTask (message) {

	var tasks = {
		'add': 'kaufe( am [a-z]{0,2}){0,1}( [0-9]{1,3}x){0,1}( [a-zäöüß]{3,})( bei [a-zäöüß]{3,}){0,1}( [a-zäöüß ]{3,}){0,1}([!]{0,1})',
		'ls': 'einkauf( am [a-z]{0,2}){0,1}( bei [a-zäöüß]{3,}){0,1}( [a-zäöüß ]{3,}){0,1}\\?',
        'rm': '([a-zäöüß]{3,}) gekauft([!]{0,1})',
        'man': 'sche(ma)',
		'memo': 'memo (.+)',
		'info': 'geschäft( [a-z]{3,}){0,1}( [a-z ]{3,}){0,1}\\?'
	};

	var task = {};
	
	message = utf8(message);
	
	for (var t in tasks) {
	
		var taskreg = new RegExp(tasks[t],'i');
		var matcher = message.match(taskreg);
		if (matcher) {
			// fix undefined parts to an empty string
			for (var i=0; i<matcher.length; i++) {
				matcher[i] = matcher[i] || ''
			}
            //if (verboseMode) {
            //  console.log(matcher);
            //}
			if (matcher.length>1) {
				switch (t) {
					case 'add':
						task = {
							command: t,
							due: matcher[1].replace(/ am /,''),
							quantity: matcher[2].replace(/ /g,'').replace(/x/,'') || 1,
							product: matcher[3].replace(/ /g,''),
							trader: matcher[4].replace(/ bei /g,''),
							store: matcher[5].replace(/^ /g,''),
							forceReply: (matcher[6].replace(/^ /g,'')) ? 1 : 0,
                            origin: message
						};
						if (!task.product || task.product === 'bei') {
							throw Error('Product required');
						}
						break;
					case 'ls':
						task = {
							command: t,
							due: matcher[1].replace(/ am /,''),
							trader: matcher[2].replace(/ bei /g,''),
							store: matcher[3].replace(/^ /g,''),
							forceReply: 1,
                            origin: message
						};
						break;
                    case 'rm':
                        task = {
                            command: t,
							product: matcher[1].replace(/ /g,''),
							forceReply: (matcher[2].replace(/^ /g,'')) ? 1 : 0,
                            origin: message
                        };
                        break;
					case 'info':
						task = {
							command: t,
							trader: matcher[1].replace(/ /g,''),
							store: matcher[2].replace(/^ /g,''),
							forceReply: 1,
                            origin: message
						};
						break;
                    case 'man':
                        task = {
                            command: t,
							forceReply: 1,
                            origin: message
                        };
                        break;
                    case 'memo':
                        task = {
                            command: t,
							forceReply: 0,
                            origin: message
                        };
                        break;
				}
				if (!task.command) {
					throw Error('Task required');
				}
				return task;
			} else {
				logUnknown(tasks[t]);
			}
		}
	}
		
	return task;
}		

function utf8 (txt) {
	// http://www.developershome.com/sms/gsmAlphabet.asp
	// http://spin.atomicobject.com/2011/09/08/converting-utf-8-to-the-7-bit-gsm-default-alphabet/
    return new Buffer(txt).toString('utf8');
}

function writeDataToFile (filename, list) {
    var products = list.pluck("product");
    fs.writeFile(filename, products.join("\n"), 'utf8', function(err){
        if (err) throw err;
    });
}
