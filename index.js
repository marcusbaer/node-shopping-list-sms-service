var argv = require('optimist').argv;
var _ = require('underscore');
var smsd = require('../sms/index').reader;

// TESTE TASKS

if (argv.test) {

	var task = detectTask('Kaufe am Do 3x Butter bei Aldi Hohe Str');
	console.log(task);

	var task = detectTask('Einkauf am Do bei Aldi Hohe Str?');
	console.log(task);

	var task = detectTask('Geschäft Aldi Hohe Str?');
	console.log(task);

}	
	
smsd.readMessages(function filterMessages(storedMessages) {
	storedMessages.forEach(function (message) {
		var task = detectTask(message.get('message'));
		if (!_.isEmpty(task)) {
			console.log(task);
		}
	});
});

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
						};
						break;
					case 'info':
						task = {
							command: t,
							trader: matcher[1].replace(/ /g,''),
							store: matcher[2].replace(/^ /g,''),
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