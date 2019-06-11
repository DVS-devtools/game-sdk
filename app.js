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
    config = require('./config.js'),
    utils = require('./utils.js');


app.use(express.static('public'));
app.set('views', './views');
app.set('view engine', 'pug');
app.listen(config.generic.port, function () {
  console.log('SDK-DEV-ENV running: http://'+config.generic.local_domain+':'+config.generic.port);
  console.log('Mode: '+(process.env.MODE || 'SDK'));
})

var proxier = proxy(config.generic.domain, {
  proxyReqPathResolver: req => {
    return req.originalUrl;
  }
});

var proxyfake = proxy(config.generic.domain, {
  proxyReqPathResolver: req => url.parse(req.baseUrl).path,
  userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {

    switch(userReq.originalUrl.split('?')[0]){
      case "/v01/user.check":
        data = JSON.parse(proxyResData.toString('utf8'));

        if (config.user.type === 'guest') {
          data.user = null;
          data.subscribed = false;
        } else if (config.user.type === 'free') {
          data.user = config.user.id || null;
          data.subscribed = false;
        } else if (config.user.type === 'premium') {
          data.user = config.user.id || null;
          data.subscribed = true;
        }
        return JSON.stringify(data);
      case "/v01/createpony":
        return JSON.stringify('{"ponyUrl":"&_PONY=12-8b1d1beaab74f4037a5a793d8c5c80ad999999END","status":"200"}');
      default:
        return proxyResData;
    }

  }
});

app.use('/static_env/*', proxier);
app.use('/v01/*', proxyfake);
app.use('/dictionary', proxyfake);


app.get('/', function (req, res) {

  var dirSamples = path.join(__dirname, 'public/games');
  var games=[];
  const mode = process.env.MODE || 'SDK';

  fs.readdir(dirSamples, function (err, files) {
    
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }

    files.forEach(function(dir){
      if(fs.lstatSync(dirSamples+'/'+dir).isDirectory()){
        games.push(dir);
      }
    })

    res.render('index', {games: games, config: config, mode: mode})
  });

})

app.get('/run/:game', function (req, res) {

  var vhostReq = axios.get('http://'+config.generic.domain+'/v01/config.getvars?keys=poggioacaiano');
  var dictionaryReq = axios.get('http://'+config.generic.domain+'/dictionary');

  // config.user.id=md5('user-'+req.params.game);
  var content_id=md5('game-'+req.params.game);

  Promise.all([vhostReq, dictionaryReq]).then(function(result) {
    
    config.vhost = objectMerge(result[0].data, config.vhost);
    config.dictionary = objectMerge(result[1].data, config.dictionary);
    config.vhost.NEWTON_SECRETID=config.vhost.NEWTON_SECRETID_devel;
    config.vhost.MOA_API_CREATEPONY=config.vhost.MOA_API_CREATEPONY.replace(config.generic.domain, config.generic.local_domain+':'+config.generic.port);
    config.vhost.MOA_API_LEADERBOARD_POST_SCORE=config.vhost.MOA_API_LEADERBOARD_POST_SCORE.replace(config.generic.domain, config.generic.local_domain+':'+config.generic.port);
    config.vhost.MOA_API_APPLICATION_OBJECTS_SET=config.vhost.MOA_API_APPLICATION_OBJECTS_SET.replace(config.generic.domain, config.generic.local_domain+':'+config.generic.port);
    config.vhost.MOA_API_APPLICATION_OBJECTS_GET=config.vhost.MOA_API_APPLICATION_OBJECTS_GET.replace(config.generic.domain, config.generic.local_domain+':'+config.generic.port);

    var gameApi = utils.dequeryfy(result[0].data.MOA_API_CONTENTS_GAMEINFO);
    const toRetain = ['country', 'fw', 'lang', 'real_customer_id', 'vh', 'white_label'];

    const filteredQuery = Object.keys(gameApi)
      .filter(key => toRetain.includes(key))
      .reduce((obj, key) => {
        obj[key] = gameApi[key];
        return obj;
      }, {});

    var gameReq = result[0].data.MOA_API_CONTENTS_GAMEINFO.split('?')[0];
    axios.get(utils.protocol(gameReq), { params: { content_id: config.vhost.GFSDK_INT_ENV_CONTENT_ID, ...filteredQuery} })
      .then(function(game){

        // override game id
        game.data.id=content_id;

        fs.readFile(path.join(__dirname, 'public/games/'+req.params.game+'/index.html'), 'utf8', function(err, data) {

          if(typeof data !=='undefined'){
            var headTag=data.match(/<head.*?>/i);
            var headTagPos=data.indexOf(headTag[0])+headTag[0].length;
            var bodyTagPos=data.indexOf('</body>');
            
            if (process.env.MODE == "gamebox") {

              fs.readFile(path.join(__dirname, 'partials/gamebox.html'), 'utf8', function(err, gbdata) {
                data=data.slice(0, bodyTagPos) + gbdata + data.slice(bodyTagPos);
                data=data.slice(0, headTagPos) + '<base href="/games/'+req.params.game+'/"><script src="'+config.generic.newton+'"></script><script>var GFSDK_CONFIG = '+JSON.stringify(config.vhost)+';var GFSDK_DICTIONARY = '+JSON.stringify(config.dictionary)+';var GamifiveInfo = {userId:"'+config.user.id+'",game:'+JSON.stringify(game.data)+'}</script><script src="'+config.vhost.HEADER_JS_GAMEBOX_INDEX+'"></script>' + data.slice(headTagPos);

                res.format({
                  html: function(){
                    res.send(data);
                  },
                });
              });
            
            } else {
              data=data.slice(0, headTagPos) + '<base href="/games/'+req.params.game+'/"><script src="'+config.generic.newton+'"></script><script>var GFSDK_CONFIG = '+JSON.stringify(config.vhost)+';var GFSDK_DICTIONARY = '+JSON.stringify(config.dictionary)+';var GamifiveInfo = {userId:"'+config.user.id+'",game:'+JSON.stringify(game.data)+'}</script><script src="'+config.vhost.GFSDK_MANIFEST_URL+'"></script><script src="'+config.vhost.GFSDK_VENDOR_URL+'"></script></script><script src="'+config.vhost.GFSDK_MAIN_URL+'"></script>' + data.slice(headTagPos);
              res.format({
                html: function(){
                  res.send(data);
                },
              });
            }
        
            
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
