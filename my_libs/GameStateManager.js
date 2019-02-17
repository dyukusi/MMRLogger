var GameState = require('./GameState');
var CURRENT_GAME_STATE = null;
var PREVIOUS_GAME_STATE = null;

exports.generateCurrentGameStateInstance = function() {
  var d = Q.defer();

  Q.allSettled([
    Util.getJSON("http://localhost:6119/ui"),
    Util.getJSON("http://localhost:6119/game"),
  ])
    .then(function(results) {
      var uiJSON = results[0].value;
      var gameJSON = results[1].value;

      var gameState = new GameState(uiJSON, gameJSON, PREVIOUS_GAME_STATE || null);
      PREVIOUS_GAME_STATE = gameState;
      d.resolve(gameState);
    });

  return d.promise;
};
