import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { environment } from '../../environments/environment';

interface HorseParam {
  _id: string;
  meetingName: string;
  raceNum: number;
  horseNum: number;
  horseName: string;
  winner: boolean;
  hasSpecial: boolean;
  hasRule4: boolean;
}

interface RaceGroup {
  raceNum: number;
  horses: HorseParam[];
}

@Component({
  selector: 'app-winners',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatCheckboxModule, MatButtonModule],
  templateUrl: './winners.html',
  styleUrl: './winners.css',
})
export class Winners implements OnInit {
  private apiUrl = `${environment.apiUrl}/api`;
  
  raceGroups: RaceGroup[] = [];
  loading: boolean = true;
  meetingName: string = '';
  displayedColumns: string[] = ['horseNum', 'horseName', 'winner'];
  
  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}
  
  ngOnInit() {
    this.loadWinners();
  }
  
  loadWinners() {
    this.http.get<any[]>(`${this.apiUrl}/params/selected-races`).subscribe({
      next: (races) => {
        if (races.length === 0) {
          this.loading = false;
          return;
        }
        
        this.meetingName = races[0].meetingName;
        this.loadParams();
      },
      error: (error) => {
        console.error('Error loading races:', error);
        this.loading = false;
      }
    });
  }
  
  loadParams() {
    this.http.get<any[]>(`${this.apiUrl}/params?meetingName=${encodeURIComponent(this.meetingName)}`).subscribe({
      next: (params) => {
        // Group params by race
        const raceMap = new Map<number, HorseParam[]>();
        
        params.forEach(param => {
          if (!raceMap.has(param.raceNum)) {
            raceMap.set(param.raceNum, []);
          }
          
          raceMap.get(param.raceNum)!.push({
            _id: param._id,
            meetingName: param.meetingName,
            raceNum: param.raceNum,
            horseNum: param.horseNum,
            horseName: param.horseName || `Horse ${param.horseNum}`,
            winner: param.winner || false,
            hasSpecial: !!param.special,
            hasRule4: !!param.rule4
          });
        });
        
        // Convert to array and sort
        this.raceGroups = Array.from(raceMap.entries())
          .map(([raceNum, horses]) => ({
            raceNum,
            horses: horses.sort((a, b) => a.horseNum - b.horseNum)
          }))
          .sort((a, b) => a.raceNum - b.raceNum);
        
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading params:', error);
        this.loading = false;
      }
    });
  }
  
  toggleWinner(horse: HorseParam) {
    const newWinnerValue = !horse.winner;
    
    this.http.patch(`${this.apiUrl}/params/${horse._id}`, { winner: newWinnerValue }).subscribe({
      next: () => {
        horse.winner = newWinnerValue;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error updating winner:', error);
        alert('Error updating winner status');
      }
    });
  }
}
