  exports.dequeryfy = function(_url) {
    const param = decodeURI(_url.slice(0));
  
    const query = param.split('?')[1];
    if (!query) { return {}; }
  
    const keyvalue = query.split('&');
  
    return keyvalue.reduce((newObj, _keyvalue) => {
      const splitted = _keyvalue.split('=');
      const key = decodeURIComponent(splitted[0]);
      const value = decodeURIComponent(splitted[1]);
      newObj[key] = value;
      return newObj;
    }, {});
  }
  
  exports.protocol = function(_url) {
    return (_url.substring(0,2) === '//') ? 'http:'+_url : _url;
  }