"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useSocket } from '@/hooks/useSocket';
import { config } from '@/lib/config';

interface VoiceRoomProps {
  currentChannel: any;
  onBack: () => void;
}

const VoiceRoom: React.FC<VoiceRoomProps> = ({ currentChannel, onBack }) => {
  const {
    isInCall,
    isJoiningCall,
    joinCall,
    leaveCall,
    toggleMute,
    setLocalStream,
    currentUser,
    remoteStreams,
    removeRemoteStream,
    addRemoteStream,
    updateChannelCallStatus,
    updateMemberCallStatus
  } = useChatStore();
  
  const [echoEnabled, setEchoEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteVolume, setRemoteVolume] = useState(0);
  const [remoteVolumeControl, setRemoteVolumeControl] = useState(() => {
    const savedVolume = localStorage.getItem('remoteVolume');
    return savedVolume ? parseFloat(savedVolume) : 1.0;
  });
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hideVolumeSliderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const peerConnections = useRef<Map<number, RTCPeerConnection>>(new Map());
  const iceCandidateQueues = useRef<Map<number, RTCIceCandidate[]>>(new Map());
  
  const {
    isConnected,
    emit,
    on
  } = useSocket({
    url: config.api.socketUrl,
    autoConnect: true
  });
  
  const initAudioAnalyser = useCallback((stream: MediaStream) => {
    try {
      cleanupAudioAnalyser();
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const gainNode = audioContext.createGain();
      gainNode.gain.value = remoteVolumeControl;
      gainNodeRef.current = gainNode;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(audioContext.destination);
      
      startAnalysingVolume();
    } catch (error) {
      console.error('初始化音频分析器失败:', error);
    }
  }, [remoteVolumeControl]);
  
  const startAnalysingVolume = useCallback(() => {
    if (!analyserRef.current) return;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    if (analyserIntervalRef.current) {
      clearInterval(analyserIntervalRef.current);
    }
    
    analyserIntervalRef.current = setInterval(() => {
      analyser.getByteTimeDomainData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = (dataArray[i] - 128) / 128;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / bufferLength);
      
      setRemoteVolume(rms);
    }, 100);
  }, []);
  
  const cleanupAudioAnalyser = useCallback(() => {
    if (analyserIntervalRef.current) {
      clearInterval(analyserIntervalRef.current);
      analyserIntervalRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    gainNodeRef.current = null;
    setRemoteVolume(0);
  }, []);
  
  const cleanupPeerConnection = useCallback((userId: number) => {
    const peerConnection = peerConnections.current.get(userId);
    if (peerConnection) {
      try {
        // 使用现代的 getSenders() 方法替代已废弃的 getLocalStreams()
        const senders = peerConnection.getSenders();
        senders.forEach(sender => {
          if (sender.track) {
            sender.track.stop();
          }
        });
        
        peerConnection.close();
      } catch (error) {
        console.error('关闭对等连接失败:', error);
      }
      peerConnections.current.delete(userId);
    }
    
    iceCandidateQueues.current.delete(userId);
    removeRemoteStream(userId);
    
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, [removeRemoteStream]);
  
  const handleJoinCall = useCallback(async () => {
    if (!currentChannel || currentChannel.type !== 'voice' || !currentUser) {
      return;
    }
    
    try {
      joinCall();
      emit('join-channel', currentChannel.id);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
        localAudioRef.current.muted = !echoEnabled;
      }
      
      emit('voice:join', {
        channelId: currentChannel.id,
        userId: currentUser.id
      });
      
      setLocalStream(stream);
    } catch (error) {
      leaveCall();
    }
  }, [currentChannel, currentUser, joinCall, leaveCall, setLocalStream, echoEnabled, emit]);
  
  const handleLeaveCall = useCallback(() => {
    if (!currentChannel || currentChannel.type !== 'voice' || !currentUser) return;
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    emit('voice:leave', {
      channelId: currentChannel.id,
      userId: currentUser.id
    });
    
    leaveCall();
    cleanupAudioAnalyser();
    
    peerConnections.current.forEach((_, userId) => {
      cleanupPeerConnection(userId);
    });
    peerConnections.current.clear();
    iceCandidateQueues.current.clear();
  }, [currentChannel, currentUser, leaveCall, cleanupAudioAnalyser, cleanupPeerConnection, emit]);
  
  const handleToggleMute = useCallback(() => {
    toggleMute();
    const newIsMuted = !isMuted;
    setIsMuted(newIsMuted);
    
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newIsMuted;
      });
    }
  }, [isMuted, toggleMute]);
  
  const handleToggleEcho = useCallback(() => {
    const newEchoEnabled = !echoEnabled;
    setEchoEnabled(newEchoEnabled);
    if (localAudioRef.current) {
      localAudioRef.current.muted = !newEchoEnabled;
    }
  }, [echoEnabled]);
  
  const handleVolumeChange = useCallback((value: number) => {
    const clampedValue = Math.max(0, Math.min(2.0, value));
    setRemoteVolumeControl(clampedValue);
    
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = clampedValue;
    }
    
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = Math.min(1, clampedValue);
    }
    
    localStorage.setItem('remoteVolume', clampedValue.toString());
  }, []);
  
  useEffect(() => {
    if (remoteStreams && remoteStreams.size > 0) {
      remoteStreams.forEach((stream, userId) => {
        if (stream && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          initAudioAnalyser(stream);
        }
      });
    } else {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      cleanupAudioAnalyser();
    }
  }, [remoteStreams, initAudioAnalyser, cleanupAudioAnalyser]);
  
  useEffect(() => {
    if (!currentChannel || currentChannel.type !== 'voice') return;
    
    const handleVoiceUserJoined = async (data: any) => {
      if (!currentUser || !data.userId || data.userId === currentUser.id) return;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      
      const peerConnection = new RTCPeerConnection({
        iceServers: config.webrtc.iceServers
      });
      
      peerConnections.current.set(data.userId, peerConnection);
      
      if (stream) {
        stream.getTracks().forEach(track => {
          peerConnection.addTrack(track, stream);
        });
      }
      
      if (peerConnection) {
              peerConnection.ontrack = (event) => {
                if (event.streams && event.streams.length > 0) {
                  const stream = event.streams[0];
                  addRemoteStream(data.senderId, stream);
                  
                  if (remoteAudioRef.current) {
                    remoteAudioRef.current.srcObject = stream;
                    remoteAudioRef.current.muted = false;
                    remoteAudioRef.current.volume = 1.0;
                  }
                }
              };
            }
      
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          emit('voice:signal', {
            channelId: currentChannel?.id,
            type: 'ice-candidate',
            candidate: event.candidate,
            senderId: currentUser?.id
          });
        }
      };
      
      peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'disconnected') {
          setTimeout(() => {
            if (peerConnection.iceConnectionState !== 'connected' && peerConnection.iceConnectionState !== 'completed') {
              if (currentUser && currentChannel) {
                peerConnection.createOffer().then(offer => {
                  return peerConnection.setLocalDescription(offer);
                }).then(() => {
                  emit('voice:signal', {
                    channelId: currentChannel?.id,
                    type: 'offer',
                    offer: peerConnection.localDescription,
                    senderId: currentUser?.id
                  });
                }).catch(() => {});
              }
            }
          }, 2000);
        }
      };
      
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      emit('voice:signal', {
        channelId: currentChannel?.id,
        type: 'offer',
        offer: offer,
        senderId: currentUser?.id
      });
    };
    
    const handleVoiceUserLeft = (data: any) => {
      if (data.userId) {
        cleanupPeerConnection(data.userId);
      }
    };
    
    const handleVoiceSignal = async (data: any) => {
      if (!currentUser || !data || !data.senderId) return;
      
      try {
        let peerConnection = peerConnections.current.get(data.senderId);
        
        if (data.type === 'offer') {
          if (!peerConnection) {
            peerConnection = new RTCPeerConnection({
              iceServers: config.webrtc.iceServers
            });
            
            peerConnections.current.set(data.senderId, peerConnection);
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            
            if (stream && peerConnection) {
              const pc = peerConnection!;
              stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
              });
              
              pc.ontrack = (event) => {
                if (event.streams && event.streams.length > 0) {
                  const stream = event.streams[0];
                  addRemoteStream(data.senderId, stream);
                  
                  if (remoteAudioRef.current) {
                    remoteAudioRef.current.srcObject = stream;
                    remoteAudioRef.current.muted = false;
                    remoteAudioRef.current.volume = 1.0;
                    remoteAudioRef.current.play().catch(error => {
                      console.error('播放远程音频失败:', error);
                    });
                  }
                }
              };
              
              pc.onicecandidate = (event) => {
                if (event.candidate) {
                  emit('voice:signal', {
                    channelId: currentChannel?.id,
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    senderId: currentUser?.id
                  });
                }
              };
              
              if (data.offer) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                
                const queuedCandidates = iceCandidateQueues.current.get(data.senderId);
                if (queuedCandidates && queuedCandidates.length > 0) {
                  for (const candidate of queuedCandidates) {
                    try {
                      await pc.addIceCandidate(candidate);
                    } catch (error) {
                      console.error('处理队列中的ICE候选失败:', error);
                    }
                  }
                  iceCandidateQueues.current.set(data.senderId, []);
                }
                
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                
                emit('voice:signal', {
                  channelId: currentChannel?.id,
                  type: 'answer',
                  answer: answer,
                  senderId: currentUser?.id
                });
              }
            }
          }
        } else if (data.type === 'answer') {
          if (peerConnection && peerConnection.signalingState === 'have-local-offer' && data.answer) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            
            const queuedCandidates = iceCandidateQueues.current.get(data.senderId);
            if (queuedCandidates && queuedCandidates.length > 0) {
              for (const candidate of queuedCandidates) {
                try {
                  await peerConnection.addIceCandidate(candidate);
                } catch (error) {
                  console.error('处理队列中的ICE候选失败:', error);
                }
              }
              iceCandidateQueues.current.set(data.senderId, []);
            }
          }
        } else if (data.type === 'ice-candidate') {
          if (peerConnection && data.candidate) {
            if (peerConnection.remoteDescription) {
              try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
              } catch {
                // 忽略ICE候选添加失败
              }
            } else {
              if (!iceCandidateQueues.current.has(data.senderId)) {
                iceCandidateQueues.current.set(data.senderId, []);
              }
              try {
                const candidate = new RTCIceCandidate(data.candidate);
                iceCandidateQueues.current.get(data.senderId)?.push(candidate);
              } catch {
                // 忽略ICE候选创建失败
              }
            }
          }
        }
      } catch {
        // 忽略WebRTC错误
      }
    };
    
    const handleVoiceStatusUpdated = (data: any) => {
      if (data.channelId && data.isInCall !== undefined && data.callMembers !== undefined) {
        updateChannelCallStatus(data.channelId, data.isInCall, data.callMembers);
      }
      
      if (data.userId !== undefined && data.isInCall !== undefined) {
        updateMemberCallStatus(data.userId, data.isInCall);
      }
    };
    
    const unsubscribeVoiceUserJoined = on('voice:user-joined', handleVoiceUserJoined);
    const unsubscribeVoiceUserLeft = on('voice:user-left', handleVoiceUserLeft);
    const unsubscribeVoiceSignal = on('voice:signal', handleVoiceSignal);
    const unsubscribeVoiceStatusUpdated = on('voice:status-updated', handleVoiceStatusUpdated);
    
    return () => {
      unsubscribeVoiceUserJoined();
      unsubscribeVoiceUserLeft();
      unsubscribeVoiceSignal();
      unsubscribeVoiceStatusUpdated();
      
      peerConnections.current.forEach((_, userId) => {
        cleanupPeerConnection(userId);
      });
      peerConnections.current.clear();
      iceCandidateQueues.current.clear();
      
      cleanupAudioAnalyser();
    };
  }, [currentChannel, currentUser, addRemoteStream, updateChannelCallStatus, updateMemberCallStatus, cleanupPeerConnection, cleanupAudioAnalyser, emit, on]);
  
  const VolumeControl = () => {
    const [isDragging, setIsDragging] = useState(false);
    
    const handleMouseEnter = () => {
      if (hideVolumeSliderTimeoutRef.current) {
        clearTimeout(hideVolumeSliderTimeoutRef.current);
        hideVolumeSliderTimeoutRef.current = null;
      }
      setShowVolumeSlider(true);
    };
    
    const handleMouseLeave = () => {
      if (!isDragging) {
        hideVolumeSliderTimeoutRef.current = setTimeout(() => {
          setShowVolumeSlider(false);
          hideVolumeSliderTimeoutRef.current = null;
        }, 300);
      }
    };
    
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      setIsDragging(true);
      calculateVolume(e);
    };
    
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) {
        calculateVolume(e);
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setTimeout(() => {
        if (!isDragging) {
          handleMouseLeave();
        }
      }, 100);
    };
    
    const calculateVolume = (e: React.MouseEvent<HTMLDivElement>) => {
      const volumeBar = e.currentTarget;
      const rect = volumeBar.getBoundingClientRect();
      const height = rect.height;
      const bottom = rect.bottom;
      const clientY = e.clientY;
      
      let volume = (bottom - clientY) / height;
      volume = Math.max(0, Math.min(1, volume)) * 2;
      
      handleVolumeChange(volume);
    };
    
    return (
      <div 
        className="relative group"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex flex-col items-center">
          <button
            className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors flex items-center justify-center transform hover:scale-105"
            title="调整音量"
            onClick={() => setShowVolumeSlider(!showVolumeSlider)}
          >
            🔊
          </button>
          
          {showVolumeSlider && (
            <div 
              className="absolute bottom-full mb-1 z-50"
              style={{
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '4px',
                borderRadius: '8px'
              }}
            >
              <div className="bg-gray-800 p-2 rounded-lg shadow-lg border border-gray-700">
                <div
                  className="relative w-3 h-24 rounded-lg bg-gray-700 cursor-pointer"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-green-500 rounded-lg transition-all duration-100 ease-out"
                    style={{
                      height: `${(remoteVolumeControl / 2) * 100}%`
                    }}
                  />
                  <div
                    className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-700 shadow-md transition-all duration-100 ease-out"
                    style={{
                      bottom: `${(remoteVolumeControl / 2) * 100}%`,
                      marginTop: '-4px'
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full">
      <audio id="localAudio" ref={localAudioRef} autoPlay className="hidden" />
      <audio id="remoteAudio" ref={remoteAudioRef} autoPlay className="hidden" />
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <div className="text-4xl mb-4">🎤</div>
          <h3 className="text-lg font-medium mb-2">语音频道</h3>
          <p className="text-center max-w-md">
            这是一个语音频道，你可以通过下方的电话按钮加入通话
          </p>
        </div>
      </div>
      
      <div className="p-4 border-t border-gray-700 bg-gray-800">
        {isInCall ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="flex items-center gap-2 w-full max-w-md">
              <span className="text-sm text-gray-400">远程音量:</span>
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all duration-100 ease-out"
                  style={{ width: `${Math.min(remoteVolume * 100, 100)}%` }}
                ></div>
              </div>
              <span className="text-sm text-gray-400 min-w-[40px] text-right">
                {Math.round(remoteVolume * 100)}%
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleMute}
                className={`p-3 ${isMuted ? 'bg-red-700' : 'bg-gray-700'} hover:${isMuted ? 'bg-red-600' : 'bg-gray-600'} rounded-full transition-colors flex items-center justify-center transform hover:scale-105`}
                title={isMuted ? '取消静音' : '静音'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
              <button
                onClick={handleToggleEcho}
                className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors flex items-center justify-center transform hover:scale-105"
                title={echoEnabled ? '关闭本地回拨' : '开启本地回拨'}
              >
                {echoEnabled ? '🔊' : '🔇'}
              </button>
              <VolumeControl />
              <button
                onClick={handleLeaveCall}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors transform hover:scale-105"
              >
                结束通话
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleJoinCall}
              disabled={isJoiningCall}
              className={`px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors transform hover:scale-105 ${isJoiningCall ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isJoiningCall ? '加入中...' : '📞 加入通话'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceRoom;