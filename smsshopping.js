var argv = require('optimist').argv;
var sys = require('util');
var _ = require('underscore');
var Backbone = require('backbone');
var smsd = require('../sms/index');
//var smsd = require('sms');
var dirty = require('dirty');

var verboseMode = argv.v || false;
var runDir = argv.d || process.cwd();
var db = dirty(runDir + '/list.db');
var db2 = dirty(runDir + '/hashes.db');

// DEMO TASKS

if (argv.demo) {

	var task = detectTask('Kaufe am Do 3x Butter bei Aldi Hohe Str');
	console.log(task);

	var task = detectTask('Einkauf am Do bei Aldi Hohe Str?');
	console.log(task);

	var task = detectTask('Geschäft Aldi Hohe Str?');
	console.log(task);

	var task = detectTask('eingekauft am Do bei Aldi');
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
	
function executeTask (task) {
    var isDataChanged = false;
    if (verboseMode || argv.try) {
        console.log("execute: " + task.origin);
        //console.log(task);
    }
	switch (task.command) {
		case 'add':
            isDataChanged = true;
			list.add({
				due: task.due,
				quantity: task.quantity || 1,
				product: task.product,
				trader: task.trader || '',
				store: task.store || '',
                origin: task.origin
			});
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
            reply(matchGiven);
			break;
        case 'rm':
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
            remove(matchGiven);
            break;
	}
    return isDataChanged;
}

function reply (collection) {
    var messages = [];
    collection.forEach(function (model){
        messages.push(model.get('product'));
    });
    var text = messages.join(', ');
    submitReply(phoneNumber, text);
}

function remove (collection) {
    var messages = [];
    collection.forEach(function (model){
        messages.push(model.get('product'));
    });
    var text = messages.join(', ');
    submitReply(phoneNumber, text + ' wurden entfernt.');
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
        if (verboseMode) {
            console.log("list saved..");
//        console.log(list);
        }
	});
}

function detectTask (message) {

	var tasks = {
		'add': 'kaufe( am [a-z]{0,2}){0,1}( [0-9]{1,3}x){0,1}( [a-z]{3,})( bei [a-z]{3,}){0,1}( [a-z ]{3,}){0,1}',
		'ls': 'einkauf( am [a-z]{0,2}){0,1}( bei [a-z]{3,}){0,1}( [a-z ]{3,}){0,1}\\?',
        'rm': 'eingekauft( am [a-z]{0,2}){0,1}( bei [a-z]{3,}){0,1}( [a-z ]{3,}){0,1}',
		'info': 'geschäft( [a-z]{3,}){0,1}( [a-z ]{3,}){0,1}\\?'
	};

	var task = {};
	
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
                            origin: message
						};
						break;
                    case 'rm':
                        task = {
                            command: t,
                            due: matcher[1].replace(/ am /,''),
                            trader: matcher[2].replace(/ bei /g,''),
                            store: matcher[3].replace(/^ /g,''),
                            origin: message
                        };
                        break;
					case 'info':
						task = {
							command: t,
							trader: matcher[1].replace(/ /g,''),
							store: matcher[2].replace(/^ /g,''),
                            origin: message
						};
						break;
				}
				if (!task.command) {
					throw Error('Task required');
				}
				return task;
			}
		}
	}
		
	return task;
}		
