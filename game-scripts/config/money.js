/**
 * Money Thresholds & Costs
 * Financial thresholds and item costs
 */

export const MONEY = {
  BUFFER_MIN: 100000,             // General minimum buffer (100k)
  SERVER_PURCHASE_MIN: 100000,    // Don't buy servers until 100k
  HACKNET_RESERVE: 200000,        // Money to keep in reserve (or 10%) - matches TOR cost
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
    'Formulas.exe': 5000000000,
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
  FORMULAS: 'Formulas.exe',
};

// Hacking level required to create each program
export const PROGRAM_CREATE_LEVEL = {
  'BruteSSH.exe': 50,
  'FTPCrack.exe': 100,
  'relaySMTP.exe': 250,
  'HTTPWorm.exe': 500,
  'SQLInject.exe': 750,
  'ServerProfiler.exe': 75,
  'DeepscanV1.exe': 75,
  'AutoLink.exe': 25,
};

export const STOCK_MARKET_COSTS = {
  WSE_ACCOUNT: 25000000,           // $25m - Basic access to view stocks
  TIX_API: 5000000000,             // $5b - API access for trading
  FOUR_SIGMA_DATA: 1000000000,     // $1b - Market data access
  FOUR_SIGMA_API: 25000000000,     // $25b - Market data API access
};
