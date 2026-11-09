import type { Schedule } from './schedule.js';

export type CategorySeed = {
  code: string;
  name: string;
  description: string;
  cutoffTime: string;
  gridMin: number;
  gridMax: number;
  pad: number;
  schedule: Schedule;
};

const STAKES = ['10.0000', '20.0000', '50.0000', '100.0000'] as const;

export const DEFAULT_STAKES: readonly string[] = STAKES;

const NATIONAL_DAYS = [1, 16];
const MARKET_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'] as const;

export const CATEGORY_SEEDS: readonly CategorySeed[] = [
  {
    code: 'TH_NATION_D3',
    name: 'หวยรัฐบาล สามหลัก',
    description: 'เลือก 000 ถึง 999 ตัดยอด 15:30 น. วันที่ 1 และ 16 ตามเวลาประเทศไทย',
    cutoffTime: '15:30',
    gridMin: 0,
    gridMax: 999,
    pad: 3,
    schedule: sessionSchedule('NATIONAL', { daysOfMonth: NATIONAL_DAYS, weekdays: null }, ['15:30']),
  },
  {
    code: 'TH_NATION_D2',
    name: 'หวยรัฐบาล สองหลัก',
    description: 'เลือก 00 ถึง 99 ตัดยอด 15:30 น. วันที่ 1 และ 16 ตามเวลาประเทศไทย',
    cutoffTime: '15:30',
    gridMin: 0,
    gridMax: 99,
    pad: 2,
    schedule: sessionSchedule('NATIONAL', { daysOfMonth: NATIONAL_DAYS, weekdays: null }, ['15:30']),
  },
  {
    code: 'TH_SAVINGS_GSB',
    name: 'สลากออมสิน',
    description: 'สลากออมสิน ตัดยอด 12:30 น. วันที่ 1 และ 16 ตามเวลาประเทศไทย',
    cutoffTime: '12:30',
    gridMin: 0,
    gridMax: 999,
    pad: 3,
    schedule: sessionSchedule('NATIONAL', { daysOfMonth: NATIONAL_DAYS, weekdays: null }, ['12:30']),
  },
  {
    code: 'TH_AGRI_BAAC',
    name: 'สลาก ธ.ก.ส.',
    description: 'สลากธนาคารเพื่อการเกษตร ตัดยอด 16:00 น. วันที่ 1 และ 16 ตามเวลาประเทศไทย',
    cutoffTime: '16:00',
    gridMin: 0,
    gridMax: 999,
    pad: 3,
    schedule: sessionSchedule('NATIONAL', { daysOfMonth: NATIONAL_DAYS, weekdays: null }, ['16:00']),
  },
  {
    code: 'VN_HN_REGULAR',
    name: 'ฮานอยปกติ',
    description: 'หวยฮานอยปกติ ตัดยอดทุกวัน 18:00 น. ตามเวลาประเทศไทย',
    cutoffTime: '18:00',
    gridMin: 0,
    gridMax: 999,
    pad: 3,
    schedule: sessionSchedule('REGIONAL', { daysOfMonth: null, weekdays: null }, ['18:00']),
  },
  {
    code: 'VN_HN_SPECIAL',
    name: 'ฮานอยพิเศษ',
    description: 'หวยฮานอยพิเศษ ตัดยอดทุกวัน 17:00 น. ตามเวลาประเทศไทย',
    cutoffTime: '17:00',
    gridMin: 0,
    gridMax: 999,
    pad: 3,
    schedule: sessionSchedule('REGIONAL', { daysOfMonth: null, weekdays: null }, ['17:00']),
  },
  {
    code: 'VN_HN_VIP',
    name: 'ฮานอย VIP',
    description: 'หวยฮานอย VIP ตัดยอดทุกวัน 19:00 น. ตามเวลาประเทศไทย',
    cutoffTime: '19:00',
    gridMin: 0,
    gridMax: 999,
    pad: 3,
    schedule: sessionSchedule('REGIONAL', { daysOfMonth: null, weekdays: null }, ['19:00']),
  },
  {
    code: 'LA_DEVELOP',
    name: 'ลาวพัฒนา',
    description: 'หวยลาวพัฒนา ตัดยอดวันจันทร์ พุธ และศุกร์ 20:00 น. ตามเวลาประเทศไทย',
    cutoffTime: '20:00',
    gridMin: 0,
    gridMax: 999,
    pad: 3,
    schedule: sessionSchedule('REGIONAL', { daysOfMonth: null, weekdays: ['MON', 'WED', 'FRI'] }, ['20:00']),
  },
  {
    code: 'LA_STAR',
    name: 'ลาวสตาร์',
    description: 'หวยลาวสตาร์ ตัดยอดทุกวัน 15:30 น. ตามเวลาประเทศไทย',
    cutoffTime: '15:30',
    gridMin: 0,
    gridMax: 999,
    pad: 3,
    schedule: sessionSchedule('REGIONAL', { daysOfMonth: null, weekdays: null }, ['15:30']),
  },
  {
    code: 'YEEKEE_15M',
    name: 'ยี่กี 15 นาที',
    description: 'เปิด 88 งวดต่อวัน ตัดยอดทุก 15 นาทีตามนาฬิกาเซิร์ฟเวอร์เวลาประเทศไทย',
    cutoffTime: '00:15',
    gridMin: 0,
    gridMax: 999,
    pad: 3,
    schedule: {
      group: 'FLASH',
      weekdays: null,
      daysOfMonth: null,
      sessions: [],
      intervalMinutes: 15,
      batchesPerDay: 88,
    },
  },
  {
    code: 'STOCK_SET_TH',
    name: 'หุ้นไทย',
    description: 'ดัชนีหุ้นไทย ตัดยอด 12:30 น. และ 16:40 น. วันจันทร์ถึงศุกร์',
    cutoffTime: '12:30',
    gridMin: 0,
    gridMax: 999,
    pad: 3,
    schedule: sessionSchedule('STOCK', { daysOfMonth: null, weekdays: [...MARKET_DAYS] }, ['12:30', '16:40']),
  },
  {
    code: 'STOCK_NIKKEI',
    name: 'หุ้นนิเคอิ',
    description: 'ดัชนีนิเคอิ ตัดยอด 09:30 น. และ 13:00 น. วันจันทร์ถึงศุกร์',
    cutoffTime: '09:30',
    gridMin: 0,
    gridMax: 999,
    pad: 3,
    schedule: sessionSchedule('STOCK', { daysOfMonth: null, weekdays: [...MARKET_DAYS] }, ['09:30', '13:00']),
  },
  {
    code: 'STOCK_HANGSENG',
    name: 'หุ้นฮั่งเส็ง',
    description: 'ดัชนีฮั่งเส็ง ตัดยอด 11:00 น. และ 14:30 น. วันจันทร์ถึงศุกร์',
    cutoffTime: '11:00',
    gridMin: 0,
    gridMax: 999,
    pad: 3,
    schedule: sessionSchedule('STOCK', { daysOfMonth: null, weekdays: [...MARKET_DAYS] }, ['11:00', '14:30']),
  },
  {
    code: 'STOCK_DOWJONES',
    name: 'หุ้นดาวโจนส์',
    description: 'ดัชนีดาวโจนส์ ตัดยอด 01:00 น. วันจันทร์ถึงศุกร์ ตามเวลาประเทศไทย',
    cutoffTime: '01:00',
    gridMin: 0,
    gridMax: 999,
    pad: 3,
    schedule: sessionSchedule('STOCK', { daysOfMonth: null, weekdays: [...MARKET_DAYS] }, ['01:00']),
  },
];

function sessionSchedule(
  group: Schedule['group'],
  days: { daysOfMonth: number[] | null; weekdays: Schedule['weekdays'] },
  cutoffs: string[],
): Schedule {
  return {
    group,
    weekdays: days.weekdays,
    daysOfMonth: days.daysOfMonth,
    sessions: cutoffs.map((cutoff) => ({ cutoff })),
    intervalMinutes: null,
    batchesPerDay: null,
  };
}
