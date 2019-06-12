exports.generic = {
    "service": "SDK-DEV-ENV",
    "local_domain":"local.www.gameasy.com",
    "domain": "www.gameasy.fr",
    "port": "8080",
    "newton":"http://static.newton.pm/js/v2.x/newton.min.js",
}

exports.user = {
    "type": "premium",
    "id": "2879f348359511e7ad1a005056b674fe"
}

exports.vhost = {
    "INSTALL_HYBRID_VISIBLE":false,

    "GAMEBOX_NEWTON_TRACKING":true,
    "GAMEBOX_GOOGLE_ANALYTICS":true,
    "GAMEBOX_NAVBAR":true,
    "GAMEBOX_ALERT":true,
    // "HEADER_JS_GAMEBOX_INDEX":"http://localhost:3001/main.js"
    "HEADER_JS_GAMEBOX_INDEX":"http://www2.gameasy.it/static_env/js/wl/webstore_gamebox/index.min.js"
}
exports.dictionary = {}