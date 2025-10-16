import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  hostName = '';
  roomId = '';
  userName = '';
  isCreating = false;
  isJoining = false;
  errorMessage = '';

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit() {}

  async createRoom() {
    if (!this.hostName.trim()) return;
    
    this.isCreating = true;
    this.errorMessage = '';
    
    try {
      const response = await this.apiService.createRoom(this.hostName).toPromise();
      this.router.navigate(['/room', response.roomId], { 
        queryParams: { 
          token: response.hostToken,
          identity: response.hostIdentity,
          isHost: true,
          userName: this.hostName
        }
      });
    } catch (error) {
      this.errorMessage = 'Không thể tạo phòng. Vui lòng thử lại.';
      console.error('Error creating room:', error);
    } finally {
      this.isCreating = false;
    }
  }

  async joinRoom() {
    if (!this.roomId.trim() || !this.userName.trim()) return;
    
    this.isJoining = true;
    this.errorMessage = '';
    
    try {
      const response = await this.apiService.joinRoom(this.roomId, this.userName).toPromise();
      this.router.navigate(['/room', this.roomId], { 
        queryParams: { 
          token: response.userToken,
          identity: response.userIdentity,
          isHost: false,
          userName: this.userName,
          isInWaitingRoom: response.isInWaitingRoom
        }
      });
    } catch (error) {
      this.errorMessage = 'Không thể tham gia phòng. Vui lòng kiểm tra ID phòng và thử lại.';
      console.error('Error joining room:', error);
    } finally {
      this.isJoining = false;
    }
  }
}
