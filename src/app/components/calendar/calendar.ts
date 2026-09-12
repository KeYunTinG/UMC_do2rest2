import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  differenceInCalendarDays,
} from 'date-fns';
import { forkJoin } from 'rxjs';
import { CalendarDay, DayEvent, Holiday, Shift } from './interface/icalendar';
@Component({
  selector: 'app-calendar',
  imports: [CommonModule],
  templateUrl: './calendar.html',
  styles: ``,
  providers: [DatePipe],
})
export class Calendar implements OnInit {
  currentDate: Date = new Date();
  days = signal<CalendarDay[]>([]);
  weekDays: string[] = ['日', '一', '二', '三', '四', '五', '六'];

  // 暫存讀取到的資料
  private holidaysData: Holiday[] = [];
  private eventsData: DayEvent[] = [];
  private readonly ANCHOR_DATE = new Date('2025-06-30');

  //* overtimes.json 沒寫 type 時的預設名稱
  private readonly DEFAULT_EVENT_NAME = '加班';

  //* 特定名稱的專屬配色，沒對到的名稱一律用 DEFAULT_EVENT_STYLE
  private readonly EVENT_STYLES: Record<string, { color: string; dot: string }> =
    {
      加班: {
        color: 'bg-orange-50 text-orange-700 ring-orange-200',
        dot: 'bg-orange-500',
      },
      請假: {
        color: 'bg-violet-50 text-violet-700 ring-violet-200',
        dot: 'bg-violet-500',
      },
    };

  private readonly DEFAULT_EVENT_STYLE = {
    color: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.generateCalendar();

    setTimeout(() => {
      this.loadData();
    }, 1000);
  }

  // 同時讀取兩個 JSON 檔案
  loadData(): void {
    forkJoin({
      holidays: this.http.get<Holiday[]>('./assets/holidays.json'),
      overtimes: this.http.get<DayEvent[]>('./assets/overtimes.json'), // 載入獨立的加班／事項檔
    }).subscribe({
      next: (response) => {
        // 處理補假邏輯
        this.holidaysData = this.processAdjustedHolidays(response.holidays);
        this.eventsData = response.overtimes; // 儲存加班／事項資料
      },
      error: (err) => console.error('無法讀取資料:', err),
      complete: () => {
        this.generateCalendar();
      },
    });
  }

  //補假
  private processAdjustedHolidays(holidays: Holiday[]): Holiday[] {
    const adjustedHolidays: Holiday[] = [];

    holidays.forEach((h) => {
      const date = new Date(h.date);
      const dayOfWeek = date.getDay(); // 0 是週日, 6 是週六
      const chineseNewYear = [
        '小年夜',
        '除夕',
        '大年初一',
        '大年初二',
        '大年初三',
      ];

      //* 過年不補假
      if (dayOfWeek === 6 && !chineseNewYear.includes(h.name)) {
        //* 週六：補禮拜五
        const friday = new Date(date);
        friday.setDate(date.getDate() - 1);
        adjustedHolidays.push({
          ...h,
          date: format(friday, 'yyyy-MM-dd'),
          name: `${h.name} (補假)`,
        });
      } else if (dayOfWeek === 0 && !chineseNewYear.includes(h.name)) {
        //* 週日：補禮拜一
        const monday = new Date(date);
        monday.setDate(date.getDate() + 1);
        adjustedHolidays.push({
          ...h,
          date: format(monday, 'yyyy-MM-dd'),
          name: `${h.name} (補假)`,
        });
      }

      // 原本的假日還是要放（或視需求決定是否保留）
      adjustedHolidays.push(h);
    });

    return adjustedHolidays;
  }

  //* 計算休假日
  getShiftsByRule(date: Date): Shift[] {
    const dateStr = format(date, 'yyyy-MM-dd');

    //* 1. 先取出當天在 overtimes.json 登記的所有事項（加班 / 請假 / 其他）
    const events = this.eventsData.filter((e) => e.date === dateStr);
    if (events.length === 0) {
      return [this.getCycleShift(date)];
    }

    const eventShifts = events.map((e) => this.toShift(e));

    //* 2. 有任一事項要取代班別，就只顯示事項；否則接在原本班別後面
    const replaceShift = events.some((e) => e.replaceShift ?? true);

    return replaceShift
      ? eventShifts
      : [this.getCycleShift(date), ...eventShifts];
  }

  //* 沒登記事項時，依 4 天一循環的規則決定上班 / 休
  private getCycleShift(date: Date): Shift {
    // 計算這一天跟基準日差了幾天
    const diff = differenceInCalendarDays(date, this.ANCHOR_DATE);

    const cycleDay = ((diff % 4) + 4) % 4;

    if (cycleDay === 0 || cycleDay === 1) {
      // 這是上班日
      return {
        title: '上班',
        type: 'morning',
        color: 'bg-sky-50 text-sky-700 ring-sky-200',
        dot: 'bg-sky-500',
      };
    }

    return {
      title: '休',
      type: 'off',
      color: 'bg-slate-100 text-slate-500 ring-slate-200',
      dot: 'bg-slate-400',
    };
  }

  //* 事項名稱：type 沒填就當成加班
  private getEventName(event: DayEvent): string {
    return event.type?.trim() || this.DEFAULT_EVENT_NAME;
  }

  private toShift(event: DayEvent): Shift {
    const name = this.getEventName(event);
    const style = this.EVENT_STYLES[name] ?? this.DEFAULT_EVENT_STYLE;
    return {
      title: name,
      type: name,
      color: style.color,
      dot: style.dot,
    };
  }

  generateCalendar(): void {
    const start = startOfWeek(startOfMonth(this.currentDate));
    const end = endOfWeek(endOfMonth(this.currentDate));

    const interval = eachDayOfInterval({ start, end });

    this.days.set(
      interval.map((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');

        // 查找是否有假日
        const holiday = this.holidaysData.find((h) => h.date === dateStr)?.name;

        // 查找是否有班表
        const shifts = this.getShiftsByRule(date);

        return {
          date: date,
          dateStr: dateStr,
          isCurrentMonth: isSameMonth(date, this.currentDate),
          isToday: isToday(date),
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
          holiday: holiday,
          shifts: shifts,
        };
      }),
    );
  }

  prevMonth(): void {
    this.currentDate = subMonths(this.currentDate, 1);
    this.generateCalendar();
  }

  nextMonth(): void {
    this.currentDate = addMonths(this.currentDate, 1);
    this.generateCalendar();
  }

  goToday(): void {
    this.currentDate = new Date();
    this.generateCalendar();
  }
}
