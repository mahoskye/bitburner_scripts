/**
 * Money Thresholds & Costs
 * Financial thresholds and item costs
 */

export const MONEY = {
  BUFFER_MIN: 100000,             // General minimum buffer (100k)
  SERVER_PURCHASE_MIN: 100000,    // Don't buy servers until 100k
  HACKNET_RESERVE: 10000,         // Money to keep in reserve (or 10%)
  HACKNET_THRESHOLD: 100000,      // Threshold for hacknet chunk sizes
  STAT_GRINDER_BUFFER: 1000000,   // Min buffer for stat grinding
};

export const TOR_COSTS = {
  ROUTER: 200000,

  PROGRAMS: {
    'BruteSSH.exe': 500000,
    'FTPCrack.exe': 1500000,
    'relaySMTP.exe': 5000000,
    'HTTPWorm.exe': 30000000,
    'SQLInject.exe': 250000000,
    'ServerProfiler.exe': 500000,
    'DeepscanV1.exe': 500000,
    'AutoLink.exe': 1000000,
  },
};

export const PROGRAMS = {
  NAMES: [
    'BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe',
    'HTTPWorm.exe', 'SQLInject.exe'
  ],

  NUKE: 'NUKE.exe',
  BRUTE_SSH: 'BruteSSH.exe',
  FTP_CRACK: 'FTPCrack.exe',
  RELAY_SMTP: 'relaySMTP.exe',
  HTTP_WORM: 'HTTPWorm.exe',
  SQL_INJECT: 'SQLInject.exe',
  SERVER_PROFILER: 'ServerProfiler.exe',
  DEEPSCAN: 'DeepscanV1.exe',
  AUTO_LINK: 'AutoLink.exe',
};
