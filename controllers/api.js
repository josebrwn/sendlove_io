'use strict';
const util = require('util');
const _ = require('lodash');
const async = require('async');
const validator = require('validator');
const request = require('request');
const cheerio = require('cheerio');
const graph = require('fbgraph');
const LastFmNode = require('lastfm').LastFmNode;
const tumblr = require('tumblr.js');
const Github = require('github-api');
const Twit = require('twit');
const stripe = require('stripe')(process.env.STRIPE_SKEY);
const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
const Linkedin = require('node-linkedin')(process.env.LINKEDIN_ID, process.env.LINKEDIN_SECRET, process.env.LINKEDIN_CALLBACK_URL);
const clockwork = require('clockwork')({ key: process.env.CLOCKWORK_KEY });
const paypal = require('paypal-rest-sdk');
const lob = require('lob')(process.env.LOB_KEY);
const ig = require('instagram-node').instagram();
const foursquare = require('node-foursquare')({
  secrets: {
    clientId: process.env.FOURSQUARE_ID,
    clientSecret: process.env.FOURSQUARE_SECRET,
    redirectUrl: process.env.FOURSQUARE_REDIRECT_URL
  }
});

// var cloudinary = require('cloudinary');
// cloudinary.config({ 
//   cloud_name: process.env.CLOUDINARY_NAME, 
//   api_key: process.env.CLOUDINARY_KEY, 
//   api_secret: process.env.CLOUDINARY_SECRET 
// });

// APP routes call the API functions by name.

/*
  GET /api
  List of API examples.
*/
exports.getApi = (req, res) => {
  res.render('api/index', {
    title: 'API Examples'
  });
};



/*
  GET /api/new_intention
  for posting a new intention
*/
exports.getNewIntention = (req, res) => {
  var latitude;
  var longitude;


  res.render('api/new_intention', {
    title: 'New Intention',
    latitude,
    longitude,
    mapKey: process.env.GOOGLE_MAPS_KEY
    //cloudinary_cors: cloudinary_cors,
    //image_upload_tag: image_upload_tag
  });
}


/*
  POST /api/detail
  Create a new detail on api.sendlove.io Question. do we return to intention/:id? or simply not return?
  
  TODO redirect simply to the page that you came from
  
*/
exports.postDetail = (req, res, next) => {
  var thingId = req.body.thingId;
  var personId = req.body.personId;
  console.log("posting detail in express for thingId " + thingId + " and  personId " + personId);
  // check errors
  const errors = req.validationErrors();
  if (errors) {
    req.flash('errors', errors);
    //res.redirect('/api/intention/' + thingId);
    return res.send();
  }
  // set API post url, and process form
  const postUrl = process.env.API_URL + '/part'
  var formData = {
    thingId: thingId, // create the route then check how to pass this
    personId: req.user._id,
    partType: "like",
    nValue: 1 // TODO pass as parameter > 1
  }
  var jsonData = JSON.stringify(formData); 
  //console.log(formData);
  console.log(jsonData);
  request({
    url: postUrl,
    method: "POST",
    json: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: jsonData
    }
    ,(err, request, body) => {
      // `body` is a js object if request was successful
      if (err) { return next(err); }
      if (request.statusCode !==200) {
        req.flash('errors', { msg: "An error occured with status code " + request.statusCode + ": " + request.body.message });
        //res.redirect('/api/intention/' + thingId);
        return res.send();
      }
      //res.redirect('/api/intention/' + thingId);
      return res.send();
    }
  );
}

/*
  POST /api/new_intention
  Create a new intention on api.sendlove.io and return it to the user

*/
exports.postIntention = (req, res, next) => {
  const fs = require('fs');
  
  // check errors
  const errors = req.validationErrors();
  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/api/new_intention');
  }
  
  // check image file type
  if (req.file == undefined) {
    req.flash('errors', { msg: "Please upload an image of type GIF, JPG, or PNG :) " });
    return res.redirect('/api/new_intention');
  }
  const readChunk = require('read-chunk'); // npm install read-chunk 
  const fileType = require('file-type');
  var newImage = req.file.filename;
  const buffer = readChunk.sync('uploads/'+newImage, 0, 262);
  var newExt = fileType(buffer);

  // delete bad file or rename good file. KLUDGE.
  const allowedImages = ['gif', 'jpg', 'png'];
  if (allowedImages.indexOf(newExt.ext.toLowerCase()) > -1) {
    newImage += "." + newExt.ext;
    fs.renameSync("uploads/"+req.file.filename, "uploads/"+newImage); // TODO: try to map this with the uploads variable set in app.js
  } else {
    fs.unlinkSync('uploads/'+newImage); // TODO make asynchronous?
    req.flash('errors', { msg: "Please upload an image of type GIF, JPG, or PNG :) " });
    return res.redirect('/api/new_intention');
  }

  // set API post url, and process form
  const postUrl = process.env.API_URL + '/thing'
  var formData = {
    name: req.body.name,
    description: req.body.description,
    personId: req.user._id,
    latitude: Number(req.body.latitude),
    longitude: Number(req.body.longitude),
    imagePath: newImage,
    category: req.body.category
  }
  var jsonData = JSON.stringify(formData); // "{  \"name\": \"hello, world!\",  \"description\": \"first intention\",  \"personId\": \"57bc9f71cf9c78642abfe952\",  \"latitude\": 33,  \"longitude\": 112, \"image\": \"sendlove.io/images/my_intention.jpg\", \"category\": \"running\", \"altId\": \"0\"}" 
  console.log(formData);
  request({
    url: postUrl,
    method: "POST",
    json: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: jsonData
    }
    ,(err, request, body) => {
      // `body` is a js object if request was successful
      if (err) { return next(err); }
      if (request.statusCode !==200) {
        req.flash('errors', { msg: "An error occured with status code " + request.statusCode + ": " + request.body.message });
        return res.redirect('/api/new_intention');
      }
      req.flash('success', { msg: 'Intention created!' });
      res.redirect('/api/intention/' + request.body._id);
    }
  );
}

/*
  GET /api/intention/:id
  Retrieve a single intention
*/
exports.getIntention = (req, res) => {
  const token = req.params.token;
  const getUrl = process.env.API_URL + '/thing/' + token;
  var getPartsUrl = process.env.API_URL + '/part';
  const mapKey = process.env.GOOGLE_MAPS_KEY;
  var latitude ; 
  var longitude ;
  var intention;
  var title ='intention';
  var imagePath = "http://" + req.hostname + '/uploads/'; // TODO dynamically determine protocol, parameterize folder
  const shareUrl = "http://" + req.hostname + '/api/intention/' + token;
  var description;
  var shortDescription;
  // set up queryString
  var queryString = {};
  queryString['thingId'] = token;
  var personId;

  // set personId
  if (req.user != undefined) {
    console.log("logged in, setting async");
    personId = req.user._id;
    personId = JSON.stringify(personId);
    personId = personId.replace(/"/g,""); // KLUDGE
    queryString['personId']  = personId;
    console.log("personId = " + personId);
    console.log("queryString[personId] = " + queryString['personId']);
  }
  else {
    console.log("not logged in, skipping personId");
  }


  async.parallel({
    getIntention: (done) => {
      request.get({ url: getUrl, json: true }, (err, request, body) => {
        if (err) { return next(err); }
        if (request.statusCode !==200) {
          req.flash('errors', { msg: "An error occured with status code " + request.statusCode + ": " + request.body.message });
        }
        // set any variables 
        imagePath += request.body.imagePath;
        description = request.body.description;
        shortDescription = request.body.description.substring(0,145) + "..";
        latitude = request.body.latitude;
        longitude = request.body.longitude;
        title = request.body.name;
        done(err, body); 
      });
    },
    getLikes: (done) => {
      queryString['partType'] = 'like';
      request.get({ url: getPartsUrl, qs: queryString, json: true }, (err, request, body) => {
        if (err) { return next(err); }
        if (request.statusCode !==200) {
          req.flash('errors', { msg: "An error occured with status code " + request.statusCode + ": " + request.body.message });
        }
        // set any variables 
        done(err, body); 
      });
    }

  },
  (err, results) => {
    if (err) { return next(err); }
    res.render('api/intention', {
      title: title,
      description: description,
      shortDescription: shortDescription,
      latitude: latitude,
      longitude: longitude,
      mapKey: mapKey,
      mapLocations: results.getIntention,
      imagePath: imagePath,
      token: token,
      shareUrl: shareUrl,
      likesArray: results.getLikes
    });
  });
}


/*
  GET /api/testmap
  this is the dynamic version
*/
exports.getTestMap = (req, res, next) => {
  console.log('test page');
}




/*
  POST /api/testmap
  test posting
*/
exports.postTestMap = (req, res) => {
  res.redirect('/api/testmap');
};



/*
  GET /api/map
  display the map 
*/
 exports.getMap = (req, res, next) => {
 
  var getUrl = process.env.API_URL + '/thing';
  var latitude; 
  var longitude;
  var mapKey;
  var mapLocations;
  var imagePath = "http://" + req.hostname + '/uploads/'; // TODO 
  var shareUrl = "http://" + req.hostname + '/api/map/' 
  
  if (req.query.category != undefined) {
    getUrl += '/?category=' + req.query.category;
  }

  request({
    url: getUrl,
    method: "GET",
    json: true,
    headers: {
      "Content-Type": "application/json",
    }
    }

    ,(err, request, body) => {
      // `body` is a js object if request was successful
      if (err) { return next(err); }
      
      if (request.statusCode !==200) {
        req.flash('errors', { msg: "An error occured with status code " + request.statusCode + ": " + request.body.message });
      }
      mapLocations = request.body; // NB: this is how to query the sendlove.io api

      if (mapLocations.length > 0) {
        imagePath += mapLocations[mapLocations.length-1].imagePath; 
      }
      else {
        imagePath += 'globe.gif';
      }
      
      res.render('api/map', {
        title: 'Map',
        shortDescription: 'Set your intention today on SendLove.io.',       
        latitude,
        longitude,
        mapKey: process.env.GOOGLE_MAPS_KEY,
        mapLocations: mapLocations,
        imagePath: imagePath, // + 'globe.gif',
        shareUrl: shareUrl
      });
    }
  );
}


/*
  GET /api/feed
  display the feed 
*/
 exports.getFeed = (req, res, next) => {
 
  var getUrl = process.env.API_URL + '/thing';
  var latitude; 
  var longitude;
  var feedKey;
  var mapLocations;
  var imagePath = "http://" + req.hostname + '/uploads/'; // TODO 
  var shareUrl = "http://" + req.hostname + '/api/feed/' 
  
  if (req.query.category != undefined) {
    getUrl += '/?category=' + req.query.category;
  }

  request({
    url: getUrl,
    method: "GET",
    json: true,
    headers: {
      "Content-Type": "application/json",
    }
    }

    ,(err, request, body) => {
      // `body` is a js object if request was successful
      if (err) { return next(err); }
      
      if (request.statusCode !==200) {
        req.flash('errors', { msg: "An error occured with status code " + request.statusCode + ": " + request.body.message });
      }
      mapLocations = request.body; // NB: this is how to query the sendlove.io api

      if (mapLocations.length > 0) {
        imagePath += mapLocations[mapLocations.length-1].imagePath; 
      }
      else {
        imagePath += 'globe.gif';
      }
      
      res.render('api/feed', {
        title: 'Feed',
        shortDescription: 'Set your intention today on SendLove.io.',       
        latitude,
        longitude,
        mapLocations: mapLocations,
        imagePath: imagePath, // + 'globe.gif',
        shareUrl: shareUrl
      });
    }
  );
}



/*
  GET /api/message
  Send a message via SMS
*/
exports.getMessage = (req, res) => {
  res.render('api/message', {
    title: 'Message - SendLove.io',
    token: req.param('intention')
  });
}

/*
  POST /api/message
  Create a new message and send it

*/
exports.postMessage = (req, res, next) => {
  req.assert('telephone', 'Phone number is required.').notEmpty();
  req.assert('message', 'Message cannot be blank.').notEmpty();
  const errors = req.validationErrors();
  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/api/message');
  }
  const token =req.body.token;
  var shareUrl = "http://" + req.hostname + '/api/intention/' + token; // TODO dynamically determine protocol, parameterize folder

  const message = {
    to: req.body.telephone,
    from: TWILIO_SMS_NUMBER, // TODO - Allow multiple numbers to by dynamically set by business logic
    body: req.body.message + " - " + shareUrl
  }; 
  // todo MediaUrl, MessagingServiceSid
  
  twilio.sendMessage(message, (err, responseData) => {
    if (err) { return next(err.message); }
    req.flash('success', { msg: `Text sent to ${responseData.to}.` });
    res.redirect('/api/message');
  });
}

/*
  GET /api/detail
  add a detail to an intention. NB: this page may not ever use get, only post.
*/
exports.getDetail = (req, res) => {
  res.render('api/detail', {
    title: 'detail - SendLove.io'
  });
}


/*
  GET /api/goodnews
  Web scraping example using Cheerio library.
*/
exports.getGoodNews = (req, res, next) => {
  const links = [];
  const links_hp = [];
  const links_gn = []
  async.parallel(
    {
      getReddit: (done) => {
        request.get('https://www.reddit.com/r/UpliftingNews/', (err, request, body) => {
          const $ = cheerio.load(body);
          $('.title a[href^="http"]').each((index, element) => {
            links.push($(element));
            
          });
          done(err, links);
        });
      }, 
      getHP: (done) => {
        request.get('http://www.huffingtonpost.com/section/good-news', (err, request, body) => {
          const $ = cheerio.load(body);
          $('.card__headlines a[href^="http"]').each((index, element) => {
            links_hp.push($(element));
            
          });
          done(err, links_hp);
        });
      }, 
      getGN: (done) => {
        request.get('http://www.goodnewsnetwork.org/', (err, request, body) => {
          const $ = cheerio.load(body);
          $('.entry-title a[href^="http"]').each((index, element) => {
            links_gn.push($(element));
            
          });
          done(err, links_gn);
        });
      } 
    },
    (err, results) => {
      if (err)  { return next(err); }
      //const links = { results.getReddit.links };
      //const links_hp = { results.getHP.links };
      res.render('api/goodnews', {
        title: "Good News",
        links: results.getReddit,
        links_hp: results.getHP,
        links_gn: results.getGN
      });
    }
  );
};


/*
  GET /api/upload
  File Upload API example.
*/
 
exports.getFileUpload = (req, res, next) => {

  // var cloudinary_cors = "http://" + req.headers.host + "/html/cloudinary_cors.html";
  // var image_upload_tag = cloudinary.uploader.image_upload_tag('imagePath', { callback: cloudinary_cors });
  
  res.render('api/upload', {
    title: 'File Upload'
    // image_upload_tag: image_upload_tag
  });
};

exports.postFileUpload = (req, res, next) => {
  req.flash('success', { msg: 'File was uploaded successfully.' });
  res.redirect('/api/upload');
};



/*
  GET /api/foursquare
  Foursquare API example.
*/
exports.getFoursquare = (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'foursquare');
  async.parallel({
    trendingVenues: (callback) => {
      foursquare.Venues.getTrending('40.7222756', '-74.0022724', { limit: 50 }, token.accessToken, (err, results) => {
        callback(err, results);
      });
    },
    venueDetail: (callback) => {
      foursquare.Venues.getVenue('49da74aef964a5208b5e1fe3', token.accessToken, (err, results) => {
        callback(err, results);
      });
    },
    userCheckins: (callback) => {
      foursquare.Users.getCheckins('self', null, token.accessToken, (err, results) => {
        callback(err, results);
      });
    }
  },
  (err, results) => {
    if (err) { return next(err); }
    res.render('api/foursquare', {
      title: 'Foursquare API',
      trendingVenues: results.trendingVenues,
      venueDetail: results.venueDetail,
      userCheckins: results.userCheckins
    });
  });
};

/*
  GET /api/tumblr
  Tumblr API example.
*/
exports.getTumblr = (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'tumblr');
  const client = tumblr.createClient({
    consumer_key: process.env.TUMBLR_KEY,
    consumer_secret: process.env.TUMBLR_SECRET,
    token: token.accessToken,
    token_secret: token.tokenSecret
  });
  client.posts('mmosdotcom.tumblr.com', { type: 'photo' }, (err, data) => {
    if (err) { return next(err); }
    res.render('api/tumblr', {
      title: 'Tumblr API',
      blog: data.blog,
      photoset: data.posts[0].photos
    });
  });
};

/*
  GET /api/facebook
  Facebook API example.
*/
exports.getFacebook = (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'facebook');
  graph.setAccessToken(token.accessToken);
  async.parallel({
    getMyProfile: (done) => {
      graph.get(`${req.user.facebook}?fields=id,name,email,first_name,last_name,gender,link,locale,timezone`, (err, me) => {
        done(err, me);
      });
    },
    getMyFriends: (done) => {
      graph.get(`${req.user.facebook}/friends`, (err, friends) => {
        done(err, friends.data);
      });
    },
    getMyTaggableFriends: (done) => {
      graph.get(`${req.user.facebook}/taggable_friends`, (err, taggable_friends) => {
        done(err, taggable_friends.data);
      });
    }
  },
  (err, results) => {
    if (err) { return next(err); }
    res.render('api/facebook', {
      title: 'Facebook API',
      me: results.getMyProfile,
      friends: results.getMyFriends,
      taggable_friends: results.getMyTaggableFriends
    });
  });
};

/*
  GET /api/scraping
  Web scraping example using Cheerio library.
*/
exports.getScraping = (req, res) => {
  request.get('http://www.huffingtonpost.com/section/good-news', (err, request, body) => {
    const $ = cheerio.load(body);
    const links = [];
    $('.card a[href^="http"]').each((index, element) => {
      links.push($(element));
    });
    res.render('api/scraping', {
      title: 'Web Scraping',
      links
    });
  });
};



/*
  GET /api/github
  GitHub API Example.
*/
exports.getGithub = (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'github');
  const github = new Github({ token: token.accessToken });
  const repo = github.getRepo('josebrwn', 'hackathon-starter');
  repo.getDetails((err, repo) => {
    if (err) { return next(err); }
    res.render('api/github', {
      title: 'GitHub API',
      repo
    });
  });
};

/*
  GET /api/aviary
  Aviary image processing example.
*/
exports.getAviary = (req, res) => {
  res.render('api/aviary', {
    title: 'Aviary API'
  });
};

/*
  GET /api/nyt
  New York Times API example.
*/
exports.getNewYorkTimes = (req, res, next) => {
  const query = {
    'list-name': 'young-adult',
    'api-key': process.env.NYT_KEY
  };
  request.get({ url: 'http://api.nytimes.com/svc/books/v2/lists', qs: query }, (err, request, body) => {
    if (request.statusCode === 403) {
      return next(new Error('Invalid New York Times API Key'));
    }
    const books = JSON.parse(body).results; 
    res.render('api/nyt', {
      title: 'New York Times API',
      books
    });
  });
};

/*
  GET /api/lastfm
  Last.fm API example.
*/
exports.getLastfm = (req, res, next) => {
  const lastfm = new LastFmNode({
    api_key: process.env.LASTFM_KEY,
    secret: process.env.LASTFM_SECRET
  });
  async.parallel({
    artistInfo: (done) => {
      lastfm.request('artist.getInfo', {
        artist: 'Roniit',
        handlers: {
          success: (data) => done(null, data),
          error: (err) => done(err)
        }
      });
    },
    artistTopTracks: (done) => {
      lastfm.request('artist.getTopTracks', {
        artist: 'Roniit',
        handlers: {
          success: (data) => done(null, data.toptracks.track.slice(0, 10)),
          error: (err) => done(err)
        }
      });
    },
    artistTopAlbums: (done) => {
      lastfm.request('artist.getTopAlbums', {
        artist: 'Roniit',
        handlers: {
          success: (data) => done(null, data.topalbums.album.slice(0, 3)),
          error: (err) => done(err)
        }
      });
    }
  },
  (err, results) => {
    if (err) { return next(err); }
    const artist = {
      name: results.artistInfo.artist.name,
      image: results.artistInfo.artist.image.slice(-1)[0]['#text'],
      tags: results.artistInfo.artist.tags.tag,
      bio: results.artistInfo.artist.bio.summary,
      stats: results.artistInfo.artist.stats,
      similar: results.artistInfo.artist.similar.artist,
      topAlbums: results.artistTopAlbums,
      topTracks: results.artistTopTracks
    };
    res.render('api/lastfm', {
      title: 'Last.fm API',
      artist
    });
  });
};

/*
  GET /api/twitter
  Twitter API example.
*/
exports.getTwitter = (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'twitter');
  const T = new Twit({
    consumer_key: process.env.TWITTER_KEY,
    consumer_secret: process.env.TWITTER_SECRET,
    access_token: token.accessToken,
    access_token_secret: token.tokenSecret
  });
  T.get('search/tweets', { q: 'nodejs since:2013-01-01', geocode: '40.71448,-74.00598,5mi', count: 10 }, (err, reply) => {
    if (err) { return next(err); }
    res.render('api/twitter', {
      title: 'Twitter API',
      tweets: reply.statuses
    });
  });
};

/*
  POST /api/twitter
  Post a tweet.
*/
exports.postTwitter = (req, res, next) => {
  req.assert('tweet', 'Tweet cannot be empty').notEmpty();

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/api/twitter');
  }

  const token = req.user.tokens.find(token => token.kind === 'twitter');
  const T = new Twit({
    consumer_key: process.env.TWITTER_KEY,
    consumer_secret: process.env.TWITTER_SECRET,
    access_token: token.accessToken,
    access_token_secret: token.tokenSecret
  });
  T.post('statuses/update', { status: req.body.tweet }, (err, data, response) => {
    if (err) { return next(err); }
    req.flash('success', { msg: 'Your tweet has been posted.' });
    res.redirect('/api/twitter');
  });
};

/*
  GET /api/steam
  Steam API example.
*/
exports.getSteam = (req, res, next) => {
  const steamId = '76561197982488301';
  const params = { l: 'english', steamid: steamId, key: process.env.STEAM_KEY };
  async.parallel({
    playerAchievements: (done) => {
      params.appid = '49520';
      request.get({ url: 'http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/', qs: params, json: true }, (err, request, body) => {
        if (request.statusCode === 401) {
          return done(new Error('Invalid Steam API Key'));
        }
        done(err, body);
      });
    },
    playerSummaries: (done) => {
      params.steamids = steamId;
      request.get({ url: 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/', qs: params, json: true }, (err, request, body) => {
        if (request.statusCode === 401) {
          return done(new Error('Missing or Invalid Steam API Key'));
        }
        done(err, body);
      });
    },
    ownedGames: (done) => {
      params.include_appinfo = 1;
      params.include_played_free_games = 1;
      request.get({ url: 'http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/', qs: params, json: true }, (err, request, body) => {
        if (request.statusCode === 401) {
          return done(new Error('Missing or Invalid Steam API Key'));
        }
        done(err, body);
      });
    }
  },
  (err, results) => {
    if (err) { return next(err); }
    res.render('api/steam', {
      title: 'Steam Web API',
      ownedGames: results.ownedGames.response.games,
      playerAchievemments: results.playerAchievements.playerstats,
      playerSummary: results.playerSummaries.response.players[0]
    });
  });
}

/*
  GET /api/stripe
  Stripe API example.
*/
exports.getStripe = (req, res) => {
  res.render('api/stripe', {
    title: 'Stripe API',
    publishableKey: process.env.STRIPE_PKEY
  });
};

/*
  POST /api/stripe
  Make a payment.
*/
exports.postStripe = (req, res) => {
  const stripeToken = req.body.stripeToken;
  const stripeEmail = req.body.stripeEmail;
  stripe.charges.create({
    amount: 395,
    currency: 'usd',
    source: stripeToken,
    description: stripeEmail
  }, (err) => {
    if (err && err.type === 'StripeCardError') {
      req.flash('errors', { msg: 'Your card has been declined.' });
      return res.redirect('/api/stripe');
    }
    req.flash('success', { msg: 'Your card has been successfully charged.' });
    res.redirect('/api/stripe');
  });
};

/*
  GET /api/
  
  Twilio API example.
*/
exports.getTwilio = (req, res) => {
  res.render('api/twilio', {
    title: 'Twilio API'
  });
};

/*
  POST /api/twilio
  Send a text message using Twilio.
*/
exports.postTwilio = (req, res, next) => {
  req.assert('telephone', 'Phone number is required.').notEmpty();
  req.assert('message', 'Message cannot be blank.').notEmpty();

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/api/twilio');
  }

  const message = {
    to: req.body.telephone,
    from: '+16233350027',
    body: req.body.message
  };
  twilio.sendMessage(message, (err, responseData) => {
    if (err) { return next(err.message); }
    req.flash('success', { msg: `Text sent to ${responseData.to}.` });
    res.redirect('/api/twilio');
  });
};

/*
  GET /api/clockwork
  Clockwork SMS API example.
*/
exports.getClockwork = (req, res) => {
  res.render('api/clockwork', {
    title: 'Clockwork SMS API'
  });
};

/*
  POST /api/clockwork
  Send a text message using Clockwork SMS
*/
exports.postClockwork = (req, res, next) => {
  const message = {
    To: req.body.telephone,
    From: 'SendLove.io',  
    Content: req.body.message
  };
  clockwork.sendSms(message, (err, responseData) => {
    if (err) { return next(err.errDesc); }
    req.flash('success', { msg: `Text sent to ${responseData.responses[0].to}` });
    res.redirect('/api/clockwork');
  });
};

/*
  GET /api/linkedin
  LinkedIn API example.
*/
exports.getLinkedin = (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'linkedin');
  const linkedin = Linkedin.init(token.accessToken);
  linkedin.people.me((err, $in) => {
    if (err) { return next(err); }
    res.render('api/linkedin', {
      title: 'LinkedIn API',
      profile: $in
    });
  });
};

/*
  GET /api/instagram
  Instagram API example.
*/
exports.getInstagram = (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'instagram');
  ig.use({ client_id: process.env.INSTAGRAM_ID, client_secret: process.env.INSTAGRAM_SECRET });
  ig.use({ access_token: token.accessToken });
  async.parallel({
    searchByUsername: (done) => {
      ig.user_search('richellemead', (err, users) => {
        done(err, users);
      });
    },
    searchByUserId: (done) => {
      ig.user('175948269', (err, user) => {
        done(err, user);
      });
    },
    popularImages: (done) => {
      ig.media_popular((err, medias) => {
        done(err, medias);
      });
    },
    myRecentMedia: (done) => {
      ig.user_self_media_recent((err, medias) => {
        done(err, medias);
      });
    }
  },(err, results) => {
    if (err) { return next(err); }
    res.render('api/instagram', {
      title: 'Instagram API',
      usernames: results.searchByUsername,
      userById: results.searchByUserId,
      popularImages: results.popularImages,
      myRecentMedia: results.myRecentMedia
    });
  });
};

/*
  GET /api/paypal
  PayPal SDK example.
*/
exports.getPayPal = (req, res, next) => {
  paypal.configure({
    mode: 'sandbox',
    client_id: process.env.PAYPAL_ID,
    client_secret: process.env.PAYPAL_SECRET
  });

  const paymentDetails = {
    intent: 'sale',
    payer: {
      payment_method: 'paypal'
    },
    redirect_urls: {
      return_url: process.env.PAYPAL_RETURN_URL,
      cancel_url: process.env.PAYPAL_CANCEL_URL
    },
    transactions: [{
      description: 'SendLoveIO',
      amount: {
        currency: 'USD',
        total: '1.99'
      }
    }]
  };

  paypal.payment.create(paymentDetails, (err, payment) => {
    if (err) { return next(err); }
    req.session.paymentId = payment.id;
    const links = payment.links;
    for (let i = 0; i < links.length; i++) {
      if (links[i].rel === 'approval_url') {
        res.render('api/paypal', {
          approvalUrl: links[i].href
        });
      }
    }
  });
};

/*
  GET /api/paypal/success
  PayPal SDK example.
*/
exports.getPayPalSuccess = (req, res) => {
  const paymentId = req.session.paymentId;
  const paymentDetails = { payer_id: req.query.PayerID };
  paypal.payment.execute(paymentId, paymentDetails, (err) => {
    res.render('api/paypal', {
      result: true,
      success: !err
    });
  });
};

/*
  GET /api/paypal/cancel
  PayPal SDK example.
*/
exports.getPayPalCancel = (req, res) => {
  req.session.paymentId = null;
  res.render('api/paypal', {
    result: true,
    canceled: true
  });
};

/*
  GET /api/lob
  Lob API example.
*/
exports.getLob = (req, res, next) => {
  lob.routes.list({ zip_codes: ['10007'] }, (err, routes) => {
    if (err) { return next(err); }
    res.render('api/lob', {
      title: 'Lob API',
      routes: routes.data[0].routes
    });
  });
};


/*
  GET /api/pinterest
  Pinterest API example.
*/
exports.getPinterest = (req, res, next) => {
  const token = req.user.tokens.find(token => token.kind === 'pinterest');
  request.get({ url: 'https://api.pinterest.com/v1/me/boards/', qs: { access_token: token.accessToken }, json: true }, (err, request, body) => {
    if (err) { return next(err); }
    res.render('api/pinterest', {
      title: 'Pinterest API',
      boards: body.data
    });
  });
};

/*
  POST /api/pinterest
  Create a pin.
*/
exports.postPinterest = (req, res, next) => {
  req.assert('board', 'Board is required.').notEmpty();
  req.assert('note', 'Note cannot be blank.').notEmpty();
  req.assert('image_url', 'Image URL cannot be blank.').notEmpty();

  const errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/api/pinterest');
  }

  const token = req.user.tokens.find(token => token.kind === 'pinterest');
  const formData = {
    board: req.body.board,
    note: req.body.note,
    link: req.body.link,
    image_url: req.body.image_url
  };

  request.post('https://api.pinterest.com/v1/pins/', { qs: { access_token: token.accessToken }, form: formData }, (err, request, body) => {
    if (err) { return next(err); }
    if (request.statusCode !== 201) {
      req.flash('errors', { msg: JSON.parse(body).message });
      return res.redirect('/api/pinterest');
    }
    req.flash('success', { msg: 'Pin created' });
    res.redirect('/api/pinterest');
  });
};

exports.getGoogleMaps = (req, res, next) => {
  res.render('api/google-maps', {
    title: 'Google Maps API'
  });
};
