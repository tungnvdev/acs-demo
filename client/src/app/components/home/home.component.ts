import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CommunicationService } from '../../services/communication.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  hostName = '';
  roomId = '';
  userName = '';
  isCreating = false;
  isJoining = false;
  errorMessage = '';

  // Preview mode
  isPreviewMode = false;
  isPreviewActive = false;
  previewVideoStream: any = null;
  previewAudioStream: any = null;
  availableCameras: any[] = [];
  availableMicrophones: any[] = [];
  selectedCameraId = '';
  selectedMicrophoneId = '';

  constructor(
    private apiService: ApiService,
    private router: Router,
    private communicationService: CommunicationService
  ) {}

  async ngOnInit() {
    await this.loadAvailableDevices();
  }

  async ngOnDestroy() {
    await this.stopPreview();
  }

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
          userName: this.hostName,
          selectedCameraId: this.selectedCameraId,
          selectedMicrophoneId: this.selectedMicrophoneId
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
          isInWaitingRoom: response.isInWaitingRoom,
          selectedCameraId: this.selectedCameraId,
          selectedMicrophoneId: this.selectedMicrophoneId
        }
      });
    } catch (error) {
      this.errorMessage = 'Không thể tham gia phòng. Vui lòng kiểm tra ID phòng và thử lại.';
      console.error('Error joining room:', error);
    } finally {
      this.isJoining = false;
    }
  }

  async loadAvailableDevices() {
    try {
      // Get available devices without initializing communication service
      const cameras = await this.getDevices('videoinput');
      const microphones = await this.getDevices('audioinput');
      
      this.availableCameras = cameras.map((camera: any) => ({
        id: camera.deviceId,
        name: camera.label || `Camera ${camera.deviceId.substring(0, 8)}`
      }));
      
      this.availableMicrophones = microphones.map((mic: any) => ({
        id: mic.deviceId,
        name: mic.label || `Microphone ${mic.deviceId.substring(0, 8)}`
      }));
      
      // Set default selections
      if (this.availableCameras.length > 0) {
        this.selectedCameraId = this.availableCameras[0].id;
      }
      if (this.availableMicrophones.length > 0) {
        this.selectedMicrophoneId = this.availableMicrophones[0].id;
      }
      
      console.log('Available cameras:', this.availableCameras);
      console.log('Available microphones:', this.availableMicrophones);
      console.log('Selected camera ID:', this.selectedCameraId);
      console.log('Selected microphone ID:', this.selectedMicrophoneId);
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  }

  async getDevices(kind: string) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === kind);
    } catch (error) {
      console.error('Error getting devices:', error);
      return [];
    }
  }

  togglePreviewMode() {
    this.isPreviewMode = !this.isPreviewMode;
    if (this.isPreviewMode) {
      this.startPreview();
    } else {
      this.stopPreview();
    }
  }

  async startPreview() {
    try {
      this.isPreviewActive = true;
      
      // Get user media with selected devices
      const constraints: any = {
        video: {
          deviceId: this.selectedCameraId ? { exact: this.selectedCameraId } : undefined
        },
        audio: {
          deviceId: this.selectedMicrophoneId ? { exact: this.selectedMicrophoneId } : undefined
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Get video element
      const videoElement = document.getElementById('previewVideo') as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.play();
        console.log('Preview started successfully');
      }
      
      this.previewVideoStream = stream;
    } catch (error) {
      console.error('Error starting preview:', error);
      this.errorMessage = 'Không thể khởi tạo preview. Vui lòng kiểm tra quyền truy cập camera/microphone.';
      this.isPreviewActive = false;
    }
  }

  async stopPreview() {
    try {
      if (this.previewVideoStream) {
        this.previewVideoStream.getTracks().forEach((track: any) => {
          track.stop();
        });
        this.previewVideoStream = null;
      }
      
      const videoElement = document.getElementById('previewVideo') as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = null;
      }
      
      this.isPreviewActive = false;
      console.log('Preview stopped');
    } catch (error) {
      console.error('Error stopping preview:', error);
    }
  }

  async onCameraChange() {
    if (this.isPreviewActive) {
      await this.stopPreview();
      await this.startPreview();
    }
  }

  async onMicrophoneChange() {
    if (this.isPreviewActive) {
      await this.stopPreview();
      await this.startPreview();
    }
  }

  getSelectedCameraName(): string {
    const camera = this.availableCameras.find(c => c.id === this.selectedCameraId);
    return camera ? camera.name : 'Chưa chọn';
  }

  getSelectedMicrophoneName(): string {
    const microphone = this.availableMicrophones.find(m => m.id === this.selectedMicrophoneId);
    return microphone ? microphone.name : 'Chưa chọn';
  }
}
