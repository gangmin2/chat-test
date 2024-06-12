import React, { useEffect, useRef, useState } from 'react'
import { StompConfig, Client } from '@stomp/stompjs';

const BASE_URI: string = 'ws://localhost:8080';
const TOKEN: string = 'accessToken';
const workspaceId: number = 1;
const username: string = 'user';

// 메시지 타입을 정의하는 인터페이스
interface Message {
  messageType: 'TALK' | 'ENTER' | 'EXIT';
  message: string;
  senderName: string;
}
interface PubMessage {
  messageType: 'TALK' | 'ENTER' | 'EXIT';
  message: string;
}

// Bubble 컴포넌트의 prop 타입을 정의하는 인터페이스
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
    return <div style={{ margin: '16px 0' }} >
      <p style={{ margin: '0', }}>{senderName}</p>
      <p style={{ backgroundColor: '#eee', width: 'fit-content', padding: '4px 8px', borderRadius: '8px', margin: '0', }}>{message}</p>
    </div>;
  }
  return null;
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    const client = new Client({
      brokerURL: `${BASE_URI}/api/ws`,
      connectHeaders: {
        Authorization: TOKEN,
      },
      debug: (str) => {
        console.log(str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        client.subscribe(`/api/sub/${workspaceId}`, (message) => {
          const newMessage = JSON.parse(message.body);
          setMessages((prevMessages) => [...prevMessages, newMessage]);
        });
        client.publish({
          destination: `/api/pub/${workspaceId}`,
          body: JSON.stringify({
            messageType: 'ENTER',
            message: `${username} 님이 입장했습니다.`,
          }),
          headers: { Authorization: TOKEN },
        });
      },
      onDisconnect: () => {
        client.publish({
          destination: `/api/pub/${workspaceId}`,
          body: JSON.stringify({
            messageType: 'EXIT',
            message: `${username} 님이 퇴장했습니다.`,
          }),
          headers: { Authorization: TOKEN },
        });
      },
    } as StompConfig);

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
    };
  }, [])

  const sendMessage = () => {
    if (!inputMessage) {
      return;
    }

    const message: PubMessage = {
      messageType: 'TALK',
      message: inputMessage,
    };

    const stringifiedMessage = JSON.stringify(message);

    clientRef.current?.publish({
      destination: `/api/pub/${workspaceId}`,
      body: stringifiedMessage,
      headers: { Authorization: TOKEN },
    });

    setInputMessage('');
  };

  return (
    <div>
      <div>
        채팅 (<span>4</span>)
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

      <form onSubmit={(e) => {
        e.preventDefault();
        sendMessage();
      }} >
        <input
          type="text"
          name="message"
          placeholder='채팅을 입력하세요'
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
        />
        <input type="submit" value="SEND" />
      </form>
    </div>
  );
};

export default App;
