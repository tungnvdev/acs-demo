import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Room, User } from './communication.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  createRoom(hostName: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/rooms`, { hostName });
  }

  joinRoom(roomId: string, userName: string, isHost: boolean = false): Observable<any> {
    return this.http.post(`${this.baseUrl}/rooms/${roomId}/join`, { userName, isHost });
  }

  getRoom(roomId: string): Observable<Room> {
    return this.http.get<Room>(`${this.baseUrl}/rooms/${roomId}`);
  }

  approveUser(roomId: string, userId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/rooms/${roomId}/approve/${userId}`, {});
  }

  getWaitingList(roomId: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/rooms/${roomId}/waiting`);
  }

  endRoom(roomId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/rooms/${roomId}/end`, {});
  }

  leaveRoom(roomId: string, userId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/rooms/${roomId}/leave/${userId}`, {});
  }

  checkUserStatus(roomId: string, userId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/rooms/${roomId}/user/${userId}/status`);
  }
}
