import { Component, OnInit, ChangeDetectorRef  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { environment } from '../../environments/environment';

interface ParamRow {
  meetingName: string;
  raceNum: number;
  horseNum: number;
  horseName: string;
  special: Date | null;
  rule4: Date | null;
  rule4deduct: number | null;
}

@Component({
  selector: 'app-params',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './params.html',
  styleUrl: './params.css',
})
export class Params implements OnInit {
  private apiUrl = `${environment.apiUrl}/api`;
  
  displayedColumns: string[] = ['raceNum', 'horseNum', 'horseName', 'special', 'rule4', 'rule4deduct'];
  dataSource: ParamRow[] = [];
  raceGroups: { [key: number]: ParamRow[] } = {};
  meetingName: string = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    // First, get selected races from init
    this.http.get<any[]>(`${this.apiUrl}/params/selected-races`).subscribe({
      next: (races) => {
        if (races.length === 0) {
          alert('No selected races found. Please select a meeting in the Init page first.');
          return;
        }

        // Store meeting name from the first race
        this.meetingName = races[0].meetingName;
        this.cdr.detectChanges();
        
        // Then load existing params for this meeting
        this.http.get<any[]>(`${this.apiUrl}/params?meetingName=${encodeURIComponent(races[0].meetingName)}`).subscribe({
          next: (params) => {
            this.buildDataSource(races, params);
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error loading params:', error);
            this.buildDataSource(races, []);
            this.cdr.detectChanges();
          }
        });
      },
      error: (error) => {
        console.error('Error loading selected races:', error);
        alert('Error loading races. Please check if the backend is running.');
      }
    });
  }

  buildDataSource(races: any[], existingParams: any[]) {
    this.dataSource = [];
    this.raceGroups = {};

    races.forEach(race => {
      const raceNum = race.raceNum;
      const numHorses = race.numHorse;
      
      this.raceGroups[raceNum] = [];

      for (let horseNum = 1; horseNum <= numHorses; horseNum++) {
        // Check if param already exists
        const existingParam = existingParams.find(
          p => p.raceNum === raceNum && p.horseNum === horseNum
        );

        const row: ParamRow = {
          meetingName: races[0].meetingName,
          raceNum: raceNum,
          horseNum: horseNum,
          horseName: existingParam?.horseName || '',
          special: existingParam?.special ? new Date(existingParam.special) : null,
          rule4: existingParam?.rule4 ? new Date(existingParam.rule4) : null,
          rule4deduct: existingParam?.rule4deduct || null
        };

        this.dataSource.push(row);
        this.raceGroups[raceNum].push(row);
      }
    });
  }

  getRaceNumbers(): number[] {
    return Object.keys(this.raceGroups).map(Number).sort((a, b) => a - b);
  }

  getRaceData(raceNum: number): ParamRow[] {
    return this.raceGroups[raceNum] || [];
  }

  saveParams() {
    const data = {
      params: this.dataSource.map(row => ({
        meetingName: row.meetingName,
        raceNum: row.raceNum,
        horseNum: row.horseNum,
        horseName: row.horseName,
        special: row.special,
        rule4: row.rule4,
        rule4deduct: row.rule4deduct
      }))
    };

    this.http.post(`${this.apiUrl}/params`, data).subscribe({
      next: (response) => {
        alert('Parameters saved successfully!');
      },
      error: (error) => {
        console.error('Error saving params:', error);
        alert('Error saving parameters. Please try again.');
      }
    });
  }

  onHorseNameKeydown(event: KeyboardEvent, currentIndex: number) {
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      
      // Auto-save current data
      this.autoSave();
      
      // Move to next horse name field
      const nextIndex = currentIndex + 1;
      if (nextIndex < this.dataSource.length) {
        setTimeout(() => {
          const nextInput = document.getElementById(`horseName-${nextIndex}`);
          if (nextInput) {
            nextInput.focus();
            (nextInput as HTMLInputElement).select();
          }
        }, 50);
      }
    }
  }

  onHorseNameInput(row: ParamRow) {
    if (row.horseName) {
      row.horseName = row.horseName.toUpperCase();
    }
  }

  autoSave() {
    const data = {
      params: this.dataSource.map(row => ({
        meetingName: row.meetingName,
        raceNum: row.raceNum,
        horseNum: row.horseNum,
        horseName: row.horseName,
        special: row.special,
        rule4: row.rule4,
        rule4deduct: row.rule4deduct
      }))
    };

    this.http.post(`${this.apiUrl}/params`, data).subscribe({
      next: (response) => {
        console.log('Auto-saved successfully');
      },
      error: (error) => {
        console.error('Error auto-saving params:', error);
      }
    });
  }

  getTimeString(date: Date | null): string {
    if (!date) return '';
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  setTime(row: ParamRow, field: 'special' | 'rule4', timeString: string) {
    if (!timeString) return;
    
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // If no date is set, create a new date with today's date
    if (!row[field]) {
      row[field] = new Date();
    }
    
    // Update the time on the existing date
    const date = new Date(row[field]!);
    date.setHours(hours, minutes, 0, 0);
    row[field] = date;
  }

  clearDateTime(row: ParamRow, field: 'special' | 'rule4') {
    row[field] = null;
    if (field === 'rule4') {
      row.rule4deduct = null;
    }
    this.cdr.detectChanges();
  }
}
