import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Client, IMessage } from '@stomp/stompjs';

const BASE_URI: string = 'ws://localhost:8080';
const workspaceId: number = 1;

interface Message {
  messageType: 'TALK' | 'ENTER' | 'EXIT';
  message: string;
  senderName: string;
}

interface BubbleProps {
  messageType: 'TALK' | 'ENTER' | 'EXIT';
  message: string;
  senderName: string;
}

interface WebRTCSignalDTO {
  peerId: string;
  sdp?: string;
  candidate?: string;
}

const Bubble: React.FC<BubbleProps> = ({ messageType, message, senderName }) => {
  if (messageType === 'ENTER' || messageType === 'EXIT') {
    return <p>{message}</p>;
  }
  if (messageType === 'TALK') {
    return (
        <div style={{ margin: '16px 0' }}>
          <p style={{ margin: '0' }}>{senderName}</p>
          <p style={{ backgroundColor: '#eee', width: 'fit-content', padding: '4px 8px', borderRadius: '8px', margin: '0' }}>{message}</p>
        </div>
    );
  }
  return null;
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]); // 채팅 메시지 목록
  const [inputMessage, setInputMessage] = useState(''); // 사용자가 입력한 채팅 메시지
  const [isConnected, setIsConnected] = useState(false); // WebSocket 연결 상태
  const [subscriberCount, setSubscriberCount] = useState(0); // 현재 채팅을 구독하고 있는 사용자 수
  const clientRef = useRef<Client | null>(null); // WebSocket 클라이언트를 참조

  const localStreamRef = useRef<MediaStream | null>(null); // 로컬 오디오 스트림을 참조
  const remoteStreams = useRef<{ [key: string]: MediaStream }>({}); // 원격 사용자 오디오 스트림 참조
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({}); // 피어 연결 관리 객체 참조

  const [peerId, setPeerId] = useState<string>(''); // 고유한 peerId 생성

  useEffect(() => {
    const client: any = new Client({
      brokerURL: `${BASE_URI}/api/ws`,
      debug: (str) => {
        console.debug(str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: (frame) => handleWebSocketConnect(client, frame),
      onDisconnect: () => handleWebSocketDisconnect(client),
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
      },
      onWebSocketError: (event) => {
        console.error('WebSocket error', event);
      },
      onWebSocketClose: () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        handleWebSocketDisconnect(client);
      },
      beforeConnect: () => {
        console.log('Attempting to connect...');
      },
    });

    client.activate();
    clientRef.current = client;

    // Handle window unload event
    const handleBeforeUnload = () => {
      if (clientRef.current) {
        clientRef.current.publish({
          destination: `/api/pub/webrtc/${workspaceId}/leave`,
          body: JSON.stringify({ peerId }),
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleWebSocketConnect = (client: Client, frame: any) => {
    setIsConnected(true); // WebSocket 연결 상태를 true로 설정
    const sessionId = frame.headers['user-name'];
    setPeerId(sessionId);
    console.log(`Connected with session ID: ${sessionId}`);

    client.subscribe(`/api/sub/chat/${workspaceId}`, (message: IMessage) => {
      const newMessage = JSON.parse(message.body) as Message;
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    });

    client.subscribe(`/api/sub/chat/${workspaceId}/count`, (message: IMessage) => {
      setSubscriberCount(parseInt(message.body, 10));
    });

    client.subscribe(`/api/sub/webrtc/${workspaceId}/offer`, (message: IMessage) => {
      console.log('Received offer', message.body);
      handleReceiveOffer(JSON.parse(message.body) as WebRTCSignalDTO);
    });

    client.subscribe(`/api/sub/webrtc/${workspaceId}/answer`, (message: IMessage) => {
      console.log('Received answer', message.body);
      handleReceiveAnswer(JSON.parse(message.body) as WebRTCSignalDTO);
    });

    client.subscribe(`/api/sub/webrtc/${workspaceId}/ice-candidate`, (message: IMessage) => {
      console.log('Received ICE candidate', message.body);
      handleReceiveIceCandidate(JSON.parse(message.body) as WebRTCSignalDTO);
    });

    client.subscribe(`/api/sub/webrtc/${workspaceId}/peers`, (message: IMessage) => {
      const peers = JSON.parse(message.body) as string[];
      console.log('Updated peer list', peers);
      callAllUsers(peers);
    });

    client.publish({
      destination: `/api/pub/chat/${workspaceId}`,
      body: JSON.stringify({
        messageType: 'ENTER',
        message: '',
        senderName: sessionId
      }),
    });

    client.publish({
      destination: `/api/pub/chat/${workspaceId}/count`,
      body: '',
    });

    // 서버에 현재 피어 ID 등록
    client.publish({
      destination: `/api/pub/webrtc/${workspaceId}/join`,
      body: JSON.stringify({ peerId: sessionId }),
    });

    // 로컬 오디오 스트림을 시작합니다.
    startLocalStream();
  };

  const handleWebSocketDisconnect = (client: Client) => {
    setIsConnected(false); // WebSocket 연결 상태를 false로 설정
    stopLocalStream(); // 로컬 오디오 스트림 정지

    // 서버에 현재 피어 ID 등록 해제
    if (client) {
      console.log(`Sending leave message for peerId: ${peerId}`);
      client.publish({
        destination: `/api/pub/webrtc/${workspaceId}/leave`,
        body: JSON.stringify({ peerId }),
      });

      client.deactivate(); // WebSocket 클라이언트 비활성화하여 연결 종료
    }
  };

  const startLocalStream = async () => {
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true }); // 사용자에게 오디오 접근 권한을 요청
      localStreamRef.current = localStream;
      console.log('Local stream started');
    } catch (error: any) {
      console.error('Error accessing local media:', error);
      alert(`Error accessing local media: ${error.message}`);
    }
  };

  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  };

  const setupPeerConnection = (peerId: string) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    peerConnections.current[peerId] = peerConnection;

    peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        console.log(`ICE candidate generated for peer ${peerId}:`, event.candidate);
        sendMessage(`/api/pub/webrtc/${workspaceId}/ice-candidate`, JSON.stringify({ peerId: peerId, candidate: JSON.stringify(event.candidate), sdp: '' }));
      }
    };

    peerConnection.ontrack = event => {
      if (!remoteStreams.current[peerId]) {
        remoteStreams.current[peerId] = new MediaStream();
        const remoteAudio = document.createElement('audio');
        remoteAudio.id = `remoteAudio-${peerId}`;
        remoteAudio.autoplay = true;
        document.body.appendChild(remoteAudio);
        remoteAudio.srcObject = remoteStreams.current[peerId];
      }
      console.log(`Track received from peer ${peerId}:`, event.track);
      remoteStreams.current[peerId].addTrack(event.track);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`Adding track to peer ${peerId}:`, track);
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    return peerConnection;
  };

  const handleReceiveOffer = async (data: WebRTCSignalDTO) => {
    const { peerId, sdp } = data;
    console.log(`Handling offer from peer ${peerId}`, data);
    const peerConnection = setupPeerConnection(peerId); // 피어 연결 설정
    await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdp! })); // SDP 설정
    const answer = await peerConnection.createAnswer();  // answer 생성 및 상대방에게 전송
    await peerConnection.setLocalDescription(answer);
    sendMessage(`/api/pub/webrtc/${workspaceId}/answer`, JSON.stringify({ peerId, sdp: answer.sdp, candidate: '' }));
  };

  const handleReceiveAnswer = async (data: WebRTCSignalDTO) => {
    const { peerId, sdp } = data;
    console.log(`Handling answer from peer ${peerId}`, data);
    const peerConnection = peerConnections.current[peerId];
    await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sdp! })); // Remote SDP 설정
  };

  const handleReceiveIceCandidate = async (data: WebRTCSignalDTO) => {
    const { peerId, candidate } = data;
    console.log(`Handling ICE candidate from peer ${peerId}`, data);
    const peerConnection = peerConnections.current[peerId];
    await peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate!))); // ICE candidate 추가
  };

  const sendMessage = (destination: string, body: string) => {
    if (clientRef.current && isConnected) {
      console.log(`Sending message to ${destination}:`, body);
      clientRef.current.publish({ destination, body });
    }
  };

  const callAllUsers = async (peerIds: string[]) => {
    console.log('Calling all users:', peerIds);
    for (const id of peerIds) {
      if (id !== peerId) {
        callUser(id);
      }
    }
  };

  const callUser = async (peerId: string) => {
    const peerConnection = setupPeerConnection(peerId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendMessage(`/api/pub/webrtc/${workspaceId}/offer`, JSON.stringify({ peerId: peerId, sdp: offer.sdp, candidate: '' }));
  };

  const handleSendMessage = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputMessage.trim() || !isConnected || !clientRef.current) {
      return;
    }

    clientRef.current.publish({
      destination: `/api/pub/chat/${workspaceId}`,
      body: JSON.stringify({
        messageType: 'TALK',
        message: inputMessage,
        senderName: peerId
      }),
    });

    setInputMessage('');
  };

  return (
      <div>
        <div>
          <div>
            채팅 (<span>{subscriberCount}</span>)
          </div>

          <input type="text" name="" id="" placeholder="Search" />

          <div>
            {messages.length === 0 ? (
                <p>채팅을 시작해보세요</p>
            ) : (
                messages.map((msg, index) => (
                    <Bubble
                        key={index}
                        messageType={msg.messageType}
                        message={msg.message}
                        senderName={msg.senderName}
                    />
                ))
            )}
          </div>

          <form onSubmit={handleSendMessage}>
            <input
                type="text"
                name="message"
                placeholder="채팅을 입력하세요"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
            />
            <input type="submit" value="SEND" />
          </form>
        </div>
        <div id="remoteAudios"></div>
      </div>
  );
};

export default App;