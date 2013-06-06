node-shopping-list-sms-service
==============================

An SMS service for our shopping list

Installation for Node.js
------------------------------

	npm install -g shopping-list-sms-service

Setup
------------------------------

1. configure smsd in its file `gateway.config.js`
2. run smsd: `smsd`
3. register shopping list SMS service as listener: smsd --register="smsshopping"

Command line parameters
------------------------------

- cmd: set a command to parse instead of datasource commands
- shoppingdb: another data source
- demo: enables demonstration of task descriptions
- try: execute single commands, e.g. "Einkauf?"
- user: a user identified by a phone number, used in combination with cmd parameter
- u: same as user parameter
- v: verbose mode to get more output

Example
-----------------------------

Start in normal mode: `smsshopping`

Start in command mode: `smsshopping -cmd "Einkauf?" -u "+4912345678910"`

Start in demo mode: `smsshopping -demo`

Start in try mode: `smsshopping -try "Einkauf?" -u "+4912345678910"`

Actually understood commands
-----------------------------

- Kaufe am Do 3x Butter bei Aldi Hohe Str.
- Kaufe Butter
- Einkauf am Do bei Aldi Hohe Str?
- Einkauf?
