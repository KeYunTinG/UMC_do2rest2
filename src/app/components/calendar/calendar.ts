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
import { CalendarDay, Holiday, Overtime, Shift } from './interface/icalendar';
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
  private overtimesData: Overtime[] = [];
  private readonly ANCHOR_DATE = new Date('2025-06-30');

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
      overtimes: this.http.get<Overtime[]>('./assets/overtimes.json'), // 載入獨立的加班檔
    }).subscribe({
      next: (response) => {
        // 處理補假邏輯
        this.holidaysData = this.processAdjustedHolidays(response.holidays);
        this.overtimesData = response.overtimes; // 儲存加班資料
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
    //* 1. 優先判斷：這一天是否在獨立的 overtimesData 中
    const overtime = this.overtimesData.find(
      (o) => o.date === format(date, 'yyyy-MM-dd'),
    );
    if (overtime) {
      // 命中加班資料，無視原本的休假週期
      return [
        {
          title: '加班',
          type: 'overtime',
          color: 'bg-orange-100 text-orange-700 border-orange-200',
        },
      ];
    } else {
      //* 2. 原有的週期邏輯
      // 1. 計算這一天跟基準日差了幾天
      const diff = differenceInCalendarDays(date, this.ANCHOR_DATE);

      const cycleDay = ((diff % 4) + 4) % 4;

      if (cycleDay === 0 || cycleDay === 1) {
        // 這是上班日
        return [
          {
            title: '上班',
            type: 'morning',
            color: 'bg-blue-100 text-blue-700 border-blue-200',
          },
        ];
      } else {
        return [
          { title: '休', type: 'off', color: 'bg-gray-100 text-gray-400' },
        ];
      }
    }
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
}
