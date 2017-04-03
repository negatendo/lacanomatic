/* for scraping code */
var fs = require('fs');
var request = require('request');
var _ = require('underscore');
_.mixin( require('underscore.deferred') );

/* Setting things up for the bot. */
var path = require('path'),
    express = require('express'),
    app = express(),   
    Twit = require('twit'),
    fs = require('fs'),
    request = require('request'),
    _ = require('underscore'),
    config = {
    /* Be sure to update the .env file with your API keys. See how to get them: https://botwiki.org/tutorials/make-an-image-posting-twitter-bot/#creating-a-twitter-app*/      
      twitter: {
        consumer_key: process.env.CONSUMER_KEY,
        consumer_secret: process.env.CONSUMER_SECRET,
        access_token: process.env.ACCESS_TOKEN,
        access_token_secret: process.env.ACCESS_TOKEN_SECRET
      }
    },
    T = new Twit(config.twitter),
    stream = T.stream('statuses/lacanomatic');

app.use(express.static('public'));

//thank you to https://github.com/dariusk/museumbot for this scraping code - see LICENSE
var baseUrl = 'http://www.metmuseum.org/api/collection/collectionlisting?artist=&department=&era=&geolocation=&material=&showOnly=withImage&sortBy=AccessionNumber&sortOrder=asc&page=';
Array.prototype.pick = function() {
  return this[Math.floor(Math.random()*this.length)];
};

Array.prototype.pickRemove = function() {
  var index = Math.floor(Math.random()*this.length);
  return this.splice(index,1)[0];
};

function generate(resp) {
  console.log('going to req');
  var url = baseUrl + Math.floor(Math.random()*21200);
  request(url, function (error, response, body) {
    console.log('reqed',error, response.statusCode);
    if (!error && response.statusCode == 200) {
      var data = JSON.parse(body).results.pick();
      console.log(data);
      var name = data.title;
      var thingUrl = 'http://www.metmuseum.org' + data.url;
      var bigImageUrl = 'http://images.metmuseum.org/CRDImages/' + data.largeImage;
      // go to page for thing
      if (data.largeImage) {
        var stream = fs.createWriteStream('hires.jpg');
        stream.on('close', function() {
          console.log('done');
          tweet(name,resp);
        });
        var r = request(bigImageUrl).pipe(stream);
      }
    }
  });
}

function tweet(img_name,resp) {
  console.log('tweeting ' + img_name);
  // first we must post the media to Twitter
  var b64content = fs.readFileSync('hires.jpg', { encoding: 'base64' })
  T.post('media/upload', { media_data: b64content }, function (err, data, response) {
    // now we can assign alt text to the media, for use by screen readers and
    // other text-based presentations and interpreters
    var mediaIdStr = data.media_id_string;
    var altText = img_name;
    var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } }

    T.post('media/metadata/create', meta_params, function (err, data, response) {
      if (!err) {
        // now we can reference the media and post a tweet (media will attach to the tweet)
        var params = { status: '"...a work of art always involves encircling the Thing." -- #Lacan', media_ids: [mediaIdStr] }

        T.post('statuses/update', params, function (err, data, response) {
          console.log(data)
        })
        resp.sendStatus(200);
      } else {
        resp.sendStatus(500);
        console.log('Error!');
        console.log(err);
      }
    })
  })
}

app.use(express.static('views'));

//cron this call to the url + secret endpoint
app.all("/" + process.env.BOT_ENDPOINT, function (request, response) {
  generate(response);
});

var listener = app.listen(process.env.PORT, function () {
  console.log('Your bot is running');
});
