exports.getJSON = function (URL) {
  var d = Q.defer();

  $.getJSON(URL, function (json) {
    d.resolve(json);
  });

  return d.promise;
};

exports.getCurrentMatchStat = function (gameModeName, myRaceName, playerNames) {
  var d = Q.defer();

  console.log("fetching match stat... " + gameModeName + " " + myRaceName + " " + playerNames.toString());

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

  var logPath = './logs/' + mmrLog.getGameModeName() + '/' + mmrLog.getLogFileName();

  console.log('adding new log');
  console.log(mmrLog);

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

          if (options.pushRetryQueueIfInvalidData && !_.isEmpty(data['matchLogs'])) {
            var lastMatchLog = data['matchLogs'].slice(-1)[0];
            var lastMMR = lastMatchLog['mmr'];

            if (mmrLog.getMMR() == lastMMR) {
              d.reject('Fetched mmr: ' + mmrLog.getMMR() + ' Last match MMR: ' + lastMMR + '  Data is not updated yet.');
              return;
            }
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

exports.updateChart = function (gameModeName) {
  // clear canvas before create new one
  $('canvas#myChart').remove();
  $('body').append('<canvas id="myChart"></canvas>');

  var $chart = $("#myChart");

  var createChartDatasetsByLogData = function (logData) {
    var mmrArray = _.map(logData['matchLogs'], function (d) {
      return d.mmr;
    });

    var convertRatingArrayToChartData = function (mmrArray) {
      var i = 0;
      return _.map(mmrArray, function (mmr) {
        return {
          x: i++,
          y: mmr,
        };
      })
    };

    var settingByRace = {
      'terran': {
        borderColor: 'red',
        legend: 'Terran'
      },
      'zerg': {
        borderColor: 'purple',
        legend: 'Zerg'
      },
      'protoss': {
        borderColor: 'yellow',
        legend: 'Protoss'
      },
    };

    var setting = settingByRace[logData['race']];

    return {
      data: convertRatingArrayToChartData(mmrArray),
      borderColor: setting.borderColor,
      fill: false,
      backgroundColor: false,
      pointRadius: 2,
      // showLine: false,
      // borderWidth: 1

      minMMR: _.min(mmrArray),
      maxMMR: _.max(mmrArray),

      legend: setting.legend,
    };
  };

  Q.allSettled([
    Util.getLogDataByGameModeName(gameModeName),
    Util.getJSON(Const.OTHERS.LEAGUE_BORDER_FILE_PATH)
  ])
    .then(function (results) {
      var logDataArray = results[0].value;
      var leagueBorders = results[1].value;

      if (_.isEmpty(logDataArray)) return;

      var mmrDatasets = _.map(logDataArray, function (logData) {
        return createChartDatasetsByLogData(logData)
      });

      var mmrRangeMin = _.min(mmrDatasets, function (dataset) {
        return dataset['minMMR'];
      })['minMMR'];

      var mmrRangeMax = _.max(mmrDatasets, function (dataset) {
        return dataset['maxMMR'];
      })['maxMMR'];

      var maxGameNum = _.max(mmrDatasets, function (dataset) {
        return dataset['data'].length;
      })['data'].length;

      var borders = [];
      _.each(leagueBorders[gameModeName], function (tierData, leagueName) {
        _.each(tierData, function (data, tierNum) {
          var minMMR = data['min_mmr'];
          var maxMMR = data['max_mmr'];

          if (mmrRangeMin - 100 < minMMR && minMMR < mmrRangeMax + 100) {
            borders.push({
              isBorderLine: true,
              data: [
                {x: 0, y: minMMR, displayName: (leagueName + ' Tier ' + tierNum),},
                {x: maxGameNum - 1, y: minMMR},
              ],
              fill: false,
              pointRadius: 0,
              borderColor: 'blue',
            });
          }
        });
      });

      var datasets = _.flatten([mmrDatasets, borders]);

      console.log(datasets);

      var myChart = new ChartJS($chart, {
        type: 'scatter',
        responsive: true,
        data: {
          datasets: datasets,
        },
        options: {
          title: {
            display: true,
            text: gameModeName,
          },

          // legend: {
          //   display: false,
          // },

          legend: {
            display: true,
            // position: 'right',
            labels: {
              generateLabels: function (data) {
                // 凡例の表示
                var chartData = data.tooltip._data;
                var legendArray = [];
                _.each(chartData.datasets, function (dataset) {

                  var legendText = dataset.legend;
                  if (!legendText) return;

                  const eachLengend = {
                    // 表示されるラベル
                    text: legendText,
                    // 凡例ボックスの塗りつぶしスタイル
                    fillStyle: dataset.borderColor,
                    //  trueの場合、この項目は非表示のデータセットを表します。ラベルは取り消し線を伴ってレンダリングされます
                    hidden: false,
                    // ボックス枠用。次をご覧ください。https://developer.mozilla.org/en/docs/Web/API/CanvasRenderingContext2D/lineCap
                    lineCap: "butt",
                    // ボックス枠用。次をご覧ください。https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash
                    lineDash: [0],
                    // ボックス枠用。次をご覧ください。https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineDashOffset
                    lineDashOffset: 0,
                    // ボックス枠用。次をご覧ください。https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineJoin
                    lineJoin: "bevel",
                    // 枠線の幅
                    lineWidth: 0,
                    // 凡例ボックスのストロークスタイル
                    strokeStyle: "",
                    // 凡例ボックスのポイントスタイル（usePointStyleがtrueの場合にのみ使用されます）
                    pointStyle: ""
                  };

                  legendArray.push(eachLengend);


                });

                return legendArray;
              }
            },
          },

          showLines: true,
          elements: {
            line: {
              // tension: 0,
            },
          },
          scales: {
            yAxes: [{
              scaleLabel: {
                display: true,
                labelString: 'MMR',
              },
              ticks: {
                suggestedMax: mmrRangeMax + 100,
                // suggestedMin: mmrRangeMin - 100,
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

    });
  
// Define a plugin to provide data labels
  ChartJS.plugins.register({
    afterDatasetsDraw: function (chart) {
      var ctx = chart.ctx;

      chart.data.datasets.forEach(function (dataset, i) {
        var meta = chart.getDatasetMeta(i);
        if (!meta.hidden && dataset.isBorderLine) {

          // Draw the text in black, with the specified font
          ctx.fillStyle = 'blue';

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
          Util.updateChart(gameModeName);
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

  console.log('checking log file existent... ' + path);

  if (!isExistFile(path)) {
    console.log('not found log file. creating new one...');

    var initData = {
      gameModeName: mmrLog.getGameModeName(),
      playerNames: mmrLog.getPlayerNames(),
      matchLogs: [],
    };

    if (mmrLog.getGameModeName() == '1v1') {
      initData = _.extend({
        race: mmrLog.getMyRaceName(),
      }, initData);
    }

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

function getFileNames(path) {
  var d = Q.defer();

  fs.readdir(path, function (err, files) {
    if (err) {
      d.reject(err);
      throw err;
    }
    var fileList = files.filter(function (file) {
      return fs.statSync(path + file).isFile(); //絞り込み
    })
    d.resolve(fileList);
  });

  return d.promise;
}

exports.getLogDataByGameModeName = function (gameModeName) {
  var d = Q.defer();

  var basePath = './logs/' + gameModeName + '/';
  getFileNames(basePath)
    .then(function (fileNames) {
      Q.allSettled(_.map(fileNames, function (fileName) {
        return Util.getJSON(basePath + fileName);
      }))
        .then(function (results) {
          var logDataArray = _.map(results, function (result) {
            return result.value;
          });

          d.resolve(logDataArray);
        });

    });

  return d.promise;
}
