import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface User {
  id: string;
  username: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

const AUTH_TOKEN_TTL = 2 * 60 * 1000;
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.initializeAuth();
    this.setupActivityTracking();
  }

  private initializeAuth(): void {
    const token = this.getToken();
    const lastActivity = localStorage.getItem('lastActivity');

    if (token && lastActivity) {
      const timeDiff = Date.now() - parseInt(lastActivity);

      if (timeDiff > AUTH_TOKEN_TTL) {
        this.logout();
      } else {
        const userStr = localStorage.getItem('currentUser');
        if (userStr) {
          this.currentUserSubject.next(JSON.parse(userStr));
        }
        this.updateActivity();
      }
    }
  }

  private lastUpdateTime = 0;
  private readonly UPDATE_THROTTLE = 10000; // Only update activity every 10 seconds

  private setupActivityTracking(): void {
    const throttledUpdate = () => {
      const now = Date.now();
      if (now - this.lastUpdateTime > this.UPDATE_THROTTLE) {
        this.updateActivity();
        this.lastUpdateTime = now;
      }
    };

    window.addEventListener('focus', throttledUpdate);
    window.addEventListener('blur', throttledUpdate);

    document.addEventListener('mousemove', throttledUpdate);
    document.addEventListener('keypress', throttledUpdate);
    document.addEventListener('click', throttledUpdate);
    document.addEventListener('scroll', throttledUpdate);

    setInterval(() => this.checkActivity(), 30000); // Check every 30 seconds
  }

  private updateActivity(): void {
    if (this.isLoggedIn()) {
      localStorage.setItem('lastActivity', Date.now().toString());
    }
  }

  private checkActivity(): void {
    if (!this.isLoggedIn()) return;

    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity) {
      const timeDiff = Date.now() - parseInt(lastActivity);

      if (timeDiff > AUTH_TOKEN_TTL) {
        this.logout();
      }
    }
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, { username, password })
      .pipe(
        tap((response) => {
          localStorage.setItem('token', response.token);
          localStorage.setItem('currentUser', JSON.stringify(response.user));
          this.updateActivity();
          this.currentUserSubject.next(response.user);
        })
      );
  }

  changePassword(
    currentPassword: string,
    newPassword: string
  ): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  logout(): void {
    localStorage.clear();
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
