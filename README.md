node-shopping-list-sms-service
==============================

An SMS service for our shopping assistance. Actually it is only speaking some German.

Installation for Node.js
------------------------------

	npm install shopping-list-sms-service -g

Setup
------------------------------

Configure smsd in its file `config.js` first (see documentation there)!

Running
------------------------------

Usually register this service as a listener at smsd and let smsd do the rest:

	$ smsd --register="smsshopping"
	$ smsd

Otherwise run on command line, if messages are available by smsd (messages.db file in your current directory is not empty or undefined):

	$ smsshopping											--> run normal
	$ smsshopping --demo    								--> run included demonstration of task descriptions and nothing else
	$ smsshopping --try "Einkauf?"   						--> run a single command manually and get the result printed out without sending messages
	$ smsshopping --cmd "Einkauf?" --to "+491234567"		--> run a command manually and send result to a phone number
	$ smsshopping -v										--> always use -v to set verbose mode

To see shopping list in browser, run server and open localhost

	$ node server

Actually understood commands
-----------------------------

- Kaufe am Do 3x Butter bei Aldi Hohe Str.
- Kaufe Butter
- Einkauf am Do bei Aldi Hohe Str?
- Einkauf?
- Butter gekauft
- Schema
