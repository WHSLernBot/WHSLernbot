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
let Wit = null;
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
if (!FB_PAGE_TOKEN) { throw new Error('missing FB_PAGE_TOKEN'); }
const FB_APP_SECRET = process.env.FB_APP_SECRET;
if (!FB_APP_SECRET) { throw new Error('missing FB_APP_SECRET'); }


//Diesen Token kann man auch noch generieren lassen
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
if (!FB_VERIFY_TOKEN) { throw new Error('missing FB_APP_SECRET'); }

// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, text) => {
  const body = JSON.stringify({
    recipient: { id },
    message:   text , 
  });
  
  
  const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp =>  rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    
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


//Die Confidence erkennen
  function getIntent(message) {
  var serviceResult = {};
  var url = 'https://api.wit.ai/message?v=20161006&q='+message;
  var options = {
    uri: url,
    qs: {},
    method: 'POST',
    headers: {},
    auth: {'bearer': process.env.WIT_TOKEN},
    json: true
  };
  request(options, function(error, response, body) {
    if(!error) {
      serviceResult.result = "success";
      // Check for entities
      if(body.entities.contact) {
        serviceResult.entity = body.entities.contact[0].value;
        serviceResult.entityConfidence = body.entities.contact[0].confidence;
      }
      // Check for intent
      if(body.entities.intent) {
        serviceResult.intent = body.entities.intent[0].value;
        serviceResult.intentConfidence = body.entities.intent[0].confidence;
      }
    }
    else {
      serviceResult.result = "fail";
    }
  });
};


// Innerhalb von Actions müssen unsere Funktionen reingepackt werden
const actions = {
	
  send({sessionId}, {text}) {
	  
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    
    if (recipientId) {
        
        
            
            
        if (keinModul) {
        
            text = {"text" : text,
                    "quick_replies" : [
                      {
                        "content_type" : "text",
                        "title" : "INS",
                        "payload" : "empty"
                      },
                      {
                        "content_type":"text",
                        "title":"ASG",
                        "payload":"empty"
                      },
                      {
                        "content_type":"text",
                        "title":"OPR",
                        "payload":"empty"
                      },
                      
                    ]

            }; 
            
            keinModul = false;
            
        } else if (istAntwort) {
            
            text = {"text" : text,
                    "quick_replies" : [
                      {
                        "content_type" : "text",
                        "title" : "(A)",
                        "payload" : "empty"
                      },
                      {
                        "content_type":"text",
                        "title":"(B)",
                        "payload":"empty"
                      },
                      {
                        "content_type":"text",
                        "title":"(C)",
                        "payload":"empty"
                      },
                      
                    ]

            }; 
            
            istAntwort = false;
            
        } else if (keinThema) {
            
            text = {"text" : text,
                    "quick_replies" : [
                      {
                        "content_type" : "text",
                        "title" : "HTML",
                        "payload" : "empty"
                      },
                      {
                        "content_type":"text",
                        "title":"XML",
                        "payload":"empty"
                      },
                      {
                        "content_type":"text",
                        "title":"PHP",
                        "payload":"empty"
                      },
                      {
                        "content_type":"text",
                        "title":"Egal",
                        "payload":"empty"
                      },
                      
                    ]

            }; 
            
            keinThema = false;
            
        } else {
            text = {text};
        }
            
              
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      // We return a promise to let our bot know when we're done sending
	  
	  
      return fbMessage(recipientId, text)
      .then(() => null)
      .catch((err) => {
        console.error(
          'Oops! An error occurred while forwarding the response to',
          recipientId,
          ':',
          err.stack || err
        );
      });
    } else {
		
      console.error('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      return Promise.resolve()
    }
  },
  // You should implement your custom actions here
  // See https://wit.ai/docs/quickstart
  
  


  
  //Eine Test Funktion
  getForecast({context, entities}) {
  return new Promise(function(resolve, reject) {
	  
    var location = firstEntityValue(entities, "location");
    
    console.log("HIER DIE ENTITIES");
    console.log(entities);
    
    if (location) {
        
        var forecastText;
        
        var api = 'http://api.openweathermap.org/data/2.5/weather?q=';
        var units = '&units=metric';
        var appid = '&appid=ad12e27ce5d345364973235d9b6a8588';
        
        var apiUrl = api + location + units + appid ;
        
        request({
            url: apiUrl,
            json: true
        }, function(error, response, body) {
            
            if (!error && response.statusCode === 200) {
                
                switch(body.weather[0].main) {

                case 'Rain':
                    forecastText = 'Pack den Regenschirm ein, in ' + location + ' wird es heute Regnen. Die Temperatur liegt bei ' + body.main.temp + '°C.';
                    break;
                case 'Snow':
                    forecastText = 'Heute soll es in ' + location + ' schneien, also schön warm anziehen! Die temperaturen betragen ' + body.main.temp + '°C.';
                    break;
                case 'Clear':
                    forecastText = 'Die Sonne lässt sich ab und zu in ' + location + ' blicken dabei beträgt die Temperatur ' + body.main.temp + '°C.';
                    break;
                case 'Sunny':
                    forecastText = 'Heute ist es sonnig in ' + location + '. Die jetztige Temperatur beträgt ' + body.main.temp + '°C.'
                    break;
                case 'Mist':
                    forecastText = 'In der Gegend von ' + location + ' ist es etwas diesig! Zurzeit sind es ' + body.main.temp + '°C.';
                    break;
                case 'Clouds':
                    forecastText = 'In ' + location + ' ist es gerade ziemlich bewölkt! Aktuell beträgt die Temperatur ' + body.main.temp + '°C.'; 
                    break;
                case 'Fog':
                    forecastText = 'Vorsicht beim Autofahren, in der Gegend von ' + location + ', ist es nebelig. Die Temperatur beträgt ' + body.main.temp + '°C.'; 
                    break;
                default:
                    forecastText = body.weather[0].main + ' Wirklich mysteriös das Wetter in ' + location + ', frag mich am besten nochmal und ich gucke nochmal genauer nach! ;)';
                }
             
                context.forecast = forecastText;
                delete context.missingLocation;
                delete context.wrongLocation;
                return resolve(context);  

            } else {
                
                if(body.cod = 502) {
                    
                    context.wrongLocation = 'Leider kenne ich ' + location + ' nicht. Hast du dich eventuell verschrieben? Versuch es doch nochmal! ;)';
                    delete context.location;
                    delete context.missingLocation;
                    resolve(context);
                }
                
            }
        });   
     
      
    } else {
        
      context.missingLocation = true;
      delete context.forecast;
      delete context.wrongLocation;
      
      return resolve(context);
    }
    
    
  });
},


    
    
    loese({context, entities}) {
      return new Promise(function(resolve, reject) {

        
        delete context.modul;
        
        var antwort = firstEntityValue(entities, "antwort");
        
        if (antwort) {
            switch(antwort) {
                
                case '(B)':
                    context.antwort = "Falsch, darunter versteht man XMLApplikation.";
                    break;
                case '(C)':
                    context.antwort = "Leider falsch :S";
                    break;
                default:
                    context.antwort = "Richtig :)";
                
                
            }
            
          }
        
        
        return resolve(context);
      });
    },
    
    
  gibAufgabe({context, entities}) {
  return new Promise(function(resolve, reject) {
   
    var thema = firstEntityValue(entities, "thema");
    var modul = firstEntityValue(entities, "modul");
    
    
    if (modul && thema) {
        
        context.modul = modul; 
        context.thema = thema;
        
        
        delete context.missingThema;
        delete context.missingModul;
        
        istAntwort = true;
                
    } else if (modul) {
        
      if (context.thema) {
          
            context.modul = modul;
            
            delete context.missingThema;
            delete context.missingModul;
            istAntwort = true;
            
      } else {
          
            context.modul = modul;
            context.missingThema = true;
            
            delete context.thema;
            delete context.missingModul;
            keinThema = true;
          
      }
      
      
      
    } else if (thema) {
        
        if(context.modul) {
            
            context.thema = thema;

            delete context.missingModul;
            delete context.missingThema;
            istAntwort = true;
            
        } else {
            
            context.missingModul = true;
            context.thema = thema;

            delete context.modul;
            delete context.missingThema;

            keinModul = true;
            
        }
      
      
        
        
    } else {
        
        console.log("BIN HIER WO ICH SOLL");
        
        context.missingThema = true;
        context.missingModul = true;
        
        keinModul = true;  
        
        delete context.thema;
        delete context.modul;
        
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
app.use(bodyParser.json({ verify: verifyRequestSignature }));

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
        if (event.message) {
			
          // Yay! We got a new message!
          // We retrieve the Facebook user ID of the sender
          const sender = event.sender.id;

          // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history
          const sessionId = findOrCreateSession(sender);

          // We retrieve the message content
          const {text, attachments} = event.message;

          if (attachments) {
			  
            // We received an attachment
            // Let's reply with an automatic message
            fbMessage(sender, 'Zurzeit kann ich leider noch keine Anhänge bearbeiten!')
            .catch(console.error);
          } else if (text) {
            // We received a text message

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
            })
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

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

function messageCreator(context, entities) {
    
    
    
    
}

app.listen(PORT);
console.log('Listening on :' + PORT + '...');