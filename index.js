global.Const = require('./my_libs/Const');
global.$ = global.jQuery = require('jquery');
global._ = require('underscore');
global.Q = require('q');
global.GameStateManager = require('./my_libs/GameStateManager');
global.ChartJS = require('chart.js');
global.sprintf = require('sprintf-js').sprintf;
global.Util = require('./my_libs/Util.js');
global.MMRLog = require('./my_libs/MMRLog.js');
global.fs = require('fs');

$(function () {
  disableCache();
  initChart();
  mainLoop();

  // Util.getCurrentMatchStat('2v2', 'terran', ['Dyukusi', 'NOTAKON']);

  // use this only if you want to refresh league border data
  // Util.updateLeagueBorders();
});

function mainLoop() {
  GameStateManager.generateCurrentGameStateInstance()
    .then(function (gameState) {
      // if (gameState.isEnterGameMoment()) {}
      // if (gameState.isInGame()) {}
      // if (gameState.isLoseMoment()) {}

      console.log(gameState.getState());

      if (gameState.isEndGame()) {
        console.log("END GAME!!!!!");
        setTimeout(function () {
          // save info just in case
          global.TEMP_INFO = {
            gameModeName: gameState.getGameModeName(),
            myRaceName: gameState.getMyRaceName(),
            playerNames: gameState.getPlayerNames(),
          };

          Util.getCurrentMatchStat(gameState.getGameModeName(), gameState.getMyRaceName(), gameState.getPlayerNames())
            .then(function (result) {
              var currentUnixTime = Math.floor((new Date().getTime()) / 1000);
              var playerNames = _.map(result['teamMembers'], function (member) {
                return member['displayName'];
              });

              Util.addNewLog(new MMRLog(currentUnixTime, gameState.getGameModeName(), result['mmr'], playerNames, gameState.getMyRaceName()))
                .then(function (logData) {
                  console.log("update chart");
                  Util.getJSON(Const.OTHERS.LEAGUE_BORDER_FILE_PATH)
                    .then(function (borders) {
                      Util.updateChart(logData, borders);
                    });
                });
            });
        }, 20000)
      }

      setTimeout(function () {
        console.log("IM ALIVE!");
        mainLoop();
      }, 500);
    })
    .fail(function (e) {
      console.log(e);
    });

}

function disableCache() {
  $.ajaxSetup({
    cache: false
  });
}

function initChart() {
  Util.getJSON('./logs/' + '1v1_Dyukusi_terran.log')
    .then(function (logData) {
      Util.getJSON(Const.OTHERS.LEAGUE_BORDER_FILE_PATH)
        .then(function (borders) {
          Util.updateChart(logData, borders);
        });
    });
}

