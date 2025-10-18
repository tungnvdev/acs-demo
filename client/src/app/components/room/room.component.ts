import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CommunicationService } from '../../services/communication.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.scss']
})
export class RoomComponent implements OnInit, OnDestroy {
  roomId = '';
  userName = '';
  isHost = false;
  isInWaitingRoom = false;
  isMuted = false;
  isVideoOn = true;
  participants: any[] = [];
  waitingList: any[] = [];
  errorMessage = '';

  private token = '';
  private identity = '';
  private currentCall: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private communicationService: CommunicationService,
    private apiService: ApiService
  ) {}

  async ngOnInit() {
    this.route.params.subscribe(params => {
      this.roomId = params['id'];
    });

    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
      this.identity = params['identity'];
      this.isHost = params['isHost'] === 'true';
      this.userName = params['userName'];
      this.isInWaitingRoom = params['isInWaitingRoom'] === 'true';
    });

    if (this.isInWaitingRoom) {
      this.startWaitingRoomPolling();
    } else {
      await this.initializeCall();
    }
  }

  async ngOnDestroy() {
    if (this.currentCall) {
      await this.communicationService.leaveCall();
    }
  }

  private async initializeCall() {
    try {
      // Initialize communication service
      await this.communicationService.initialize(this.token);

      // Get devices
      const cameras = await this.communicationService.getCameras();
      const microphones = await this.communicationService.getMicrophones();

      if (cameras.length === 0 || microphones.length === 0) {
        this.errorMessage = 'Không tìm thấy camera hoặc microphone. Vui lòng kiểm tra thiết bị.';
        return;
      }

      // Start local streams
      const localVideoStream = await this.communicationService.startVideo(cameras[0]);
      const localAudioStream = await this.communicationService.startAudio(microphones[0]);

      // Join or start call
      if (this.isHost) {
        this.currentCall = await this.communicationService.startCall(this.roomId, localVideoStream, localAudioStream);
      } else {
        this.currentCall = await this.communicationService.joinCall(this.roomId, localVideoStream, localAudioStream);
      }

      this.setupCallEventHandlers();
      this.startRoomPolling();

    } catch (error) {
      console.error('Error initializing call:', error);
      this.errorMessage = 'Không thể khởi tạo cuộc gọi. Vui lòng thử lại.';
    }
  }

  private setupCallEventHandlers() {
    if (!this.currentCall) return;

    this.currentCall.on('remoteParticipantsUpdated', (e: any) => {
      this.participants = e.added.map((p: any) => ({
        id: p.identifier.communicationUserId,
        name: p.displayName || 'Unknown'
      }));
    });

    this.currentCall.on('stateChanged', (e: any) => {
      console.log('Call state changed:', e);
    });
  }

  private startWaitingRoomPolling() {
    setInterval(async () => {
      try {
        // Check if user is still in waiting room or has been approved
        const status = await this.apiService.checkUserStatus(this.roomId, this.identity).toPromise();
        
        if (status.isApproved && status.isInRoom) {
          // User has been approved, move them to the room
          this.isInWaitingRoom = false;
          console.log('User has been approved and can join the room!');
          // You can add logic here to start the video call
        } else if (status.isWaiting) {
          // User is still waiting
          console.log('User is still waiting for approval...');
        } else {
          // User not found or room not active
          const response = await this.apiService.getRoom(this.roomId).toPromise();
          if (response && !response.isActive) {
            this.router.navigate(['/']);
          }
        }
      } catch (error) {
        console.error('Error polling user status:', error);
      }
    }, 2000); // Check every 2 seconds
  }

  private startRoomPolling() {
    if (this.isHost) {
      setInterval(async () => {
        try {
          const result = await this.apiService.getWaitingList(this.roomId).toPromise();
          this.waitingList = result || [];
        } catch (error) {
          console.error('Error fetching waiting list:', error);
        }
      }, 2000);
    }
  }

  async toggleMute() {
    try {
      if (this.isMuted) {
        await this.communicationService.toggleUnmute();
        this.isMuted = false;
      } else {
        await this.communicationService.toggleMute();
        this.isMuted = true;
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  }

  async toggleVideo() {
    try {
      if (this.isVideoOn) {
        await this.communicationService.stopVideo();
        this.isVideoOn = false;
      } else {
        await this.communicationService.toggleVideo();
        this.isVideoOn = true;
      }
    } catch (error) {
      console.error('Error toggling video:', error);
    }
  }

  async approveUser(userId: string) {
    try {
      await this.apiService.approveUser(this.roomId, userId).toPromise();
      this.waitingList = this.waitingList.filter(user => user.id !== userId);
    } catch (error) {
      console.error('Error approving user:', error);
      this.errorMessage = 'Không thể phê duyệt người dùng. Vui lòng thử lại.';
    }
  }

  async leaveRoom() {
    try {
      await this.communicationService.leaveCall();
      await this.apiService.leaveRoom(this.roomId, this.identity).toPromise();
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Error leaving room:', error);
      this.router.navigate(['/']);
    }
  }

  async endRoom() {
    try {
      await this.communicationService.endCall();
      await this.apiService.endRoom(this.roomId).toPromise();
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Error ending room:', error);
      this.router.navigate(['/']);
    }
  }
}
