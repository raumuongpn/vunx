'use strict';

var fs = require('fs');
var path = require('path');
var express = require('express')
var xml = require('xml2js').parseString;
var bodyParser = require('body-parser');
var request = require('request');
var parse = require('./parse');
var https = require('https');
var http = require('http');
var config = require('./public/config');
var app = express();
var urls = [
  'http://www.overpass-api.de/api/xapi_meta?',
  'http://overpass.osm.rambler.ru/cgi/xapi_meta?',
  'http://api.openstreetmap.fr/xapi?'
]

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.use(bodyParser.json());

function tryUrl(i, req, res, next) {
  var coords = req.body.coordinates;
  if (!urls[i]) next(new Error('Could not reach data'))
  request({method: 'GET', timeout: 15000, url: urls[i] + '*[bbox=' + coords + ']'}, function(error, response, data) {
    if (error) {
      if (error.message === 'ETIMEDOUT') return tryUrl(++i, req, res, next);
      else return next(new Error('Could not reach data'));
    }
    if (response.statusCode !== 200) return next(new Error('Error downloading data'));
    xml(data, function(error, result) {
      result.bounds = { latMin: coords[1], latMax: coords[3], lngMin: coords[0], lngMax: coords[2] }
      parse(result, req.body, (error, analyzed) => {
        if (error) next(new Error('Error analyzing data'));
        res.json(analyzed);
      });
    });
  });
}

app.post('/geo', function (req, res, next) {
  tryUrl(0, req, res, next);
});

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});

app.use(express.static('public'));

app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', { message: err.message, error: {} });
});

// var httpsOptions = {
//   key: fs.readFileSync(config.sslKey),
//   cert: fs.readFileSync(config.sslCert),
//   ca: fs.readFileSync(config.sslCA)
// }

http.createServer(app).listen(config.port, "localhost");
// https.createServer(httpsOptions, app).listen(config.portSSL);
console.log('Server running at http://localhost:8080/');
