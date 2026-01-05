import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-listdata',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list.html',
  styleUrl: './list.css'
})

export class ListdataComponent implements OnInit {
  private apiUrl = 'http://localhost:3000/api';
  
  items: any[] = [];
  searchRaceNum: number | null = null;
  searchHorseNum: number | null = null;
  searchClientName: string = '';
  meetingName: string = '';
  
  // Cache all params data for horse names
  private allParams: any[] = [];

  get filteredItems() {
    // If no filters, return all
    if (!this.searchRaceNum && !this.searchHorseNum && !this.searchClientName?.trim()) return this.items;

    return this.items.filter(i => {
      // Name filter (case-insensitive, partial match)
      const nameMatch = !this.searchClientName?.trim() ||
        (i.clientName && i.clientName.toLowerCase().includes(this.searchClientName.trim().toLowerCase()));

      // Race and Horse filters
      let raceMatch = true, horseMatch = true;
      if (this.searchRaceNum) {
        raceMatch = Number(i.raceNum) === Number(this.searchRaceNum);
      }
      if (this.searchHorseNum) {
        horseMatch = Number(i.horseNum) === Number(this.searchHorseNum);
      }

      return nameMatch && raceMatch && horseMatch;
    });
  }

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    try {
      // Load selected races first
      const selectedRaces = await this.http.get<any[]>(`${this.apiUrl}/params/selected-races`).toPromise();
      
      if (!selectedRaces || selectedRaces.length === 0) {
        alert('No selected races found. Please select a meeting in the Init page first.');
        return;
      }
      
      // Set meetingName first
      this.meetingName = selectedRaces[0].meetingName;
      
      // Then load params and bets for this meeting
      this.loadBets();
      this.loadAllParams();
      
      // Trigger change detection after everything is set
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 0);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  loadBets() {
    this.http.get<any[]>(`${this.apiUrl}/bets?meetingName=${encodeURIComponent(this.meetingName)}`).subscribe({
      next: (data: any[]) => {
        this.items = data.sort((a: any, b: any) => {
          const dateA = new Date(a.betTime || a.createdAt).getTime();
          const dateB = new Date(b.betTime || b.createdAt).getTime();
          return dateB - dateA; // latest first
        });
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error loading bets:', error);
      }
    });
  }

  loadAllParams() {
    this.http.get<any[]>(`${this.apiUrl}/params?meetingName=${encodeURIComponent(this.meetingName)}`).subscribe({
      next: (params: any[]) => {
        this.allParams = params;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error loading params:', error);
      }
    });
  }

  cancelBet(item: any) {
    const newCancelledValue = !item.cancelled;
    const action = newCancelledValue ? 'cancel' : 'reactivate';
    
    if (!confirm(`Are you sure you want to ${action} this bet?`)) {
      return;
    }

    this.http.patch(`${this.apiUrl}/bets/${item._id}/cancel`, { cancelled: newCancelledValue }).subscribe({
      next: () => {
        console.log(`Bet ${action}ed successfully`);
        item.cancelled = newCancelledValue; // Update local state
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error(`Failed to ${action} bet:`, error);
        alert(`Error ${action}ing bet`);
      }
    });
  }

  getHorseName(raceNum: number, horseNum: number): string {
    const param = this.allParams.find(p => 
      p.raceNum === raceNum && p.horseNum === horseNum
    );
    return param?.horseName || '';
  }

  isHorseWithdrawn(raceNum: number, horseNum: number): boolean {
    const param = this.allParams.find(p => 
      p.raceNum === raceNum && p.horseNum === horseNum
    );
    return param?.special != null;
  }

  isBetBeforeSpecial(item: any): boolean {
    // Find any horse in the race that has a special date
    const raceParams = this.allParams.filter(p => p.raceNum === item.raceNum);
    
    for (const param of raceParams) {
      if (param.special) {
        const specialDate = new Date(param.special);
        const betTime = new Date(item.betTime || item.createdAt);
        if (betTime < specialDate) {
          return true;
        }
      }
    }
    return false;
  }

  isHorseRule4(raceNum: number, horseNum: number): boolean {
    const param = this.allParams.find(p => 
      p.raceNum === raceNum && p.horseNum === horseNum
    );
    return param?.rule4 != null;
  }

  hasRule4Applies(item: any): boolean {
    // Check if any horse in the race has a rule4 date after this bet was placed
    const raceParams = this.allParams.filter(p => p.raceNum === item.raceNum);
    const betTime = new Date(item.betTime || item.createdAt);
    
    for (const param of raceParams) {
      if (param.rule4) {
        const rule4Date = new Date(param.rule4);
        if (betTime < rule4Date) {
          return true;
        }
      }
    }
    return false;
  }

  printList() {
    window.print();
  }
}
