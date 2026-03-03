import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Shared data service that caches selectedRaces, params, and bets
 * across all tab components. Avoids redundant API calls when switching tabs.
 *
 * Call invalidateBets() after placing/cancelling/deleting a bet.
 * Call invalidateParams() after changing params/winners.
 * Call invalidateAll() after changing/selecting a meeting.
 */
@Injectable({ providedIn: 'root' })
export class MeetingDataService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api`;

  // Cached promises – multiple callers share the same in-flight request
  private _selectedRaces: Promise<any[]> | null = null;
  private _params: Promise<any[]> | null = null;
  private _bets: Promise<any[]> | null = null;
  private _lastBet: Promise<any> | null = null;
  private _meetingName = '';

  /** Selected races (cached). */
  getSelectedRaces(): Promise<any[]> {
    if (!this._selectedRaces) {
      this._selectedRaces = firstValueFrom(
        this.http.get<any[]>(`${this.apiUrl}/params/selected-races`)
      ).then(races => {
        if (races && races.length > 0) {
          this._meetingName = races[0].meetingName;
        }
        return races || [];
      }).catch(() => {
        this._selectedRaces = null;
        return [];
      });
    }
    return this._selectedRaces;
  }

  /** Params for the current meeting (cached). */
  async getParams(): Promise<any[]> {
    if (!this._meetingName) await this.getSelectedRaces();
    if (!this._params) {
      this._params = firstValueFrom(
        this.http.get<any[]>(
          `${this.apiUrl}/params?meetingName=${encodeURIComponent(this._meetingName)}`
        )
      ).then(p => p || []).catch(() => {
        this._params = null;
        return [];
      });
    }
    return this._params;
  }

  /** Bets for the current meeting (cached). */
  async getBets(): Promise<any[]> {
    if (!this._meetingName) await this.getSelectedRaces();
    if (!this._bets) {
      this._bets = firstValueFrom(
        this.http.get<any[]>(
          `${this.apiUrl}/bets?meetingName=${encodeURIComponent(this._meetingName)}`
        )
      ).then(b => b || []).catch(() => {
        this._bets = null;
        return [];
      });
    }
    return this._bets;
  }

  /** Last placed bet (cached). */
  getLastBet(): Promise<any> {
    if (!this._lastBet) {
      this._lastBet = firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/bets/last`)
      ).catch(() => {
        this._lastBet = null;
        return null;
      });
    }
    return this._lastBet;
  }

  /** Currently cached meeting name. */
  getMeetingName(): string {
    return this._meetingName;
  }

  /** Invalidate bets + lastBet caches (call after placing / cancelling / deleting a bet). */
  invalidateBets(): void {
    this._bets = null;
    this._lastBet = null;
  }

  /** Invalidate params cache (call after saving params or toggling winner). */
  invalidateParams(): void {
    this._params = null;
  }

  /** Invalidate everything (call after meeting/race changes). */
  invalidateAll(): void {
    this._selectedRaces = null;
    this._params = null;
    this._bets = null;
    this._lastBet = null;
    this._meetingName = '';
  }
}
