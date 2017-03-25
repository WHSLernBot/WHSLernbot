'use strict';

//Schritt Anleitung von Facebook/Wit.ai zum aufsetzen eines Bots.

// Integration von Wit.ai in den Facebook CHat
// Vorrausetzung
// * Ein Wit.ai Bot Projekt  (https://wit.ai/docs/quickstart)
// * Eine Facebook Seite/App (https://developers.facebook.com/docs/messenger-platform/quickstart)
// Folgende Module müssen mittels 'npm install' in der Eingabeaufforderung installiert werden: body-parser, express, request.
//
// 4. WIT_TOKEN=your_access_token FB_APP_SECRET=your_app_secret FB_PAGE_TOKEN=your_page_token node examples/messenger.js
// 5. Verknüpfe deine Webseite als Webhooks in deinen Facebook App Einstellungen. verify_token and `https://deine-domain.de/webhook` als Callback URL.
// 6. Du kannst jetzt mit deinem Bot in Facebook Kommunizieren.


//Laden der Bibliotheken in unser Projekt.
const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');
const http = require('http');
var Wit = null;
let log = null;

//Erstellen der Notwendigen Objekte aus Bibliotheken von Node.js
try {

    Wit = require('../').Wit;
    log = require('../').log;
} catch (e) {
    Wit = require('node-wit').Wit;
    log = require('node-wit').log;
}
try {

    Wit = require('../').Wit;
    log = require('../').log;
} catch (e) {
    Wit = require('node-wit').Wit;
    log = require('node-wit').log;
}

//Alle Token werden auf dem Server ausgelesen. Bei Localer überprüfung müssen diese mitangegeben werden!

// Webserver parameter
const PORT = process.env.PORT || 8445;

// Unser Spezieller WIT_TOKEN um uns Zugriff zu WIT.ai zu gewähren.
const WIT_TOKEN = process.env.WIT_TOKEN;

//PB_PAGE_TOKEN dient zur Zuweisung der APP
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
if (!FB_PAGE_TOKEN) {
    throw new Error('missing FB_PAGE_TOKEN');
}

//FB_APP_SECRET zur bestätifung unserer APP, kann als Passwort gesehen werden.
const FB_APP_SECRET = process.env.FB_APP_SECRET;
if (!FB_APP_SECRET) {
    throw new Error('missing FB_APP_SECRET');
}


//Unser FB_VERIFY_TOKEN, welcher bestätigt das dieser Node.js zu unserer APP gehört.
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
if (!FB_VERIFY_TOKEN) {
    throw new Error('missing FB_VERIFY_SECRET');
}

// ----------------------------------------------------------------------------
// Messenger API specific code

// Hier kann sich der Funktionsumfang von der Facebook Messenger API angesehen werden.
// https://developers.facebook.com/docs/messenger-platform/send-api-reference


//Mit dieser Methode können Nachrichten an Facebook gesendet werden
//@id Die Facebook ID eines Nutzers
//@text Die Nachricht, welche an den Nutzer gesendet werden soll.
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
                return json;
            });
};

// ----------------------------------------------------------------------------
// Wit.ai bot spezifischer Code

// Hier werden alle Userinformationen in Sessions gespeichert
// Jede Session hat einen Eintrag
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

//Erstellt oder sucht eine Session für einen User, falls dieser schon eine hat,
// oder eben nicht!
const findOrCreateSession = (fbid) => {
    let sessionId;

    // Prüfen ob zu dem gegebenen User schon eine Session existiert
    Object.keys(sessions).forEach(k => {
        if (sessions[k].fbid === fbid) {
            //Falls eine Session gefunden wurde
            sessionId = k;
        }
    });
    if (!sessionId) {
        // Erstellen einer neuen Session
        sessionId = new Date().toISOString();
        sessions[sessionId] = {fbid: fbid, context: {}};
    }
    return sessionId;
};

//Hilfsmethode zum auslesen der von Wit.ai übergebenen Informationen zum Gespräch.
//@entities JsonObject mit allen Einträgen.
//@entity Name der gesuchten Entity.
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


// Innerhalb dieser Variable werden alle Funktionen des Wit.ai Bots erstellt.
// Liste aller Funktionen :
// send
// getForecast
// replies
// loesche
// speichereNote
// gibSelektoren
// gibAufgabe
// gibInfos
// gibMeineModule
// setzeName
// meldeModulAn
// setzeUni
// 
// Hier können die einzelnen Wit Funktionen erstellt werden.
// See https://wit.ai/docs/quickstart
const actions = {

    send( {sessionId}, {text}) {

        //Festlegen des Empfängers
        const recipientId = sessions[sessionId].fbid;

        if (recipientId) {

            text = {text};

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
            
            return Promise.resolve();
    }
    },
    
    


    //Funktion zum Abrufen von Wetter Daten auf openweathermap.org.
    //Aktuell nur das aktuelle Wetter
    //appid kann unter Vorbehalt verwendet werden. Zu Sicherheit sollten sich aber 
    //die AGBs der Webseite nochmals durchgelesen werden und ein eigener Account + appid erstellt werden.
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
                "text": "Für dieses Thema habe ich leider noch keine Aufgabe :( !"
            };

            if (context.thema === "HTML") {

                frage = {
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

            } else if (context.thema === "XML") {

                frage = {
                    "text": "Welche Antwort meinst du ist richtig?",
                    "quick_replies": [
                        {
                            "content_type": "text",
                            "title": "A",
                            "payload": "falsch"
                        },
                        {
                            "content_type": "text",
                            "title": "B",
                            "payload": "richtig"
                        },
                        {
                            "content_type": "text",
                            "title": "C",
                            "payload": "falsch"
                        }
                    ]
                };


            }



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

    //Löscht die Contexte aus gibAufgabe
    loesche( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            delete context.Aufgabe;
            delete context.A;
            delete context.B;
            delete context.C;
            delete context.modul;
            delete context.thema;
            delete context.missingModul;
            delete context.missingThema;

            delete context.location;
            delete context.missingLocation;
            delete context.wrongLocation;
            delete context.forecast;

            delete context.note;

            return resolve(context);
        });
    },

    //Speichert die Note zu einem Modul
    speicherNote( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            var note;

            //nur modul aufrufen, wird die Funktion nicht aktivieren
            //daher ist es mit Note zsm genannt oder kommt im zweiten schritt dazu
            //daher ist eine Abspeicherung wie bei Note nicht nötig !!!
            var modul = firstEntityValue(entities, "modul");
            console.dir(modul);

            //für den fall das nur die Note geschrieben wird und dabei 100% 
            //für den weiteren verlauf abgespeichert wird.
            if (firstEntityValue(entities, "number") !== null) {

                
                note = firstEntityValue(entities, "number");
                

            } else if (firstEntityValue(entities, "note") !== null) {
                
                note = firstEntityValue(entities, "note");
                
            } else {
                
                note = context.note;
                
            }



            if (note && modul) {

                var api = 'https://immense-journey-49192.herokuapp.com/';
                var route = 'messageBot';

                var apiUrl = api + route;

                request({
                    url: apiUrl,
                    json: {
                        "user": {
                            "userID": sessions[sessionId].fbid + "",
                            "plattformID": 1,
                            "witSession": "12345"
                        },
                        "methode": "speichereNote",
                        "modul": modul,
                        "userNote": note
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {


                        //Hier noch Antwort einfügen!! Frage und Antwort muss getrennt
                        //gesendet werden

                    } else {


                    }

                });


                context.note = note;
                context.modul = modul;
               
                delete context.missingModul;
                return resolve(context);

            } else {
                
                context.missingModul = true;
                context.note = note;
                
                return resolve(context);
            }



            //return resolve(context);
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
                        "userID": sessions[sessionId].fid + "",
                        "plattformID": 1,
                        "witSession": "12345"
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

    //Ermittelt eine Aufgabe für den Benutzer.
    gibAufgabe( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            var thema;
            var modul;

            // Er überschreibt die Variable nur wenn Sie auch in der Nachricht vorhanden ist.
            // sonst ist die variable die alte schonmal genutzte variable im Context
            if (firstEntityValue(entities, "thema") !== null) {
                thema = firstEntityValue(entities, "thema");

            } else {
                thema = context.thema;
            }

            // Er überschreibt die variable nur wenn Sie auch in der Nachricht vorhanden ist.
            // sonst ist die variable die alte schonmal genutzte variable im Context
            if (firstEntityValue(entities, "modul") !== null) {
                modul = firstEntityValue(entities, "modul");
            } else {
                modul = context.modul;
            }

            // Wenn modul und thema drin ist
            if (modul && thema) {
                //es ist ein modul und thema gegeben

                var api = 'https://immense-journey-49192.herokuapp.com/';
                var route = 'messageBot';

                var apiUrl = api + route;

                request({
                    url: apiUrl,
                    json: {
                        "user": {
                            "userID": sessions[sessionId].fbid + "",
                            "plattform": 1,
                            "witSession": "12345"
                        },
                        "methode": "gibAufgabe",
                        "modul": modul,
                        "thema": {
                            "id": -1,
                            "token": [
                                thema
                            ]
                        }
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {

                        contex.Aufgabe = body.aufgabe;
                        context.A = body.antwort[0];
                        context.B = body.antwort[1];
                        context.C = body.antwort[2];
                        context.verweis = body.verweis;
                        context.hinweis = body.hinweis;

                    } else {

                        context.error = "Ich konnte dir leider keine Aufgabe schicken, da ein Fehler in der Datenbank vorliegt";

                    }

                });



                context.modul = modul;
                context.thema = thema;
                //Abspeichern der Richtig und Falschen Antwort
                delete context.missingModul;
                delete context.missingThema;


            } else {
                context.missingModul = true;

            }

            return resolve(context);
        });


    },

    //Soll grundlegende Infos eines Nutzer ausgeben.
    gibInfos( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {


            var api = 'https://immense-journey-49192.herokuapp.com/';
            var route = 'messageBot';

            var apiUrl = api + route;

            request({
                url: apiUrl,
                json: {
                    "user": {
                        "userID": sessions[sessionId].fid + "",
                        "plattformID": 1,
                        "witSession": "12345"

                    },
                    "methode": "gibInfos"
                }
            }, function (error, response, body) {

                if (!error && response.statusCode === 200) {


                } else {


                }
            });


            return resolve(context);
        });
    },

    //Soll die Module ausgeben bei denen der Nutzer angemeldet ist !
    gibMeineModule( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {


            var api = 'https://immense-journey-49192.herokuapp.com/';
            var route = 'messageBot';

            var apiUrl = api + route;

            request({
                url: apiUrl,
                json: {
                    "user": {
                        "userID": sessions[sessionId].fid + "",
                        "plattformID": 1,
                        "witSession": "12345"
                    },
                    "methode": "gibAnModule"
                }
            }, function (error, response, body) {

                if (!error && response.statusCode === 200) {

                    console.log("Juhu keine Fehler");

                } else {

                    console.log("GibANModule funkt nicht BIIIIITCH");

                }
            });

            context.gibModule = true
                    ;
            return resolve(context);
        });
    },

    //Speichert den übergebenen Benutzernamen in der Datenbank ab.
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
                            "userID": sessions[sessionId].fid + "",
                            "plattformID": 1,
                            "witSession": "12345"
                        },
                        "methode": "setzeName",
                        "username": context.contact
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {


                        context.name = "Ok ab jetzt nenne ich dich " + name;

                    } else {

                        context.error = "Hmm dein Name fällt mir schwer! Kannst du ihn mir nochmal nennen? ;)"

                    }
                });

            }

            return resolve(context);
        });
    },

    //Meldet den Nutzer für das gewünschter Modul an.
    meldeModulAn( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            //erstellt ein Array mit den Modulen bei denen man sich anmelden möchte
            var modul = new Array;
            var i = 0;

           
            if (entities.modul === undefined || entities.modul === "undefined") {
                //FALLS der Bot in die Funktion geht ohne ein Modul zu haben
                context.antwort = "Tut mir leid ohne Modul bei der Anmeldung verstehe ich nichts, versuche es doch einfach nochmal !";

                return resolve(context);
            }

            while (entities.modul.length > i) {

                //fügt jedes genannte Modul an das Array dran
                modul.push(entities.modul[i].value);
                i = i + 1;

            }

            context.antwort = "Hey ich habe dich erfolgreich für dein/e Modul/e angemeldet <3";

            var api = 'https://immense-journey-49192.herokuapp.com/';
            var route = 'messageBot';

            var apiUrl = api + route;

            if (modul) {

                request({
                    url: apiUrl,
                    json: {
                        "user": {
                            "userID": sessions[sessionId].fid + "",
                            "plattformID": 1,
                            "witSession": "12345"
                        },
                        "methode": "meldeFuerModulAn",
                        "module": modul
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {


                        //i.was machen

                    } else {

                        //Fehlerfall

                    }
                });
            }


            return resolve(context);
        });
    },

    //Legt eine Uni für einem Benutzer fest.
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
                "userID": sessions[sessionId].fid + "",
                "plattformID": 1,
                "witSession": "12345"
            },
            "methode": "setzeUni",
            "uniID": 1
        }
    }, function (error, response, body) {

        if (!error && response.statusCode === 200) {

            context.uni = "Ok deine Uni ist also die " + uni;

        } else {
            //Für den Fall eines Fehlers
            context.error = "Leider ist ein Fehler, beim setzen deiner Uni, passiert! :( Könntest du noch einmal deine Uni nennen?"

        }
    });
            }

            return resolve(context);
        });
    },

    //Setz eine Prüfungs für einen Nutzer zu einem bestimmten Modul.
    setzePruefung( {context, entities, sessionId}) {
        return new Promise(function (resolve, reject) {

            var time = firstEntityValue(entities, "datetime");
            var modul = firstEntityValue(entities, "modul");

            var api = 'https://immense-journey-49192.herokuapp.com/';
            var route = 'messageBot';

            var apiUrl = api + route;

            if (time && modul) {

                request({
                    url: apiUrl,
                    json: {
                        "user": {
                            "userID": sessions[sessionId].fid + "",
                            "plattformID": 1,
                            "witSession": "12345"
                        },
                        "methode": "setzePruefung",
                        "modul": context.modul,
                        "pruefungsperiode": 2, /////KPPP SO BESTIMMT NOCH ZU ÄNDERN
                        "pruefungsperiodeJahr": 2017
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {

                        context.antwort = "Okay deine Prüfung für das Modul " + modul + " wurde für den " + time + "eingetragen."

                    } else {

                        context.error = "Ich konnte deine Prüfung leider nicht setzen! Btte überprüf dein Datum und das Modul noch einmal!"

                    }
                });
            }

            return resolve(context);
        });
    },

    //Gibt die Klausrinformationen über ein bestimmtes Modul
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
                            "userID": sessions[sessionId].fid + "",
                            "plattformID": 1,
                            "witSession": "12345"
                        },
                        "methode": "gibKlausurInfos",
                        "modul": modul
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {

                        context.infos = "Ok hier sind die Infos zur " + modul + " Klausur! Infos: \n " + body.info;


                    } else {

                        context.error = "Leider habe ich es nicht geschafft dir Informationen über dieses Modul zu beschaffen :( Versuche es evtl später nochmal! :)"

                    }
                });
            }

            return resolve(context);
        });
    },

    //Gibt der Datebank die Bewertung der aktuellen Aufgabe an.
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
                            "userID": sessions[sessionId].fid + "",
                            "plattformID": 1,
                            "witSession": "12345"
                        },
                        "methode": "bewerteAufgabe",
                        "likeAufgabe": true, //Hier wird kein Wert erwartet sondern true/false!,
                        "aufgabenID": 1 //Braucht wert 1
                    }
                }, function (error, response, body) {

                    if (!error && response.statusCode === 200) {

                        context.bewertung = "Ok also findest du die Aufgabe " + wert;


                    } else {

                        context.error = "Leider ist beim Bewerten was schief gelaufen!";

                    }
                });
            }

            return resolve(context);
        });
    }

};

// Erstellt eine Wit.ai Variable
// Regelt den Zugriff auf unser Wit.ai Konto über unseren zugewiesenen WIT_TOKEN. 
const wit = new Wit({
    accessToken: WIT_TOKEN,
    actions,
    logger: new log.Logger(log.INFO)
});

// Erstellt eine Express Variable, welche den Zugang zum Server festlegt.
const app = express();
app.use(({method, url}, rsp, next) => {
    rsp.on('finish', () => {
        console.log(`${rsp.statusCode} ${method} ${url}`);
    });
    next();
});
app.use(bodyParser.json({verify: verifyRequestSignature}));

// Route für den Facebook Webhook.
app.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' &&
            req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    } else {
        res.sendStatus(400);
    }
});

// POST Route für Facebook, an welchen die User Daten geschickt werden.
app.post('/webhook', (req, res) => {

    // Auswerten des Benutzerinputs
    // Weitere Informationen unter:
    // https://developers.facebook.com/docs/messenger-platform/webhook-reference
    const data = req.body;

    if (data.object === 'page') {
        data.entry.forEach(entry => {
            entry.messaging.forEach(event => {

                // Ermitteln/Festelgen des Absenders
                const sender = event.sender.id;

                // Prüfen ob der Absender schon eine Session besitzt, wenn nicht
                // wird eine neue Session erstellt 
                const sessionId = findOrCreateSession(sender);

                if (event.message && !event.postback) {

                    // Prüfen auf Art der Benutzer Nachricht.
                    var {text, attachments, quick_reply, is_echo} = event.message;

                    if (quick_reply) {

                        var payload = quick_reply.payload;
                    }

                    if (attachments) {

                        // Der Benutzer hat ein Anhang (Bild,Video etc) gesendet
                        // Kann noch nicht bearbeitet werden.
                        fbMessage(sender, 'Zurzeit kann ich leider noch keine Anhänge bearbeiten!')
                                .catch(console.error);

                        //Prüfen ob eine der Benutzer eine Textnachricht gesendet hat
                        //(!is_echo prüft ob es die Nachricht ist die wir dem Nutzer geschickt haben, welche immer als Echo bekommen,und sortiert diese aus.)
                    } else if (text && !is_echo) {

                        // Alle Nachrichten die mit ! anfangen sind zum Testen gedacht
                        if (text.charAt(0) === '!') {

                            switch (text) {

                                //Testbefehl zum Senden eines GIF-Bildes.
                                //Quelle: https://www.giphy.com // Link: https://media.giphy.com/media/5Zesu5VPNGJlm/giphy.gif
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
                                    text = 'Nicht erkannter Test befehl';
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
                            //Payload ist eine spezielle Textnachricht, 
                            //welche beim klicken von Buttons im Chat automatisch an Node.js gesendet werden.
                            if (payload === 'richtig') {

                                //Sollte eine Antowrt richtig sein, wird der User darüber informiert.
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


                                //Sollte eine Antowrt falsch sein, wird der User darüber informiert.

                                var text = {"text": "Die Antwort war leider falsch! :/"};

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
                            } else if (payload === '!ins') {

                                //Testfall für das Setzen eins Moduls, in dem Fall INS.
                                var api = 'https://immense-journey-49192.herokuapp.com/';
                                var route = 'messageBot';

                                var apiUrl = api + route;

                                request({
                                    url: apiUrl,
                                    json: {
                                        "user": {
                                            "userID": sender + "",
                                            "plattformID": 1,
                                            "witSession": "12345"
                                        },
                                        "methode": "meldeFuerModulAn",
                                        "module": ["INS"]
                                    }
                                }, function (error, response, body) {

                                    if (!error && response.statusCode === 200) {

                                        text = 'Okay INS wurde als Modul gespeichert! Frag mich doch direkt mal nach einer Aufgabe! :)';
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

                                    } else {
                                        text = 'Es ist wohl ein Fehler aufgetreten!';
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

                                    }
                                });
                            } else {

                                //Standardfall: Nachricht an Wit.ai weiterleiten 
                                wit.runActions(
                                        sessionId, // Aktuelle SessionID.
                                        text, // Nachricht von dem Benutzer.
                                        sessions[sessionId].context //Der Context vom Benutzergespräch 
                                        ).then((context) => {
                                    //Der Bot hat die Anfrage bearbeitet und wartet auf die nächste Nachricht.
                                    console.log('Waiting for next user messages');



                                    //Aktualisiert den Benutzer Context
                                    sessions[sessionId].context = context;

                                }).catch((err) => {
                                    console.error('Oops! Error von Wit erhalten: ', err.stack || err);
                                });
                            }
                        }
                    }
                    //Spezielles Event, welches kein Nachrichten Objekt des User ist.
                    //Postbacks sind Nachrichten, welche in Facebook hinterlegt werden können,
                    //welche ausgelöst werden, sollte der User etwas bestimmte drücken, wie z.B.: Buttons, Templates. 
                } else if (event.postback) {

                    const {payload} = event.postback;
                    var text = payload;

                    if (payload.charAt(0) === '!') {

                        //Hier wird ! als markierung Verwendet.
                        switch (text) {

                            //Sollte das Peristent Menu geöffnet worden sein und auf Hilfe gedrückt wurde, 
                            //wird diese Nachricht an den User geschickt.
                            case '!hilfe':
                                text = 'Dies ist ein Lernbot der WHS Gelsenkirchen, du kannst nach Aufgaben für dein angemeldetes Modul fragen mit z.B. "Gib mir eine Aufgabe". Außerdem kannst du mich auch nach dem Wetter fragen ;)';
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

                                // Testfall zum Setzen einer Universität, in diesem Fall WHS.
                            case '!whs':

                                var api = 'https://immense-journey-49192.herokuapp.com/';
                                var route = 'messageBot';

                                var apiUrl = api + route;

                                request({
                                    url: apiUrl,
                                    json: {
                                        "user": {
                                            "userID": sender + "",
                                            "plattformID": 1,
                                            "witSession": "12345"
                                        },
                                        "methode": "setzeUni",
                                        "uniID": 1
                                    }
                                }, function (error, response, body) {

                                    if (!error && response.statusCode === 200) {

                                        text = 'Okay die WHS Gelsenkirchen ist jetzt registriert!';
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



                                        var frage = {
                                            "text": "Mit welchem Modul möchtest du beginnen?",
                                            "quick_replies": [
                                                {
                                                    "content_type": "text",
                                                    "title": "INS",
                                                    "payload": "!ins"
                                                },
                                                {
                                                    "content_type": "text",
                                                    "title": "Möglichkeit B",
                                                    "payload": "!gmi"
                                                },
                                                {
                                                    "content_type": "text",
                                                    "title": "Möglichkeit C",
                                                    "payload": "!opr"
                                                }
                                            ]
                                        };

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

                                    } else {

                                        text = 'Es ist wohl ein Fehler aufgetreten!';
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

                                    }
                                });

                                break;

                                //Dieses Event wird ausgelöst, wenn auf Los Gehts/Get Started gedrückt wird.
                            case '!gettingStarted':

                                text = 'Willkommen beim WHSLernBot. Damit du mit dem lernen anfangen kannst wähle bitte zuerst eine Hochschule.';
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

                                text = {
                                    "attachment": {
                                        "type": "template",
                                        "payload": {
                                            "template_type": "list",
                                            "elements": [
                                                {
                                                    "title": "Westfälische Hochschule Gelsenkirchen",
                                                    "image_url": "http://i1383.photobucket.com/albums/ah313/Pascal_Bro/westfaelische-hochschule-wh-600x377_zps3accakub.png",
                                                    "subtitle": "Die Westfälische Hochschule ist eine Fachhochschule in Nordrhein-Westfalen",
                                                    "buttons": [
                                                        {
                                                            "type": "postback",
                                                            "title": "WHS auswählen",
                                                            "payload": "!whs"
                                                        }
                                                    ]
                                                },
                                                {
                                                    "title": "Weitere Unis?",
                                                    "image_url": "http://i1383.photobucket.com/albums/ah313/Pascal_Bro/white_and_blue_twitter_zpsdci5lqwj.jpg",
                                                    "subtitle": "Zurzeit ist leider nur die Westfälische Hochschule eingetragen. ",
                                                    "buttons": [
                                                        {
                                                            "type": "postback",
                                                            "title": "Hinzufügen",
                                                            "payload": "!neueUni"
                                                        }
                                                    ]
                                                }
                                            ],
                                            "buttons": [
                                                {
                                                    "title": "Close",
                                                    "type": "postback",
                                                    "payload": "!close"
                                                }
                                            ]
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

                                //Testfall für das erneute Auswählen in einem Template.
                            case '!neueUni':
                                text = 'Du hast dich schon für eine Option entschieden!';
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
                                //Default Ausgabe wenn ein nicht abgedeckter Fall auftritt.                
                            default:
                                text = 'Nicht erkanntes Postback event!';
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
 * Überprüft ob eine Anfrage tatsächlich von Facebook kommt,dazu wird das FB_APP_SECRET verwendet.
 * 
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
    var signature = req.headers["x-hub-signature"];

    if (!signature) {
        //Hier wird zu Testzwecken nur ein Log erstellt.
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

//Startt den Server auf den von Heroku zugewiesenen Port.
app.listen(PORT);
console.log('Listening on :' + PORT + '...');
