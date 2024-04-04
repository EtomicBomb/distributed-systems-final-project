const util = require('../util/util');

function Crawler(gidConfig) {
  gidConfig = util.defaultGIDConfig(gidConfig);
    this.crawl = (urls) => {

    };

}

module.exports = (...args) => new Crawler(...args);
