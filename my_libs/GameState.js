module.exports = class GameState {
  constructor(uiJSON, gameJSON, previousState) {
    this.uiJSON = uiJSON;
    this.gameJSON = gameJSON;
    this.previousState = previousState;
  }

  getState() {
    var state = getRawCurrentState(this.uiJSON.activeScreens);
    if (this.previousState && this.previousState.getState() == Const.STATE.MENU && state == Const.STATE.IN_GAME) {
      return Const.STATE.MENU;
    }
    return state;
  }

  getDurationSec() {
    return Number(this.gameJSON.displayTime);
  }

  getGameModeName() {
    switch (this.gameJSON.players.length) {
      case 2:
        return '1v1';
        break;

      case 4:
        return '2v2';
        break;

      case 6:
        return '3v3';
        break;

      case 8:
        return '4v4';
        break;

      default:
        return 'undefined mode';
        break;
    };

    return 'undefined mode';
  }

  getPlayerNames() {
    return _.map(this.gameJSON.players, function(data) {
      return data.name;
    });
  }

  getMyPlayer() {
    var myIdx = _.findIndex(this.gameJSON.players, function(data) {
      return _.contains(['Dyukusi', 'FtwoAbuser', 'AntiProtoss', 'Pimba', 'llllllllllll'], data.name);
    });

    if (myIdx < 0) return false;

    return this.gameJSON.players[myIdx];
  }

  getMyRaceName() {
    var player = this.getMyPlayer();
    if (!player) return false;

    var fixHash = {
      'Terr': 'terran',
      'Zerg': 'zerg',
      'Prot': 'protoss',
    };

    return fixHash[player.race];
  }

  getAllPlayerNames() {
    return _.map(this.gameJSON.players, function(data) {
      return data.name;
    });
  }

  getResult() {
    var player = this.getMyPlayer();
    if (!player) return false;

    return player.result;
  }

  isEnterGameMoment() {
    if (!this.previousState) return false;
    return (this.previousState.getState() == Const.STATE.LOADING) && (this.getState() == Const.STATE.IN_GAME);
  }

  isVictory() {
    return this.getResult() == 'Victory';
  }

  isVictoryMoment() {
    if (!this.previousState) return false;
    return (!this.previousState.isVictory() && this.isVictory());
  }

  isLose() {
    return this.getResult() == 'Defeat';
  }

  isLoseMoment() {
    if (!this.previousState) return false;
    return (!this.previousState.isLose() && this.isLose());
  }

  isEndGame() {
    if (!this.previousState) return false;
    return (this.previousState.getState() == Const.STATE.IN_GAME) && (this.getState() != Const.STATE.IN_GAME);
  }

  isInGame() {
    return this.getState() == Const.STATE.IN_GAME;
  }
}



function getRawCurrentState(activeScreens) {
  if (_.isEmpty(activeScreens)) {
    return Const.STATE.IN_GAME;
  };

  if (activeScreens[0] == "ScreenLoading/ScreenLoading") {
    return Const.STATE.LOADING;
  }

  return Const.STATE.MENU;
}
