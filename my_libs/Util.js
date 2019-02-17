exports.getJSON = function (URL) {
  var d = Q.defer();

  $.getJSON(URL, function (json) {
    d.resolve(json);
  });

  return d.promise;
};

exports.getCurrentMatchStat = function (gameModeName, myRaceName, playerNames) {
  var d = Q.defer();
  var LADDER_SUMMARY_API_URL = sprintf(Const.BLIZ_API.URL_LADDER_SUMMARY, Const.TEMP.REGION_ID, Const.TEMP.BLIZ_PROFILE_ID, Const.BLIZ_API.ACCESS_TOKEN);

  Util.getJSON(LADDER_SUMMARY_API_URL)
    .then(function (json) {
      var ladderSummaryArray = json['allLadderMemberships'];
      var ladderIds = _.chain(ladderSummaryArray)
        .filter(function (data) {
          return data['localizedGameMode'].includes(gameModeName);
        })
        .map(function (data) {
          return data['ladderId'];
        })
        .value();

      var ladderPromises = [];
      _.each(ladderIds, function (ladderId) {
        var ladderAPIurl = sprintf(Const.BLIZ_API.URL_LADDER, Const.TEMP.REGION_ID, Const.TEMP.BLIZ_PROFILE_ID, ladderId, Const.BLIZ_API.ACCESS_TOKEN);
        ladderPromises.push(Util.getJSON(ladderAPIurl));
      });

      var findFor1v1Func = function (data) {
        return _.find(data['teamMembers'], function (member) {
          return member['id'] == Const.TEMP.BLIZ_PROFILE_ID && member['favoriteRace'] == myRaceName;
        });
      };

      var findForTeamFunc = function (data) {
        var thresholdNum = gameModeNameToThresholdNum(gameModeName);
        var count = 0;
        var isExistMyName = false;
        _.each(data['teamMembers'], function (member) {
          var name = member['displayName'];
          if (_.contains(playerNames, name)) {
            count++;

            if (name == Const.TEMP.MY_NAME) {
              isExistMyName = true;
            }
          }
        });

        if (count >= thresholdNum && isExistMyName) {
          return true;
        }
      };

      Q.allSettled(ladderPromises)
        .then(function (results) {
          var ladderDataArray = _.chain(results)
            .map(function (data) {
              return data.value['ladderTeams'];
            })
            .flatten()
            .value();

          var targetData = _.find(ladderDataArray, gameModeName == '1v1' ? findFor1v1Func : findForTeamFunc);
          d.resolve(targetData);
        })
        .fail(function (e) {
          d.reject(e);
        });
    });

  return d.promise;
}

exports.addNewLog = function (mmrLog, options) {
  var d = Q.defer();
  options = options || {};

  var logPath = './logs/' + mmrLog.getLogFileName();
  console.log('Reading from ' + logPath);

  // create init file if not exist
  createNewLogFileIfNotExist(logPath, mmrLog)
    .then(function () {
      console.log("Reading log file finished");

      Util.getJSON(logPath)
        .then(function (data) {
          if (options.removeLastMatchLog) {
            var removedData = data['matchLogs'].pop();
            console.log("REMOVED LAST MATCH LOG");
            console.log(removedData);
          }

          data['matchLogs'].push(mmrLog.createLogData());
          writeJsonFile(logPath, data)
            .then(function () {
              d.resolve(data);
            })
            .fail(function (e) {
              console.log("Error: " + e);
              d.reject(e);
            });
        });
    });

  return d.promise;
}

exports.updateChart = function (logData, leagueBorder) {
  // clear canvas before create new one
  $('canvas#myChart').remove();
  $('body').append('<canvas id="myChart"></canvas>');

  var $chart = $("#myChart");
  var convertRatingArrayToChartData = function (mmrArray) {
    var i = 0;
    return _.map(mmrArray, function (mmr) {
      return {
        x: i++,
        y: mmr,
      };
    })
  };

  var mmrArray = _.map(logData['matchLogs'], function (d) {
    return d.mmr;
  });
  var mmrMappingArray = convertRatingArrayToChartData(mmrArray);
  var mmrRangeMax = _.max(mmrArray) + 100;
  var mmrRangeMin = _.min(mmrArray) - 100;

  var targetLeagueBorders = leagueBorder[logData['gameModeName']];
  var borders = [];
  _.each(targetLeagueBorders, function (tierData, leagueName) {
    _.each(tierData, function (data, tierNum) {
      var minMMR = data['min_mmr'];
      var maxMMR = data['max_mmr'];

      if (mmrRangeMin < minMMR && minMMR < mmrRangeMax) {
        // if (true) {
        borders.push({
          isBorderLine: true,
          data: [
            {x: 0, y: minMMR, displayName: (leagueName + ' Tier ' + tierNum),},
            {x: mmrMappingArray.length - 1, y: minMMR},
          ],
          fill: false,
          pointRadius: 0,
          borderColor: 'black',
        });
      }
    });
  });

  var datasets = _.flatten([{
    data: mmrMappingArray,
    borderColor: 'red',
    fill: false,
    backgroundColor: false,
    pointRadius: 2,
    // showLine: false,
    // borderWidth: 1
  }, borders]);

  var myChart = new ChartJS($chart, {
    type: 'scatter',
    responsive: true,
    data: {
      datasets: datasets,
    },
    options: {
      title: {
        display: true,
        text: logData['gameModeName'] + ' ' + logData['playerNames'].join(' '),
      },

      legend: {
        display: true,
      },
      showLines: true,
      elements: {
        line: {
          // tension: 0,
        },
      },
      legend: {
        display: false,
      },
      scales: {
        yAxes: [{
          scaleLabel: {
            display: true,
            labelString: 'MMR',
          },
          ticks: {
            suggestedMax: mmrRangeMax,
            suggestedMin: mmrRangeMin,
          }
        }],
        xAxes: [{
          scaleLabel: {
            display: true,
            labelString: 'Matches',
          },
          ticks: {
            // stepSize: 1,
          }
        }],
      },
      tooltips: {
        enabled: true,
      }
    }
  });


// Define a plugin to provide data labels
  ChartJS.plugins.register({
    afterDatasetsDraw: function (chart) {
      var ctx = chart.ctx;

      chart.data.datasets.forEach(function (dataset, i) {
        var meta = chart.getDatasetMeta(i);
        if (!meta.hidden && dataset.isBorderLine) {

          // Draw the text in black, with the specified font
          ctx.fillStyle = 'rgb(0, 0, 0)';

          var fontSize = 16;
          var fontStyle = 'normal';
          var fontFamily = 'Helvetica Neue';
          ctx.font = Chart.helpers.fontString(fontSize, fontStyle, fontFamily);

          // Just naively convert to string for now
          var dataString = dataset.data[0].displayName.toString();
          // var dataString = 'GM Contender #10';

          // Make sure alignment settings are correct
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';

          var padding = 5;
          var position = meta.data[0].tooltipPosition();
          ctx.fillText(dataString, position.x, position.y - (fontSize / 2) - padding);
        }
      });
    }
  });
}

exports.updateLeagueBorders = function () {
  var SEASON_ID = 39;
  var QUEUE_ID_HASH = {
    201: '1v1',
    202: '2v2',
    203: '3v3',
    204: '4v4',
  };
  var LEAGUE_ID_HASH = {
    0: 'bronze',
    1: 'silver',
    2: 'gold',
    3: 'platinum',
    4: 'diamond',
    5: 'master',
  };

  var promises = [];
  _.each(QUEUE_ID_HASH, function (gameModeName, queueId) {
    _.each(LEAGUE_ID_HASH, function (leagueName, leagueId) {
      promises.push(Util.getJSON(sprintf(Const.BLIZ_API.URL_LEAGUE, SEASON_ID, queueId, leagueId, Const.BLIZ_API.ACCESS_TOKEN)));
    });
  });

  Q.allSettled(promises)
    .then(function (results) {
      var borders = {};
      var leagues = _.map(results, function (r) {
        return r.value;
      });

      _.each(leagues, function (data) {
        var queueName = QUEUE_ID_HASH[data['key']['queue_id']];
        var leagueName = LEAGUE_ID_HASH[data['key']['league_id']];

        borders[queueName] = borders[queueName] || {};
        borders[queueName][leagueName] = borders[queueName][leagueName] || {};

        _.each(data['tier'], function (d, tier) {
          var realTier = tier + 1;
          var minMMR = d.min_rating;
          var maxMMR = d.max_rating;

          borders[queueName][leagueName][realTier] = borders[queueName][leagueName][realTier] || {};
          borders[queueName][leagueName][realTier]['min_mmr'] = minMMR;
          borders[queueName][leagueName][realTier]['max_mmr'] = maxMMR;
        })

        writeJsonFile(Const.OTHERS.LEAGUE_BORDER_FILE_PATH, borders)
          .then(function () {
            console.log("completed!");
          });
      });
    });
}

exports.reUpdateChart = function () {
  var gameModeName = global.TEMP_INFO.gameModeName;
  var myRaceName = global.TEMP_INFO.myRaceName;
  var playerNames = global.TEMP_INFO.playerNames;

  Util.getCurrentMatchStat(gameModeName, myRaceName, playerNames)
    .then(function (result) {
      console.log(result);
      var currentUnixTime = Math.floor((new Date().getTime()) / 1000);
      playerNames = _.map(result['teamMembers'], function (member) {
        return member['displayName'];
      });

      Util.addNewLog(
        new MMRLog(currentUnixTime, gameModeName, result['mmr'], playerNames, myRaceName),
        {
          removeLastMatchLog: true,
        })
        .then(function (logData) {
          console.log("update chart");
          Util.getJSON(Const.OTHERS.LEAGUE_BORDER_FILE_PATH)
            .then(function (borders) {
              Util.updateChart(logData, borders);
            });
        });
    });
}

function writeJsonFile(path, data) {
  var d = Q.defer();
  fs.writeFile(path, JSON.stringify(data, undefined, 4), function (e) {
    if (e) {
      d.reject();
    }
    d.resolve();
  });
  return d.promise;
}

function createNewLogFileIfNotExist(path, mmrLog) {
  var d = Q.defer();

  if (!isExistFile(path)) {
    var initData = {
      gameModeName: mmrLog.getGameModeName(),
      playerNames: mmrLog.getPlayerNames(),
      matchLogs: [],
    };
    fs.writeFile(path, JSON.stringify(initData, undefined, 4), function (e) {
      if (e) {
        d.reject();
        return;
      }

      d.resolve();
    });
  } else {
    d.resolve();
  }

  return d.promise;
}


function gameModeNameToThresholdNum(gameModeName) {
  switch (gameModeName) {
    case '1v1':
      return 1;
    case '2v2':
      return 2;
    case '3v3':
      return 3;
    case '4v4':
      return 4;
    default:
      return 1;
  }
  ;
}

function isExistFile(path) {
  try {
    fs.statSync(path);
    return true
  } catch (err) {
    if (err.code === 'ENOENT') return false
  }
}

