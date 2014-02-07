var argv = require('optimist').argv;
var Gmailer = require("gmail-sender");
var account = require("./"+argv.account+".gmail.config");
var aliases = require("./"+argv.account+".aliases.config");


// run with: node mailer.js --account=marcus --recipient=marcus --subject="A bit later" --message="I'm coming today a bit later.."


// any options can be set here...
Gmailer.options({
    smtp: {
        service: "Gmail",
        user: account.user,
        pass: account.pass
    }
});

var alias = argv.recipient;
var recipient = aliases[alias];
var subject = argv.subject || null;

// any options set here, will overwrite options from above...
Gmailer.send({
    subject: subject || account.subject,
    template: "./mailer/assets/templates/"+argv.account+".messages.html",
    from: account.from,
    to: {
        email: recipient.email,
        name: recipient.name,
        surname: recipient.surname
    },
    //text: "Hello Johnny!",
    data: {
        welcome: recipient.welcome,
        message: argv.message || '',
        surname: account.surname
    }
//    attachments: [
//        {
//            fileName: "html5.png",
//            filePath: "./mailer/assets/attachments/html5.png",
//            cid: "html5@demo"
//        }
//    ]
});

setTimeout(function(){
    process.exit(code=0);
}, 5000);

