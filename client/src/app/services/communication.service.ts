import { Injectable } from '@angular/core';
import { CallClient, CallAgent, DeviceManager, LocalVideoStream, LocalAudioStream, VideoStreamRenderer } from '@azure/communication-calling';
import { AzureCommunicationTokenCredential } from '@azure/communication-common';

export interface User {
  id: string;
  name: string;
  isHost: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
}

export interface Room {
  id: string;
  hostName: string;
  participantCount: number;
  waitingCount: number;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private callClient: CallClient | null = null;
  private callAgent: CallAgent | null = null;
  private deviceManager: DeviceManager | null = null;
  private currentCall: any = null;
  private localVideoStream: LocalVideoStream | null = null;
  private localAudioStream: LocalAudioStream | null = null;

  async initialize(token: string): Promise<void> {
    this.callClient = new CallClient();
    const tokenCredential = new AzureCommunicationTokenCredential(token);
    this.callAgent = await this.callClient.createCallAgent(tokenCredential);
    this.deviceManager = await this.callClient.getDeviceManager();
    await this.deviceManager.askDevicePermission({ audio: true, video: true });
  }

  async getCameras() {
    if (!this.deviceManager) return [];
    return await this.deviceManager.getCameras();
  }

  async getMicrophones() {
    if (!this.deviceManager) return [];
    return await this.deviceManager.getMicrophones();
  }

  async getSpeakers() {
    if (!this.deviceManager) return [];
    return await this.deviceManager.getSpeakers();
  }

  async startVideo(camera?: any): Promise<LocalVideoStream> {
    if (!this.deviceManager) throw new Error('Device manager not initialized');
    
    const cameras = await this.getCameras();
    const selectedCamera = camera || cameras[0];
    
    this.localVideoStream = new LocalVideoStream(selectedCamera);
    return this.localVideoStream;
  }

  async startAudio(microphone?: any): Promise<LocalAudioStream> {
    if (!this.deviceManager) throw new Error('Device manager not initialized');
    
    const microphones = await this.getMicrophones();
    const selectedMicrophone = microphone || microphones[0];
    
    this.localAudioStream = new LocalAudioStream(selectedMicrophone);
    return this.localAudioStream;
  }

  async joinCall(roomId: string, localVideoStream?: LocalVideoStream, localAudioStream?: LocalAudioStream) {
    if (!this.callAgent) throw new Error('Call agent not initialized');

    const callOptions: any = {
      videoOptions: localVideoStream ? { localVideoStreams: [localVideoStream] } : undefined,
      audioOptions: localAudioStream ? { localAudioStreams: [localAudioStream] } : undefined
    };

    this.currentCall = await this.callAgent.join({ roomId: roomId }, callOptions);
    // Set up event handlers for video streams
    this.setupVideoEventHandlers();
    
    return this.currentCall;
  }

  async startCall(roomId: string, localVideoStream?: LocalVideoStream, localAudioStream?: LocalAudioStream) {
    if (!this.callAgent) throw new Error('Call agent not initialized');

    const callOptions: any = {
      videoOptions: localVideoStream ? { localVideoStreams: [localVideoStream] } : undefined,
      audioOptions: localAudioStream ? { localAudioStreams: [localAudioStream] } : undefined
    };

    this.currentCall = await this.callAgent.join({ roomId: roomId }, callOptions);
    // Set up event handlers for video streams
    this.setupVideoEventHandlers();
    
    return this.currentCall;
  }

  private setupVideoEventHandlers() {
    if (!this.currentCall) return;

    // Handle call state changes
    this.currentCall.on('stateChanged', (e: any) => {
      console.log('Call state changed:', e);
    });

    // Handle remote participants
    this.currentCall.on('remoteParticipantsUpdated', (e: any) => {
      console.log('Remote participants updated:', e);
      e.added.forEach((participant: any) => {
        console.log('Added remote participant:', participant);
        this.setupParticipantEventHandlers(participant);
      });
    });
  }

  private setupParticipantEventHandlers(participant: any) {
    // Handle participant video streams
    participant.on('videoStreamsUpdated', (e: any) => {
      console.log('Participant video streams updated:', e);
      e.added.forEach((stream: any) => {
        console.log('Added participant video stream:', stream);
      });
    });

    // Handle participant state changes
    participant.on('stateChanged', (e: any) => {
      console.log('Participant state changed:', e);
    });
  }

  async toggleMute(): Promise<boolean> {
    if (!this.currentCall) return false;
    
    try {
      await this.currentCall.mute();
      return true;
    } catch (error) {
      console.error('Error toggling mute:', error);
      return false;
    }
  }

  async toggleUnmute(): Promise<boolean> {
    if (!this.currentCall) return false;
    
    try {
      await this.currentCall.unmute();
      return true;
    } catch (error) {
      console.error('Error toggling unmute:', error);
      return false;
    }
  }

  async toggleVideo(): Promise<boolean> {
    if (!this.currentCall || !this.localVideoStream) return false;
    
    try {
      await this.currentCall.startVideo(this.localVideoStream);
      return true;
    } catch (error) {
      console.error('Error toggling video:', error);
      return false;
    }
  }

  async stopVideo(): Promise<boolean> {
    if (!this.currentCall || !this.localVideoStream) return false;
    
    try {
      await this.currentCall.stopVideo(this.localVideoStream);
      return true;
    } catch (error) {
      console.error('Error stopping video:', error);
      return false;
    }
  }

  async leaveCall(): Promise<void> {
    if (this.currentCall) {
      await this.currentCall.hangUp();
      this.currentCall = null;
    }
  }

  async endCall(): Promise<void> {
    if (this.currentCall) {
      await this.currentCall.hangUp();
      this.currentCall = null;
    }
  }

  getCurrentCall() {
    return this.currentCall;
  }

  getLocalVideoStream() {
    return this.localVideoStream;
  }

  getLocalAudioStream() {
    return this.localAudioStream;
  }

}
