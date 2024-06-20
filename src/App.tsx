import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import AudioCapture from './AudioCapture';

const BASE_URI: string = 'ws://localhost:8080';
const workspaceId: number = 1;

interface Participant {
  id: string;
  name: string;
}

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
  // const [isMuted, setIsMuted] = useState(false); // 로컬 마이크의 음소거 상태

  const clientRef = useRef<Client | null>(null); // WebSocket 클라이언트를 참조
  const localStreamRef = useRef<MediaStream | null>(null); // 로컬 오디오 스트림을 참조
  const remoteStreams = useRef<{ [key: string]: MediaStream }>({}); // 원격 사용자 오디오 스트림 참조
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({}); // 피어 연결 관리 객체 참조

  const [participants, setParticipants] = useState<Participant[]>([]);

  // 예를 들어, WebSocket을 통해 새로운 참가자가 들어왔을 때 participants 상태를 업데이트할 수 있습니다.
  useEffect(() => {
    // WebSocket 또는 다른 방법으로 새로운 참가자가 들어왔을 때 participants를 업데이트하는 로직을 작성합니다.
    // 예시로 초기에 몇 명의 참가자를 가정합니다.
    setParticipants([
      { id: '1', name: 'Participant 1' },
      { id: '2', name: 'Participant 2' },
    ]);
  }, []);

  // WebSocket 클라이언트 초기화 및 연결 설정
  useEffect(() => {
    const client = new Client({
      brokerURL: `${BASE_URI}/api/ws`,
      debug: (str) => {
        console.debug(str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => handleWebSocketConnect(client),
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
      },
      beforeConnect: () => {
        console.log('Attempting to connect...');
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, []);

  // WebSocket 연결 성공 시 처리
  const handleWebSocketConnect = (client: Client) => {
    setIsConnected(true); // WebSocket 연결 상태를 true로 설정

    client.subscribe(`/api/sub/chat/${workspaceId}`, (message: IMessage) => {
      const newMessage = JSON.parse(message.body) as Message;
      setMessages((prevMessages) => [...prevMessages, newMessage]);

      const newParticipant = JSON.stringify({
        id: '3',
        name: 'Participant 3',
      })
      setParticipants((prevParticipants) => [...prevParticipants, newParticipant]);
    });

    client.subscribe(`/api/sub/chat/${workspaceId}/count`, (message: IMessage) => {
      setSubscriberCount(parseInt(message.body, 10));
    });

    client.subscribe(`/api/sub/webrtc/${workspaceId}/offer`, (message: IMessage) => {
      handleReceiveOffer(JSON.parse(message.body));
    });

    client.subscribe(`/api/sub/webrtc/${workspaceId}/answer`, (message: IMessage) => {
      handleReceiveAnswer(JSON.parse(message.body));
    });

    client.subscribe(`/api/sub/webrtc/${workspaceId}/ice-candidate`, (message: IMessage) => {
      handleReceiveIceCandidate(JSON.parse(message.body));
    });

    client.publish({
      destination: `/api/pub/chat/${workspaceId}`,
      body: JSON.stringify({
        messageType: 'ENTER',
        message: ''
      }),
    });

    client.publish({
      destination: `/api/pub/chat/${workspaceId}/count`,
      body: '',
    });

    // 로컬 오디오 스트림을 시작하고, 다른 사용자들에게 음성 통화 요청
    startLocalStream().then(() => {
      // 다른 사용자에게 통화 시작 알림
      callAllUsers();
    });
  };

  // WebSocket 연결 종료 시 처리
  const handleWebSocketDisconnect = (client: Client) => {
    setIsConnected(false); // WebSocket 연결 상태를 false로 설정
    stopLocalStream(); // 로컬 오디오 스트림 정지
    client.deactivate(); // WebSocket 클라이언트 비활성화하여 연결 종료
  };

  // 로컬 오디오 스트림 가져오기
  const startLocalStream = async () => {
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true }); // 사용자에게 오디오 접근 권한을 요청
      localStreamRef.current = localStream;
    } catch (error) {
      console.error('Error accessing local media:', error);
      alert(`Error accessing local media: ${error.message}`);
    }
  };

  // 로컬 오디오 스트림 정지
  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  };

  // 피어 연결 설정 및 ICE candidate 이벤트 핸들링 (특정 사용자와의 피어 연결을 설정)
  const setupPeerConnection = (peerId: string) => {
    // RTCPeerConnection 객체를 생성 및 ICE 서버 설정
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    peerConnections.current[peerId] = peerConnection;

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        sendMessage(`/api/pub/webrtc/${workspaceId}/ice-candidate`, JSON.stringify({ peerId, candidate: event.candidate }));
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
      remoteStreams.current[peerId].addTrack(event.track);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    return peerConnection;
  };

  // Offer 수신 처리
  const handleReceiveOffer = async (data: { peerId: string, sdp: RTCSessionDescriptionInit }) => {
    const { peerId, sdp } = data;
    const peerConnection = setupPeerConnection(peerId); // 피어 연결 설정
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp)); // SDP 설정
    const answer = await peerConnection.createAnswer();  // answer 생성 및 상대방에게 전송
    await peerConnection.setLocalDescription(answer);
    sendMessage(`/api/pub/webrtc/${workspaceId}/answer`, JSON.stringify({ peerId, sdp: answer }));
  };

  // Answer 수신 처리
  const handleReceiveAnswer = async (data: { peerId: string, sdp: RTCSessionDescriptionInit }) => {
    const { peerId, sdp } = data;
    const peerConnection = peerConnections.current[peerId];
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp)); // Remote SDP 설정
  };

  // ICE candidate 수신 처리
  const handleReceiveIceCandidate = async (data: { peerId: string, candidate: RTCIceCandidateInit }) => {
    const { peerId, candidate } = data;
    const peerConnection = peerConnections.current[peerId];
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); // ICE candidate 추가
  };

  // 메시지 전송
  const sendMessage = (destination: string, body: string) => {
    if (clientRef.current && isConnected) {
      clientRef.current.publish({ destination, body });
    }
  };

  // 모든 사용자에게 통화 요청 보내기
  const callAllUsers = async () => {
    //  애플리케이션 상태 또는 백엔드 엔드포인트에서 연결된 피어 ID 목록을 검색
    const peerIds = Object.keys(peerConnections.current);
    for (const peerId of peerIds) {
      callUser(peerId);
    }
  };

  // 특정 사용자에게 통화 요청 보내기
  const callUser = async (peerId: string) => {
    // 해당 사용자의 PeerConnection을 설정하고, Offer를 전송하여 통화 요청
    const peerConnection = setupPeerConnection(peerId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendMessage(`/api/pub/webrtc/${workspaceId}/offer`, JSON.stringify({ peerId, sdp: offer }));
  };

  // 마이크 음소거 토글
  // const toggleMute = () => {
  //   if (localStreamRef.current) {
  //     localStreamRef.current.getAudioTracks().forEach(track => {
  //       track.enabled = !track.enabled;
  //     });
  //     setIsMuted(!isMuted);
  //   }
  // };

  // 채팅 메시지 전송
  const handleSendMessage = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputMessage.trim() || !isConnected || !clientRef.current) {
      return;
    }

    clientRef.current.publish({
      destination: `/api/pub/chat/${workspaceId}`,
      body: JSON.stringify({
        messageType: 'TALK',
        message: inputMessage
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

      {participants.map(participant => (
        <div key={participant.id}>
          <h3>{participant.name}</h3>
          <AudioCapture key={participant.id} /> {/* 각 참가자에 대해 AudioCapture 컴포넌트를 렌더링 */}
        </div>
      ))}
    </div>
  );
};

export default App;