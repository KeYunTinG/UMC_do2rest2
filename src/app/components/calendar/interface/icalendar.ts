export interface Shift {
  title: string;
  type: string;
  color: string;
}

export interface Holiday {
  date: string;
  name: string;
}

export interface CalendarDay {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  holiday?: string;
  shifts: Shift[];
}
