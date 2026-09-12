export interface Shift {
  title: string;
  type: string;
  color: string;
  dot: string;
}

export interface Holiday {
  date: string;
  name: string;
}

export interface DayEvent {
  date: string;
  /** 直接寫要顯示的名稱，例如「加班」「請假」「家庭日」；省略時視為加班 */
  type?: string;
  /** 預設會蓋掉當天的輪班班別；設成 false 則與「上班／休」並排顯示 */
  replaceShift?: boolean;
}

export interface CalendarDay {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  holiday?: string;
  shifts: Shift[];
}
