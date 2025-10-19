import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommunicationService } from '../../services/communication.service';
import { ApiService } from '../../services/api.service';
import { VideoStreamRenderer } from '@azure/communication-calling';

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  // Device selection
  availableCameras: any[] = [];
  availableMicrophones: any[] = [];
  selectedCameraId = '';
  selectedMicrophoneId = '';
  isDeviceSelectionVisible = false;

  private token = '';
  private identity = '';
  private currentCall: any = null;
  private waitingRoomPollingInterval: any = null;
  private roomPollingInterval: any = null;

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
      
      // Get selected devices from query params
      if (params['selectedCameraId']) {
        this.selectedCameraId = params['selectedCameraId'];
      }
      if (params['selectedMicrophoneId']) {
        this.selectedMicrophoneId = params['selectedMicrophoneId'];
      }
    });

    // Load available devices
    await this.loadAvailableDevices();

    if (this.isInWaitingRoom) {
      this.startWaitingRoomPolling();
    } else {
      await this.initializeCall();
    }
  }

  async ngOnDestroy() {
    // Stop all polling
    this.stopWaitingRoomPolling();
    this.stopRoomPolling();
    
    // Leave call if active
    if (this.currentCall) {
      await this.communicationService.leaveCall();
    }
  }

  async loadAvailableDevices() {
    try {
      // Initialize communication service first
      await this.communicationService.initialize(this.token);
      
      // Get available devices
      const cameras = await this.communicationService.getCameras();
      const microphones = await this.communicationService.getMicrophones();
      
      this.availableCameras = cameras.map((camera: any) => ({
        id: camera.id,
        name: camera.name || `Camera ${camera.id.substring(0, 8)}`
      }));
      
      this.availableMicrophones = microphones.map((mic: any) => ({
        id: mic.id,
        name: mic.name || `Microphone ${mic.id.substring(0, 8)}`
      }));
      
      // Set selections - prioritize passed device IDs, fallback to first available
      if (this.availableCameras.length > 0) {
        if (!this.selectedCameraId || !this.availableCameras.find(c => c.id === this.selectedCameraId)) {
          this.selectedCameraId = this.availableCameras[0].id;
        }
      }
      if (this.availableMicrophones.length > 0) {
        if (!this.selectedMicrophoneId || !this.availableMicrophones.find(m => m.id === this.selectedMicrophoneId)) {
          this.selectedMicrophoneId = this.availableMicrophones[0].id;
        }
      }
      
      console.log('Available cameras:', this.availableCameras);
      console.log('Available microphones:', this.availableMicrophones);
      console.log('Selected camera ID:', this.selectedCameraId);
      console.log('Selected microphone ID:', this.selectedMicrophoneId);
    } catch (error) {
      console.error('Error loading devices:', error);
      this.errorMessage = 'Không thể tải danh sách thiết bị. Vui lòng thử lại.';
    }
  }

  toggleDeviceSelection() {
    this.isDeviceSelectionVisible = !this.isDeviceSelectionVisible;
  }

  async onCameraChange() {
    console.log('Camera changed to:', this.selectedCameraId);
    // Reinitialize call with new camera if call is active
    if (this.currentCall && !this.isInWaitingRoom) {
      await this.reinitializeCall();
    }
  }

  async onMicrophoneChange() {
    console.log('Microphone changed to:', this.selectedMicrophoneId);
    // Reinitialize call with new microphone if call is active
    if (this.currentCall && !this.isInWaitingRoom) {
      await this.reinitializeCall();
    }
  }

  async reinitializeCall() {
    try {
      // Leave current call
      if (this.currentCall) {
        await this.communicationService.leaveCall();
      }
      
      // Reinitialize with new devices
      await this.initializeCall();
    } catch (error) {
      console.error('Error reinitializing call:', error);
      this.errorMessage = 'Không thể thay đổi thiết bị. Vui lòng thử lại.';
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

      // Find selected devices
      const selectedCamera = cameras.find(c => c.id === this.selectedCameraId) || cameras[0];
      const selectedMicrophone = microphones.find(m => m.id === this.selectedMicrophoneId) || microphones[0];

      // Start local streams with selected devices
      console.log('Starting video with camera:', selectedCamera);
      console.log('Starting audio with microphone:', selectedMicrophone);
      
      const localVideoStream = await this.communicationService.startVideo(selectedCamera);
      const localAudioStream = await this.communicationService.startAudio(selectedMicrophone);
      
      console.log('Local video stream created:', localVideoStream);
      console.log('Local audio stream created:', localAudioStream);

      // Join or start call first
      if (this.isHost) {
        this.currentCall = await this.communicationService.startCall(this.roomId, localVideoStream, localAudioStream);
      } else {
        this.currentCall = await this.communicationService.joinCall(this.roomId, localVideoStream, localAudioStream);
      }

      console.log('Call established:', this.currentCall);

      // Set up event handlers first
      this.setupCallEventHandlers();

      // Wait for call to be in connected state before rendering video
      this.waitForCallConnected().then(async () => {
        console.log('Call is connected, rendering local video...');
        await this.renderLocalVideo(localVideoStream);
        
        // Check for existing participants
        await this.handleExistingParticipants();
      });

      // Also try to render video immediately as fallback
      setTimeout(async () => {
        console.log('Fallback: Attempting to render video after 2 seconds...');
        await this.renderLocalVideo(localVideoStream);
      }, 2000);

      this.startRoomPolling();

    } catch (error) {
      console.error('Error initializing call:', error);
      this.errorMessage = 'Không thể khởi tạo cuộc gọi. Vui lòng thử lại.';
    }
  }

  private waitForCallConnected(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.currentCall) {
        resolve();
        return;
      }

      // Check if already connected
      if (this.currentCall.state === 'Connected') {
        resolve();
        return;
      }

      // Wait for state change to Connected
      const stateChangeHandler = (e: any) => {
        console.log('Call state changed:', e);
        if (e.state === 'Connected') {
          this.currentCall.off('stateChanged', stateChangeHandler);
          resolve();
        }
      };

      this.currentCall.on('stateChanged', stateChangeHandler);

      // Fallback timeout after 10 seconds
      setTimeout(() => {
        this.currentCall?.off('stateChanged', stateChangeHandler);
        console.warn('Call connection timeout, proceeding with video render');
        resolve();
      }, 10000);
    });
  }

  private async renderLocalVideo(localVideoStream: any) {
    try {
      console.log('Attempting to render local video...');
      console.log('Local video stream:', localVideoStream);
      
      // Get the preview container
      const previewContainer = document.getElementById('localVideo');
      console.log('Preview container found:', !!previewContainer);
      
      if (previewContainer && localVideoStream) {
        // Clear any existing content
        previewContainer.innerHTML = '';
        
        console.log('Creating VideoStreamRenderer...');
        // Create video stream renderer
        const renderer = new VideoStreamRenderer(localVideoStream);
        console.log('VideoStreamRenderer created:', renderer);
        
        console.log('Creating view...');
        const view = await renderer.createView();
        console.log('View created:', view);
        
        // Append the view to the container
        previewContainer.appendChild(view.target);
        console.log('View appended to container');
        
        console.log('Local video stream rendered successfully');
      } else {
        console.warn('Local video container or stream not found');
        console.warn('Container:', previewContainer);
        console.warn('Stream:', localVideoStream);
      }
    } catch (error) {
      console.error('Error rendering local video:', error);
      this.errorMessage = 'Không thể hiển thị video. Vui lòng thử lại.';
    }
  }

  private async getParticipantDisplayName(participant: any): Promise<string> {
    // Try multiple ways to get the participant name
    console.log('Getting display name for participant:', participant);
    
    // Method 1: Check if displayName is directly available
    if (participant.displayName && participant.displayName.trim() !== '') {
      console.log('Found displayName:', participant.displayName);
      return participant.displayName;
    }
    
    // Method 2: Check if there's a name property
    if (participant.name && participant.name.trim() !== '') {
      console.log('Found name:', participant.name);
      return participant.name;
    }
    
    // Method 3: Try to get name from API using communicationUserId
    if (participant.identifier && participant.identifier.communicationUserId) {
      try {
        console.log('Fetching participant name from API for userId:', participant.identifier.communicationUserId);
        const response = await this.apiService.getParticipant(this.roomId, participant.identifier.communicationUserId).toPromise();
        
        if (response && response.found && response.user && response.user.name) {
          console.log('Found participant name from API:', response.user.name);
          return response.user.name;
        }
      } catch (error) {
        console.warn('Failed to fetch participant name from API:', error);
      }
      
      // Fallback to using portion of communicationUserId
      const userId = participant.identifier.communicationUserId;
      console.log('Using communicationUserId portion:', userId);
      return `User ${userId.substring(0, 8)}`;
    }
    
    // Method 4: Check if there's a userPrincipalName in identifier
    if (participant.identifier && participant.identifier.userPrincipalName) {
      console.log('Found userPrincipalName:', participant.identifier.userPrincipalName);
      return participant.identifier.userPrincipalName;
    }
    
    // Method 5: Check if there's a phoneNumber
    if (participant.identifier && participant.identifier.phoneNumber) {
      console.log('Found phoneNumber:', participant.identifier.phoneNumber);
      return participant.identifier.phoneNumber;
    }
    
    // Final fallback
    console.log('No name found, using default');
    return 'Unknown Participant';
  }

  private async handleExistingParticipants() {
    if (!this.currentCall) return;
    
    console.log('Checking for existing participants...');
    const remoteParticipants = this.currentCall.remoteParticipants;
    console.log('Existing remote participants:', remoteParticipants);
    
    for (const participant of remoteParticipants) {
      console.log('Processing existing participant:', participant);
      const participantName = await this.getParticipantDisplayName(participant);
      console.log('Existing participant name resolved to:', participantName);
      
      // Set up participant event handlers
      this.setupParticipantEventHandlers(participant);
      
      // Render participant (with or without video)
      const videoStream = participant.videoStreams && participant.videoStreams.length > 0 ? participant.videoStreams[0] : null;
      this.renderRemoteVideo(videoStream, participant.identifier.communicationUserId, participantName);
    }
  }

  private setupParticipantEventHandlers(participant: any) {
    // Handle participant video streams
    participant.on('videoStreamsUpdated', async (e: any) => {
      console.log('Participant video streams updated:', e);
      const participantName = await this.getParticipantDisplayName(participant);
      
      e.added.forEach((stream: any) => {
        console.log('Added participant video stream:', stream);
        this.renderRemoteVideo(stream, participant.identifier.communicationUserId, participantName);
      });
      
      e.removed.forEach((stream: any) => {
        console.log('Removed participant video stream:', stream);
        // Video stream was removed, but keep the participant container with name
        const videoContainerDiv = document.getElementById(`remoteVideo-${participant.identifier.communicationUserId}`);
        if (videoContainerDiv) {
          // Remove video element but keep the container and label
          const videoElement = videoContainerDiv.querySelector('video');
          if (videoElement) {
            videoElement.remove();
          }
        }
      });
    });

    // Handle participant state changes
    participant.on('stateChanged', (e: any) => {
      console.log('Participant state changed:', e);
    });
  }

  private setupCallEventHandlers() {
    if (!this.currentCall) return;

    this.currentCall.on('remoteParticipantsUpdated', async (e: any) => {
      console.log('Remote participants updated:', e);
      // Handle video streams for each participant
      for (const participant of e.added) {
        console.log('Added participant details:', participant);
        const participantName = await this.getParticipantDisplayName(participant);
        console.log('Participant name resolved to:', participantName);
        
        // Set up participant event handlers
        this.setupParticipantEventHandlers(participant);
        
        // Render participant (with or without video)
        const videoStream = participant.videoStreams && participant.videoStreams.length > 0 ? participant.videoStreams[0] : null;
        this.renderRemoteVideo(videoStream, participant.identifier.communicationUserId, participantName);
      }
      e.removed.forEach((participant: any) => {
        let videoContainerDiv = document.getElementById(`remoteVideo-${participant.identifier.communicationUserId}`);
        if(videoContainerDiv){
          videoContainerDiv.remove();
        }
      });
    });

    this.currentCall.on('stateChanged', (e: any) => {
      console.log('Call state changed:', e);
    });
  }

  private async renderRemoteVideo(remoteVideoStream: any, participantId: string, name: string) {
    try {
      console.log(`Rendering remote video for participant: ${participantId}, name: ${name}`);
      
      // Check if video container already exists
      let videoContainerDiv = document.getElementById(`remoteVideo-${participantId}`);
      
      if (!videoContainerDiv) {
        // Create a new video container for remote participant
        const remoteVideosContainer = document.getElementById('remoteVideos');
        if (remoteVideosContainer) {
          videoContainerDiv = document.createElement('div');
          videoContainerDiv.id = `remoteVideo-${participantId}`;
          videoContainerDiv.className = 'video-container !min-w-[270px]';
          
          // Add label first (even without video)
          const label = document.createElement('div');
          label.className = 'video-label text-white absolute bottom-0';
          label.textContent = `${name}`;
          videoContainerDiv.appendChild(label);
          
          remoteVideosContainer.appendChild(videoContainerDiv);
          
          // Only render video if stream is available
          if (remoteVideoStream) {
            try {
              // Clear any existing video content
              const existingVideo = videoContainerDiv.querySelector('video');
              if (existingVideo) {
                existingVideo.remove();
              }
              
              // Create video stream renderer
              const renderer = new VideoStreamRenderer(remoteVideoStream);
              const view = await renderer.createView();
              
              // Append the view to the container
              videoContainerDiv.appendChild(view.target);
              
              console.log(`Remote video stream rendered for participant: ${participantId}`);
            } catch (videoError) {
              console.warn(`Could not render video for participant ${participantId}:`, videoError);
              // Still show the participant name even if video fails
            }
          } else {
            console.log(`No video stream available for participant: ${participantId}, showing name only`);
          }
        }
      } else {
        // Update existing container with new name
        const existingLabel = videoContainerDiv.querySelector('.video-label');
        if (existingLabel) {
          existingLabel.textContent = name;
        } else {
          const label = document.createElement('div');
          label.className = 'video-label text-white absolute bottom-0';
          label.textContent = `${name}`;
          videoContainerDiv.appendChild(label);
        }
      }
      
    } catch (error) {
      console.error('Error rendering remote video:', error);
    }
  }

  private startWaitingRoomPolling() {
    this.waitingRoomPollingInterval = setInterval(async () => {
      try {
        // Check if user is still in waiting room or has been approved
        const status = await this.apiService.checkUserStatus(this.roomId, this.identity).toPromise();
        
        if (status.isApproved && status.isInRoom) {
          // User has been approved, move them to the room
          this.isInWaitingRoom = false;
          console.log('User has been approved and can join the room!');
          
          // Stop polling
          this.stopWaitingRoomPolling();
          
          // Initialize the call
          await this.initializeCall();
        } else if (status.isWaiting) {
          // User is still waiting
          console.log('User is still waiting for approval...');
        } else {
          // User not found or room not active
          const response = await this.apiService.getRoom(this.roomId).toPromise();
          if (response && !response.isActive) {
            this.stopWaitingRoomPolling();
            this.router.navigate(['/']);
          }
        }
      } catch (error) {
        console.error('Error polling user status:', error);
      }
    }, 2000); // Check every 2 seconds
  }

  private stopWaitingRoomPolling() {
    if (this.waitingRoomPollingInterval) {
      clearInterval(this.waitingRoomPollingInterval);
      this.waitingRoomPollingInterval = null;
      console.log('Waiting room polling stopped');
    }
  }

  private startRoomPolling() {
    if (this.isHost) {
      this.roomPollingInterval = setInterval(async () => {
        try {
          const result = await this.apiService.getWaitingList(this.roomId).toPromise();
          this.waitingList = result || [];
        } catch (error) {
          console.error('Error fetching waiting list:', error);
        }
      }, 2000);
    }
  }

  private stopRoomPolling() {
    if (this.roomPollingInterval) {
      clearInterval(this.roomPollingInterval);
      this.roomPollingInterval = null;
      console.log('Room polling stopped');
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
      // Stop all polling
      this.stopWaitingRoomPolling();
      this.stopRoomPolling();
      
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
      // Stop all polling
      this.stopWaitingRoomPolling();
      this.stopRoomPolling();
      
      await this.communicationService.endCall();
      await this.apiService.endRoom(this.roomId).toPromise();
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Error ending room:', error);
      this.router.navigate(['/']);
    }
  }

  async refreshParticipantNames() {
    try {
      console.log('Refreshing participant names...');
      
      if (!this.currentCall) {
        console.log('No active call, cannot refresh participant names');
        return;
      }

      const remoteParticipants = this.currentCall.remoteParticipants;
      console.log('Refreshing names for participants:', remoteParticipants);

      for (const participant of remoteParticipants) {
        const participantName = await this.getParticipantDisplayName(participant);
        console.log(`Refreshed name for participant ${participant.identifier.communicationUserId}: ${participantName}`);
        
        // Update the video container label
        const videoContainerDiv = document.getElementById(`remoteVideo-${participant.identifier.communicationUserId}`);
        if (videoContainerDiv) {
          const existingLabel = videoContainerDiv.querySelector('.video-label');
          if (existingLabel) {
            existingLabel.textContent = participantName;
          } else {
            const label = document.createElement('div');
            label.className = 'video-label text-white absolute bottom-0';
            label.textContent = participantName;
            videoContainerDiv.appendChild(label);
          }
        }
      }
      
      console.log('Participant names refreshed successfully');
    } catch (error) {
      console.error('Error refreshing participant names:', error);
    }
  }
}

