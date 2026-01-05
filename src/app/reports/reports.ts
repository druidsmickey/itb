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
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {
  private apiUrl = 'http://localhost:3000/api';
  
  allBets: any[] = [];
  allParams: any[] = [];
  clientReports: Map<string, ClientReport> = new Map();
  groupedItems: Map<string, any[]> = new Map();
  horseNamesByRace: string[][] = [];
  
  showSummaryOnly: boolean = false;
  filterClientName: string = '';
  meetingName: string = '';
  
  // Cache for special and rule4 dates
  private specialDates = new Map<string, Date>();
  private rule4Info = new Map<number, Array<{ date: Date; deduct: number }>>();

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    try {
      // Load params first to get meeting name
      const selectedRaces = await this.http.get<any[]>(`${this.apiUrl}/params/selected-races`).toPromise();
      
      if (!selectedRaces || selectedRaces.length === 0) {
        alert('No selected races found. Please select a meeting in the Init page first.');
        return;
      }
      
      this.meetingName = selectedRaces[0].meetingName;
      
      // Load params and bets
      const [params, bets] = await Promise.all([
        this.http.get<any[]>(`${this.apiUrl}/params?meetingName=${encodeURIComponent(this.meetingName)}`).toPromise(),
        this.http.get<any[]>(`${this.apiUrl}/bets?meetingName=${encodeURIComponent(this.meetingName)}`).toPromise()
      ]);
      
      this.allParams = params || [];
      this.allBets = bets || [];
      
      // Build special dates and rule4 info maps
      this.buildDateMaps();
      
      // Calculate reports
      this.calculateClientReports();
      this.groupBetsByClient();
      
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  buildDateMaps() {
    this.specialDates.clear();
    this.rule4Info.clear();
    
    // Build horse names array
    const maxRace = Math.max(...this.allParams.map(p => p.raceNum), 0);
    this.horseNamesByRace = Array.from({ length: maxRace }, () => []);
    
    this.allParams.forEach(param => {
      const key = `${param.raceNum}-${param.horseNum}`;
      
      // Store horse name
      if (param.raceNum > 0 && param.horseNum > 0) {
        const raceIndex = param.raceNum - 1;
        const horseIndex = param.horseNum - 1;
        if (!this.horseNamesByRace[raceIndex]) {
          this.horseNamesByRace[raceIndex] = [];
        }
        this.horseNamesByRace[raceIndex][horseIndex] = param.horseName || `Horse ${param.horseNum}`;
      }
      
      if (param.special) {
        this.specialDates.set(key, new Date(param.special));
      }
      
      if (param.rule4 && param.rule4deduct > 0) {
        if (!this.rule4Info.has(param.raceNum)) {
          this.rule4Info.set(param.raceNum, []);
        }
        this.rule4Info.get(param.raceNum)!.push({
          date: new Date(param.rule4),
          deduct: param.rule4deduct
        });
      }
    });
  }

  calculateClientReports() {
    this.clientReports.clear();
    
    // Process each bet
    this.allBets.forEach(bet => {
      if (bet.cancelled) return;
      
      const betTime = new Date(bet.betTime || bet.createdAt);
      const key = `${bet.raceNum}-${bet.horseNum}`;
      
      // Check if bet should be ignored due to special date
      const specialDate = this.specialDates.get(key);
      if (specialDate && betTime < specialDate) {
        return; // Ignore bets before special date
      }
      
      // Check if horse has rule4
      const hasRule4 = this.allParams.some(p => 
        p.raceNum === bet.raceNum && 
        p.horseNum === bet.horseNum && 
        p.rule4
      );
      
      // If horse withdrawn due to rule4 with betTime before rule4 date, ignore
      if (hasRule4) {
        const rule4s = this.rule4Info.get(bet.raceNum) || [];
        const firstRule4 = rule4s[0];
        if (firstRule4 && betTime < firstRule4.date) {
          return; // Ignore bets placed before rule4 (horse withdrawn)
        }
      }
      
      const clientName = bet.clientName || 'Unknown';
      
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
        const rule4s = this.rule4Info.get(bet.raceNum) || [];
        rule4s.forEach(r4 => {
          if (betTime < r4.date) {
            payout = payout * (1 - r4.deduct / 100);
          }
        });
        
        // Adjust for dead heat
        const winnerCount = this.allParams.filter(p => p.raceNum === bet.raceNum && p.winner).length;
        if (winnerCount > 1) {
          payout = payout / winnerCount;
        }
        
        report.totalPayout += payout;
      }
    });
    
    // Calculate profit/loss for each client: (stake + tax) - payout
    this.clientReports.forEach(report => {
      report.profitLoss = (report.totalStake + report.totalTax) - report.totalPayout;
    });
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
        const rule4s = this.rule4Info.get(bet.raceNum) || [];
        
        // Adjust for dead heat
        const winnerCount = this.allParams.filter(p => p.raceNum === bet.raceNum && p.winner).length;
        if (winnerCount > 1) {
          payout = payout / winnerCount;
        }
        
        rule4s.forEach(r4 => {
          if (betTime < r4.date) {
            payout = payout * (1 - r4.deduct / 100);
          }
        });
        
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

  compareKeysAsc(a: any, b: any): number {
    return a.key.localeCompare(b.key);
  }

  trackClientKey(index: number, item: any): string {
    return item.key;
  }

  trackItemId(index: number, item: any): string {
    return item._id || index.toString();
  }

  isSpecial(bet: any): boolean {
    // Check if any horse in the race has a special flag set
    return this.allParams.some(p => 
      p.raceNum === bet.raceNum && p.special != null
    );
  }

  isRule4(bet: any): boolean {
    // Check if the specific horse has rule4 flag set
    return this.allParams.some(p => 
      p.raceNum === bet.raceNum && 
      p.horseNum === bet.horseNum && 
      p.rule4 != null
    );
  }

  isWinner(bet: any): boolean {
    return this.allParams.some(p => 
      p.raceNum === bet.raceNum && 
      p.horseNum === bet.horseNum && 
      p.winner
    );
  }

  getWinnerStatus(bet: any): string {
    return 'Winner';
  }

  getDividedPayout(bet: any): number {
    let payout = bet.payout || 0;
    const betTime = new Date(bet.betTime || bet.createdAt);
    const rule4s = this.rule4Info.get(bet.raceNum) || [];
    
    rule4s.forEach(r4 => {
      if (betTime < r4.date) {
        payout = payout * (1 - r4.deduct / 100);
      }
    });
    
    return payout;
  }

  hasRule4Deduction(bet: any): boolean {
    const betTime = new Date(bet.betTime || bet.createdAt);
    const rule4s = this.rule4Info.get(bet.raceNum) || [];
    
    // Check if any rule4 deduction applies (bet was before rule4 date)
    return rule4s.some(r4 => betTime < r4.date);
  }

  getRule4Deductions(bet: any): string {
    const betTime = new Date(bet.betTime || bet.createdAt);
    const rule4s = this.rule4Info.get(bet.raceNum) || [];
    
    // Get all applicable deductions
    const deductions = rule4s
      .filter(r4 => betTime < r4.date)
      .map(r4 => `${r4.deduct}%`);
    
    return deductions.length > 0 ? `(${deductions.join(' ')})` : '';
  }

  printProfit() {
    window.print();
  }

  get filteredGroupedItems() {
    if (!this.filterClientName || this.filterClientName.trim() === '') {
      return this.groupedItems;
    }

    const filter = this.filterClientName.toLowerCase().trim();
    const filtered = new Map<string, any[]>();

    this.groupedItems.forEach((value, key) => {
      if (key.toLowerCase().includes(filter)) {
        filtered.set(key, value);
      }
    });

    return filtered;
  }

  hasActiveBets(bets: any[]): boolean {
    return bets.some(bet => !bet.cancelled && !this.shouldIgnoreBet(bet));
  }

  getWinnerCountForRace(raceNum: number): number {
    // Only count winners that are not special (withdrawn)
    return this.allParams.filter(p => {
      if (p.raceNum !== raceNum || !p.winner) return false;
      // Exclude if horse was made special (withdrawn)
      const key = `${p.raceNum}-${p.horseNum}`;
      const specialDate = this.specialDates.get(key);
      if (specialDate && p.special && new Date(p.special) <= specialDate) {
        return false;
      }
      return true;
    }).length;
  }

  isDeadHeat(bet: any): boolean {
    return this.getWinnerCountForRace(bet.raceNum) > 1;
  }

  getAdjustedPayout(bet: any): number {
    let payout = this.getDividedPayout(bet);
    const winnerCount = this.getWinnerCountForRace(bet.raceNum);
    
    if (winnerCount > 1) {
      payout = payout / winnerCount;
    }
    
    return payout;
  }
}
