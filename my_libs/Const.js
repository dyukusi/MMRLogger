exports.STATE = {
  MENU: 0,
  IN_GAME: 1,
  LOADING: 2,
};

exports.BLIZ_API = {
  ACCESS_TOKEN: 'USGEwcbmvyEQoVqyjx0c5a8piNkAZF1xlR',

  // (regionId, profileId)
  URL_LADDER_SUMMARY: 'https://us.api.blizzard.com/sc2/profile/1/%d/%d/ladder/summary?locale=en_US&access_token=%s',
  URL_LADDER: 'https://us.api.blizzard.com/sc2/profile/%d/1/%d/ladder/%d?locale=en_US&access_token=%s',
  URL_LEAGUE: 'https://us.api.blizzard.com/data/sc2/league/%d/%d/0/%d?locale=en_US&access_token=%s',
};

// MAIN
// exports.TEMP = {
//   MY_NAME: 'Dyukusi',
//   BLIZ_PROFILE_ID: 5223470,
//   REGION_ID: 1,
// };

// SUB
exports.TEMP = {
  MY_NAME: 'llllllllllll',
  BLIZ_PROFILE_ID: 10752425,
  REGION_ID: 1,
};

exports.OTHERS = {
  LEAGUE_BORDER_FILE_PATH: './others/leagueBorders.json',
};
