module.exports = class MMRLog {
  constructor(unixTime, gameModeName, mmr, playerNames, myRaceName) {
    this.unixTime = unixTime;
    this.gameModeName = gameModeName;
    this.mmr = mmr;
    this.playerNames = playerNames;
    this.myRaceName = myRaceName;
  }

  getPlayerNames() {
    return this.playerNames;
  }

  getGameModeName() {
    return this.gameModeName;
  }

  getLogFileName() {
    // 1v1
    if (this.gameModeName == '1v1') {
      return '1v1_' + this.playerNames[0] + '_' + this.myRaceName + '.log';
    }
    // team
    else {
      var nameStr = '';
      _.each(_.sortBy(this.playerNames), function (name) {
        nameStr += (name + '_');
      });
      nameStr = nameStr.slice(0, nameStr.length - 1);
      return this.gameModeName + '_' + nameStr + '.log';
    }
  }

  createLogData() {
    return {
      unixTime: this.unixTime,
      mmr: this.mmr,
    };
  }
}
