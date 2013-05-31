var argv = require('optimist').argv;
var _ = require('underscore');
var Backbone = require('backbone');
var smsd = require('../sms/index').reader;
var dirty = require('dirty');
var db = dirty(argv.shoppingdb || '../data/list.db');

// TESTE TASKS

if (argv.test) {

	var task = detectTask('Kaufe am Do 3x Butter bei Aldi Hohe Str');
	console.log(task);

	var task = detectTask('Einkauf am Do bei Aldi Hohe Str?');
	console.log(task);

	var task = detectTask('Geschäft Aldi Hohe Str?');
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

initialize();

function initialize () {
	loadData(function dataLoaded() {
		readTasks(function(tasks){
			for (var i=0; i<tasks.length; i++) {
				executeTask(tasks[i]);
                if (i === tasks.length-1) {
                    saveData();
                }
			}
		});
	});
}

function readTasks (callback) {
	var tasks = [];
	smsd.readMessages(function filterMessages(storedMessages) {
        var newMessageDetected = false;
		storedMessages.forEach(function (message) {
            if (hashes && hashes.length>0 && _.indexOf(hashes, message.get('hash'))>-1) {
                // ignore message
                console.log("ignore " + message.get('hash'));
            } else {
                newMessageDetected = true;
                hashes.push(message.get('hash'));
                var task = detectTask(message.get('message'));
                if (!_.isEmpty(task)) {
                    tasks.push(task);
                }
            }
		});
        newMessageDetected = true;
        if (newMessageDetected) {
            saveHashes();
        }
		callback(tasks);
	});
}
	
function executeTask (task) {
//	console.log(task);
	switch (task.command) {
		case 'add':
			list.add({
				due: task.due,
				quantity: task.quantity || 1,
				product: task.product,
				trader: task.trader || '',
				store: task.store || '',
                origin: task.origin
			});
			break;
		case 'get':
			var filter = {};
			if (task.due) filter.due = task.due;
			if (task.trader) filter.trader = task.trader;
			if (task.store) filter.store = task.store;
			var match = list.where(filter);
			//console.log("match...");
			console.log(JSON.stringify(match));
			break;
	}
}
	
function loadData (callback) {
	db.on('load', function() {
		list = new Items(db.get('list') || []);
        hashes = db.get('hashes') || [];
		callback();
	});
}

function saveHashes () {
    db.set("hashes", hashes, function hashesSaved (){
    });
}

function saveData () {
    console.log("save list now..");
    console.log(list.toJSON());
	db.set("list", list, function listSaved (){
        console.log("saved..");
        console.log(list);
	});
}

function detectTask (message) {

	var tasks = {
		'add': 'kaufe( am [a-z]{0,2}){0,1}( [0-9]{1,3}x){0,1}( [a-z]{3,})( bei [a-z]{3,}){0,1}( [a-z ]{3,}){0,1}',
		'get': 'einkauf( am [a-z]{0,2}){0,1}( bei [a-z]{3,}){0,1}( [a-z ]{3,}){0,1}\\?',
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
			//console.log(matcher);
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
					case 'get':
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