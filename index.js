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
global.updateTimerManager = (function () {
  var timers = [];
  return {
    addTimer: function (callback, timeout) {
      var timer, that = this;
      timer = setTimeout(function () {
        that.removeTimer(timer);
        callback();
      }, timeout);
      timers.push(timer);
      return timer;
    },
    removeTimer: function (timer) {
      clearTimeout(timer);
      timers.splice(timers.indexOf(timer), 1);
    },
    getTimers: function () {
      return timers;
    }
  };
})();

$(function () {
  disableCache();

  // Util.getCurrentMatchStat('1v1', 'protoss', ['llllllllllll', 'Max'])
  //   .then(function(result) {
  //     console.log(result);
  //   });
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
        updateLogAndChart(gameState);
      }

      setTimeout(function () {
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
  Util.updateChart('1v1');
}

function updateLogAndChart(gameState) {
  console.log('MMR Log and Chart will be updated after 30 sec.');
  console.log(updateTimerManager.getTimers());

  var updateProcess = function () {
    // save info just in case
    global.TEMP_INFO = {
      gameModeName: gameState.getGameModeName(),
      myRaceName: gameState.getMyRaceName(),
      playerNames: gameState.getPlayerNames(),
    };

    Util.getCurrentMatchStat(gameState.getGameModeName(), gameState.getMyRaceName(), gameState.getPlayerNames())
      .then(function (result) {
        console.log("fetched match stat");
        console.log(result);

        var currentUnixTime = Math.floor((new Date().getTime()) / 1000);
        var playerNames = _.map(result['teamMembers'], function (member) {
          return member['displayName'];
        });

        Util.addNewLog(new MMRLog(currentUnixTime, gameState.getGameModeName(), result['mmr'], playerNames, gameState.getMyRaceName()), {
          pushRetryQueueIfInvalidData: true,
        })
          .then(function (logData) {
            Util.updateChart(gameState.getGameModeName());
          })
          .fail(function(e) {
            console.log(e);
            updateTimerManager.addTimer(updateProcess, 30000);
            console.log('this process will be retried after 30 sec...');
          });
      });
  }

  updateTimerManager.addTimer(updateProcess, 30000);
}
