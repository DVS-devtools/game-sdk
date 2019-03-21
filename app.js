var app = require('express')(),
    express = require('express'),
    pug = require('pug'),
    url = require('url'),
    server = require('http').Server(app),
    path = require('path'),
    fs = require('fs'),
    axios = require('axios'),
    proxy = require('express-http-proxy'),
    utils = require('./utils.js'),
    objectMerge = require('object-merge'),
    md5 = require('md5'),
    config = require('./config.js');


app.use(express.static('public'));
app.set('views', './views');
app.set('view engine', 'pug');
app.listen(config.generic.port, function () {
  console.log('SDK-DEV-ENV running: http://'+config.generic.local_domain+':'+config.generic.port);
})

var proxy = proxy(config.generic.domain, {
  proxyReqPathResolver: req => url.parse(req.baseUrl).path,
  userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {

    switch(userReq.originalUrl){
      case "/v01/user.check":
        data = JSON.parse(proxyResData.toString('utf8'));

        if (config.user.type === 'guest') {
          data.user = null;
          data.subscribed = false;
        } else if (config.user.type === 'free') {
          data.user = global.user_id;
          data.subscribed = false;
        } else if (config.user.type === 'premium') {
          data.user = global.user_id;
          data.subscribed = true;
        }
        return JSON.stringify(data);
      default:
        return proxyResData;
    }

  }
});

app.use('/v01/*', proxy);
app.use('/dictionary', proxy);


app.get('/', function (req, res) {

  var dirSamples = path.join(__dirname, 'public/games');
  var games=[];

  fs.readdir(dirSamples, function (err, files) {
    
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }

    files.forEach(function(dir){
      if(fs.lstatSync(dirSamples+'/'+dir).isDirectory()){
        games.push(dir);
      }
    })

    res.render('index', {games: games, config: config})
  });

})

// app.get('/build/:game', function (req, res) {
//   fs.readFile(path.join(__dirname, 'public/games/'+req.params.game+'/index.html'), 'utf8', function(err, data) {
    
//     var headTagPos=data.indexOf('<head>')+6;
//     data=data.slice(0, headTagPos) + '<script id="gfsdk"></script>'+ data.slice(headTagPos);

    
//     res.setHeader('Content-Disposition', 'attachment; filename=index.html');
//     res.setHeader('Content-Type', 'application/octet-stream');
//     res.send(new Buffer(data));
//   });
// });


app.get('/run/:game', function (req, res) {

  var vhostReq = axios.get('http://'+config.generic.domain+'/v01/config.getvars?keys=poggioacaiano');
  var dictionaryReq = axios.get('http://'+config.generic.domain+'/dictionary');

  var user_id=md5('user-'+req.params.game);
  var content_id=md5('game-'+req.params.game);

  Promise.all([vhostReq, dictionaryReq]).then(function(result) {
    
    config.vhost = objectMerge(result[0].data, config.vhost);
    config.dictionary = objectMerge(result[1].data, config.dictionary);
    config.vhost.NEWTON_SECRETID=config.vhost.NEWTON_SECRETID_devel;

    var gameApi = utils.dequeryfy(result[0].data.MOA_API_CONTENTS_GAMEINFO);
    const toRetain = ['country', 'fw', 'lang', 'real_customer_id', 'vh', 'white_label'];

    const filteredQuery = Object.keys(gameApi)
      .filter(key => toRetain.includes(key))
      .reduce((obj, key) => {
        obj[key] = gameApi[key];
        return obj;
      }, {});

    var gameReq = result[0].data.MOA_API_CONTENTS_GAMEINFO.split('?')[0];
    axios.get(gameReq, { params: { content_id: config.vhost.GFSDK_INT_ENV_CONTENT_ID, ...filteredQuery} })
      .then(function(game){

        // override game id
        game.data.id=content_id;

        fs.readFile(path.join(__dirname, 'public/games/'+req.params.game+'/index.html'), 'utf8', function(err, data) {

          if(typeof data !=='undefined'){
            var headTagPos=data.indexOf('<head>')+6;
            data=data.slice(0, headTagPos) + '<base href="/games/'+req.params.game+'/"><script src="'+config.generic.newton+'"></script><script>var GFSDK_CONFIG = '+JSON.stringify(config.vhost)+';var GFSDK_DICTIONARY = '+JSON.stringify(config.dictionary)+';var GamifiveInfo = {game:'+JSON.stringify(game.data)+'}</script><script src="'+config.generic.sdk_vendor+'"></script><script src="'+config.generic.sdk+'"></script>' + data.slice(headTagPos);
        
            res.format({
              html: function(){
                res.send(data);
              },
            });
          } else {
            console.log('path file not found: '+path.join(__dirname, 'public/games/'+req.params.game+'/index.html'))
          }
        });

      })
      .catch(function(reason){
        res.send('<h1>'+reason+'</h1>');
      });

  }).catch(function(err){
    res.send('<h1>Error on init environment: '+err+'</h1>');
  });
});
