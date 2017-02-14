'use strict';

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_APP_SECRET=your_app_secret FB_PAGE_TOKEN=your_page_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/webhook` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');
const http = require('http');
var keinThema = false;
var istAntwort = false;
var keinModul = false;
var Wit = null;
let log = null;

try {
    // if running from repo
    Wit = require('../').Wit;
    log = require('../').log;
} catch (e) {
    Wit = require('node-wit').Wit;
    log = require('node-wit').log;
}

//Alle Token werden auf dem Server ausgelesen. Bei Localer überprüfung müssen diese mitangegeben werden!

// Webserver parameter
const PORT = process.env.PORT || 8445;

// Wit.ai parameters
const WIT_TOKEN = process.env.WIT_TOKEN;

// Messenger API parameters
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
if (!FB_PAGE_TOKEN) {
    throw new Error('missing FB_PAGE_TOKEN');
}
const FB_APP_SECRET = process.env.FB_APP_SECRET;
if (!FB_APP_SECRET) {
    throw new Error('missing FB_APP_SECRET');
}


//Diesen Token kann man auch noch generieren lassen
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
if (!FB_VERIFY_TOKEN) {
    throw new Error('missing FB_APP_SECRET');
}

// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, text) => {
    const body = JSON.stringify({
        recipient: {id},
        message: text
    });


    const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
    return fetch('https://graph.facebook.com/me/messages?' + qs, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body
    })
            .then(rsp => rsp.json())
            .then(json => {
                if (json.error && json.error.message) {
                    throw new Error(json.error.message);
                }
                console.dir(json);
                return json;
            });
};

// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}

const sessions = {};

const findOrCreateSession = (fbid) => {
    let sessionId;

    // Let's see if we already have a session for the user fbid
    Object.keys(sessions).forEach(k => {
        if (sessions[k].fbid === fbid) {
            // Yep, got it!
            sessionId = k;
        }
    });
    if (!sessionId) {
        // No session found for user fbid, let's create a new one
        sessionId = new Date().toISOString();
        sessions[sessionId] = {fbid: fbid, context: {}};
    }
    return sessionId;
};


const firstEntityValue = (entities, entity) => {
    const val = entities && entities[entity] &&
            Array.isArray(entities[entity]) &&
            entities[entity].length > 0 &&
            entities[entity][0].value
            ;
    if (!val) {
        return null;
    }
    return typeof val === 'object' ? val.value : val;
};


// Innerhalb von actions müssen unsere Funktionen reingepackt werden
const actions = {

    send( {sessionId}, {text}) {

        // Our bot has something to say!
        // Let's retrieve the Facebook user whose session belongs to
        const recipientId = sessions[sessionId].fbid;

        if (recipientId) {


            //Noch stark zu bearbeiten!!    

            text = {text};

            // Yay, we found our recipient!
            // Let's forward our bot response to her.
            // We return a promise to let our bot know when we're done sending


            return fbMessage(recipientId, text)
                    .then(() => null)
                    .catch((err) => {
                        console.error(
                                'Oops! An error occurred while forwarding the response in SENDS to',
                                recipientId,
                                ':',
                                err.stack || err
                                );
                    });
        } else {

            console.error('Oops! Couldn\'t find user for session:', sessionId);
            // Giving the wheel back to our bot
            return Promise.resolve();
    }
    },
    // You should implement your custom actions here
    // See https://wit.ai/docs/quickstart


    //Funktion zum Abrufen von Wetter Daten auf openweathermap.
    //Aktuell nur das aktuelle Wetter
    getForecast( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            var locations = firstEntityValue(entities, "location");

            if (locations) {

                var forecastText;

                var api = 'http://api.openweathermap.org/data/2.5/weather?q=';
                var units = '&units=metric';
                var appid = '&appid=ad12e27ce5d345364973235d9b6a8588';

                var apiUrl = api + locations + units + appid;

                request({
                    url: apiUrl,
                    json: true
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {


                        switch (body.weather[0].main) {

                            case 'Rain':
                                forecastText = 'Pack den Regenschirm ein, in ' + locations + ' wird es heute Regnen. Die Temperatur liegt bei ' + body.main.temp + '°C.';
                                break;
                            case 'Snow':
                                forecastText = 'Heute soll es in ' + locations + ' schneien, also schön warm anziehen! Die temperaturen betragen ' + body.main.temp + '°C.';
                                break;
                            case 'Clear':
                                forecastText = 'Die Sonne lässt sich ab und zu in ' + locations + ' blicken, dabei beträgt die Temperatur ' + body.main.temp + '°C.';
                                break;
                            case 'Sunny':
                                forecastText = 'Heute ist es sonnig in ' + locations + '. Die jetztige Temperatur beträgt ' + body.main.temp + '°C.'
                                break;
                            case 'Mist':
                                forecastText = 'In der Gegend von ' + locations + ' ist es etwas diesig! Zurzeit sind es ' + body.main.temp + '°C.';
                                break;
                            case 'Clouds':
                                forecastText = 'In ' + locations + ' ist es gerade ziemlich bewölkt! Aktuell beträgt die Temperatur ' + body.main.temp + '°C.';
                                break;
                            case 'Fog':
                                forecastText = 'Vorsicht beim Autofahren, in der Gegend von ' + locations + ', ist es nebelig. Die Temperatur beträgt ' + body.main.temp + '°C.';
                                break;
                            default:
                                forecastText = body.weather[0].main + ' Wirklich mysteriös das Wetter in ' + locations + ', frag mich am besten nochmal und ich gucke nochmal genauer nach! ;)';
                        }

                        context.forecast = forecastText;


                        delete context.missingLocation;
                        delete context.wrongLocation;
                        delete context.location;
                        return resolve(context);

                    } else {

                        if (response.statusCode === 502) {

                            context.wrongLocation = 'Leider kenne ich ' + locations + ' nicht. Hast du dich eventuell verschrieben? Versuch es doch nochmal! ;)';
                            delete context.missingLocation;
                            delete context.forecast;
                            delete context.location;
                            resolve(context);
                        }

                        delete context.missingLocation;
                        delete context.forecast;
                        delete context.location;
                        resolve(context);

                    }
                });


            } else {

                context.missingLocation = true;
                delete context.forecast;
                delete context.wrongLocation;
                delete context.location;

                return resolve(context);
            }


        });
    },

    //Erstellt die Quickreplies für die Fragen
    replies( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {
            var sender = sessions[sessionId].fbid;

            var frage = {
                "text": "Welche Antwort meinst du ist richtig?",
                "quick_replies": [
                    {
                        "content_type": "text",
                        "title": "A",
                        "payload": "richtig"
                    },
                    {
                        "content_type": "text",
                        "title": "B",
                        "payload": "falsch"
                    },
                    {
                        "content_type": "text",
                        "title": "C",
                        "payload": "falsch"
                    }
                ]
            };
            
            delete context.A;
            delete context.B;
            delete context.C;
            delete context.missingModul;
            delete context.thema;

            fbMessage(sender, frage)
                    .then(() => null)
                    .catch((err) => {
                        console.error(
                                'Oops! An error occurred while forwarding the response to',
                                sender,
                                ':',
                                err.stack || err
                                );
                    });



            return resolve(context);
        });
    },

    //Ermittelt die angemeldeten Module und Themen für den Benutzer
    gibSelektoren( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            var api = 'https://immense-journey-49192.herokuapp.com/';
            var route = 'messageBot';

            var apiUrl = api + route;

            request({
                url: apiUrl,
                json: {
                    "user": {
                        "userID": sessions[sessionId].fid,
                        "plattformID": 1
                    },
                    "methode": "gibSelektoren"
                }
            }, function (error, response, body) {

                if (!error && response.statusCode === 200) {

                    if (context.thema) {

                        var text = {};
                        text["text"] = "Zu welchem Modul möchtest du dieses Thema?";
                        var quick_replies = [];
                        for (var i = 0; body.module.length; i++) {
                            var kuerzel = body.module[i].kuerzel;


                            var item = {};
                            item["content_type"] = "text";
                            item["title"] = kuerzel;
                            item["payload"] = "!modul";

                            quick_replies.push(item);



                        }

                        text["quick_replies"] = quick_replies;


                    } else {

                        if (context.modul) {

                            var matched = false;
                            for (var obj in body.module) {
                                if (obj.kuerzel === context.modul) {
                                    matched = true;
                                }
                            }
                            if (matched) {

                                var text = {};
                                text["text"] = "Was für ein Thema möchtest du bearbeiten?";
                                var quick_replies = [];
                                for (var i = 0; body.module; i++) {
                                    var kuerzel = body.module[i].kuerzel;


                                    var item = {};
                                    item["content_type"] = "text";
                                    item["title"] = kuerzel;
                                    item["payload"] = "!modul";

                                    quick_replies.push(item);



                                }

                                text["quick_replies"] = quick_replies;

                            } else {
                                text["text"] = "Für dieses Modul hast du dich noch nicht angemeldet! Das solltest du so schnell wie möglich machen! :)";
                            }
                        }

                    }

                    fbMessage(sessions[sessionId].fid, text)
                            .then(() => null)
                            .catch((err) => {
                                console.error(
                                        'Oops! An error occurred while forwarding the response to',
                                        sessions[sessionId].fid,
                                        ':',
                                        err.stack || err
                                        );
                            });


                } else {

                    //ERROR NACHRICHT

                }
            });

            return resolve(context);
        });
    },

    createJson( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            var text = {};
            text["text"] = "Welches Modul meinst du?"

            var quick = [];

            var item = {};
            item["name"] = "Pascal";
            item["alter"] = 12;

            quick.push(item);

            var item = {};
            item["name"] = "Peter";
            item["alter"] = 115;

            quick.push(item);

            text["quick_replies"] = quick;

            var body = JSON.stringify(text);

            context.done = "Es wurde ein Json erstellt Check logs!";

            return resolve(context);

        });




    },

    //Ermittelt eine Aufgabe für den Benutzer.
    gibAufgabe( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            var thema = firstEntityValue(entities, "thema");
            var modul = firstEntityValue(entities, "modul");
            
            console.dir("Sind in Modul");
            console.dir(modul);

            //wenn modul drin ist
            if (modul) {
                //es ist ein modul gegeben
                console.dir("Sind in Modul");
                console.dir(modul);
                //Aufrufen gibAufgabe der Datenbank

                context.Aufgabe = "Hier ist deine " + modul + " Aufgabe !";

                context.A = "Aussage A";
                context.B = "Aussage B";
                context.C = "Aussage C";


                //Abspeichern der Richtig und Falschen Antwort
                


                delete context.missingModul;
                

            } else {
                //wenn modul fehlt
                context.missingModul = true;
            }


//                var api = 'https://immense-journey-49192.herokuapp.com/';
//                var route = 'messageBot';
//
//                var apiUrl = api + route;
//
//                request({
//                    url: apiUrl,
//                    json: {
//                        "user": {
//
//                            "userID": sessions[sessionId].fbid,
//                            "plattform": 1
//
//                        },
//                        "methode": "gibAufgabe",
//                        "modul": context.modul,
//                        "thema": {
//                            "id": context.thema,
//                            "token": context.token
//                        }
//                    }
//                }, function (error, response, body) {
//
//                    if (!error && response.statusCode === 200) {
//
//                        context.aufgabeText = body.aufgabe.frage;
//                        context.verweis = body.aufgabe.verweis;
//                        context.hinweis = body.aufgabe.hinweis;
//                        context.bewerten = body.aufgabe.bewerten;
//                        context.antwort1 = body.antwort[0];
//
//                        //Hier noch Antwort einfügen!! Frage und Antwort muss getrennt
//                        //gesendet werden
//
//
//
//                    } else {
//
//                        
//
//                    }

            return resolve(context);
        });


    },

    setzeName( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {


            var name = firstEntityValue(entities, "contact");

            var api = 'https://immense-journey-49192.herokuapp.com/';
            var route = 'messageBot';

            var apiUrl = api + route;

            if (name) {

                request({
                    url: apiUrl,
                    json: {
                        "user": {
                            "userID": sessions[sessionId].fid,
                            "plattformID": 1

                        },
                        "methode": "setzeName",
                        "username": context.contact
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {


                        context.name = "Ok ab jetzt nenne ich dich " + name;

                    } else {



                    }
                });

            }


            return resolve(context);
        });
    },

    speichereNote( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {
            var note = firstEntityValue(entities, "number");
            var modul = firstEntityValue(entities, "modul");


            var api = 'https://immense-journey-49192.herokuapp.com/';
            var route = 'messageBot';

            var apiUrl = api + route;

            if (modul && note) {

                request({
                    url: apiUrl,
                    json: {
                        "user": {
                            "userID": sessions[sessionId].fid,
                            "plattformID": 1
                        },
                        "methode": "speichereNote",
                        "modul": context.modul,
                        "userNote": context.number
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {


                        //i.was machen

                    } else {



                    }
                });

            }

            context.note = note;
            context.modul = modul;

            return resolve(context);
        });
    },

    gibInfos( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            var modul = firstEntityValue(entities, "modul");


            var api = 'https://immense-journey-49192.herokuapp.com/';
            var route = 'messageBot';

            var apiUrl = api + route;

            if (modul) {

                request({
                    url: apiUrl,
                    json: {
                        "user": {
                            "userID": sessions[sessionId].fid,
                            "plattformID": 1
                        },
                        "methode": "speichereNote",
                        "modul": context.modul,
                        "userNote": context.number
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {


                        //i.was machen

                    } else {

                        //Fehlerfall

                    }
                });
            }

            if (modul) {
                context.modul = "Hier sind deine " + modul + "-Daten.";
                delete context.missingModul;
            } else {
                context.missingModul = "Hier sind deine Statistiken";
                delete context.modul;
            }

            return resolve(context);
        });
    },

    setzeUni( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            var uni = firstEntityValue(entities, "uni");

            var api = 'https://immense-journey-49192.herokuapp.com/';
            var route = 'messageBot';

            var apiUrl = api + route;

            if (uni) {

                request({
                    url: apiUrl,
                    json: {
                        "user": {
                            "userID": sessions[sessionId].fid,
                            "plattformID": 1
                        },
                        "methode": "setzeUni",
                        "uniID": 1
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {

                        context.uni = "Ok deine Uni ist also die " + uni;

                    } else {

                        //Fehlerfall

                    }
                });
            }

            context.uni = "Ok deine Uni ist also die " + uni;

            return resolve(context);
        });
    },

    setzePruefung( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            var time = firstEntityValue(entities, "datetime");
            var modul = firstEntityValue(entities, "modul");

            var api = 'https://immense-journey-49192.herokuapp.com/';
            var route = 'messageBot';

            var apiUrl = api + route;

            if (time && modul) {

                context.time = time;
                context.modul = modul;

                delete context.missingModul;
                delete context.missingTime;

            } else if (context.time && context.modul) {

                delete context.missingModul;
                delete context.missingTime;

            } else if (modul) {
                if (context.time) {

                    context.modul = modul;

                    delete context.missingModul;

                } else {
                    context.missingTime = true;
                    context.modul = modul;

                    delete context.missingModul;
                }
            } else if (time) {

                if (context.modul) {

                    context.time = time;

                    delete context.missingTime;

                } else {
                    keinModul = true;
                    context.missingModul = true;
                    context.time = time;

                    delete context.missingTime;
                }

            } else {
                keinModul = true;
                context.missingModul = true;
            }


            if (time && modul) {

                request({
                    url: apiUrl,
                    json: {
                        "user": {
                            "userID": sessions[sessionId].fid,
                            "plattformID": 1
                        },
                        "methode": "setzePruefung",
                        "modul": context.modul,
                        "pruefungsperiode": 2, /////KPPP SO BESTIMMT NOCH ZU ÄNDERN
                        "pruefungsperiodeJahr": 2017
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {

                        //Antwort Variable erstellen wit.ai

                    } else {

                        //Fehlerfall

                    }
                });
            }

            return resolve(context);
        });
    },

    gibKlausurInfos( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            var modul = firstEntityValue(entities, "modul");

            var api = 'https://immense-journey-49192.herokuapp.com/';
            var route = 'messageBot';

            var apiUrl = api + route;

            if (modul) {

                request({
                    url: apiUrl,
                    json: {
                        "user": {
                            "userID": sessions[sessionId].fid,
                            "plattformID": 1
                        },
                        "methode": "gibKlausurInfos",
                        "modul": modul
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {

                        context.infos = "Ok hier sind die Infos zur " + modul + " Klausur !!!";
                        //NATÜRLICH DIE INFOS NOCH!!

                    } else {

                        //Fehlerfall

                    }
                });
            }


            return resolve(context);
        });
    },

    bewerteAufgabe( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            var wert = firstEntityValue(entities, "bewertung");

            var api = 'https://immense-journey-49192.herokuapp.com/';
            var route = 'messageBot';

            var apiUrl = api + route;

            if (wert) {

                request({
                    url: apiUrl,
                    json: {
                        "user": {
                            "userID": sessions[sessionId].fid,
                            "plattformID": 1
                        },
                        "methode": "bewerteAufgabe",
                        "likeAufgabe": true, //Hier wird kein Wert erwartet sondern true/false!,
                        "aufgabenID": 1 //Braucht wert 1
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {

                        context.bewertung = "Ok also findest du die Aufgabe " + wert;
                        //NATÜRLICH DIE INFOS NOCH!!

                    } else {

                        //Fehlerfall

                    }
                });
            }


            return resolve(context);
        });
    }

};

// Setting up our bot
const wit = new Wit({
    accessToken: WIT_TOKEN,
    actions,
    logger: new log.Logger(log.INFO)
});

// Starting our webserver and putting it all together
const app = express();
app.use(({method, url}, rsp, next) => {
    rsp.on('finish', () => {
        console.log(`${rsp.statusCode} ${method} ${url}`);
    });
    next();
});
app.use(bodyParser.json({verify: verifyRequestSignature}));

// Webhook setup
app.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' &&
            req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    } else {
        res.sendStatus(400);
    }
});

// Message handler
app.post('/webhook', (req, res) => {

    // Parse the Messenger payload
    // See the Webhook reference
    // https://developers.facebook.com/docs/messenger-platform/webhook-reference
    const data = req.body;



    if (data.object === 'page') {
        data.entry.forEach(entry => {
            entry.messaging.forEach(event => {

                // Yay! We got a new message!
                // We retrieve the Facebook user ID of the sender
                const sender = event.sender.id;

                // We retrieve the user's current session, or create one if it doesn't exist
                // This is needed for our bot to figure out the conversation history
                const sessionId = findOrCreateSession(sender);


                if (event.message) {


                    // We retrieve the message content
                    var {text, attachments, quick_reply} = event.message;
                    
                    if (quick_reply) {

                        var payload = quick_reply.payload;
                    }

                    if (attachments) {

                        // Der Benutzer hat ein Anhang (Bild,Video etc) gesendet
                        // Kann noch nicht bearbeitet werden.
                        fbMessage(sender, 'Zurzeit kann ich leider noch keine Anhänge bearbeiten!')
                                .catch(console.error);
                        
                        
                    } else if (text) {
                        // Der Benutzer hat eine Textnachricht gesendet

                        console.dir("Der Aktuelle Context");
                        console.dir(sessions[sessionId].context);

                        if (text.charAt(0) === '!') {

                            switch (text) {

                                case '!kazoo':

                                    text = 'Gute Wahl! Video kommt sofort ;)'
                                    text = {text};

                                    fbMessage(sender, text)
                                            .then(() => null)
                                            .catch((err) => {
                                                console.error(
                                                        'Oops! An error occurred while forwarding the response to',
                                                        sender,
                                                        ':',
                                                        err.stack || err
                                                        );
                                            });

                                    text = {"attachment": {
                                            "type": "video",
                                            "payload": {
                                                "url": "https://goo.gl/f4sgPo"
                                            }
                                        }
                                    }



                                    fbMessage(sender, text)
                                            .then(() => null)
                                            .catch((err) => {
                                                console.error(
                                                        'Oops! An error occurred while forwarding the response to',
                                                        sender,
                                                        ':',
                                                        err.stack || err
                                                        );
                                            });
                                    break;

                                case '!monkey' :

                                    text = {"attachment": {
                                            "type": "image",
                                            "payload": {
                                                "url": "https://media.giphy.com/media/5Zesu5VPNGJlm/giphy.gif"
                                            }
                                        }
                                    };

                                    fbMessage(sender, text)
                                            .then(() => null)
                                            .catch((err) => {
                                                console.error(
                                                        'Oops! An error occurred while forwarding the response to',
                                                        sender,
                                                        ':',
                                                        err.stack || err
                                                        );
                                            });


                                    break;



                                default:
                                    text = 'YOLO geiles Ausrufezeichen!';
                                    text = {text};
                                    fbMessage(sender, text)
                                            .then(() => null)
                                            .catch((err) => {
                                                console.error(
                                                        'Oops! An error occurred while forwarding the response to',
                                                        sender,
                                                        ':',
                                                        err.stack || err
                                                        );
                                            });
                                    break;

                            }

                        } else {

                            if (payload === 'richtig') {


                                //Aufrufen SpeichereAntwort

                                var text = {"text": "Die Antwort war richtig!"};

                                fbMessage(sender, text)
                                        .then(() => null)
                                        .catch((err) => {
                                            console.error(
                                                    'Oops! An error occurred while forwarding the response to',
                                                    sender,
                                                    ':',
                                                    err.stack || err
                                                    );
                                        });

                            } else if (payload === 'falsch') {


                                //Aufrufen Speichere Antwort

                                var text = {"text": "Die Antwort war leider falsch du AFFENJUNGEN NOOB!!! Wichser...HUSO ersterklasse"};

                                fbMessage(sender, text)
                                        .then(() => null)
                                        .catch((err) => {
                                            console.error(
                                                    'Oops! An error occurred while forwarding the response to',
                                                    sender,
                                                    ':',
                                                    err.stack || err
                                                    );
                                        });



                            }



                            // Let's forward the message to the Wit.ai Bot Engine
                            // This will run all actions until our bot has nothing left to do
                            wit.runActions(
                                    sessionId, // the user's current session
                                    text, // the user's message
                                    sessions[sessionId].context // the user's current session state
                                    ).then((context) => {
                                // Our bot did everything it has to do.
                                // Now it's waiting for further messages to proceed.
                                console.log('Waiting for next user messages');

                                // Based on the session state, you might want to reset the session.
                                // This depends heavily on the business logic of your bot.
                                // Example:
                                // if (context['done']) {
                                //   delete sessions[sessionId];
                                // }

                                // Updating the user's current session state


                                sessions[sessionId].context = context;

                            })
                                    .catch((err) => {
                                        console.error('Oops! Got an error from Wit: ', err.stack || err);
                                    });
                        }
                    }
                } else if (event.postback) {

                    const {payload} = event.postback;
                    var text = payload;

                    if (payload.charAt(0) === '!') {

                        switch (text) {

                            case '!hilfe':
                                text = 'Dies ist ein Lernbot der WHS Gelsenkirchen, schreib mir Sachen wie "Gib mir eine Aufgabe" oder "Melde mich bei der Prüfung XY am Datum an." Du kannst mich auch nach dem Wetter fragen ;)';
                                text = {text};

                                fbMessage(sender, text)
                                        .then(() => null)
                                        .catch((err) => {
                                            console.error(
                                                    'Oops! An error occurred while forwarding the response to',
                                                    sender,
                                                    ':',
                                                    err.stack || err
                                                    );
                                        });

                                break;

                            default:
                                text = 'YOLO geiles Ausrufezeichen!';
                                text = {text};
                                fbMessage(sender, text)
                                        .then(() => null)
                                        .catch((err) => {
                                            console.error(
                                                    'Oops! An error occurred while forwarding the response to',
                                                    sender,
                                                    ':',
                                                    err.stack || err
                                                    );
                                        });
                                break;

                        }
                    }
                } else {
                    console.log('received event', JSON.stringify(event));
                }
            });
        });
    }
    res.sendStatus(200);
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
    var signature = req.headers["x-hub-signature"];

    if (!signature) {
        // For testing, let's log an error. In production, you should throw an
        // error.
        console.error("Couldn't validate the signature.");
    } else {
        var elements = signature.split('=');
        var method = elements[0];
        var signatureHash = elements[1];

        var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
                .update(buf)
                .digest('hex');

        if (signatureHash !== expectedHash) {
            throw new Error("Couldn't validate the request signature.");
        }
    }
}

function messageCreator(context, entities) {




}

app.listen(PORT);
console.log('Listening on :' + PORT + '...');
