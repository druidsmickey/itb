import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface ClientReport {
  clientName: string;
  totalStake: number;
  totalTax: number;
  totalPayout: number;
  profitLoss: number;
}

@Component({
  selector: 'app-merge',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './merge.html',
  styleUrl: './merge.css',
})
export class Merge implements OnInit {
  private apiUrl = 'http://localhost:3000/api';
  
  allMeetings: string[] = [];
  selectedMeetings: string[] = [];
  
  allBets: any[] = [];
  allParams: any[] = [];
  clientReports: Map<string, ClientReport> = new Map();
  groupedItems: Map<string, any[]> = new Map();
  horseNamesByRace: Map<string, string[][]> = new Map(); // keyed by meetingName
  
  showSummaryOnly: boolean = false;
  filterClientName: string = '';
  
  // Cache for special and rule4 dates per meeting
  private specialDates = new Map<string, Date>(); // key: meetingName-raceNum-horseNum
  private rule4Info = new Map<string, Array<{ date: Date; deduct: number }>>(); // key: meetingName-raceNum

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadMeetings();
  }

  async loadMeetings() {
    try {
      const meetings = await this.http.get<string[]>(`${this.apiUrl}/meetings`).toPromise();
      this.allMeetings = meetings || [];
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading meetings:', error);
    }
  }

  toggleMeeting(meeting: string) {
    const index = this.selectedMeetings.indexOf(meeting);
    if (index === -1) {
      if (this.selectedMeetings.length >= 4) {
        alert('You can select up to 4 meetings only');
        return;
      }
      this.selectedMeetings.push(meeting);
    } else {
      this.selectedMeetings.splice(index, 1);
    }
    this.cdr.detectChanges();
  }

  isMeetingSelected(meeting: string): boolean {
    return this.selectedMeetings.includes(meeting);
  }

  async loadData() {
    if (this.selectedMeetings.length === 0) {
      alert('Please select at least one meeting');
      return;
    }

    try {
      this.allBets = [];
      this.allParams = [];
      this.horseNamesByRace.clear();
      
      // Load data for each selected meeting
      for (const meetingName of this.selectedMeetings) {
        const [params, bets] = await Promise.all([
          this.http.get<any[]>(`${this.apiUrl}/params?meetingName=${encodeURIComponent(meetingName)}`).toPromise(),
          this.http.get<any[]>(`${this.apiUrl}/bets?meetingName=${encodeURIComponent(meetingName)}`).toPromise()
        ]);
        
        this.allParams.push(...(params || []));
        this.allBets.push(...(bets || []));
      }
      
      // Build date maps and horse names
      this.buildDateMaps();
      
      // Calculate reports
      this.calculateClientReports();
      this.groupBetsByClient();
      
      // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 0);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  buildDateMaps() {
    this.specialDates.clear();
    this.rule4Info.clear();
    
    // Group params by meeting
    const paramsByMeeting = new Map<string, any[]>();
    this.allParams.forEach(param => {
      if (!paramsByMeeting.has(param.meetingName)) {
        paramsByMeeting.set(param.meetingName, []);
      }
      paramsByMeeting.get(param.meetingName)!.push(param);
    });
    
    // Build horse names array per meeting
    paramsByMeeting.forEach((params, meetingName) => {
      const maxRace = Math.max(...params.map(p => p.raceNum), 0);
      const horseNames: string[][] = Array.from({ length: maxRace }, () => []);
      
      params.forEach(param => {
        const key = `${meetingName}-${param.raceNum}-${param.horseNum}`;
        
        // Store horse name
        if (param.raceNum > 0 && param.horseNum > 0) {
          const raceIndex = param.raceNum - 1;
          const horseIndex = param.horseNum - 1;
          if (!horseNames[raceIndex]) {
            horseNames[raceIndex] = [];
          }
          horseNames[raceIndex][horseIndex] = param.horseName || `Horse ${param.horseNum}`;
        }
        
        if (param.special) {
          this.specialDates.set(key, new Date(param.special));
        }
        
        if (param.rule4 && param.rule4deduct > 0) {
          const raceKey = `${meetingName}-${param.raceNum}`;
          if (!this.rule4Info.has(raceKey)) {
            this.rule4Info.set(raceKey, []);
          }
          this.rule4Info.get(raceKey)!.push({
            date: new Date(param.rule4),
            deduct: param.rule4deduct
          });
        }
      });
      
      this.horseNamesByRace.set(meetingName, horseNames);
    });
  }

  calculateClientReports() {
    this.clientReports.clear();
    
    // Process each bet
    this.allBets.forEach(bet => {
      if (bet.cancelled) return;
      
      const betTime = new Date(bet.betTime || bet.createdAt);
      const clientName = bet.clientName || 'Unknown';
      
      // Check if bet should be ignored
      if (this.shouldIgnoreBet(bet)) {
        return;
      }
      
      if (!this.clientReports.has(clientName)) {
        this.clientReports.set(clientName, {
          clientName,
          totalStake: 0,
          totalTax: 0,
          totalPayout: 0,
          profitLoss: 0
        });
      }
      
      const report = this.clientReports.get(clientName)!;
      
      // Calculate stake (negative for purchase)
      const stake = bet.stake || 0;
      report.totalStake += stake;
      
      // Calculate tax: (tax% / 100) * stake (negative for purchase)
      const taxAmount = ((bet.tax || 0) / 100) * stake;
      report.totalTax += taxAmount;
      
      // Calculate payout with rule4 deductions (only for winners)
      if (this.isWinner(bet)) {
        let payout = bet.payout || 0;
        
        // Apply rule4 deductions that occurred AFTER this bet was placed
        const raceKey = `${bet.meetingName}-${bet.raceNum}`;
        const rule4s = this.rule4Info.get(raceKey) || [];
        rule4s.forEach(r4 => {
          if (betTime < r4.date) {
            payout = payout * (1 - r4.deduct / 100);
          }
        });
        
        // Adjust for dead heat
        const winnerCount = this.allParams.filter(p => 
          p.meetingName === bet.meetingName && 
          p.raceNum === bet.raceNum && 
          p.winner &&
          !this.isHorseSpecial(p)
        ).length;
        if (winnerCount > 1) {
          payout = payout / winnerCount;
        }
        
        report.totalPayout += payout;
      }
    });
    
    // Calculate P/L for each client
    this.clientReports.forEach(report => {
      report.profitLoss = (report.totalStake + report.totalTax) - report.totalPayout;
    });
  }

  isHorseSpecial(param: any): boolean {
    const specialDate = this.specialDates.get(`${param.meetingName}-${param.raceNum}-${param.horseNum}`);
    return specialDate != null;
  }

  groupBetsByClient() {
    this.groupedItems.clear();
    
    this.allBets.forEach(bet => {
      const clientName = bet.clientName || 'Unknown';
      if (!this.groupedItems.has(clientName)) {
        this.groupedItems.set(clientName, []);
      }
      this.groupedItems.get(clientName)!.push({
        ...bet,
        date: new Date(bet.betTime || bet.createdAt)
      });
    });
    
    // Sort bets by date within each client group
    this.groupedItems.forEach((bets, clientName) => {
      bets.sort((a, b) => b.date.getTime() - a.date.getTime());
    });
  }

  get filteredGroupedItems() {
    if (!this.filterClientName?.trim()) {
      return this.groupedItems;
    }
    
    const filtered = new Map<string, any[]>();
    const searchTerm = this.filterClientName.trim().toLowerCase();
    
    this.groupedItems.forEach((bets, clientName) => {
      if (clientName.toLowerCase().includes(searchTerm)) {
        filtered.set(clientName, bets);
      }
    });
    
    return filtered;
  }

  getFilteredGroupedItemsArray() {
    const items = this.filteredGroupedItems;
    const array = Array.from(items.entries()).map(([key, value]) => ({ key, value }));
    return array.sort((a, b) => a.key.localeCompare(b.key));
  }

  getStakeAmountForGroup(bets: any[]): number {
    return bets
      .filter(bet => !bet.cancelled && !this.shouldIgnoreBet(bet))
      .reduce((sum, bet) => sum + (bet.stake || 0), 0);
  }

  getTaxAmountForGroup(bets: any[]): number {
    return bets
      .filter(bet => !bet.cancelled && !this.shouldIgnoreBet(bet))
      .reduce((sum, bet) => {
        const stake = bet.stake || 0;
        const taxAmount = ((bet.tax || 0) / 100) * stake;
        return sum + taxAmount;
      }, 0);
  }

  getProfitLossForGroupByMeeting(bets: any[], meetingName: string): number {
    let totalStake = 0;
    let totalPayout = 0;
    let totalTax = 0;
    
    bets.forEach(bet => {
      if (bet.cancelled || this.shouldIgnoreBet(bet) || bet.meetingName !== meetingName) return;
      
      const stake = bet.stake || 0;
      totalStake += stake;
      
      const taxAmount = ((bet.tax || 0) / 100) * stake;
      totalTax += taxAmount;
      
      // Calculate payout with rule4 deductions (only for winners)
      if (this.isWinner(bet)) {
        let payout = bet.payout || 0;
        const betTime = new Date(bet.betTime || bet.createdAt);
        const raceKey = `${bet.meetingName}-${bet.raceNum}`;
        const rule4s = this.rule4Info.get(raceKey) || [];
        
        rule4s.forEach(r4 => {
          if (betTime < r4.date) {
            payout = payout * (1 - r4.deduct / 100);
          }
        });
        
        // Adjust for dead heat
        const winnerCount = this.allParams.filter(p => 
          p.meetingName === bet.meetingName && 
          p.raceNum === bet.raceNum && 
          p.winner &&
          !this.isHorseSpecial(p)
        ).length;
        if (winnerCount > 1) {
          payout = payout / winnerCount;
        }
        
        totalPayout += payout;
      }
    });
    
    return (totalStake + totalTax) - totalPayout;
  }

  getProfitLossForGroup(bets: any[]): number {
    let totalStake = 0;
    let totalPayout = 0;
    let totalTax = 0;
    
    bets.forEach(bet => {
      if (bet.cancelled || this.shouldIgnoreBet(bet)) return;
      
      const stake = bet.stake || 0;
      totalStake += stake;
      
      const taxAmount = ((bet.tax || 0) / 100) * stake;
      totalTax += taxAmount;
      
      // Calculate payout with rule4 deductions (only for winners)
      if (this.isWinner(bet)) {
        let payout = bet.payout || 0;
        const betTime = new Date(bet.betTime || bet.createdAt);
        const raceKey = `${bet.meetingName}-${bet.raceNum}`;
        const rule4s = this.rule4Info.get(raceKey) || [];
        
        rule4s.forEach(r4 => {
          if (betTime < r4.date) {
            payout = payout * (1 - r4.deduct / 100);
          }
        });
        
        // Adjust for dead heat
        const winnerCount = this.allParams.filter(p => 
          p.meetingName === bet.meetingName && 
          p.raceNum === bet.raceNum && 
          p.winner &&
          !this.isHorseSpecial(p)
        ).length;
        if (winnerCount > 1) {
          payout = payout / winnerCount;
        }
        
        totalPayout += payout;
      }
    });
    
    return (totalStake + totalTax) - totalPayout;
  }

  shouldIgnoreBet(bet: any): boolean {
    // Ignore bets that are marked as With-Sp or With-R4
    if (this.isSpecial(bet) || this.isRule4(bet)) {
      return true;
    }
    
    return false;
  }

  getNetTotalTaxAmount(): number {
    let total = 0;
    this.clientReports.forEach(report => {
      if (report.profitLoss > 0) {
        total += report.totalTax;
      }
    });
    return total;
  }

  getNetTotalProfitLoss(): number {
    let total = 0;
    this.clientReports.forEach(report => {
      if (report.profitLoss > 0) {
        total += report.profitLoss;
      }
    });
    return total;
  }

  getNetTotalTaxAmountLoss(): number {
    let total = 0;
    this.clientReports.forEach(report => {
      if (report.profitLoss < 0) {
        total += report.totalTax;
      }
    });
    return total;
  }

  getNetTotalLoss(): number {
    let total = 0;
    this.clientReports.forEach(report => {
      if (report.profitLoss < 0) {
        total += Math.abs(report.profitLoss);
      }
    });
    return total;
  }

  getNetTotalProfitLossByMeeting(meetingName: string): number {
    let total = 0;
    this.groupedItems.forEach((bets, clientName) => {
      const pl = this.getProfitLossForGroupByMeeting(bets, meetingName);
      if (pl > 0) {
        total += pl;
      }
    });
    return total;
  }

  getNetTotalLossByMeeting(meetingName: string): number {
    let total = 0;
    this.groupedItems.forEach((bets, clientName) => {
      const pl = this.getProfitLossForGroupByMeeting(bets, meetingName);
      if (pl < 0) {
        total += Math.abs(pl);
      }
    });
    return total;
  }

  Math = Math;

  compareKeysAsc = (a: any, b: any) => {
    return a.key.localeCompare(b.key);
  };

  trackClientKey(index: number, item: any): string {
    return item.key;
  }

  trackItemId(index: number, item: any): string {
    return item._id || index.toString();
  }

  isSpecial(bet: any): boolean {
    // Check if any horse in the race has a special flag set
    return this.allParams.some(p => 
      p.meetingName === bet.meetingName &&
      p.raceNum === bet.raceNum && 
      p.special != null
    );
  }

  isRule4(bet: any): boolean {
    // Check if the specific horse has rule4 flag set
    return this.allParams.some(p => 
      p.meetingName === bet.meetingName &&
      p.raceNum === bet.raceNum && 
      p.horseNum === bet.horseNum && 
      p.rule4 != null
    );
  }

  isWinner(bet: any): boolean {
    return this.allParams.some(p => 
      p.meetingName === bet.meetingName &&
      p.raceNum === bet.raceNum && 
      p.horseNum === bet.horseNum && 
      p.winner
    );
  }

  getDividedPayout(bet: any): number {
    let payout = bet.payout || 0;
    const betTime = new Date(bet.betTime || bet.createdAt);
    const raceKey = `${bet.meetingName}-${bet.raceNum}`;
    const rule4s = this.rule4Info.get(raceKey) || [];
    
    rule4s.forEach(r4 => {
      if (betTime < r4.date) {
        payout = payout * (1 - r4.deduct / 100);
      }
    });
    
    return payout;
  }

  hasRule4Deduction(bet: any): boolean {
    const betTime = new Date(bet.betTime || bet.createdAt);
    const raceKey = `${bet.meetingName}-${bet.raceNum}`;
    const rule4s = this.rule4Info.get(raceKey) || [];
    
    return rule4s.some(r4 => betTime < r4.date);
  }

  getRule4Deductions(bet: any): string {
    const betTime = new Date(bet.betTime || bet.createdAt);
    const raceKey = `${bet.meetingName}-${bet.raceNum}`;
    const rule4s = this.rule4Info.get(raceKey) || [];
    
    const deductions = rule4s
      .filter(r4 => betTime < r4.date)
      .map(r4 => `${r4.deduct}%`);
    
    return deductions.length > 0 ? `(${deductions.join(' ')})` : '';
  }

  hasActiveBets(bets: any[]): boolean {
    return bets.some(bet => !bet.cancelled && !this.shouldIgnoreBet(bet));
  }

  getWinnerCountForRace(bet: any): number {
    // Only count winners that are not special (withdrawn)
    return this.allParams.filter(p => {
      if (p.meetingName !== bet.meetingName || p.raceNum !== bet.raceNum || !p.winner) return false;
      // Exclude if horse was made special (withdrawn)
      return !this.isHorseSpecial(p);
    }).length;
  }

  isDeadHeat(bet: any): boolean {
    return this.getWinnerCountForRace(bet) > 1;
  }

  getAdjustedPayout(bet: any): number {
    let payout = this.getDividedPayout(bet);
    const winnerCount = this.getWinnerCountForRace(bet);
    
    if (winnerCount > 1) {
      payout = payout / winnerCount;
    }
    
    return payout;
  }

  getHorseName(bet: any): string {
    const horseNames = this.horseNamesByRace.get(bet.meetingName);
    if (!horseNames) return '-';
    const raceIndex = bet.raceNum - 1;
    const horseIndex = bet.horseNum - 1;
    return horseNames[raceIndex]?.[horseIndex] || '-';
  }

  printProfit() {
    window.print();
  }
}
